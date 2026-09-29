"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildReportModel, number, formatDate } = require("../services/report.model");
const { buildHTML } = require("../services/pdf.service");
const { generateChartData } = require("../services/chart.service");
const template = require("../services/template");
const fields = { answer: "test_answer", marker: "test_marker", note: "test_note", answerValues: { Y: "yes", N: "no", NA: "na", P: "partial" } };
const logger = { warn() {} };
function fixture() {
  const sections = template.map(s => {
    const questions = s.questions.flatMap(q => q.sub || [q]).map((q, index) => ({ number: index + 1, question: q.text, earned: q.weight, possible: q.weight, test_answer: "Y" }));
    const possible = questions.reduce((n, q) => n + q.possible, 0);
    return { key: s.key, title: s.name, section_score: possible, possible_score: possible, questions };
  });
  return { evaluation_id: 9, sales_rep_name: "Test Representative", community_name: "Test Community",
    metadata: { shop_date: "2026-05-21", time_in: "12:20 PM", time_out: "1:15 PM" }, total_score: 100, percentage: 100,
    responses: { evaluation: { sections } }, stored_result: { evaluation_id: 9, total_score: 100, max_score: 100, percentage: 100,
      section_scores: Object.fromEntries(sections.map(s => [s.key, { score: s.section_score, possible: s.possible_score, percentage: 100 }])) } };
}
test("missing values are not numeric zeros", () => {
  for (const value of [null, undefined, "", " ", false, [], {}, "bad"]) assert.equal(number(value), null);
  assert.equal(number(0), 0); assert.equal(number("0"), 0);
});
test("missing answer never becomes NO", () => {
  const data = fixture(); const q = data.responses.evaluation.sections[0].questions[0];
  delete q.test_answer; delete q.earned;
  const { model, html } = buildHTML(data, { fields, logger });
  assert.equal(model.sections[0].questions[0].earned, null);
  assert.equal(model.sections[0].questions[0].answer, null);
  assert.match(html, /\? \?/); assert.ok(model.issues.some(i => i.code === "missing_or_unmapped_answer"));
});
test("explicit zero and partial credit remain recorded values", () => {
  const data = fixture(); const q = data.responses.evaluation.sections[0].questions[0];
  q.test_answer = "N"; q.earned = 0;
  let model = buildReportModel(data, { fields, logger });
  assert.equal(model.sections[0].questions[0].earned, 0);
  assert.ok(model.issues.some(i => i.code === "question_section_total_mismatch"));
  q.test_answer = "P"; q.earned = .5;
  model = buildReportModel(data, { fields, logger });
  assert.equal(model.sections[0].questions[0].marker, "*");
});
test("N/A preserves awarded points and denominator; renderer does not rescore", () => {
  const data = fixture(); data.responses.evaluation.sections[0].questions[0].test_answer = "NA";
  const model = buildReportModel(data, { fields, logger });
  assert.equal(model.total, 100); assert.equal(model.possible, 100);
  assert.equal(model.sections[0].questions[0].marker, "N/A");
});
test("mismatched stored result is flagged and wrong evaluation is refused", () => {
  const data = fixture(); data.stored_result.total_score = 99;
  assert.ok(buildReportModel(data, { fields, logger }).issues.some(i => i.code === "stored_result_mismatch"));
  data.stored_result.evaluation_id = 10;
  assert.throws(() => buildReportModel(data, { fields, logger }), /different evaluation/);
});
test("HTML values escaped, unsafe URL rejected", () => {
  const data = fixture(); data.sales_rep_name = '<script>alert(1)</script>';
  data.video_url = 'javascript:alert(1)';
  const result = buildHTML(data, { fields, logger });
  assert.ok(result.html.includes('&lt;script&gt;')); assert.ok(!result.html.includes('<script>'));
  assert.equal(result.model.videoURL, null);
});
test("date does not fall back to today", () => {
  assert.equal(formatDate(null), null); assert.equal(formatDate("2026-02-30"), null);
  assert.equal(formatDate("2026-05-21"), "May 21, 2026");
});
test("chart preserves missing versus true zero and uses repository benchmarks", () => {
  const data = generateChartData({ sections: [{ key: "approach", section_score: 0, possible_score: 8 }], percentage: 0 });
  assert.equal(data[0].salesRep, 0); assert.equal(data[1].salesRep, null); assert.equal(data[6].salesRep, 0);
  assert.deepEqual(data.map(x => x.industry), [89, 65, 60, 45, 75, 73, 65]);
});
test("JSON string snapshots accepted", () => {
  const data = fixture(); data.responses = JSON.stringify(data.responses);
  assert.equal(buildReportModel(data, { fields, logger }).total, 100);
});
test("complete numeric fixture reconciles all stored section and total results", () => {
  assert.equal(buildReportModel(fixture(), { fields, logger }).scoreVerified, true);
});
test("N/A with no numeric award is not a missing answer or a NO", () => {
  const data = fixture(); const q = data.responses.evaluation.sections[0].questions[0];
  q.test_answer = "NA"; q.earned = null; q.possible = null;
  const model = buildReportModel(data, { fields, logger });
  assert.equal(model.sections[0].questions[0].answer, "na");
  assert.ok(!model.issues.some(i => i.field.includes("questions[0]") && i.code === "missing_or_invalid_number"));
});
