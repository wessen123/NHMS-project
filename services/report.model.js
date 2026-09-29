"use strict";

const DEFAULT_FIELDS = require("./report.fields");
const TOPICS = require("../templates/analysis.sections");
const SECTION_DEFINITIONS = [
  ["approach", "Approach", 8], ["qualifying", "Qualifying", 15],
  ["demonstration", "Demonstration", 20], ["closing", "Close", 22],
  ["presentation", "Presentation", 20], ["attitude", "General Attitude", 15],
];

function number(value) {
  if (value === null || value === undefined || typeof value === "boolean" ||
      (typeof value !== "number" && typeof value !== "string") || String(value).trim() === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
function text(value) { return typeof value === "string" ? value.trim() : ""; }
function get(object, field) {
  if (!field) return undefined;
  return field.split(".").reduce((value, key) =>
    value && Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined, object);
}
function parseSnapshot(value) {
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { throw new Error("Invalid evaluation.responses_json JSON"); }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function safeURL(value) {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}
function formatDate(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(String(value));
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function buildReportModel(data, { fields = DEFAULT_FIELDS, logger = console } = {}) {
  const issues = [];
  const issue = (code, field, severity = "warning") => {
    if (!issues.some(x => x.code === code && x.field === field)) issues.push({ code, field, severity });
  };
  const snapshot = parseSnapshot(data.responses);
  const source = snapshot.evaluation || {};
  const sections = Array.isArray(source.sections) ? source.sections : [];
  for (const section of sections) if (!SECTION_DEFINITIONS.some(([key]) => key === section.key))
    issue("unrecognized_section", `sections[${section.key}]`, "error");
  if (!snapshot.evaluation) issue("missing_snapshot", "evaluation.responses_json.evaluation", "error");
  const readNumber = (value, field) => {
    const n = number(value);
    if (n === null) issue("missing_or_invalid_number", field, "error");
    return n;
  };
  const total = readNumber(data.total_score ?? source.scores?.total_score, "scores.total_score");
  const percentage = readNumber(data.percentage ?? source.scores?.percentage, "scores.percentage");
  if (percentage !== null && (percentage < 0 || percentage > 100)) issue("invalid_percentage_range", "scores.percentage", "error");
  if (!fields.answer) issue("answer_mapping_not_verified", "services/report.fields.js:answer", "error");
  if (!fields.marker) issue("marker_mapping_not_verified", "services/report.fields.js:marker");
  if (!fields.note) issue("note_mapping_not_verified", "services/report.fields.js:note");

  const normalizedSections = SECTION_DEFINITIONS.map(([key, title, referenceWeight]) => {
    const matches = sections.filter(s => s.key === key);
    const s = matches[0] || {};
    const base = `sections[${key}]`;
    if (matches.length !== 1) issue(matches.length ? "duplicate_section" : "missing_section", base, "error");
    const earned = readNumber(s.section_score, `${base}.section_score`);
    const possible = readNumber(s.possible_score, `${base}.possible_score`);
    if (possible !== null && possible !== referenceWeight) issue("reference_weight_differs_preserved", `${base}.possible_score`);
    if (earned !== null && possible !== null && (earned < 0 || possible < 0 || earned > possible)) issue("invalid_section_range", base, "error");
    const questions = (Array.isArray(s.questions) ? s.questions : []).map((q, index) => {
      const location = `${base}.questions[${index}]`;
      const rawAnswer = get(q, fields.answer);
      const answer = rawAnswer === null || rawAnswer === undefined || rawAnswer === "" ? null :
        (Object.prototype.hasOwnProperty.call(fields.answerValues || {}, String(rawAnswer)) ? fields.answerValues[String(rawAnswer)] : null);
      if (!answer || !["yes", "no", "na", "nmd", "partial"].includes(answer)) issue("missing_or_unmapped_answer", `${location}.${fields.answer || "<answer field unverified>"}`, "error");
      const qEarned = answer === "na" ? number(q.earned) : readNumber(q.earned, `${location}.earned`);
      const qPossible = answer === "na" ? number(q.possible) : readNumber(q.possible, `${location}.possible`);
      if (qEarned !== null && qPossible !== null && (qEarned < 0 || qPossible < 0 || qEarned > qPossible)) issue("invalid_question_range", location, "error");
      if (answer === "no" && qEarned !== null && qEarned !== 0) issue("answer_points_conflict", location, "error");
      const storedMarker = text(get(q, fields.marker));
      if (storedMarker && !["*", "**", "N/A", "NMD"].includes(storedMarker)) issue("unrecognized_marker", `${location}.${fields.marker}`);
      const marker = storedMarker || (answer === "na" ? "N/A" : answer === "nmd" ? "NMD" :
        qEarned !== null && qPossible !== null && qEarned > 0 && qEarned < qPossible ? "*" : "");
      if (!text(q.question)) issue("missing_question_text", `${location}.question`, "error");
      return { number: q.number ?? index + 1, question: text(q.question) || "Question text missing", earned: qEarned,
        possible: qPossible, answer, marker, note: text(get(q, fields.note)), path: location };
    });
    if (!questions.length) issue("missing_questions", `${base}.questions`, "error");
    // Do not change weights, redistribute N/A points, or run the legacy scoring engine.
    if (questions.length && questions.every(q => q.earned !== null && q.answer !== "na") && earned !== null &&
        Math.abs(questions.reduce((sum, q) => sum + q.earned, 0) - earned) > 0.055) issue("question_section_total_mismatch", base, "error");
    return { key, title, earned, possible, questions,
      percentage: earned !== null && possible > 0 ? Math.round(earned / possible * 100) : null };
  });
  const allPossibleKnown = normalizedSections.every(s => s.possible !== null);
  const possible = allPossibleKnown ? normalizedSections.reduce((sum, s) => sum + s.possible, 0) : null;
  if (possible !== null && possible !== 100) issue("configured_total_not_100_preserved", "sections[].possible_score");
  if (total !== null && normalizedSections.every(s => s.earned !== null) &&
      Math.abs(normalizedSections.reduce((sum, s) => sum + s.earned, 0) - total) > 0.055) issue("section_total_mismatch", "scores.total_score", "error");
  if (total !== null && possible > 0 && percentage !== null && Math.abs(total / possible * 100 - percentage) > 0.51)
    issue("total_percentage_mismatch", "scores.percentage", "error");
  const result = data.stored_result;
  if (result) {
    if (String(result.evaluation_id) !== String(data.evaluation_id)) throw new Error("Stored result belongs to a different evaluation");
    for (const [field, actual] of [["total_score", total], ["percentage", percentage], ["max_score", possible]]) {
      if (number(result[field]) === null || actual === null || Math.abs(number(result[field]) - actual) > 0.055)
        issue("stored_result_mismatch", `evaluation_results.${field}`, "error");
    }
    for (const section of normalizedSections) {
      const saved = result.section_scores?.[section.key];
      for (const [field, actual] of [["score", section.earned], ["possible", section.possible], ["percentage", section.percentage]]) {
        if (number(saved?.[field]) === null || actual === null || Math.abs(number(saved[field]) - actual) > (field === "percentage" ? 0.51 : 0.055))
          issue("stored_section_mismatch", `evaluation_results.section_scores.${section.key}.${field}`, "error");
      }
    }
  } else issue("stored_result_not_checked", "evaluation_results", "error");
  const metadata = data.metadata || source.metadata || {};
  const visitDate = formatDate(metadata.shop_date);
  if (!visitDate) issue("missing_or_invalid_visit_date", "metadata.shop_date", "error");
  const name = text(data.sales_rep_name) || text(source.sales_rep?.full_name);
  const community = text(data.community_name) || text(source.metadata?.community_name);
  if (!name) issue("missing_representative", "sales_rep.full_name", "error");
  if (!community) issue("missing_community", "metadata.community_name", "error");
  const timeIn = text(metadata.time_in) || text(source.shop?.time_in);
  const timeOut = text(metadata.time_out) || text(source.shop?.time_out);
  if (!timeIn) issue("missing_time_in", "metadata.time_in / shop.time_in");
  if (!timeOut) issue("missing_time_out", "metadata.time_out / shop.time_out");
  // video_url is an explicit renderer input, not an assumed collection field.
  const videoURL = safeURL(data.video_url);
  if (!videoURL) issue("final_video_not_mapped", "renderer.video_url");
  const analysis = Array.isArray(data.sections) ? data.sections : [];
  const narratives = TOPICS.map(topic => {
    const matches = analysis.filter(s => s.title === topic.title);
    const s = matches[0] || {};
    if (matches.length !== 1) issue("missing_or_duplicate_narrative", topic.key);
    const narrative = text(s.narrative) || text(s.summary);
    if (!narrative) issue("missing_narrative_text", topic.key);
    return { title: topic.title, narrative: narrative || "Visit-specific narrative not available.",
      strengths: (Array.isArray(s.strengths) ? s.strengths : []).map(text).filter(Boolean),
      opportunities: (Array.isArray(s.opportunities) ? s.opportunities : []).map(text).filter(Boolean) };
  });
  for (const item of issues) logger.warn?.("[NHMS report mapping]", JSON.stringify({ evaluation_id: data.evaluation_id ?? null, ...item }));
  return { evaluationId: data.evaluation_id, name: name || "Representative missing", community: community || "Community missing",
    visitDate: visitDate || "Visit date missing", timeIn: timeIn || "Missing", timeOut: timeOut || "Missing", videoURL,
    total, percentage, possible, sections: normalizedSections, narratives, issues,
    evaluatorNote: text(data.evaluator_note) || text(source.final_evaluator_note),
    scoreVerified: !!result && !issues.some(i => i.severity === "error"),
    previewLabel: text(data.preview_label) };
}

module.exports = { buildReportModel, number, parseSnapshot, safeURL, formatDate, SECTION_DEFINITIONS };
