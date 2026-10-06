"use strict";

const fs = require("fs");
const crypto = require("crypto");

const {
  validateSnapshot,
  buildReportModel,
  parseSnapshot,
  number,
  safeURL,
} = require("./report.model");

const {
  generateChartData,
} = require("./chart.service");

const {
  PROMPT_VERSION,
  validateAnalysis,
} = require("./openai.evaluation");


/* =========================================================
   CONFIGURATION
========================================================= */

const REPORT_VERSION = "nhms-pdf-v1";
const AI_ANALYSIS_SCHEMA_VERSION = "1.0";

const active = new Map();

const SCORE_TOLERANCE = 0.011;


/*
 * Canonical NHMS section configuration.
 *
 * Total = 100
 */
const SECTION_CONFIG = {
  approach: {
    label: "Approach",
    possible: 8,
    recordField: "approach_score",
  },

  qualifying: {
    label: "Qualifying",
    possible: 15,
    recordField: "qualifying_score",
  },

  demonstration: {
    label: "Demonstration",
    possible: 20,
    recordField: "demonstration_score",
  },

  presentation: {
    label: "Presentation",
    possible: 20,
    recordField: "presentation_score",
  },

  closing: {
    label: "Closing",
    possible: 22,
    recordField: "closing_score",
  },

  attitude: {
    label: "General Attitude",
    possible: 15,
    recordField: "attitude_score",
  },
};

const EXPECTED_SECTION_KEYS =
  Object.keys(SECTION_CONFIG);

const EXPECTED_TOTAL_POSSIBLE =
  Object.values(SECTION_CONFIG)
    .reduce(
      (sum, section) =>
        sum + section.possible,
      0
    );


/* =========================================================
   STABLE OBJECT / HASH
========================================================= */

function stable(value) {
  if (Array.isArray(value)) {
    return value.map(stable);
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          stable(value[key]),
        ])
    );
  }

  return value;
}


function hash(value) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify(
        stable(value)
      )
    )
    .digest("hex");
}


/* =========================================================
   ERROR HELPER
========================================================= */

function fail(
  message,
  code = "EVALUATION_PROCESSING_ERROR"
) {
  const error =
    new Error(message);

  error.code = code;

  return error;
}


/* =========================================================
   BASIC HELPERS
========================================================= */

function id(value) {
  if (
    typeof value === "number" &&
    !Number.isSafeInteger(value)
  ) {
    throw fail(
      "Send large IDs as strings",
      "UNSAFE_EVALUATION_ID"
    );
  }

  const result =
    String(
      value ?? ""
    ).trim();

  if (
    !/^[1-9]\d*$/.test(
      result
    )
  ) {
    throw fail(
      "A positive numeric evaluationId is required",
      "INVALID_EVALUATION_ID"
    );
  }

  return result;
}


function numeric(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}


function round2(value) {
  return Number(
    Number(value)
      .toFixed(2)
  );
}


function approximatelyEqual(
  left,
  right,
  tolerance =
    SCORE_TOLERANCE
) {
  const a =
    numeric(left);

  const b =
    numeric(right);

  if (
    a === null ||
    b === null
  ) {
    return false;
  }

  return (
    Math.abs(a - b) <=
    tolerance
  );
}


function normalize(value) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}


function safeJSON(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value === "object"
  ) {
    return value;
  }

  if (
    typeof value !== "string"
  ) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}


function clone(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}


/* =========================================================
   STAR DETECTION
========================================================= */

function getStar(question) {
  const displayMark =
    String(
      question?.display_mark ??
      ""
    ).trim();

  const gradingType =
    normalize(
      question?.grading_type
    );

  /*
   * Check ** before *.
   */
  if (
    displayMark.includes("**") ||
    gradingType === "**" ||
    gradingType.includes(
      "some"
    )
  ) {
    return "**";
  }

  if (
    displayMark.includes("*") ||
    gradingType === "*" ||
    gradingType.includes(
      "limited"
    )
  ) {
    return "*";
  }

  return null;
}


/* =========================================================
   ANSWER NORMALIZATION
========================================================= */

function normalizeAnswer(value) {
  const answer =
    normalize(value);

  if (
    answer === "yes"
  ) {
    return "yes";
  }

  if (
    answer === "no"
  ) {
    return "no";
  }

  if (
    answer === "n/a" ||
    answer === "na" ||
    answer === "not applicable"
  ) {
    return "na";
  }

  if (
    answer === "nmd" ||
    answer.includes(
      "not much discussed"
    )
  ) {
    return "nmd";
  }

  if (
    answer === "some" ||
    answer === "**"
  ) {
    return "some";
  }

  if (
    answer === "limited" ||
    answer === "*"
  ) {
    return "limited";
  }

  return answer;
}


/* =========================================================
   QUESTION VALIDATION

   NHMS RULES

   YES:
     earned = possible

   N/A:
     earned = possible
     full numeric credit
     neutral evidence

   NO:
     no star => earned = 0

   NMD *:
     earned >= 0
     earned < possible

   NMD **:
     earned > 0
     earned < possible

   NO *:
     limited partial credit

   NO **:
     some partial credit

   Informational:
     does not affect score
========================================================= */

