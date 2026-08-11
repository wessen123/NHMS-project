
const axios = require("axios");

const fs =
  require("fs");

const FormData =
  require("form-data");

const {
  generateInsights,
} = require("./openai.evaluation");

const {
  generatePDF,
} = require("./pdf.service");

const {
  generateChartData,
} = require("./chart.service");

// =====================================
// PROCESS EVALUATION
// =====================================
async function processEvaluation(
  evaluationId
) {

  // =====================================
  // FETCH EVALUATION
  // =====================================
  const { data } =
    await axios.get(

      `${process.env.BASE_URL}/api/evaluation:get/${evaluationId}`,

      {
        headers: {

          Authorization:
            `Bearer ${process.env.NOCOBASE_TOKEN}`,
        },
      }
    );

  const evaluation =
    data?.data;

  // =====================================
  // VALIDATE
  // =====================================
  if (!evaluation) {

    throw new Error(
      "Evaluation not found"
    );
  }
// =====================================
// FRONTEND SNAPSHOT
// =====================================
const evaluationData =
  evaluation.responses_json
    ?.evaluation || {};
const shop =
  evaluationData.shop || {};

const metadata =
  evaluationData.metadata || {};

const salesRep =
  evaluationData.sales_rep || {};

const scores =
  evaluationData.scores || {};
const sections =
  evaluationData.sections || [];

const approach =
  sections.find(
    s => s.key === "approach"
  );

const qualifying =
  sections.find(
    s => s.key === "qualifying"
  );

const demonstration =
  sections.find(
    s => s.key === "demonstration"
  );

const presentation =
  sections.find(
    s => s.key === "presentation"
  );

const closing =
  sections.find(
    s => s.key === "closing"
  );

const attitude =
  sections.find(
    s => s.key === "attitude"
  );
const salesRepName =
  salesRep.full_name || "N/A";

const communityName =
  metadata.community_name || "N/A";

// =====================================
// AI PAYLOAD
// =====================================
const payload = {

  sales_rep:
    evaluationData.sales_rep || {},

  scores:
    evaluationData.scores || {},

  sections:
    evaluationData.sections || [],

  final_evaluator_note:
    evaluationData.final_evaluator_note || ""
};

// =====================================
// GENERATE AI
// =====================================
const aiResult =
  await generateInsights(
    payload
  );

// =====================================
// CHART DATA
// =====================================
console.log(
  "SECTIONS:",
  JSON.stringify(
    evaluationData.sections,
    null,
    2
  )
);

console.log(
  "SECTIONS:",
  JSON.stringify(
    evaluationData.sections,
    null,
    2
  )
);
const chartData =
  generateChartData({

    sections:
      evaluationData.sections,

    percentage:
      scores.percentage
  });

  console.log(
  JSON.stringify(
    {
      sales_rep_name:
        salesRepName,

      community_name:
        communityName,

      executive_summary:
        aiResult.executive_summary,

      sections:
        aiResult.sections
    },
    null,
    2
  )
);
// =====================================
// GENERATE PDF
// =====================================
const pdfResult =
  await generatePDF({

    evaluation_id:
      evaluation.id,

    sales_rep_name:
      salesRepName,

    community_name:
      communityName,

    metadata: {
  ...metadata,

  time_in:
    metadata.time_in ||
    shop.time_in ||
    "",

  time_out:
    metadata.time_out ||
    shop.time_out ||
    ""
},

    total_score:
      scores.total_score ||
      evaluation.total_score,

    percentage:
      scores.percentage ||
      evaluation.percentage,

    evaluator_note:
      evaluationData.final_evaluator_note || "",

    executive_summary:
    aiResult.executive_summary,

  sections:
    aiResult.sections,

    chartData,

    responses:
      evaluation.responses_json,
  });

 if (
  !pdfResult ||
  !pdfResult.filePath ||
  !fs.existsSync(
    pdfResult.filePath
  )
) {

  throw new Error(
    "PDF generation failed"
  );
}

  // =====================================
  // CREATE FORM
  // =====================================
  const form =
    new FormData();

  form.append(

    "file",

    fs.createReadStream(
      pdfResult.filePath
    )
  );

  // =====================================
  // UPLOAD PDF
  // =====================================
  const uploadResponse =
    await axios.post(

      `${process.env.BASE_URL}/api/attachments:create`,

      form,

      {
        headers: {

          Authorization:
            `Bearer ${process.env.NOCOBASE_TOKEN}`,

          ...form.getHeaders(),
        },
      }
    );

  // =====================================
  // FILE
  // =====================================
  const uploadedFile =
    uploadResponse.data?.data;

  // =====================================
  // AI SUMMARY
  // =====================================
 const aiSummary =
  aiResult.executive_summary || "";
  // =====================================
  // STRENGTHS
  // =====================================
  const aiStrengths =
    (aiResult.sections || [])
      .flatMap(
        (s) =>
          s.strengths || []
      )
      .join("\n");

  // =====================================
  // WEAKNESSES
  // =====================================
  const aiWeaknesses =
    (aiResult.sections || [])
      .flatMap(
        (s) =>
          s.opportunities || []
      )
      .join("\n");

  // =====================================
  // RECOMMENDATIONS
  // =====================================
  const aiRecommendations =
    (aiResult.sections || [])
      .flatMap(
        (s) =>
          s.opportunities || []
      )
      .slice(0, 10)
      .join("\n");

  // =====================================
  // SAVE RESULTS
  // =====================================
  await axios.post(

    `${process.env.BASE_URL}/api/evaluation_results:create`,

    {

      evaluation_id:
        evaluation.id,

      total_score:
       scores.total_score ||
    evaluation.total_score,

     max_score: 100,

    percentage:
     scores.percentage ||
     evaluation.percentage,

     section_scores:

  (evaluationData.sections || [])
    .reduce(

      (acc, section) => {

        acc[
          section.key
        ] = {

          score:
            section.section_score || 0,

          possible:
            section.possible_score || 0,

          percentage:

            section.possible_score > 0

              ? Math.round(

                  (
                    section.section_score /
                    section.possible_score
                  ) * 100

                )

              : 0,
        };

        return acc;

      },

      {}
    ),

      ai_summary:
        aiSummary,

      ai_strengths:
        aiStrengths,

      ai_weaknesses:
        aiWeaknesses,

      ai_recommendations:
        aiRecommendations,

      ai_model:
        aiResult.ai_model,

      ai_prompt_version:
        "v3",

      input_tokens:
        aiResult.input_tokens,

      output_tokens:
        aiResult.output_tokens,

      processing_time_ms:
        aiResult.processing_time_ms,

      status:
        "completed",

      processed_at:
        new Date()
          .toISOString(),

      responses_snapshot:
        evaluation.responses_json,

      industry_benchmark_comparison:
  chartData,

ai_analysis_json: {

  executive_summary:
    aiResult.executive_summary,

  sections:
    aiResult.sections,

  ai_model:
    aiResult.ai_model
},

      // =====================================
      // PDF ATTACHMENT
      // =====================================
      pdf_report:

        uploadedFile

          ? [
              {
                id:
                  uploadedFile.id
              }
            ]

          : [],
    },

    {
      headers: {

        Authorization:
          `Bearer ${process.env.NOCOBASE_TOKEN}`,

        "Content-Type":
          "application/json",
      },
    }
  );

  // =====================================
  // RETURN
  // =====================================
  return {

    success: true,

    evaluation_id:
      evaluation.id,

    sales_rep_name:
      salesRepName,

    community_name:
      communityName,

    pdf_path:
      pdfResult.filePath,
  };
}

// =====================================
// EXPORT
// =====================================
module.exports = {
  processEvaluation,
};
