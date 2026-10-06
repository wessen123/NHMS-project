"use strict";

const fs = require("fs");

const {
  validateSnapshot,
  buildReportModel,
  parseSnapshot,
  number,
  safeURL,
} = require("./report.model");


/* ============================================================
   PDF-ONLY REPORT REGENERATION

   IMPORTANT:
   This service must NEVER call OpenAI.

   It uses:
   - existing evaluation questionnaire/scores
   - existing current evaluation_results record
   - manually edited AI narrative already saved in evaluation_results
   - existing PDF generator

   It updates only:
   - pdf_report

   It must NOT overwrite:
   - ai_summary
   - ai_strengths
   - ai_weaknesses
   - ai_recommendations
   - ai_analysis_json
   - questionnaire answers
   - evaluation scores
============================================================ */

const active =
  new Map();


/* ============================================================
   ERROR HELPER
============================================================ */

function fail(
  message,
  code = "PDF_REGENERATION_FAILED"
) {

  const error =
    new Error(message);

  error.code =
    code;

  return error;
}


/* ============================================================
   SAFE ID
============================================================ */

function positiveId(
  value,
  label
) {

  if (
    typeof value === "number" &&
    !Number.isSafeInteger(value)
  ) {

    throw fail(
      `${label} must be sent as a string because it exceeds JavaScript's safe integer range`,
      "INVALID_INPUT"
    );
  }


  const result =
    String(
      value ?? ""
    ).trim();


  if (
    !/^[1-9]\d*$/.test(result)
  ) {

    throw fail(
      `${label} must be a positive numeric ID`,
      "INVALID_INPUT"
    );
  }


  return result;
}


/* ============================================================
   JSON FIELD PARSER
============================================================ */

function parseJSONField(
  value,
  label
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return null;
  }


  if (
    typeof value === "object" &&
    !Array.isArray(value)
  ) {

    return value;
  }


  if (
    typeof value !== "string"
  ) {

    throw fail(
      `${label} must be a JSON object`,
      "INVALID_REPORT_NARRATIVE"
    );
  }


  try {

    const parsed =
      JSON.parse(value);


    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {

      throw new Error(
        "Not an object"
      );
    }


    return parsed;

  } catch {

    throw fail(
      `${label} contains invalid JSON`,
      "INVALID_REPORT_NARRATIVE"
    );
  }
}


/* ============================================================
   CREATE NOCOBASE CLIENT
============================================================ */

async function createClient(
  injectedClient
) {

  if (injectedClient) {
    return injectedClient;
  }


  const base =
    process.env.NOCOBASE_URL ||
    process.env.BASE_URL;


  if (
    !base ||
    !process.env.NOCOBASE_TOKEN
  ) {

    throw fail(
      "Set NOCOBASE_URL (or BASE_URL) and NOCOBASE_TOKEN",
      "CONFIGURATION_ERROR"
    );
  }


  return require("axios")
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
        30000,
    });
}


/* ============================================================
   LOAD EVALUATION
============================================================ */

async function loadEvaluation(
  client,
  evaluationId
) {

  const response =
    await client.get(
      "/api/evaluation:get",
      {
        params: {
          filterByTk:
            evaluationId,
        },
      }
    );


  const record =
    response.data?.data;


  if (!record) {

    throw fail(
      `Evaluation ${evaluationId} was not found`,
      "EVALUATION_NOT_FOUND"
    );
  }


  if (
    String(record.id) !==
    String(evaluationId)
  ) {

    throw fail(
      "Evaluation ID mismatch",
      "EVALUATION_NOT_FOUND"
    );
  }


  return record;
}


/* ============================================================
   LOAD EVALUATION RESULT
============================================================ */