function validateQuestion(
  question,
  {
    sectionKey,
    sectionTitle,
    questionIndex,
  }
) {
  if (
    !question ||
    typeof question !==
      "object"
  ) {
    throw fail(
      `Invalid question in ${sectionTitle} at position ${questionIndex + 1}`,
      "INVALID_QUESTION"
    );
  }

  const label =
    question.question ||
    question.number ||
    question.id ||
    `question ${questionIndex + 1}`;

  const informational =
    !!question.informational;

  const rawAnswer =
    question.answer;

  if (
    rawAnswer === null ||
    rawAnswer === undefined ||
    String(rawAnswer)
      .trim() === ""
  ) {
    throw fail(
      `Incomplete evaluation: "${label}" in ${sectionTitle} has no saved answer`,
      "QUESTION_NOT_ANSWERED"
    );
  }

  const answer =
    normalizeAnswer(
      rawAnswer
    );

  const star =
    getStar(question);

  /*
   * Informational questions do not
   * participate in numeric scoring.
   */
  if (informational) {
    return {
      informational: true,
      answer,
      star,
      earned: 0,
      possible: 0,
    };
  }

  const possible =
    numeric(
      question.possible
    );

  const earned =
    numeric(
      question.earned
    );

  if (
    possible === null ||
    possible <= 0
  ) {
    throw fail(
      `Invalid possible score for "${label}" in ${sectionTitle}`,
      "INVALID_QUESTION_POSSIBLE"
    );
  }

  if (
    earned === null
  ) {
    throw fail(
      `Missing earned score for "${label}" in ${sectionTitle}`,
      "MISSING_QUESTION_SCORE"
    );
  }

  if (
    earned < 0 ||
    earned >
      possible +
        SCORE_TOLERANCE
  ) {
    throw fail(
      `Invalid earned score ${earned}/${possible} for "${label}" in ${sectionTitle}`,
      "INVALID_QUESTION_SCORE"
    );
  }


  /* =====================================================
     YES
  ===================================================== */

  if (
    answer === "yes"
  ) {
    if (
      !approximatelyEqual(
        earned,
        possible
      )
    ) {
      throw fail(
        `YES must receive full credit for "${label}" in ${sectionTitle}. Saved ${earned}/${possible}`,
        "YES_SCORE_MISMATCH"
      );
    }
  }


  /* =====================================================
     N/A
  ===================================================== */

  else if (
    answer === "na"
  ) {
    if (
      !approximatelyEqual(
        earned,
        possible
      )
    ) {
      throw fail(
        `N/A must receive full credit for "${label}" in ${sectionTitle}. Saved ${earned}/${possible}`,
        "NA_SCORE_MISMATCH"
      );
    }
  }


  /* =====================================================
     NMD
  ===================================================== */

  else if (
    answer === "nmd"
  ) {
    if (
      star !== "*" &&
      star !== "**"
    ) {
      throw fail(
        `NMD requires * or ** for "${label}" in ${sectionTitle}`,
        "NMD_STAR_REQUIRED"
      );
    }

    if (
      earned >=
      possible -
        SCORE_TOLERANCE
    ) {
      throw fail(
        `NMD ${star} cannot receive full credit for "${label}" in ${sectionTitle}`,
        "NMD_FULL_CREDIT_NOT_ALLOWED"
      );
    }

    if (
      star === "**" &&
      earned <= 0
    ) {
      throw fail(
        `NMD ** must receive some credit for "${label}" in ${sectionTitle}`,
        "NMD_SOME_CREDIT_REQUIRED"
      );
    }
  }


  /* =====================================================
     NO
  ===================================================== */

  else if (
    answer === "no"
  ) {
    if (!star) {
      if (
        !approximatelyEqual(
          earned,
          0
        )
      ) {
        throw fail(
          `Plain NO must receive zero points for "${label}" in ${sectionTitle}. Saved ${earned}/${possible}`,
          "NO_SCORE_MISMATCH"
        );
      }
    } else {
      if (
        earned >=
        possible -
          SCORE_TOLERANCE
      ) {
        throw fail(
          `NO ${star} cannot receive full credit for "${label}" in ${sectionTitle}`,
          "NO_STAR_FULL_CREDIT_NOT_ALLOWED"
        );
      }

      if (
        star === "**" &&
        earned <= 0
      ) {
        throw fail(
          `NO ** must receive some credit for "${label}" in ${sectionTitle}`,
          "NO_SOME_CREDIT_REQUIRED"
        );
      }
    }
  }


  /* =====================================================
     DIRECT SOME / LIMITED
  ===================================================== */

  else if (
    answer === "some"
  ) {
    if (
      earned <= 0 ||
      earned >=
        possible -
          SCORE_TOLERANCE
    ) {
      throw fail(
        `Some credit answer must be greater than zero and below full credit for "${label}"`,
        "SOME_SCORE_INVALID"
      );
    }
  }

  else if (
    answer === "limited"
  ) {
    if (
      earned >=
      possible -
        SCORE_TOLERANCE
    ) {
      throw fail(
        `Limited credit cannot equal full credit for "${label}"`,
        "LIMITED_SCORE_INVALID"
      );
    }
  }

  else {
    throw fail(
      `Unsupported answer "${rawAnswer}" for "${label}" in ${sectionTitle}`,
      "UNSUPPORTED_ANSWER"
    );
  }


  return {
    informational: false,
    answer,
    star,
    earned,
    possible,
  };
}


/* =========================================================
   COMPLETE SNAPSHOT / SCORE VALIDATION
========================================================= */

