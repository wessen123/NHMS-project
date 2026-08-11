const axios = require("axios");

const {
  generateRepPerformanceInsights
} = require(
  "./openai.rep.performance"
);
async function getRepEvaluationHistory(
  salesRepId
) {

  const response =
    await axios.get(

      `${process.env.BASE_URL}/api/evaluation:list`,

      {
        headers: {
          Authorization:
            `Bearer ${process.env.NOCOBASE_TOKEN}`
        }
      }
    );

  const evaluations =
    response.data?.data || [];

  return evaluations.filter(
    e =>
      String(
        e.sales_rep_id
      ) === String(
        salesRepId
      )
  );
}
function calculateRepAverages(
  evaluations
) {

  if (
    !evaluations ||
    !evaluations.length
  ) {

    return {
      avg_score: 0,
      best_score: 0,
      worst_score: 0,
      last_score: 0,

      avg_approach: 0,
      avg_qualifying: 0,
      avg_demonstration: 0,
      avg_presentation: 0,
      avg_closing: 0,
      avg_attitude: 0,

      total_evaluations: 0
    };
  }

  let totalScore = 0;

  let totalApproach = 0;
  let totalQualifying = 0;
  let totalDemonstration = 0;
  let totalPresentation = 0;
  let totalClosing = 0;
  let totalAttitude = 0;

  let bestScore = 0;
  let worstScore = 999;

  evaluations.forEach(
    evaluation => {

      const data =
        evaluation
          ?.responses_json
          ?.evaluation || {};

      const score =
        Number(
          data?.scores
            ?.percentage || 0
        );

      totalScore += score;

      if (
        score > bestScore
      ) {
        bestScore = score;
      }

      if (
        score < worstScore
      ) {
        worstScore = score;
      }

      const sections =
        data.sections || [];

      const getScore =
        (key) => {

          const section =
            sections.find(
              s =>
                String(
                  s.key
                )
                  .toLowerCase()
                  .trim() ===
                key
            );

          return Number(
            section
              ?.section_score || 0
          );
        };

      totalApproach +=
        getScore(
          "approach"
        );

      totalQualifying +=
        getScore(
          "qualifying"
        );

      totalDemonstration +=
        getScore(
          "demonstration"
        );

      totalPresentation +=
        getScore(
          "presentation"
        );

      totalClosing +=
        getScore(
          "closing"
        );

      totalAttitude +=
        getScore(
          "attitude"
        );
    }
  );

  const count =
    evaluations.length;

  const sorted =
    [...evaluations]
      .sort(
        (a, b) =>
          new Date(
            b.createdAt
          ) -
          new Date(
            a.createdAt
          )
      );

  const latest =
    sorted[0];

  const latestScore =
    Number(

      latest
        ?.responses_json
        ?.evaluation
        ?.scores
        ?.percentage || 0
    );

  return {

    total_evaluations:
      count,

    avg_score:
      Number(
        (
          totalScore /
          count
        ).toFixed(2)
      ),

    best_score:
      bestScore,

    worst_score:
      worstScore,

    last_score:
      latestScore,

    avg_approach:
      Number(
        (
          totalApproach /
          count
        ).toFixed(2)
      ),

    avg_qualifying:
      Number(
        (
          totalQualifying /
          count
        ).toFixed(2)
      ),

    avg_demonstration:
      Number(
        (
          totalDemonstration /
          count
        ).toFixed(2)
      ),

    avg_presentation:
      Number(
        (
          totalPresentation /
          count
        ).toFixed(2)
      ),

    avg_closing:
      Number(
        (
          totalClosing /
          count
        ).toFixed(2)
      ),

    avg_attitude:
      Number(
        (
          totalAttitude /
          count
        ).toFixed(2)
      )
  };
}