async function loadEvaluationResult(
  client,
  evaluationResultId
) {

  const response =
    await client.get(
      "/api/evaluation_results:get",
      {
        params: {
          filterByTk:
            evaluationResultId,

          appends: [
            "pdf_report",
          ],
        },
      }
    );


  const record =
    response.data?.data;


  if (!record) {

    throw fail(
      `Evaluation result ${evaluationResultId} was not found`,
      "RESULT_NOT_FOUND"
    );
  }


  if (
    String(record.id) !==
    String(evaluationResultId)
  ) {

    throw fail(
      "Evaluation result ID mismatch",
      "RESULT_NOT_FOUND"
    );
  }


  return record;
}


/* ============================================================
   GET QUESTIONNAIRE SNAPSHOT
============================================================ */

function getSnapshot(
  result,
  evaluation
) {

  /*
   * Prefer evaluation_results.responses_snapshot.
   *
   * That snapshot represents the questionnaire revision used
   * to create the current report.
   *
   * For older records without responses_snapshot,
   * fall back to evaluation.responses_json.
   */

  const raw =
    result.responses_snapshot ??
    evaluation.responses_json;


  return validateSnapshot(
    raw
  );
}


/* ============================================================
   SCORE SAFETY CHECK
============================================================ */

function assertScoreConsistency(
  result,
  evaluation,
  snapshot
) {

  const source =
    snapshot.evaluation;


  const checks = [
    [
      "evaluation_result.total_score",
      result.total_score,
      source.scores?.total_score,
    ],

    [
      "evaluation_result.percentage",
      result.percentage,
      source.scores?.percentage,
    ],

    [
      "evaluation.total_score",
      evaluation.total_score,
      source.scores?.total_score,
    ],

    [
      "evaluation.percentage",
      evaluation.percentage,
      source.scores?.percentage,
    ],
  ];


  for (
    const [
      label,
      actual,
      expected,
    ] of checks
  ) {

    if (
      actual === null ||
      actual === undefined ||
      actual === ""
    ) {

      continue;
    }


    const left =
      number(actual);

    const right =
      number(expected);


    if (
      left === null ||
      right === null ||
      Math.abs(
        left - right
      ) > 0.011
    ) {

      throw fail(
        `${label} does not match the saved questionnaire snapshot. PDF regeneration stopped so evaluation scores are not changed accidentally.`,
        "SCORE_MISMATCH"
      );
    }
  }
}


/* ============================================================
   GET MANUALLY EDITED AI NARRATIVE
============================================================ */

function getNarrativeSections(
  result
) {

  const analysis =
    parseJSONField(
      result.ai_analysis_json,
      "evaluation_results.ai_analysis_json"
    );


  if (
    !analysis
  ) {

    throw fail(
      "evaluation_results.ai_analysis_json is missing",
      "INVALID_REPORT_NARRATIVE"
    );
  }


  if (
    !Array.isArray(
      analysis.sections
    ) ||
    !analysis.sections.length
  ) {

    throw fail(
      "evaluation_results.ai_analysis_json.sections is missing. The six structured report narrative sections are required to regenerate the PDF.",
      "INVALID_REPORT_NARRATIVE"
    );
  }


  return {
    analysis,
    sections:
      analysis.sections,
  };
}


/* ============================================================
   LOAD FINAL EDITED VIDEO
============================================================ */

async function loadVideoURL(
  client,
  evaluation,
  source
) {

  const shopId =
    evaluation.nhms_shop_id ??
    source.shop?.id;


  if (!shopId) {
    return null;
  }


  if (
    evaluation.nhms_shop_id != null &&
    source.shop?.id != null &&
    String(
      evaluation.nhms_shop_id
    ) !==
      String(
        source.shop.id
      )
  ) {

    throw fail(
      "Evaluation shop differs from the saved questionnaire snapshot",
      "SHOP_MISMATCH"
    );
  }


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
          ],

          pageSize:
            2,
        },
      }
    );


  const videos =
    response.data?.data;


  if (
    !Array.isArray(videos)
  ) {

    throw fail(
      "Invalid edited video response",
      "VIDEO_LOOKUP_FAILED"
    );
  }


  if (
    videos.some(
      video =>
        String(
          video.nhms_shop_id
        ) !==
        String(shopId)
    )
  ) {

    throw fail(
      "Edited video belongs to another shop",
      "VIDEO_LOOKUP_FAILED"
    );
  }


  if (
    videos.length > 1
  ) {

    throw fail(
      "Multiple edited videos exist; confirm the final video selection rule before regenerating this report",
      "VIDEO_LOOKUP_FAILED"
    );
  }


  if (
    !videos.length
  ) {

    return null;
  }


  const url =
    safeURL(
      videos[0].url
    );


  if (!url) {

    throw fail(
      "Invalid edited video URL",
      "VIDEO_LOOKUP_FAILED"
    );
  }


  return url;
}