function validateSubmittedEvaluation(
  record,
  expectedId
) {
  if (
    !record ||
    String(record.id) !==
      expectedId
  ) {
    throw fail(
      "Evaluation not found or ID mismatch",
      "EVALUATION_NOT_FOUND"
    );
  }


  /* =====================================================
     STATUS
  ===================================================== */

  if (
    record.status ===
    "pending"
  ) {
    throw fail(
      "Evaluation is still pending/draft and cannot generate a report",
      "EVALUATION_NOT_SUBMITTED"
    );
  }

  if (
    ![
      "submitted",
      "processed",
    ].includes(
      record.status
    )
  ) {
    throw fail(
      `Unsupported evaluation status: ${record.status}`,
      "INVALID_EVALUATION_STATUS"
    );
  }

  if (
    !record.submitted_at
  ) {
    throw fail(
      "Submitted evaluation is missing submitted_at",
      "MISSING_SUBMITTED_AT"
    );
  }


  /* =====================================================
     RESPONSES JSON
  ===================================================== */

  const snapshot =
    validateSnapshot(
      record.responses_json
    );

  const evaluation =
    snapshot.evaluation;

  if (
    !evaluation ||
    typeof evaluation !==
      "object"
  ) {
    throw fail(
      "responses_json.evaluation is missing",
      "MISSING_EVALUATION_SNAPSHOT"
    );
  }

  if (
    evaluation.draft ===
    true
  ) {
    throw fail(
      "Evaluation snapshot is still marked as draft",
      "SNAPSHOT_STILL_DRAFT"
    );
  }

  if (
    !Array.isArray(
      evaluation.sections
    )
  ) {
    throw fail(
      "Evaluation sections are missing",
      "MISSING_SECTIONS"
    );
  }


  /* =====================================================
     SECTION PRESENCE
  ===================================================== */

  if (
    evaluation.sections.length !==
      EXPECTED_SECTION_KEYS.length
  ) {
    throw fail(
      `Expected ${EXPECTED_SECTION_KEYS.length} evaluation sections, received ${evaluation.sections.length}`,
      "SECTION_COUNT_MISMATCH"
    );
  }

  const seenSections =
    new Set();

  let calculatedTotal =
    0;

  let calculatedPossible =
    0;

  const calculatedSections =
    {};


  for (
    const section of
    evaluation.sections
  ) {
    const sectionKey =
      String(
        section?.key ??
        ""
      ).trim();

    if (
      !EXPECTED_SECTION_KEYS.includes(
        sectionKey
      )
    ) {
      throw fail(
        `Unexpected evaluation section: ${sectionKey || "missing key"}`,
        "UNKNOWN_SECTION"
      );
    }

    if (
      seenSections.has(
        sectionKey
      )
    ) {
      throw fail(
        `Duplicate evaluation section: ${sectionKey}`,
        "DUPLICATE_SECTION"
      );
    }

    seenSections.add(
      sectionKey
    );

    const config =
      SECTION_CONFIG[
        sectionKey
      ];

    const sectionTitle =
      section.title ||
      config.label;

    if (
      !Array.isArray(
        section.questions
      ) ||
      section.questions.length ===
        0
    ) {
      throw fail(
        `${sectionTitle} contains no questionnaire items`,
        "EMPTY_SECTION"
      );
    }


    /* ===================================================
       VALIDATE QUESTIONS
    =================================================== */

    let questionEarnedTotal =
      0;

    let questionPossibleTotal =
      0;

    section.questions.forEach(
      (
        question,
        index
      ) => {
        const validated =
          validateQuestion(
            question,
            {
              sectionKey,
              sectionTitle,
              questionIndex:
                index,
            }
          );

        if (
          !validated.informational
        ) {
          questionEarnedTotal +=
            validated.earned;

          questionPossibleTotal +=
            validated.possible;
        }
      }
    );

    questionEarnedTotal =
      round2(
        questionEarnedTotal
      );

    questionPossibleTotal =
      round2(
        questionPossibleTotal
      );


    /* ===================================================
       SECTION POSSIBLE
    =================================================== */

    if (
      !approximatelyEqual(
        questionPossibleTotal,
        config.possible
      )
    ) {
      throw fail(
        `${sectionTitle} questionnaire possible points total ${questionPossibleTotal}, expected ${config.possible}`,
        "SECTION_POSSIBLE_MISMATCH"
      );
    }

    const savedPossible =
      numeric(
        section.possible_score ??
        section.possible
      );

    if (
      savedPossible === null ||
      !approximatelyEqual(
        savedPossible,
        config.possible
      )
    ) {
      throw fail(
        `${sectionTitle} saved possible score is ${savedPossible}, expected ${config.possible}`,
        "SAVED_SECTION_POSSIBLE_MISMATCH"
      );
    }


    /* ===================================================
       SECTION EARNED
    =================================================== */

    const savedSectionScore =
      numeric(
        section.section_score ??
        section.score
      );

    if (
      savedSectionScore ===
      null
    ) {
      throw fail(
        `${sectionTitle} is missing section_score`,
        "MISSING_SECTION_SCORE"
      );
    }

    if (
      !approximatelyEqual(
        savedSectionScore,
        questionEarnedTotal
      )
    ) {
      throw fail(
        `${sectionTitle} section score ${savedSectionScore} does not match question total ${questionEarnedTotal}`,
        "SECTION_SCORE_MISMATCH"
      );
    }


    /* ===================================================
       TOP-LEVEL EVALUATION FIELD
    =================================================== */

    const recordSectionScore =
      numeric(
        record[
          config.recordField
        ]
      );

    if (
      recordSectionScore ===
      null
    ) {
      throw fail(
        `Evaluation.${config.recordField} is missing`,
        "MISSING_RECORD_SECTION_SCORE"
      );
    }

    if (
      !approximatelyEqual(
        recordSectionScore,
        questionEarnedTotal
      )
    ) {
      throw fail(
        `Evaluation.${config.recordField} (${recordSectionScore}) does not match ${sectionTitle} question total (${questionEarnedTotal})`,
        "RECORD_SECTION_SCORE_MISMATCH"
      );
    }


    calculatedSections[
      sectionKey
    ] = {
      score:
        questionEarnedTotal,

      possible:
        questionPossibleTotal,

      percentage:
        questionPossibleTotal > 0
          ? round2(
              (
                questionEarnedTotal /
                questionPossibleTotal
              ) *
                100
            )
          : 0,
    };

    calculatedTotal +=
      questionEarnedTotal;

    calculatedPossible +=
      questionPossibleTotal;
  }


  /* =====================================================
     ALL REQUIRED SECTIONS PRESENT
  ===================================================== */

  for (
    const key of
    EXPECTED_SECTION_KEYS
  ) {
    if (
      !seenSections.has(key)
    ) {
      throw fail(
        `Required section ${key} is missing`,
        "REQUIRED_SECTION_MISSING"
      );
    }
  }

  calculatedTotal =
    round2(
      calculatedTotal
    );

  calculatedPossible =
    round2(
      calculatedPossible
    );


  /* =====================================================
     TOTAL POSSIBLE MUST BE 100
  ===================================================== */

  if (
    !approximatelyEqual(
      calculatedPossible,
      EXPECTED_TOTAL_POSSIBLE
    )
  ) {
    throw fail(
      `Questionnaire possible score is ${calculatedPossible}, expected ${EXPECTED_TOTAL_POSSIBLE}`,
      "TOTAL_POSSIBLE_MISMATCH"
    );
  }


  /* =====================================================
     SNAPSHOT SCORES
  ===================================================== */

  const snapshotTotal =
    numeric(
      evaluation.scores
        ?.total_score ??
      evaluation.total_score
    );

  if (
    snapshotTotal ===
    null ||
    !approximatelyEqual(
      snapshotTotal,
      calculatedTotal
    )
  ) {
    throw fail(
      `Snapshot total score ${snapshotTotal} does not match calculated total ${calculatedTotal}`,
      "SNAPSHOT_TOTAL_MISMATCH"
    );
  }


  /* =====================================================
     RECORD TOTAL
  ===================================================== */

  const recordTotal =
    numeric(
      record.total_score
    );

  if (
    recordTotal ===
    null ||
    !approximatelyEqual(
      recordTotal,
      calculatedTotal
    )
  ) {
    throw fail(
      `Evaluation total_score ${recordTotal} does not match calculated total ${calculatedTotal}`,
      "RECORD_TOTAL_MISMATCH"
    );
  }


  /* =====================================================
     PERCENTAGE
  ===================================================== */

  const calculatedPercentage =
    calculatedPossible > 0
      ? round2(
          (
            calculatedTotal /
            calculatedPossible
          ) *
            100
        )
      : 0;

  const snapshotPercentage =
    numeric(
      evaluation.scores
        ?.percentage ??
      evaluation.percentage
    );

  if (
    snapshotPercentage ===
    null ||
    !approximatelyEqual(
      snapshotPercentage,
      calculatedPercentage
    )
  ) {
    throw fail(
      `Snapshot percentage ${snapshotPercentage} does not match calculated percentage ${calculatedPercentage}`,
      "SNAPSHOT_PERCENTAGE_MISMATCH"
    );
  }

  const recordPercentage =
    numeric(
      record.percentage
    );

  if (
    recordPercentage ===
    null ||
    !approximatelyEqual(
      recordPercentage,
      calculatedPercentage
    )
  ) {
    throw fail(
      `Evaluation percentage ${recordPercentage} does not match calculated percentage ${calculatedPercentage}`,
      "RECORD_PERCENTAGE_MISMATCH"
    );
  }


  /* =====================================================
     BASIC RELATION IDS
  ===================================================== */

  if (
    !record.nhms_shop_id
  ) {
    throw fail(
      "Submitted evaluation is missing nhms_shop_id",
      "MISSING_SHOP_ID"
    );
  }

  if (
    !record.evaluator_id
  ) {
    throw fail(
      "Submitted evaluation is missing evaluator_id",
      "MISSING_EVALUATOR_ID"
    );
  }

  if (
    !record.sales_rep_id
  ) {
    throw fail(
      "Submitted evaluation is missing sales_rep_id",
      "MISSING_SALES_REP_ID"
    );
  }


  /* =====================================================
     SHOP ID SNAPSHOT CHECK
  ===================================================== */

  if (
    evaluation.shop?.id !=
      null &&
    String(
      evaluation.shop.id
    ) !==
      String(
        record.nhms_shop_id
      )
  ) {
    throw fail(
      "Evaluation shop does not match the saved questionnaire shop",
      "SHOP_ID_MISMATCH"
    );
  }


  return {
    snapshot,

    evaluation,

    calculated: {
      total_score:
        calculatedTotal,

      max_score:
        calculatedPossible,

      percentage:
        calculatedPercentage,

      sections:
        calculatedSections,
    },
  };
}