function collectSectionNotes(
  evaluations
) {

  const notes = {

    approach_notes: [],

    qualifying_notes: [],

    demonstration_notes: [],

    presentation_notes: [],

    closing_notes: [],

    attitude_notes: [],

    final_notes: []
  };

  evaluations.forEach(
    evaluation => {

      const data =
        evaluation
          ?.responses_json
          ?.evaluation || {};

      const sections =
        data.sections || [];

      sections.forEach(
        section => {

          const note =
            String(
              section
                ?.evaluator_section_note || ""
            ).trim();

          if (!note) {
            return;
          }

          switch (
            String(
              section.key
            )
              .toLowerCase()
              .trim()
          ) {

            case "approach":
              notes.approach_notes.push(
                note
              );
              break;

            case "qualifying":
              notes.qualifying_notes.push(
                note
              );
              break;

            case "demonstration":
              notes.demonstration_notes.push(
                note
              );
              break;

            case "presentation":
              notes.presentation_notes.push(
                note
              );
              break;

            case "closing":
              notes.closing_notes.push(
                note
              );
              break;

            case "attitude":
              notes.attitude_notes.push(
                note
              );
              break;
          }
        }
      );

      const finalNote =
        String(
          data.final_evaluator_note || ""
        ).trim();

      if (finalNote) {

        notes.final_notes.push(
          finalNote
        );
      }
    }
  );

  return notes;
}
async function buildRepPerformanceSummary(
  salesRepId
) {

  // ==============================
  // LOAD EVALUATIONS
  // ==============================

  const evaluations =
    await getRepEvaluationHistory(
      salesRepId
    );

  if (
    !evaluations ||
    !evaluations.length
  ) {

    throw new Error(
      "No evaluations found"
    );
  }

  // ==============================
  // AVERAGES
  // ==============================

  const averages =
    calculateRepAverages(
      evaluations
    );

  // ==============================
  // NOTES
  // ==============================

  const notes =
    collectSectionNotes(
      evaluations
    );

  // ==============================
  // SALES REP INFO
  // ==============================

  const latest =
    evaluations[0];

  const salesRep =

    latest
      ?.responses_json
      ?.evaluation
      ?.sales_rep || {};

  // ==============================
  // AI
  // ==============================

  const aiResult =
    await generateRepPerformanceInsights({

      sales_rep_name:
        salesRep.full_name,

      total_evaluations:
        averages.total_evaluations,

      avg_score:
        averages.avg_score,

      avg_approach:
        averages.avg_approach,

      avg_qualifying:
        averages.avg_qualifying,

      avg_demonstration:
        averages.avg_demonstration,

      avg_presentation:
        averages.avg_presentation,

      avg_closing:
        averages.avg_closing,

      avg_attitude:
        averages.avg_attitude,

      notes
    });

  // ==============================
  // APPROACH SUMMARY
  // ==============================

  const getSectionSummary =
    (key) => {

      return (

        aiResult.sections.find(
          s =>
            s.key === key
        ) || {}
      );
    };

  const approachSummary =
    getSectionSummary(
      "approach"
    );

  const qualifyingSummary =
    getSectionSummary(
      "qualifying"
    );

  const demonstrationSummary =
    getSectionSummary(
      "demonstration"
    );

  const presentationSummary =
    getSectionSummary(
      "presentation"
    );

  const closingSummary =
    getSectionSummary(
      "closing"
    );

  const attitudeSummary =
    getSectionSummary(
      "attitude"
    );

  // ==============================
  // SAVE SUMMARY
  // ==============================

  const payload = {
    

    sales_rep_id:
      salesRepId,

      sales_rep_name:
  salesRep.full_name ||
  "Unknown Rep",

    avg_score:
      averages.avg_score,

    last_score:
      averages.last_score,

    best_score:
      averages.best_score,

    worst_score:
      averages.worst_score,

    total_evaluations:
      averages.total_evaluations,

    performance_index:
      averages.avg_score,

    Avg_approach:
      averages.avg_approach,

    avg_qualifying:
      averages.avg_qualifying,

    avg_demonstration:
      averages.avg_demonstration,

    avg_presentation:
      averages.avg_presentation,

    avg_closing:
      averages.avg_closing,

    avg_attitude:
      averages.avg_attitude,

    quality_status:
      averages.avg_score >= 90
        ? "Excellent"
        : averages.avg_score >= 80
        ? "Good"
        : averages.avg_score >= 70
        ? "Average"
        : "Needs Improvement",

    performance_tier:
      averages.avg_score >= 95
        ? "Elite"
        : averages.avg_score >= 85
        ? "Top Performer"
        : averages.avg_score >= 75
        ? "Solid Performer"
        : "Coaching Needed",

    ai_summary:
      aiResult.executive_summary,

    ai_approach_summary:
      approachSummary.summary || "",

    ai_qualifying_summary:
      qualifyingSummary.summary || "",

    ai_demonstration_summary:
      demonstrationSummary.summary || "",

    ai_presentation_summary:
      presentationSummary.summary || "",

    ai_closing_summary:
      closingSummary.summary || "",

    ai_attitude_summary:
      attitudeSummary.summary || ""
  };

  return payload;
}

