"use strict";

const SCHEMA =
  require("../templates/questionnaire.schema.json");

const TOPICS =
  require("../templates/analysis.sections");


/* =========================================================
   SECTION DEFINITIONS
========================================================= */

const SECTION_DEFINITIONS = [
  "approach",
  "qualifying",
  "demonstration",
  "closing",
  "presentation",
  "attitude",
].map((key) => {

  const s =
    SCHEMA.find(
      (section) =>
        section.key === key
    );

  const titleMap = {
    approach:
      "Approach",
    qualifying:
      "Qualifying",
    demonstration:
      "Demonstration",
    closing:
      "Close",
    presentation:
      "Presentation",
    attitude:
      "General Attitude",
  };

  return [
    key,
    titleMap[key],
    s.possible_score,
  ];
});


/* =========================================================
   NUMBER
========================================================= */

const number =
  (value) => {

    if (
      value === null ||
      value === undefined ||
      typeof value === "boolean"
    ) {
      return null;
    }

    if (
      ![
        "number",
        "string",
      ].includes(
        typeof value
      )
    ) {
      return null;
    }

    if (
      String(value)
        .trim() === ""
    ) {
      return null;
    }

    const parsed =
      Number(value);

    if (
      !Number.isFinite(
        parsed
      )
    ) {
      return null;
    }

    return parsed;
  };


/* =========================================================
   TEXT
========================================================= */

const text =
  (value) => {

    return (
      typeof value ===
        "string"
        ? value.trim()
        : ""
    );
  };


/* =========================================================
   NEAR
========================================================= */

const near =
  (a, b) => {

    return (
      a !== null &&
      b !== null &&
      Math.abs(
        a - b
      ) <= 0.011
    );
  };


/* =========================================================
   PARSE SNAPSHOT
========================================================= */

function parseSnapshot(
  value
) {

  if (
    typeof value ===
    "string"
  ) {

    try {

      value =
        JSON.parse(
          value
        );

    } catch {

      throw new Error(
        "Invalid responses_json JSON"
      );

    }

  }


  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {

    throw new Error(
      "responses_json must be an object"
    );

  }


  return value;
}


/* =========================================================
   SAFE URL
========================================================= */

function safeURL(
  value
) {

  try {

    const u =
      new URL(
        value
      );


    if (
      ![
        "https:",
        "http:",
      ].includes(
        u.protocol
      )
    ) {

      return null;

    }


    if (
      u.username ||
      u.password
    ) {

      return null;

    }


    return u.href;

  } catch {

    return null;

  }
}


/* =========================================================
   FORMAT DATE

   Supports:

   2026-09-30
   2026-09-30T12:31:52.908Z
   9/30/2026
   09/30/2026
========================================================= */

function formatDate(
  value
) {

  const raw =
    String(
      value || ""
    ).trim();


  if (
    !raw
  ) {

    return null;

  }


  /* =====================================================
     YYYY-MM-DD / ISO
  ===================================================== */

  let m =
    /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/
      .exec(
        raw
      );


  if (
    m
  ) {

    const [
      y,
      mo,
      d,
    ] =
      m
        .slice(
          1
        )
        .map(
          Number
        );


    const date =
      new Date(
        Date.UTC(
          y,
          mo - 1,
          d
        )
      );


    if (
      date.getUTCFullYear() !==
        y ||
      date.getUTCMonth() !==
        mo - 1 ||
      date.getUTCDate() !==
        d
    ) {

      return null;

    }


    return (
      date
        .toLocaleDateString(
          "en-US",
          {
            month:
              "long",
            day:
              "numeric",
            year:
              "numeric",
            timeZone:
              "UTC",
          }
        )
    );

  }


  /* =====================================================
     M/D/YYYY / MM/DD/YYYY
  ===================================================== */

  m =
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
      .exec(
        raw
      );


  if (
    m
  ) {

    const mo =
      Number(
        m[1]
      );

    const d =
      Number(
        m[2]
      );

    const y =
      Number(
        m[3]
      );


    const date =
      new Date(
        Date.UTC(
          y,
          mo - 1,
          d
        )
      );


    if (
      date.getUTCFullYear() !==
        y ||
      date.getUTCMonth() !==
        mo - 1 ||
      date.getUTCDate() !==
        d
    ) {

      return null;

    }


    return (
      date
        .toLocaleDateString(
          "en-US",
          {
            month:
              "long",
            day:
              "numeric",
            year:
              "numeric",
            timeZone:
              "UTC",
          }
        )
    );

  }


  return null;
}