/* ============================================================
   BUILD REPORT DATA
============================================================ */

function buildReportData({
  evaluation,
  result,
  snapshot,
  sections,
  videoURL,
}) {

  const source =
    snapshot.evaluation;


  return {

    evaluation_id:
      evaluation.id,


    sales_rep_name:
      source.sales_rep?.full_name,


    community_name:
      source.metadata?.community_name,


    metadata:
      source.metadata,


    video_url:
      videoURL,


    /*
     * Preserve existing saved score.
     */

    total_score:
      result.total_score ??
      evaluation.total_score,


    percentage:
      result.percentage ??
      evaluation.percentage,


    /*
     * Questionnaire is NOT modified.
     */

    responses:
      snapshot,


    evaluator_note:
      source.final_evaluator_note,


    /*
     * Critical:
     *
     * These are the manually edited AI narrative sections
     * already saved in evaluation_results.ai_analysis_json.
     *
     * No OpenAI call happens here.
     */

    sections:
      sections,
  };
}


/* ============================================================
   VERIFY GENERATED PDF
============================================================ */

function verifyPDF(
  pdf
) {

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
        "Generated output is not a valid PDF",
        "PDF_GENERATION_FAILED"
      );
    }

  } finally {

    fs.closeSync(fd);
  }
}


/* ============================================================
   UPLOAD PDF TO NOCOBASE ATTACHMENTS
============================================================ */