/* =========================================================
   RECORD FINGERPRINT

   Intentionally excludes:
   - ai_status
   - ai_payload_json
   - updatedAt
   - updatedBy

   Those processing fields can change without changing the
   evaluator's actual submitted evaluation.
========================================================= */

function recordFingerprint(
  record
) {
  return hash({
    id:
      String(
        record?.id ??
        ""
      ),

    responses:
      parseSnapshot(
        record?.responses_json
      ),

    total_score:
      record?.total_score,

    percentage:
      record?.percentage,

    approach_score:
      record?.approach_score,

    qualifying_score:
      record?.qualifying_score,

    demonstration_score:
      record?.demonstration_score,

    presentation_score:
      record?.presentation_score,

    closing_score:
      record?.closing_score,

    attitude_score:
      record?.attitude_score,

    submitted_at:
      record?.submitted_at,

    status:
      record?.status,

    nhms_shop_id:
      record?.nhms_shop_id,

    sales_rep_id:
      record?.sales_rep_id,

    evaluator_id:
      record?.evaluator_id,
  });
}


/* =========================================================
   VERIFY AI ONLY CHANGED NOTES
========================================================= */

function withoutRefinableNotes(
  value
) {
  const copy =
    clone(value);

  delete copy
    .final_evaluator_note;

  if (
    Array.isArray(
      copy.sections
    )
  ) {
    for (
      const section of
      copy.sections
    ) {
      delete section
        .evaluator_section_note;
    }
  }

  return copy;
}


function verifyNotesOnlyMutation(
  source,
  refined
) {
  if (
    hash(
      withoutRefinableNotes(
        source
      )
    ) !==
    hash(
      withoutRefinableNotes(
        refined
      )
    )
  ) {
    throw fail(
      "AI note refinement changed questionnaire data other than evaluator notes",
      "AI_CHANGED_NON_NOTE_DATA"
    );
  }
}


/* =========================================================
   RESULT HELPERS
========================================================= */

function resultSourceHash(
  result
) {
  if (!result) {
    return null;
  }

  if (
    result.source_hash
  ) {
    return String(
      result.source_hash
    );
  }

  const ai =
    safeJSON(
      result.ai_analysis_json
    );

  return ai
    ?.source?.source_hash ||
    ai?.source_hash ||
    null;
}


function resultRevision(
  result
) {
  const value =
    numeric(
      result
        ?.evaluation_revision
    );

  return value === null
    ? 0
    : Math.max(
        0,
        Math.trunc(value)
      );
}


function getCurrentResult(
  rows
) {
  const current =
    rows.filter(
      (row) =>
        row.is_current ===
          true ||
        row.is_current ===
          1 ||
        row.is_current ===
          "true"
    );

  if (
    current.length > 1
  ) {
    throw fail(
      "More than one evaluation result is marked current",
      "MULTIPLE_CURRENT_RESULTS"
    );
  }

  if (
    current.length === 1
  ) {
    return current[0];
  }

  /*
   * Compatibility with legacy results created before
   * is_current existed.
   *
   * Pick latest completed record only as a fallback.
   */
  const legacy =
    rows
      .filter(
        (row) =>
          row.status ===
            "completed"
      )
      .sort(
        (a, b) => {
          const revDiff =
            resultRevision(b) -
            resultRevision(a);

          if (revDiff !== 0) {
            return revDiff;
          }

          return (
            new Date(
              b.updatedAt ||
              b.createdAt ||
              0
            ).getTime() -
            new Date(
              a.updatedAt ||
              a.createdAt ||
              0
            ).getTime()
          );
        }
      );

  return legacy[0] ||
    null;
}


function nextRevision(
  rows
) {
  const maxRevision =
    rows.reduce(
      (max, row) =>
        Math.max(
          max,
          resultRevision(row)
        ),
      0
    );

  return maxRevision > 0
    ? maxRevision + 1
    : 1;
}


/* =========================================================
   CREATE PROCESSOR
========================================================= */