/* =========================================================
   TODAY DATE
========================================================= */

function todayDate() {

  return (
    new Date()
      .toLocaleDateString(
        "en-US",
        {
          month:
            "long",
          day:
            "numeric",
          year:
            "numeric",
          timeZone:
            "Africa/Addis_Ababa",
        }
      )
  );
}


/* =========================================================
   COLUMNS
========================================================= */

function columns(
  q
) {

  const numeric =
    q.informational
      ? ""
      : String(
          q.earned
        );


  switch (
    q.answer
  ) {

    case "yes":

      return {
        yes:
          q.informational
            ? "YES"
            : numeric,

        no:
          "",

        mark:
          "YES",
      };


    case "no":

      return {
        yes:
          "",

        no:
          q.informational
            ? "NO"
            : "0",

        mark:
          "NO",
      };


    case "na":

      return {
        yes:
          numeric,

        no:
          "N/A",

        mark:
          "N/A",
      };


    case "limited":

      return {
        yes:
          numeric,

        no:
          "*",

        mark:
          "*",
      };


    case "some":

      return {
        yes:
          numeric,

        no:
          "**",

        mark:
          "**",
      };


    case "nmd":

      return {
        yes:
          numeric,

        no:
          "NMD",

        mark:
          "NMD",
      };


    default:

      throw new Error(
        `Unsupported answer at ${
          q.id ||
          "question"
        }`
      );
  }
}


/* =========================================================
   VALIDATE SNAPSHOT
========================================================= */