async function buildRepPerformanceSummary(
  salesRepId
) {

  // ==============================
  // LOAD EVALUATIONS
  // ==============================

  const evaluations =
    await getRepEvaluationHistory(
      salesRepId
    );

  if (
    !evaluations ||
    !evaluations.length
  ) {

    throw new Error(
      "No evaluations found"
    );
  }

  // ==============================
  // AVERAGES
  // ==============================

  const averages =
    calculateRepAverages(
      evaluations
    );

  // ==============================
  // NOTES
  // ==============================

  const notes =
    collectSectionNotes(
      evaluations
    );

  // ==============================
  // SALES REP INFO
  // ==============================

  const latest =
    evaluations[0];

  const salesRep =

    latest
      ?.responses_json
      ?.evaluation
      ?.sales_rep || {};

  // ==============================
  // AI
  // ==============================

  const aiResult =
    await generateRepPerformanceInsights({

      sales_rep_name:
        salesRep.full_name,

      total_evaluations:
        averages.total_evaluations,

      avg_score:
        averages.avg_score,

      avg_approach:
        averages.avg_approach,

      avg_qualifying:
        averages.avg_qualifying,

      avg_demonstration:
        averages.avg_demonstration,

      avg_presentation:
        averages.avg_presentation,

      avg_closing:
        averages.avg_closing,

      avg_attitude:
        averages.avg_attitude,

      notes
    });

  // ==============================
  // APPROACH SUMMARY
  // ==============================

  const getSectionSummary =
    (key) => {

      return (

        aiResult.sections.find(
          s =>
            s.key === key
        ) || {}
      );
    };

  const approachSummary =
    getSectionSummary(
      "approach"
    );

  const qualifyingSummary =
    getSectionSummary(
      "qualifying"
    );

  const demonstrationSummary =
    getSectionSummary(
      "demonstration"
    );

  const presentationSummary =
    getSectionSummary(
      "presentation"
    );

  const closingSummary =
    getSectionSummary(
      "closing"
    );

  const attitudeSummary =
    getSectionSummary(
      "attitude"
    );

  // ==============================
  // SAVE SUMMARY
  // ==============================

  const payload = {

    sales_rep_id:
      salesRepId,

    avg_score:
      averages.avg_score,

    last_score:
      averages.last_score,

    best_score:
      averages.best_score,

    worst_score:
      averages.worst_score,

    total_evaluations:
      averages.total_evaluations,

    performance_index:
      averages.avg_score,

    Avg_approach:
      averages.avg_approach,

    avg_qualifying:
      averages.avg_qualifying,

    avg_demonstration:
      averages.avg_demonstration,

    avg_presentation:
      averages.avg_presentation,

    avg_closing:
      averages.avg_closing,

    avg_attitude:
      averages.avg_attitude,

    quality_status:
      averages.avg_score >= 90
        ? "Excellent"
        : averages.avg_score >= 80
        ? "Good"
        : averages.avg_score >= 70
        ? "Average"
        : "Needs Improvement",

    performance_tier:
      averages.avg_score >= 95
        ? "Elite"
        : averages.avg_score >= 85
        ? "Top Performer"
        : averages.avg_score >= 75
        ? "Solid Performer"
        : "Coaching Needed",

    ai_summary:
      aiResult.executive_summary,

    ai_approach_summary:
      approachSummary.summary || "",

    ai_qualifying_summary:
      qualifyingSummary.summary || "",

    ai_demonstration_summary:
      demonstrationSummary.summary || "",

    ai_presentation_summary:
      presentationSummary.summary || "",

    ai_closing_summary:
      closingSummary.summary || "",

    ai_attitude_summary:
      attitudeSummary.summary || ""
  };

  return payload;
}
async function saveRepPerformanceSummary(
  summary
) {

  const existingResponse =
    await axios.get(

      `${process.env.BASE_URL}/api/rep_performance_summary:list`,

      {
        headers: {
          Authorization:
            `Bearer ${process.env.NOCOBASE_TOKEN}`
        }
      }
    );

  const existingRecords =
    existingResponse.data?.data || [];

  const existing =
    existingRecords.find(
      r =>
        String(
          r.sales_rep_id
        ) ===
        String(
          summary.sales_rep_id
        )
    );

  if (existing) {

    console.log(
      "Updating Rep Summary"
    );

    await axios.post(

      `${process.env.BASE_URL}/api/rep_performance_summary:update/${existing.id}`,

      summary,

      {
        headers: {
          Authorization:
            `Bearer ${process.env.NOCOBASE_TOKEN}`
        }
      }
    );

    return existing.id;
  }

  console.log(
    "Creating Rep Summary"
  );

  const createResponse =
    await axios.post(

      `${process.env.BASE_URL}/api/rep_performance_summary:create`,

      summary,

      {
        headers: {
          Authorization:
            `Bearer ${process.env.NOCOBASE_TOKEN}`
        }
      }
    );

  return createResponse
    .data?.data?.id;
}
module.exports = {

  getRepEvaluationHistory,

  calculateRepAverages,

  collectSectionNotes,

  buildRepPerformanceSummary,

  saveRepPerformanceSummary
};