async function uploadPDF(
  pdf,
  client,
  injectedUpload
) {

  if (
    injectedUpload
  ) {

    return injectedUpload(
      pdf,
      client
    );
  }


  const FormData =
    require("form-data");


  const form =
    new FormData();


  form.append(
    "file",
    fs.createReadStream(
      pdf.filePath
    ),
    pdf.fileName
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


  const attachment =
    response.data?.data;


  if (
    !attachment?.id
  ) {

    throw fail(
      "Attachment upload returned no ID; the existing report was not replaced",
      "PDF_UPLOAD_FAILED"
    );
  }


  return attachment;
}


/* ============================================================
   NARRATIVE FINGERPRINT

   Used to guarantee that this endpoint never changes
   manually edited AI content.
============================================================ */

function narrativeFingerprint(
  result
) {

  return JSON.stringify({

    ai_summary:
      result.ai_summary ??
      null,

    ai_strengths:
      result.ai_strengths ??
      null,

    ai_weaknesses:
      result.ai_weaknesses ??
      null,

    ai_recommendations:
      result.ai_recommendations ??
      null,

    ai_analysis_json:
      parseJSONField(
        result.ai_analysis_json,
        "evaluation_results.ai_analysis_json"
      ),
  });
}


/* ============================================================
   SOURCE FINGERPRINT

   Used to prevent publishing an old PDF if data changes
   while Puppeteer is rendering.
============================================================ */

function sourceFingerprint(
  evaluation,
  result,
  snapshot
) {

  return JSON.stringify({

    evaluation_id:
      String(
        evaluation.id
      ),

    result_id:
      String(
        result.id
      ),

    evaluation_updatedAt:
      evaluation.updatedAt ??
      null,

    narrative:
      narrativeFingerprint(
        result
      ),

    snapshot:
      parseSnapshot(
        snapshot
      ),

    total_score:
      result.total_score ??
      evaluation.total_score,

    percentage:
      result.percentage ??
      evaluation.percentage,
  });
}


/* ============================================================
   CREATE REGENERATOR
============================================================ */

function createRegenerator(
  deps = {}
) {

  return async function run({
    evaluationResultId,
    evaluationId,
  }) {

    const resultKey =
      positiveId(
        evaluationResultId,
        "evaluation_result_id"
      );


    const evaluationKey =
      positiveId(
        evaluationId,
        "evaluation_id"
      );


    const client =
      await createClient(
        deps.client
      );


    /* ========================================================
       LOAD RECORDS
    ======================================================== */

    const [
      evaluation,
      result,
    ] =
      await Promise.all([

        loadEvaluation(
          client,
          evaluationKey
        ),

        loadEvaluationResult(
          client,
          resultKey
        ),

      ]);


    /* ========================================================
       VERIFY RELATIONSHIP
    ======================================================== */

    if (
      String(
        result.evaluation_id
      ) !==
      evaluationKey
    ) {

      throw fail(
        "The evaluation result does not belong to the supplied evaluation",
        "RESULT_EVALUATION_MISMATCH"
      );
    }


    /* ========================================================
       VERIFY CURRENT RESULT

       Legacy records where is_current does not exist are allowed.
    ======================================================== */

    if (
      result.is_current === false
    ) {

      throw fail(
        "Only the current evaluation result can regenerate the client PDF",
        "RESULT_NOT_CURRENT"
      );
    }


    /* ========================================================
       LOAD QUESTIONNAIRE
    ======================================================== */

    const snapshot =
      getSnapshot(
        result,
        evaluation
      );


    /* ========================================================
       VERIFY SCORES
    ======================================================== */

    assertScoreConsistency(
      result,
      evaluation,
      snapshot
    );


    /* ========================================================
       LOAD SAVED MANUAL NARRATIVE
    ======================================================== */

    const {
      sections,
    } =
      getNarrativeSections(
        result
      );


    const source =
      snapshot.evaluation;


    /* ========================================================
       FINAL VIDEO URL
    ======================================================== */

    const videoURL =
      await loadVideoURL(
        client,
        evaluation,
        source
      );


    /* ========================================================
       BUILD PDF INPUT
    ======================================================== */

    const reportData =
      buildReportData({
        evaluation,
        result,
        snapshot,
        sections,
        videoURL,
      });


    /*
     * Validate using existing report model.
     */

    const reportModel =
      buildReportModel(
        reportData
      );


    /* ========================================================
       SAVE CURRENT DATA STATE
    ======================================================== */

    const beforeFingerprint =
      sourceFingerprint(
        evaluation,
        result,
        snapshot
      );


    /* ========================================================
       GENERATE PDF

       IMPORTANT:
       pdf.service.js does NOT call OpenAI.
    ======================================================== */

    const pdf =
      await (
        deps.generatePDF ||
        require("./pdf.service")
          .generatePDF
      )(
        reportData
      );


    verifyPDF(
      pdf
    );


    /* ========================================================
       CHECK DATA DID NOT CHANGE DURING PDF GENERATION
    ======================================================== */

    const [
      freshEvaluation,
      freshResult,
    ] =
      await Promise.all([

        loadEvaluation(
          client,
          evaluationKey
        ),

        loadEvaluationResult(
          client,
          resultKey
        ),

      ]);


    if (
      freshResult.is_current === false
    ) {

      throw fail(
        "The evaluation result stopped being current while the PDF was being generated",
        "RESULT_NOT_CURRENT"
      );
    }


    const freshSnapshot =
      getSnapshot(
        freshResult,
        freshEvaluation
      );


    const afterFingerprint =
      sourceFingerprint(
        freshEvaluation,
        freshResult,
        freshSnapshot
      );


    if (
      beforeFingerprint !==
      afterFingerprint
    ) {

      throw fail(
        "The evaluation or report narrative changed while the PDF was being generated. Regenerate again using the newest data.",
        "RESULT_CHANGED_DURING_REGENERATION"
      );
    }


    /* ========================================================
       UPLOAD NEW PDF
    ======================================================== */

    const attachment =
      await uploadPDF(
        pdf,
        client,
        deps.uploadPDF
      );


    /* ========================================================
       CHECK NARRATIVE AGAIN BEFORE SAVING PDF
    ======================================================== */

    const latestResult =
      await loadEvaluationResult(
        client,
        resultKey
      );


    if (
      latestResult.is_current === false
    ) {

      throw fail(
        "The evaluation result is no longer current",
        "RESULT_NOT_CURRENT"
      );
    }


    if (
      narrativeFingerprint(
        latestResult
      ) !==
      narrativeFingerprint(
        result
      )
    ) {

      throw fail(
        "The report narrative changed before the new PDF could be attached. Regenerate again from the newest manual edits.",
        "RESULT_CHANGED_DURING_REGENERATION"
      );
    }


    /* ========================================================
       UPDATE ONLY PDF ASSOCIATION

       DO NOT update:
       ai_summary
       ai_strengths
       ai_weaknesses
       ai_recommendations
       ai_analysis_json
       section scores
       total scores
    ======================================================== */

    const updatePayload = {

      pdf_report: [
        {
          id:
            attachment.id,
        },
      ],

    };


    await client.post(
      "/api/evaluation_results:update",
      updatePayload,
      {
        params: {
          filterByTk:
            resultKey,
        },
      }
    );


    /* ========================================================
       VERIFY SAVED PDF
    ======================================================== */

    const saved =
      await loadEvaluationResult(
        client,
        resultKey
      );


    const attached =
      Array.isArray(
        saved.pdf_report
      )
        ? saved.pdf_report
        : saved.pdf_report
          ? [
              saved.pdf_report,
            ]
          : [];


    if (
      !attached.some(
        item =>
          String(
            item.id
          ) ===
          String(
            attachment.id
          )
      )
    ) {

      throw fail(
        "The new PDF was uploaded but evaluation_results.pdf_report was not updated correctly",
        "PDF_SAVE_VERIFICATION_FAILED"
      );
    }


    /* ========================================================
       FINAL NARRATIVE SAFETY CHECK
    ======================================================== */

    if (
      narrativeFingerprint(
        saved
      ) !==
      narrativeFingerprint(
        result
      )
    ) {

      throw fail(
        "Narrative verification failed. PDF regeneration must never overwrite manually edited AI report content.",
        "NARRATIVE_CHANGED_UNEXPECTEDLY"
      );
    }


    /* ========================================================
       SUCCESS
    ======================================================== */

    return {

      success:
        true,

      evaluation_id:
        evaluationKey,

      evaluation_result_id:
        resultKey,

      attachment_id:
        String(
          attachment.id
        ),

      total_score:
        reportModel.total,

      percentage:
        reportModel.percentage,

      page_count:
        pdf.pageCount,

      score_verified:
        true,

      ai_called:
        false,

      narrative_preserved:
        true,

      report_issues:
        pdf.issues || [],
    };
  };
}


/* ============================================================
   MAIN REGENERATOR
============================================================ */

const run =
  createRegenerator();


/* ============================================================
   PUBLIC FUNCTION

   Prevent simultaneous regeneration for the same result.
============================================================ */

function regenerateReport({
  evaluationResultId,
  evaluationId,
}) {

  let resultKey;
  let evaluationKey;


  try {

    resultKey =
      positiveId(
        evaluationResultId,
        "evaluation_result_id"
      );


    evaluationKey =
      positiveId(
        evaluationId,
        "evaluation_id"
      );

  } catch (error) {

    return Promise.reject(
      error
    );
  }


  const activeKey =
    `${evaluationKey}:${resultKey}`;


  if (
    active.has(
      activeKey
    )
  ) {

    return active.get(
      activeKey
    );
  }


  const promise =
    run({
      evaluationResultId:
        resultKey,

      evaluationId:
        evaluationKey,
    })
      .finally(
        () => {

          active.delete(
            activeKey
          );

        }
      );


  active.set(
    activeKey,
    promise
  );


  return promise;
}


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {

  regenerateReport,

  createRegenerator,

};