function validateSnapshot(
  value
) {

  const snapshot =
    parseSnapshot(
      value
    );


  const source =
    snapshot.evaluation;


  const fail =
    (message) => {

      throw new Error(
        `Report validation: ${message}`
      );

    };


  if (
    !source ||
    !Array.isArray(
      source.sections
    )
  ) {

    fail(
      "missing evaluation.sections"
    );

  }


  if (
    source.draft ===
      true ||
    !source.metadata
      ?.submitted_at
  ) {

    fail(
      "submit the evaluation before generating a report"
    );

  }


  if (
    source.sections
      .length !==
    SCHEMA.length
  ) {

    fail(
      "expected exactly six sections"
    );

  }


  for (
    const spec of
    SCHEMA
  ) {

    const found =
      source.sections
        .filter(
          (s) =>
            s.key ===
            spec.key
        );


    if (
      found.length !==
      1
    ) {

      fail(
        `missing/duplicate section ${spec.key}`
      );

    }


    const s =
      found[0];


    if (
      !near(
        number(
          s.possible_score
        ),
        spec.possible_score
      )
    ) {

      fail(
        `possible score differs for ${spec.key}`
      );

    }


    if (
      !Array.isArray(
        s.questions
      ) ||
      s.questions
        .length !==
      spec.questions
        .length
    ) {

      fail(
        `question count differs for ${spec.key}`
      );

    }


    let earned =
      0;


    for (
      const expected of
      spec.questions
    ) {

      const matches =
        s.questions
          .filter(
            (q) =>
              q.id ===
              expected.id
          );


      if (
        matches.length !==
        1
      ) {

        fail(
          `missing/duplicate question ${expected.id}`
        );

      }


      const q =
        matches[0];


      const informational =
        expected.informational ===
        true;


      if (
        q.informational !==
        informational
      ) {

        fail(
          `informational flag differs at ${q.id}`
        );

      }


      if (
        !text(
          q.question
        )
      ) {

        fail(
          `question text missing at ${q.id}`
        );

      }


      if (
        informational
      ) {

        if (
          q.possible !==
            null ||
          q.earned !==
            null
        ) {

          fail(
            `informational item must have null scores at ${q.id}`
          );

        }

      } else {

        const points =
          number(
            q.earned
          );


        const max =
          number(
            q.possible
          );


        if (
          !near(
            max,
            expected.possible
          ) ||
          points ===
            null ||
          points <
            0 ||
          points >
            max
        ) {

          fail(
            `invalid points at ${q.id}`
          );

        }


        if (
          [
            "yes",
            "na",
          ].includes(
            q.answer
          ) &&
          !near(
            points,
            max
          )
        ) {

          fail(
            `YES/N/A must receive full credit at ${q.id}`
          );

        }


        if (
          q.answer ===
            "no" &&
          points !==
            0
        ) {

          fail(
            `NO must receive zero at ${q.id}`
          );

        }


        earned +=
          points;

      }


      const c =
        columns(
          q
        );


      if (
        q.grading_type !=
          null &&
        q.grading_type !==
          q.answer
      ) {

        fail(
          `grading_type mismatch at ${q.id}`
        );

      }


      if (
        q.display_mark !=
          null &&
        q.display_mark !==
          c.mark
      ) {

        fail(
          `display_mark mismatch at ${q.id}`
        );

      }


      for (
        const [
          key,
          v,
        ] of [
          [
            "yes_column",
            c.yes,
          ],
          [
            "no_column",
            c.no,
          ],
        ]
      ) {

        if (
          q[key] !=
            null &&
          String(
            q[key]
          ) !==
            v
        ) {

          fail(
            `${key} mismatch at ${q.id}`
          );

        }

      }

    }


    if (
      !near(
        number(
          s.section_score
        ),
        earned
      )
    ) {

      fail(
        `section sum mismatch for ${s.key}`
      );

    }


    if (
      s.efficiency_rating !=
        null &&
      !near(
        number(
          s.efficiency_rating
        ),
        earned
      )
    ) {

      fail(
        `efficiency rating mismatch for ${s.key}`
      );

    }

  }


  const total =
    source.sections
      .reduce(
        (
          sum,
          s
        ) =>
          sum +
          number(
            s.section_score
          ),
        0
      );


  if (
    !near(
      number(
        source.scores
          ?.total_score
      ),
      total
    ) ||
    !near(
      number(
        source.scores
          ?.possible_score
      ),
      100
    ) ||
    !near(
      number(
        source.scores
          ?.percentage
      ),
      total
    )
  ) {

    fail(
      "total, possible score, or percentage mismatch"
    );

  }


  return snapshot;
}


/* =========================================================
   BUILD REPORT MODEL
========================================================= */

