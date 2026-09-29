"use strict";
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const { generatePDF } = require("./pdf.service");
const { generateChartData } = require("./chart.service");
const { buildReportModel, parseSnapshot, number } = require("./report.model");

// Only established collection fields are used here. No survey weights are recalculated.
async function processEvaluation(evaluationId) {
  if (!/^\d+$/.test(String(evaluationId))) throw new Error("A numeric evaluationId is required");
  const base = process.env.BASE_URL;
  const headers = { Authorization: `Bearer ${process.env.NOCOBASE_TOKEN}` };
  const client = axios.create({ baseURL: base, headers, timeout: 30000 });
  const response = await client.get(`/api/evaluation:get/${evaluationId}`);
  const evaluation = response.data?.data;
  if (!evaluation) throw new Error("Evaluation not found");
  const snapshot = parseSnapshot(evaluation.responses_json);
  const source = snapshot.evaluation;
  if (!source || !Array.isArray(source.sections)) throw new Error("Missing evaluation.responses_json.evaluation.sections; report not published");
  const existingResponse = await client.get("/api/evaluation_results:list", {
    params: { filter: JSON.stringify({ evaluation_id: evaluation.id }), pageSize: 2 },
  });
  const existing = existingResponse.data?.data;
  if (!Array.isArray(existing)) throw new Error("Invalid evaluation_results response");
  if (existing.length > 1) throw new Error("Multiple stored results for this evaluation; select the authoritative result before regeneration");
  const stored = existing[0];
  const scores = source.scores || {};
  const total = number(scores.total_score) ?? number(evaluation.total_score);
  const percentage = number(scores.percentage) ?? number(evaluation.percentage);
  for (const field of ["total_score", "percentage"]) {
    if (number(scores[field]) !== null && number(evaluation[field]) !== null &&
        number(scores[field]) !== number(evaluation[field])) {
      throw new Error(`Snapshot scores.${field} differs from evaluation.${field}; resolve before publication`);
    }
  }
  const reportData = {
    evaluation_id: evaluation.id,
    sales_rep_name: source.sales_rep?.full_name,
    community_name: source.metadata?.community_name,
    metadata: { ...source.metadata,
      time_in: source.metadata?.time_in ?? source.shop?.time_in,
      time_out: source.metadata?.time_out ?? source.shop?.time_out },
    total_score: total, percentage, responses: snapshot,
    evaluator_note: source.final_evaluator_note,
    stored_result: stored,
    sections: stored?.ai_analysis_json?.sections || [],
  };
  const preflight = buildReportModel(reportData);
  const blocking = preflight.issues.filter(i => i.severity === "error" && i.code !== "stored_result_not_checked");
  if (blocking.length) {
    // Paths and diagnostic codes only. Never log the source record, tokens, or request config.
    throw new Error(`Report data needs verification: ${blocking.slice(0, 8).map(i => `${i.code} (${i.field})`).join("; ")}. No AI request, attachment upload, or result write performed.`);
  }
  let aiResult;
  if (stored) {
    // Re-render existing visit-specific analysis, without rewriting historic coaching.
    aiResult = { ...(stored.ai_analysis_json || {}),
      executive_summary: stored.ai_analysis_json?.executive_summary ?? stored.ai_summary,
      ai_model: stored.ai_model };
  } else {
    const { generateInsights } = require("./openai.evaluation");
    aiResult = await generateInsights({ sales_rep: source.sales_rep || {}, scores,
      sections: source.sections, final_evaluator_note: source.final_evaluator_note || "" });
  }
  reportData.sections = aiResult.sections || [];
  const chartData = generateChartData({ sections: source.sections, percentage });
  const pdf = await generatePDF(reportData);
  if (!pdf.filePath || !fs.existsSync(pdf.filePath)) throw new Error("PDF generation failed");
  const form = new FormData();
  form.append("file", fs.createReadStream(pdf.filePath));
  const upload = await client.post("/api/attachments:create", form, { headers: form.getHeaders() });
  const attachment = upload.data?.data;
  if (!attachment?.id) throw new Error("Attachment upload returned no ID; result not modified");
  if (stored) {
    // Layout regeneration must never overwrite stored scores or narrative analysis.
    await client.post("/api/evaluation_results:update", { pdf_report: [{ id: attachment.id }] },
      { params: { filterByTk: stored.id } });
  } else {
    const narrativeSections = aiResult.sections || [];
    await client.post("/api/evaluation_results:create", {
      evaluation_id: evaluation.id, total_score: total, max_score: preflight.possible, percentage,
      section_scores: Object.fromEntries(preflight.sections.map(s => [s.key,
        { score: s.earned, possible: s.possible, percentage: s.percentage }])),
      ai_summary: aiResult.executive_summary || "",
      ai_strengths: narrativeSections.flatMap(s => s.strengths || []).join("\n"),
      ai_weaknesses: narrativeSections.flatMap(s => s.opportunities || []).join("\n"),
      ai_recommendations: narrativeSections.flatMap(s => s.opportunities || []).slice(0, 10).join("\n"),
      ai_model: aiResult.ai_model, ai_prompt_version: "v3",
      input_tokens: aiResult.input_tokens, output_tokens: aiResult.output_tokens,
      processing_time_ms: aiResult.processing_time_ms, status: "completed", processed_at: new Date().toISOString(),
      responses_snapshot: snapshot, industry_benchmark_comparison: chartData,
      ai_analysis_json: { executive_summary: aiResult.executive_summary, sections: narrativeSections, ai_model: aiResult.ai_model },
      pdf_report: [{ id: attachment.id }],
    });
  }
  const verification = await client.get("/api/evaluation_results:list", {
    params: { filter: JSON.stringify({ evaluation_id: evaluation.id }), pageSize: 2 },
  });
  const saved = verification.data?.data;
  if (!Array.isArray(saved) || saved.length !== 1 ||
      number(saved[0].total_score) !== total || number(saved[0].percentage) !== percentage ||
      number(saved[0].max_score) !== preflight.possible) {
    throw new Error("Saved result verification failed after write; inspect this evaluation before retrying");
  }
  return { success: true, evaluation_id: evaluation.id, sales_rep_name: reportData.sales_rep_name,
    community_name: reportData.community_name, pdf_path: pdf.filePath, score_verified: true,
    report_issues: pdf.issues.filter(i => i.code !== "stored_result_not_checked") };
}
module.exports = { processEvaluation };