function createProcessor(
  deps = {}
) {
  return async function run(
    evaluationId
  ) {
    const evaluationKey =
      id(evaluationId);

    let client =
      deps.client;


    /* =====================================================
       NOCOBASE CLIENT
    ===================================================== */

    if (!client) {
      const base =
        process.env
          .NOCOBASE_URL ||
        process.env
          .BASE_URL;

      if (
        !base ||
        !process.env
          .NOCOBASE_TOKEN
      ) {
        throw fail(
          "Set NOCOBASE_URL (or BASE_URL) and NOCOBASE_TOKEN",
          "NOCOBASE_CONFIG_MISSING"
        );
      }

      client =
        require("axios")
          .create({
            baseURL:
              base.replace(
                /\/+$/,
                ""
              ),

            headers: {
              Authorization:
                `Bearer ${process.env.NOCOBASE_TOKEN}`,
            },

            timeout:
              120000,
          });
    }


    /* =====================================================
       NOCOBASE HELPERS
    ===================================================== */

    const getEvaluation =
      async () => {
        const response =
          await client.get(
            "/api/evaluation:get",
            {
              params: {
                filterByTk:
                  evaluationKey,
              },
            }
          );

        return response.data
          ?.data;
      };


    const updateEvaluation =
      async (payload) => {
        const response =
          await client.post(
            "/api/evaluation:update",
            payload,
            {
              params: {
                filterByTk:
                  evaluationKey,
              },
            }
          );

        return response.data
          ?.data;
      };


    const getResults =
      async () => {
        const response =
          await client.get(
            "/api/evaluation_results:list",
            {
              params: {
                filter:
                  JSON.stringify({
                    evaluation_id: {
                      $eq:
                        evaluationKey,
                    },
                  }),

                pageSize:
                  100,

                sort:
                  "-createdAt",

                appends: [
                  "pdf_report",
                ],
              },
            }
          );

        const rows =
          response.data
            ?.data;

        if (
          !Array.isArray(
            rows
          )
        ) {
          throw fail(
            "Invalid evaluation_results response",
            "INVALID_RESULTS_RESPONSE"
          );
        }

        return rows;
      };


    const getResultById =
      async (resultId) => {
        const response =
          await client.get(
            "/api/evaluation_results:get",
            {
              params: {
                filterByTk:
                  String(
                    resultId
                  ),

                appends: [
                  "pdf_report",
                ],
              },
            }
          );

        return response.data
          ?.data;
      };


    const updateResult =
      async (
        resultId,
        payload
      ) => {
        const response =
          await client.post(
            "/api/evaluation_results:update",
            payload,
            {
              params: {
                filterByTk:
                  String(
                    resultId
                  ),
              },
            }
          );

        return response.data
          ?.data;
      };


    /* =====================================================
       STATE USED BY ERROR HANDLER
    ===================================================== */

    let startingRecord =
      null;

    let intendedRevision =
      null;

    let processingSourceHash =
      null;


    try {
      /* ===================================================
         LOAD EVALUATION
      =================================================== */

      startingRecord =
        await getEvaluation();

      const initial =
        validateSubmittedEvaluation(
          startingRecord,
          evaluationKey
        );

      let workingRecord =
        startingRecord;

      let workingSnapshot =
        initial.snapshot;

      let workingSource =
        initial.evaluation;


      /* ===================================================
         EXISTING REPORT HISTORY
      =================================================== */

      let resultRows =
        await getResults();

      let currentResult =
        getCurrentResult(
          resultRows
        );

      const preAIHash =
        hash(
          workingSnapshot
        );


      /* ===================================================
         ALREADY CURRENT / NO MEANINGFUL CHANGE

         This also repairs a situation where:
         - result was successfully created
         - final Evaluation status update failed
      =================================================== */

      if (
        currentResult &&
        currentResult.status ===
          "completed" &&
        resultSourceHash(
          currentResult
        ) ===
          preAIHash
      ) {
        if (
          currentResult.is_current !==
            true
        ) {
          await updateResult(
            currentResult.id,
            {
              is_current: true,
            }
          );
        }

        await updateEvaluation({
          status:
            "processed",

          ai_status:
            "completed",

          ai_payload_json: {
            schema_version:
              "1.0",

            state:
              "completed",

            source_hash:
              preAIHash,

            evaluation_revision:
              resultRevision(
                currentResult
              ) || 1,

            prompt_version:
              currentResult
                .ai_prompt_version ||
              PROMPT_VERSION,

            report_version:
              currentResult
                .report_version ||
              REPORT_VERSION,

            result_id:
              String(
                currentResult.id
              ),

            processed_at:
              currentResult
                .processed_at ||
              new Date()
                .toISOString(),

            no_change:
              true,

            recovered_existing_result:
              true,
          },
        });

        return {
          success: true,

          changed: false,

          report_regenerated:
            false,

          recovered_existing_result:
            true,

          evaluation_id:
            startingRecord.id,

          result_id:
            currentResult.id,

          evaluation_revision:
            resultRevision(
              currentResult
            ) || 1,

          source_hash:
            preAIHash,

          total_score:
            initial
              .calculated
              .total_score,

          percentage:
            initial
              .calculated
              .percentage,

          message:
            "No evaluation changes detected. Existing current report remains valid.",
        };
      }


      /* ===================================================
         PROCESSED RECORD WITH DIFFERENT SOURCE

         Save Changes should reset the frontend record to:
           status = submitted
           ai_status = submitted

         If it didn't, reject the inconsistent state rather
         than silently regenerate.
      =================================================== */

      if (
        workingRecord.status ===
          "processed"
      ) {
        throw fail(
          "Evaluation data differs from the current report, but status is still processed. Save Changes must reset status to submitted before regeneration.",
          "PROCESSED_EVALUATION_CHANGED"
        );
      }


      /* ===================================================
         VALID AI STATUS
      =================================================== */

      if (
        ![
          "submitted",
          "failed",
          "retrying",
        ].includes(
          workingRecord.ai_status
        )
      ) {
        throw fail(
          `Submitted evaluation has invalid ai_status "${workingRecord.ai_status}". Expected submitted, failed, or retrying.`,
          "INVALID_AI_STATUS"
        );
      }


      /* ===================================================
         REVISION NUMBER
      =================================================== */

      intendedRevision =
        nextRevision(
          resultRows
        );

      processingSourceHash =
        preAIHash;


      /* ===================================================
         MARK PROCESSING / RETRYING
      =================================================== */

      const processingStartedAt =
        new Date()
          .toISOString();

      const previousPayload =
        safeJSON(
          workingRecord
            .ai_payload_json
        ) || {};

      const previousAttempt =
        numeric(
          previousPayload.attempt
        ) || 0;

      const attempt =
        previousAttempt + 1;

      await updateEvaluation({
        ai_status:
          workingRecord.ai_status ===
            "failed"
            ? "retrying"
            : "submitted",

        ai_payload_json: {
          schema_version:
            "1.0",

          state:
            workingRecord
              .ai_status ===
              "failed"
              ? "retrying"
              : "processing",

          source_hash:
            preAIHash,

          evaluation_revision:
            intendedRevision,

          prompt_version:
            PROMPT_VERSION,

          report_version:
            REPORT_VERSION,

          attempt,

          started_at:
            processingStartedAt,

          completed_at:
            null,

          failed_at:
            null,

          last_error:
            null,

          notes_updated:
            false,

          scores_verified:
            true,

          pdf_verified:
            false,
        },
      });


      /* ===================================================
         CAPTURE FINGERPRINT BEFORE AI

         ai_status / ai_payload_json do not affect this.
      =================================================== */

      let expectedFingerprint =
        recordFingerprint(
          workingRecord
        );


      /* ===================================================
         GENERATE AI

         openai.evaluation.js:
         - refines evaluator notes
         - interprets scores
         - generates report analysis
      =================================================== */

      const ai =
        await (
          deps.generateInsights ||
          require(
            "./openai.evaluation"
          ).generateInsights
        )(
          workingSource
        );


      validateAnalysis(ai);

      const refinedSource =
        ai.refined_evaluation;

      if (
        !refinedSource
      ) {
        throw fail(
          "AI did not return refined_evaluation",
          "MISSING_REFINED_EVALUATION"
        );
      }


      /* ===================================================
         AI MAY CHANGE NOTES ONLY
      =================================================== */

      verifyNotesOnlyMutation(
        workingSource,
        refinedSource
      );


      /* ===================================================
         CHECK EVALUATOR DID NOT SAVE CHANGES WHILE AI RAN
      =================================================== */

      const beforeNoteSave =
        await getEvaluation();

      validateSubmittedEvaluation(
        beforeNoteSave,
        evaluationKey
      );

      if (
        recordFingerprint(
          beforeNoteSave
        ) !==
        expectedFingerprint
      ) {
        throw fail(
          "Evaluation changed while AI was processing. The report was not published; process the newest saved revision.",
          "EVALUATION_CHANGED_DURING_AI"
        );
      }


      /* ===================================================
         SAVE AI-REFINED NOTES INTO EVALUATION DATABASE
      =================================================== */

      const refinedSnapshot = {
        ...workingSnapshot,

        evaluation:
          refinedSource,
      };

      await updateEvaluation({
        responses_json:
          refinedSnapshot,

        evaluator_note:
          refinedSource
            .final_evaluator_note ||
          "",
      });


      /* ===================================================
         RE-READ / VERIFY REFINED NOTES REALLY SAVED
      =================================================== */

      workingRecord =
        await getEvaluation();

      const refinedValidation =
        validateSubmittedEvaluation(
          workingRecord,
          evaluationKey
        );

      workingSnapshot =
        refinedValidation.snapshot;

      workingSource =
        refinedValidation.evaluation;

      if (
        hash(
          workingSnapshot
        ) !==
        hash(
          refinedSnapshot
        )
      ) {
        throw fail(
          "AI-refined notes were not saved exactly as expected",
          "REFINED_NOTES_SAVE_MISMATCH"
        );
      }

      verifyNotesOnlyMutation(
        initial.evaluation,
        workingSource
      );


      /* ===================================================
         FINAL SOURCE HASH

         This is the exact database snapshot used by the PDF.
      =================================================== */

      const sourceHash =
        hash(
          workingSnapshot
        );

      processingSourceHash =
        sourceHash;

      expectedFingerprint =
        recordFingerprint(
          workingRecord
        );


      /* ===================================================
         BUILD REPORT MODEL BEFORE CREATING FILES
      =================================================== */

      buildReportModel({
        responses:
          workingSnapshot,

        total_score:
          workingRecord
            .total_score,

        percentage:
          workingRecord
            .percentage,
      });


      /* ===================================================
         FINAL EDITED VIDEO

         Failure to find a video does NOT fail the report.
      =================================================== */

      const shopId =
        workingRecord
          .nhms_shop_id ??
        workingSource
          .shop?.id;

      let editedVideo =
        null;

      let videoURL =
        null;

      if (shopId) {
        try {
          const response =
            await client.get(
              "/api/edited_videos:list",
              {
                params: {
                  filter:
                    JSON.stringify({
                      nhms_shop_id: {
                        $eq:
                          String(
                            shopId
                          ),
                      },
                    }),

                  fields: [
                    "id",
                    "nhms_shop_id",
                    "url",
                    "updatedAt",
                    "createdAt",
                  ],

                  sort:
                    "-updatedAt",

                  pageSize:
                    10,
                },
              }
            );

          const videos =
            response.data
              ?.data;

          if (
            Array.isArray(
              videos
            )
          ) {
            for (
              const video of
              videos
            ) {
              if (
                String(
                  video
                    .nhms_shop_id
                ) !==
                String(
                  shopId
                )
              ) {
                continue;
              }

              const candidate =
                safeURL(
                  video.url
                );

              if (candidate) {
                editedVideo =
                  video;

                videoURL =
                  candidate;

                break;
              }
            }
          }
        } catch (error) {
          console.warn(
            "[NHMS report] Edited video lookup failed; continuing without video:",
            error.message
          );
        }
      }


      /* ===================================================
         REPORT DATA
      =================================================== */

      const reportData = {
        evaluation_id:
          workingRecord.id,

        sales_rep_name:
          workingSource
            .sales_rep
            ?.full_name,

        community_name:
          workingSource
            .metadata
            ?.community_name,

        metadata:
          workingSource
            .metadata,

        video_url:
          videoURL,

        edited_video_url:
          videoURL,

        total_score:
          workingRecord
            .total_score,

        percentage:
          workingRecord
            .percentage,

        responses:
          workingSnapshot,

        evaluator_note:
          workingSource
            .final_evaluator_note,

        sections:
          ai.sections,
      };


      /* ===================================================
         REPORT MODEL
      =================================================== */

      const reportModel =
        buildReportModel(
          reportData
        );


      /* ===================================================
         FINAL SCORE VERIFICATION AGAIN
      =================================================== */

      if (
        !approximatelyEqual(
          reportModel.total,
          refinedValidation
            .calculated
            .total_score
        ) ||
        !approximatelyEqual(
          reportModel.possible,
          refinedValidation
            .calculated
            .max_score
        ) ||
        !approximatelyEqual(
          reportModel.percentage,
          refinedValidation
            .calculated
            .percentage
        )
      ) {
        throw fail(
          "Report model scores differ from validated evaluation scores",
          "REPORT_MODEL_SCORE_MISMATCH"
        );
      }


      /* ===================================================
         GENERATE PDF
      =================================================== */

      const pdf =
        await (
          deps.generatePDF ||
          require(
            "./pdf.service"
          ).generatePDF
        )(
          reportData
        );

      if (
        !pdf?.filePath ||
        !fs.existsSync(
          pdf.filePath
        )
      ) {
        throw fail(
          "PDF generation failed",
          "PDF_GENERATION_FAILED"
        );
      }


      /* ===================================================
         VERIFY REAL PDF SIGNATURE
      =================================================== */

      const fd =
        fs.openSync(
          pdf.filePath,
          "r"
        );

      try {
        const signature =
          Buffer.alloc(5);

        fs.readSync(
          fd,
          signature,
          0,
          5,
          0
        );

        if (
          signature.toString() !==
          "%PDF-"
        ) {
          throw fail(
            "Generated file is not a valid PDF",
            "INVALID_PDF"
          );
        }
      } finally {
        fs.closeSync(fd);
      }


      /* ===================================================
         ASSERT EVALUATION STILL UNCHANGED
      =================================================== */

      const assertEvaluationUnchanged =
        async () => {
          const latest =
            await getEvaluation();

          validateSubmittedEvaluation(
            latest,
            evaluationKey
          );

          if (
            recordFingerprint(
              latest
            ) !==
            expectedFingerprint
          ) {
            throw fail(
              "Evaluation changed during report generation. The generated report was not published.",
              "EVALUATION_CHANGED_DURING_REPORT"
            );
          }
        };


      await assertEvaluationUnchanged();


      /* ===================================================
         CAPTURE RESULT HISTORY BEFORE NEW RESULT
      =================================================== */

      resultRows =
        await getResults();

      currentResult =
        getCurrentResult(
          resultRows
        );

      const resultsBeforeHash =
        hash(
          resultRows.map(
            (row) => ({
              id:
                String(
                  row.id
                ),

              source_hash:
                resultSourceHash(
                  row
                ),

              evaluation_revision:
                resultRevision(
                  row
                ),

              status:
                row.status,

              is_current:
                row.is_current,

              updatedAt:
                row.updatedAt,
            })
          )
        );


      /* ===================================================
         UPLOAD PDF
      =================================================== */

      let attachment;

      if (
        deps.uploadPDF
      ) {
        attachment =
          await deps.uploadPDF(
            pdf,
            client
          );
      } else {
        const FormData =
          require(
            "form-data"
          );

        const form =
          new FormData();

        form.append(
          "file",
          fs.createReadStream(
            pdf.filePath
          )
        );

        const response =
          await client.post(
            "/api/attachments:create",
            form,
            {
              headers:
                form.getHeaders(),
            }
          );

        attachment =
          response.data
            ?.data;
      }

      if (
        !attachment?.id
      ) {
        throw fail(
          "PDF attachment upload returned no ID",
          "PDF_UPLOAD_FAILED"
        );
      }


      await assertEvaluationUnchanged();


      /* ===================================================
         ENSURE RESULT HISTORY DID NOT CHANGE CONCURRENTLY
      =================================================== */

      const resultsImmediatelyBeforeCreate =
        await getResults();

      const currentResultsHash =
        hash(
          resultsImmediatelyBeforeCreate.map(
            (row) => ({
              id:
                String(
                  row.id
                ),

              source_hash:
                resultSourceHash(
                  row
                ),

              evaluation_revision:
                resultRevision(
                  row
                ),

              status:
                row.status,

              is_current:
                row.is_current,

              updatedAt:
                row.updatedAt,
            })
          )
        );

      if (
        currentResultsHash !==
        resultsBeforeHash
      ) {
        throw fail(
          "Evaluation result history changed while the report was being generated",
          "RESULT_HISTORY_CHANGED"
        );
      }


      /* ===================================================
         CANONICAL AI ANALYSIS JSON
      =================================================== */

      const processedAt =
        new Date()
          .toISOString();

      const aiAnalysisJSON = {
        schema_version:
          AI_ANALYSIS_SCHEMA_VERSION,

        report_version:
          REPORT_VERSION,

        prompt_version:
          PROMPT_VERSION,


        source: {
          evaluation_id:
            String(
              workingRecord.id
            ),

          evaluation_revision:
            intendedRevision,

          source_hash:
            sourceHash,

          submitted_at:
            workingRecord
              .submitted_at,
        },


        model: {
          provider:
            "openai",

          model:
            ai.ai_model ||
            process.env
              .OPENAI_MODEL ||
            "gpt-4o-mini",

          input_tokens:
            numeric(
              ai.input_tokens
            ) || 0,

          output_tokens:
            numeric(
              ai.output_tokens
            ) || 0,

          processing_time_ms:
            numeric(
              ai.processing_time_ms
            ) || 0,

          attempts:
            numeric(
              ai.analysis_attempts
            ) || 1,
        },


        score: {
          total_score:
            reportModel.total,

          max_score:
            reportModel.possible,

          percentage:
            reportModel.percentage,

          sections:
            Object.fromEntries(
              reportModel.sections
                .map(
                  (
                    section
                  ) => [
                    section.key,
                    {
                      score:
                        section.earned,

                      possible:
                        section.possible,

                      percentage:
                        section.percentage,
                    },
                  ]
                )
            ),
        },


        executive_summary:
          ai.executive_summary,


        sections:
          ai.sections.map(
            (section) => ({
              title:
                section.title,

              summary:
                section.summary,

              strengths:
                Array.isArray(
                  section.strengths
                )
                  ? section.strengths
                  : [],

              opportunities:
                Array.isArray(
                  section.opportunities
                )
                  ? section.opportunities
                  : [],
            })
          ),


        refined_notes:
          Array.isArray(
            ai.refined_notes
          )
            ? ai.refined_notes
            : [],


        validation: {
          questionnaire_complete:
            true,

          scoring_rules_verified:
            true,

          section_scores_verified:
            true,

          total_score_verified:
            true,

          database_scores_verified:
            true,

          source_unchanged:
            true,

          notes_only_mutation_verified:
            true,

          refined_notes_saved:
            true,

          pdf_verified:
            true,
        },


        video: {
          found:
            !!videoURL,

          edited_video_id:
            editedVideo?.id
              ? String(
                  editedVideo.id
                )
              : null,

          url:
            videoURL,
        },


        generated_at:
          processedAt,
      };


      /* ===================================================
         EVALUATION RESULT PAYLOAD

         Create non-current first.

         We do NOT touch the previous current result yet.
      =================================================== */

      const resultPayload = {
        evaluation_id:
          workingRecord.id,

        total_score:
          reportModel.total,

        max_score:
          reportModel.possible,

        percentage:
          reportModel.percentage,


        section_scores:
          Object.fromEntries(
            reportModel.sections
              .map(
                (
                  section
                ) => [
                  section.key,
                  {
                    score:
                      section.earned,

                    possible:
                      section.possible,

                    percentage:
                      section.percentage,
                  },
                ]
              )
          ),


        ai_summary:
          ai.executive_summary,

        ai_strengths:
          ai.sections
            .flatMap(
              (section) =>
                section.strengths ||
                []
            )
            .join("\n"),

        ai_weaknesses:
          ai.sections
            .flatMap(
              (section) =>
                section.opportunities ||
                []
            )
            .join("\n"),

        ai_recommendations:
          ai.sections
            .flatMap(
              (section) =>
                section.opportunities ||
                []
            )
            .slice(
              0,
              10
            )
            .join("\n"),


        ai_model:
          ai.ai_model ||
          process.env
            .OPENAI_MODEL ||
          "gpt-4o-mini",

        ai_prompt_version:
          PROMPT_VERSION,

        input_tokens:
          numeric(
            ai.input_tokens
          ) || 0,

        output_tokens:
          numeric(
            ai.output_tokens
          ) || 0,

        processing_time_ms:
          numeric(
            ai.processing_time_ms
          ) || 0,


        status:
          "completed",

        processed_at:
          processedAt,

        error_message:
          null,


        responses_snapshot:
          workingSnapshot,


        industry_benchmark_comparison:
          generateChartData(
            workingSource
          ),


        ai_analysis_json:
          aiAnalysisJSON,


        source_hash:
          sourceHash,

        evaluation_revision:
          intendedRevision,

        report_version:
          REPORT_VERSION,

        is_current:
          false,


        pdf_report: [
          {
            id:
              attachment.id,
          },
        ],
      };


      /* ===================================================
         CREATE NEW VERSIONED RESULT
      =================================================== */

      const createdResponse =
        await client.post(
          "/api/evaluation_results:create",
          resultPayload
        );

      const createdResult =
        createdResponse.data
          ?.data;

      if (
        !createdResult?.id
      ) {
        throw fail(
          "New evaluation result was not created",
          "RESULT_CREATE_FAILED"
        );
      }


      /* ===================================================
         VERIFY NEW RESULT BEFORE MAKING IT CURRENT
      =================================================== */

      let savedResult =
        await getResultById(
          createdResult.id
        );

      if (
        !savedResult
      ) {
        throw fail(
          "Created evaluation result could not be reloaded",
          "RESULT_RELOAD_FAILED"
        );
      }

      const savedAI =
        safeJSON(
          savedResult
            .ai_analysis_json
        );

      const savedAttachments =
        Array.isArray(
          savedResult
            .pdf_report
        )
          ? savedResult
              .pdf_report
          : savedResult
              ?.pdf_report
            ? [
                savedResult
                  .pdf_report,
              ]
            : [];


      const scoreMatches =
        approximatelyEqual(
          savedResult
            .total_score,
          reportModel.total
        ) &&
        approximatelyEqual(
          savedResult
            .max_score,
          reportModel.possible
        ) &&
        approximatelyEqual(
          savedResult
            .percentage,
          reportModel
            .percentage
        );


      const sourceMatches =
        String(
          savedResult
            .source_hash ||
          savedAI
            ?.source
            ?.source_hash ||
          ""
        ) ===
          sourceHash;


      const revisionMatches =
        Number(
          savedResult
            .evaluation_revision
        ) ===
          Number(
            intendedRevision
          );


      const attachmentMatches =
        savedAttachments.some(
          (item) =>
            String(
              item?.id
            ) ===
            String(
              attachment.id
            )
        );


      const aiMatches =
        !!savedAI &&
        savedAI
          ?.executive_summary ===
          ai.executive_summary &&
        Array.isArray(
          savedAI.sections
        ) &&
        savedAI.sections.length ===
          ai.sections.length;


      if (
        !scoreMatches ||
        !sourceMatches ||
        !revisionMatches ||
        !attachmentMatches ||
        !aiMatches
      ) {
        console.error(
          "[NHMS report] New result verification failed",
          {
            result_id:
              savedResult.id,

            checks: {
              scoreMatches,
              sourceMatches,
              revisionMatches,
              attachmentMatches,
              aiMatches,
            },

            expected: {
              total_score:
                reportModel.total,

              max_score:
                reportModel
                  .possible,

              percentage:
                reportModel
                  .percentage,

              source_hash:
                sourceHash,

              evaluation_revision:
                intendedRevision,

              attachment_id:
                attachment.id,
            },
          }
        );

        throw fail(
          "New evaluation result failed verification. Previous current report remains unchanged.",
          "RESULT_VERIFICATION_FAILED"
        );
      }


      /* ===================================================
         ONE LAST SOURCE CHECK
      =================================================== */

      await assertEvaluationUnchanged();


      /* ===================================================
         SWITCH CURRENT RESULT SAFELY

         1. New result -> current
         2. Old result -> superseded

         If old result update fails, try to roll new result
         back to non-current.
      =================================================== */

      await updateResult(
        savedResult.id,
        {
          is_current: true,
        }
      );


      if (
        currentResult &&
        String(
          currentResult.id
        ) !==
          String(
            savedResult.id
          )
      ) {
        try {
          await updateResult(
            currentResult.id,
            {
              is_current:
                false,

              status:
                "superseded",
            }
          );
        } catch (error) {
          try {
            await updateResult(
              savedResult.id,
              {
                is_current:
                  false,
              }
            );
          } catch (
            rollbackError
          ) {
            console.error(
              "[NHMS report] Current-result rollback failed:",
              rollbackError.message
            );
          }

          throw fail(
            `Could not supersede previous report: ${error.message}`,
            "CURRENT_RESULT_SWITCH_FAILED"
          );
        }
      }


      /* ===================================================
         VERIFY EXACTLY ONE CURRENT RESULT
      =================================================== */

      resultRows =
        await getResults();

      const currentRows =
        resultRows.filter(
          (row) =>
            row.is_current ===
              true ||
            row.is_current ===
              1 ||
            row.is_current ===
              "true"
        );

      if (
        currentRows.length !==
        1 ||
        String(
          currentRows[0].id
        ) !==
          String(
            savedResult.id
          )
      ) {
        throw fail(
          "Current report verification failed after result switch",
          "CURRENT_RESULT_VERIFICATION_FAILED"
        );
      }


      /* ===================================================
         MARK EVALUATION PROCESSED

         Only now is the evaluation considered completely
         processed.
      =================================================== */

      await updateEvaluation({
        status:
          "processed",

        ai_status:
          "completed",

        ai_payload_json: {
          schema_version:
            "1.0",

          state:
            "completed",

          source_hash:
            sourceHash,

          evaluation_revision:
            intendedRevision,

          prompt_version:
            PROMPT_VERSION,

          report_version:
            REPORT_VERSION,

          attempt,

          started_at:
            processingStartedAt,

          completed_at:
            processedAt,

          failed_at:
            null,

          last_error:
            null,

          notes_updated:
            true,

          scores_verified:
            true,

          pdf_verified:
            true,

          result_id:
            String(
              savedResult.id
            ),

          attachment_id:
            String(
              attachment.id
            ),
        },
      });


      /* ===================================================
         FINAL EVALUATION STATE VERIFICATION
      =================================================== */

      const finalEvaluation =
        await getEvaluation();

      if (
        finalEvaluation
          ?.status !==
          "processed" ||
        finalEvaluation
          ?.ai_status !==
          "completed"
      ) {
        throw fail(
          "Evaluation result succeeded but final Evaluation lifecycle state was not saved",
          "FINAL_STATE_SAVE_FAILED"
        );
      }


      /* ===================================================
         SUCCESS
      =================================================== */

      return {
        success: true,

        changed: true,

        report_regenerated:
          true,

        evaluation_id:
          workingRecord.id,

        result_id:
          savedResult.id,

        previous_result_id:
          currentResult?.id ||
          null,

        attachment_id:
          attachment.id,

        evaluation_revision:
          intendedRevision,

        report_version:
          REPORT_VERSION,

        source_hash:
          sourceHash,

        score_verified:
          true,

        questionnaire_verified:
          true,

        section_scores_verified:
          true,

        refined_notes_saved:
          true,

        ai_analysis_saved:
          true,

        current_result_verified:
          true,

        total_score:
          reportModel.total,

        max_score:
          reportModel.possible,

        percentage:
          reportModel.percentage,

        page_count:
          pdf.pageCount,

        edited_video_found:
          !!videoURL,

        edited_video_id:
          editedVideo?.id ||
          null,

        edited_video_url:
          videoURL,

        notes_requiring_attention:
          (
            ai.refined_notes ||
            []
          )
            .filter(
              (note) =>
                [
                  "insufficient",
                  "review_needed",
                ].includes(
                  note.status
                )
            )
            .map(
              (note) => ({
                key:
                  note.key,

                status:
                  note.status,
              })
            ),

        report_issues:
          pdf.issues ||
          [],
      };
    } catch (error) {
      /* ===================================================
         PROCESSING FAILURE

         Keep the existing current report untouched.

         Only submitted evaluations are marked AI failed.
      =================================================== */

      console.error(
        "[NHMS report] Processing failed:",
        {
          evaluation_id:
            evaluationKey,

          code:
            error.code ||
            "EVALUATION_PROCESSING_ERROR",

          message:
            error.message,
        }
      );


      try {
        const latest =
          await getEvaluation();

        if (
          latest &&
          latest.status ===
            "submitted"
        ) {
          const previous =
            safeJSON(
              latest
                .ai_payload_json
            ) || {};

          await updateEvaluation({
            ai_status:
              "failed",

            ai_payload_json: {
              ...previous,

              schema_version:
                "1.0",

              state:
                "failed",

              source_hash:
                processingSourceHash ||
                previous
                  .source_hash ||
                null,

              evaluation_revision:
                intendedRevision ||
                previous
                  .evaluation_revision ||
                null,

              prompt_version:
                PROMPT_VERSION,

              report_version:
                REPORT_VERSION,

              failed_at:
                new Date()
                  .toISOString(),

              completed_at:
                null,

              last_error: {
                code:
                  error.code ||
                  "EVALUATION_PROCESSING_ERROR",

                message:
                  error.message,
              },

              pdf_verified:
                false,
            },
          });
        }
      } catch (
        stateError
      ) {
        console.error(
          "[NHMS report] Could not save failure state:",
          stateError.message
        );
      }

      throw error;
    }
  };
}


/* =========================================================
   PROCESSOR
========================================================= */

const run =
  createProcessor();


/* =========================================================
   PROCESS EVALUATION

   Prevent duplicate simultaneous generation for the
   same evaluation inside this Node process.
========================================================= */

function processEvaluation(
  evaluationId
) {
  let key;

  try {
    key =
      id(
        evaluationId
      );
  } catch (error) {
    return Promise.reject(
      error
    );
  }

  if (
    active.has(key)
  ) {
    return active.get(
      key
    );
  }

  const promise =
    run(key)
      .finally(
        () =>
          active.delete(
            key
          )
      );

  active.set(
    key,
    promise
  );

  return promise;
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  processEvaluation,
  createProcessor,

  validateSubmittedEvaluation,
  validateQuestion,
  verifyNotesOnlyMutation,

  recordFingerprint,
  hash,

  REPORT_VERSION,
};