function buildReportModel(
  data
) {

  const snapshot =
    validateSnapshot(
      data.responses
    );


  const source =
    snapshot.evaluation;


  const issues =
    [];


  const metadata =
    data.metadata ||
    source.metadata ||
    {};


  /* =====================================================
     REPRESENTATIVE
  ===================================================== */

  const name =
    text(
      data.sales_rep_name
    ) ||

    text(
      source.sales_rep
        ?.full_name
    ) ||

    text(
      source.shop
        ?.sales_rep_name
    ) ||

    [
      text(
        source.sales_rep
          ?.first_name
      ),
      text(
        source.sales_rep
          ?.last_name
      ),
    ]
      .filter(
        Boolean
      )
      .join(
        " "
      );


  /* =====================================================
     COMMUNITY
  ===================================================== */

  const community =
    text(
      data.community_name
    ) ||

    text(
      metadata
        .community_name
    ) ||

    text(
      source.community
        ?.name
    );


  /* =====================================================
     VISIT DATE

     Fallback order:

     1. metadata.shop_date
     2. source.shop.shop_date
     3. metadata.evaluation_date
     4. metadata.submitted_at
     5. today's date
  ===================================================== */

  let visitDate =
    formatDate(
      metadata
        .shop_date
    ) ||

    formatDate(
      source.shop
        ?.shop_date
    ) ||

    formatDate(
      metadata
        .evaluation_date
    ) ||

    formatDate(
      metadata
        .submitted_at
    );


  if (
    !visitDate
  ) {

    visitDate =
      todayDate();


    issues.push({
      code:
        "missing_visit_date_used_today",

      field:
        "metadata.shop_date",

      severity:
        "warning",
    });

  }


  /* =====================================================
     REQUIRED IDENTITY
  ===================================================== */

  if (
    !name
  ) {

    throw new Error(
      "Sales representative name is required"
    );

  }


  if (
    !community
  ) {

    throw new Error(
      "Community name is required"
    );

  }


  /* =====================================================
     SCORE VALIDATION
  ===================================================== */

  for (
    const key of [
      "total_score",
      "percentage",
    ]
  ) {

    if (
      data[key] !=
        null &&
      !near(
        number(
          data[key]
        ),
        number(
          source.scores[
            key
          ]
        )
      )
    ) {

      throw new Error(
        `Evaluation ${key} differs from its snapshot`
      );

    }

  }


  /* =====================================================
     SECTIONS
  ===================================================== */

  const sections =
    SECTION_DEFINITIONS
      .map(
        (
          [
            key,
            title,
          ]
        ) => {

          const s =
            source.sections
              .find(
                (section) =>
                  section.key ===
                  key
              );


          return {
            key,
            title,

            earned:
              number(
                s.section_score
              ),

            possible:
              number(
                s.possible_score
              ),

            percentage:
              Math.round(
                (
                  s.section_score /
                  s.possible_score
                ) *
                  100
              ),

            note:
              text(
                s.evaluator_section_note
              ),

            questions:
              s.questions
                .map(
                  (q) => ({
                    ...q,

                    earned:
                      number(
                        q.earned
                      ),

                    possible:
                      number(
                        q.possible
                      ),

                    ...columns(
                      q
                    ),
                  })
                ),
          };
        }
      );


  /* =====================================================
     ANALYSIS
  ===================================================== */

  const analysis =
    Array.isArray(
      data.sections
    )
      ? data.sections
      : [];


  const narratives =
    TOPICS
      .map(
        (t) => {

          const s =
            analysis.find(
              (section) =>
                section.title ===
                t.title
            ) ||
            {};


          return {
            title:
              t.title,

            narrative:
              text(
                s.summary
              ) ||
              text(
                s.narrative
              ) ||
              "Visit-specific analysis is not available.",

            strengths:
              Array.isArray(
                s.strengths
              )
                ? s.strengths
                    .map(
                      text
                    )
                    .filter(
                      Boolean
                    )
                : [],

            opportunities:
              Array.isArray(
                s.opportunities
              )
                ? s.opportunities
                    .map(
                      text
                    )
                    .filter(
                      Boolean
                    )
                : [],
          };
        }
      );


  /* =====================================================
     TIME

     Do not invent time values.
  ===================================================== */

  if (
    !metadata
      .time_in
  ) {

    issues.push({
      code:
        "missing_time_in",

      field:
        "metadata.time_in",

      severity:
        "warning",
    });

  }


  if (
    !metadata
      .time_out
  ) {

    issues.push({
      code:
        "missing_time_out",

      field:
        "metadata.time_out",

      severity:
        "warning",
    });

  }


  if (
    !metadata
      .shop_date &&
    !source.shop
      ?.shop_date &&
    metadata
      .evaluation_date
  ) {

    issues.push({
      code:
        "shop_date_missing_used_evaluation_date",

      field:
        "metadata.shop_date",

      severity:
        "warning",
    });

  }


  /* =====================================================
     FINAL MODEL
  ===================================================== */

  return {

    evaluationId:
      data.evaluation_id,

    name,

    community,

    visitDate,

    timeIn:
      text(
        metadata
          .time_in
      ) ||
      "Not recorded",

    timeOut:
      text(
        metadata
          .time_out
      ) ||
      "Not recorded",

    videoURL:
      safeURL(
        data.video_url
      ),

    total:
      number(
        source.scores
          .total_score
      ),

    possible:
      100,

    percentage:
      number(
        source.scores
          .percentage
      ),

    sections,

    narratives,

    issues,

    evaluatorNote:
      text(
        data.evaluator_note
      ) ||
      text(
        source
          .final_evaluator_note
      ),

    scoreVerified:
      true,

    previewLabel:
      text(
        data.preview_label
      ),
  };
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  buildReportModel,
  validateSnapshot,
  columns,
  number,
  parseSnapshot,
  safeURL,
  formatDate,
  SECTION_DEFINITIONS,
};