# NHMS PDF generator audit — before changes

Repository: https://github.com/wessen123/NHMS-project
Inspected main commit: d592b5c9c23558fc057e5b0317f7cd0f08358ff8

## Active execution path

1. `index.js` mounts `routes/evaluation.routes.js` at `/uploadApi`.
2. `POST /uploadApi/process-evaluation`, body `{ evaluationId }`, calls `controllers/evaluation.controller.js` → `services/evaluation.service.js:processEvaluation`.
3. The service directly GETs `/api/evaluation:get/${evaluationId}` using `BASE_URL` and `NOCOBASE_TOKEN`. It does not use `services/nocobase.service.js` for this report.
4. It reads `evaluation.responses_json.evaluation` as an already scored frontend snapshot. No survey collection is queried. No scoring engine is invoked.
5. `services/openai.evaluation.js:generateInsights` uses `templates/analysis.sections.js` to generate six narrative topics. The request includes the snapshot's `sales_rep`, `scores`, `sections`, and `final_evaluator_note`. The prompt says scores are finalized and must not be calculated.
6. `services/chart.service.js:generateChartData` computes section percentages from snapshot `section_score / possible_score`. `constants/industryBenchmarks.js` supplies static benchmark percentages.
7. `services/pdf.service.js:generatePDF` builds scorecard and narrative HTML inline, reads `templates/report.template.html`, `templates/report.styles.css`, and `templates/logo.png`. Chart.js is loaded from an external CDN in the HTML.
8. Puppeteer renders `uploads/reports/<representative>_<timestamp>.pdf` using A4. CSS also controls pagination. The browser waits a fixed three seconds for charts.
9. `services/evaluation.service.js` uploads to `attachments:create`, then POSTs `evaluation_results:create` with scores, narratives, snapshots, chart data, and the attachment ID.

## Exact existing report field map

These are code-observed reads/writes, not confirmation of live NocoBase Configure fields. JSON paths below start at `evaluation.responses_json.evaluation` unless fully qualified.

| Report value | Current source / transformation |
|---|---|
| Evaluation identifier | `evaluation.id` |
| Representative | `sales_rep.full_name` |
| Community | `metadata.community_name` |
| Cover visit date | `metadata.shop_date`; incorrectly falls back to today's date |
| Scorecard visit date | `data.generated_at`; caller never supplies it, so blank |
| Narrative evaluation date | current rendering time, not visit date |
| Time in | `metadata.time_in`, then `shop.time_in`, then blank |
| Time out | `metadata.time_out`, then `shop.time_out`, then blank |
| Total score input and persisted value | `scores.total_score || evaluation.total_score` |
| Scorecard total and total chart percentage | `scores.percentage || evaluation.percentage`; scorecard formats as percentage and defaults to zero |
| Maximum possible total | literal `100`; no survey configuration check |
| Section identity | `sections[].key`, matched to `approach`, `qualifying`, `demonstration`, `closing`, `presentation`, `attitude` |
| Section label | `sections[].title` |
| Section earned / possible | `sections[].section_score`, `sections[].possible_score` |
| Section efficiency | rounded section earned / possible × 100; missing/zero possible becomes zero |
| Question number / label | `sections[].questions[].number`, `.question` |
| Question possible / awarded | `sections[].questions[].possible`, `.earned`, each defaulted to zero |
| YES column | earned points, only when positive |
| NO column | `max(possible - earned, 0)`, including missing answers and partial credit |
| Actual answer / N/A / NMD markers | not read by active renderer; exact live fields unknown |
| Question/section notes | entire section objects passed to AI; no explicit note field read or printed |
| Final evaluator note | `final_evaluator_note`; passed to AI; placeholder substitution exists in renderer |
| Narrative topics | titles from `templates/analysis.sections.js` |
| Narrative text | generated `aiResult.sections[].summary`; renderer also accepts `.narrative` |
| Strengths / opportunities | generated `aiResult.sections[].strengths[]`, `.opportunities[]` |
| Executive summary | generated `aiResult.executive_summary` |
| Logo / website / copyright | local `templates/logo.png`; hard-coded template strings |
| Video link | literal text only; no URL mapped |
| Industry averages | `constants/industryBenchmarks.js`: approach 89, qualifying 65, demonstration 60, closing 45, presentation 75, attitude 73, total 65 |

### NocoBase writes in the active workflow

- `attachments:create`: multipart `file`; response `data.id` becomes the PDF attachment reference.
- `evaluation_results:create`: `evaluation_id`, `total_score`, `max_score`, `percentage`, `section_scores`, `ai_summary`, `ai_strengths`, `ai_weaknesses`, `ai_recommendations`, `ai_model`, `ai_prompt_version`, `input_tokens`, `output_tokens`, `processing_time_ms`, `status`, `processed_at`, `responses_snapshot`, `industry_benchmark_comparison`, `ai_analysis_json`, `pdf_report`.
- `section_scores[section.key]` contains `score`, `possible`, `percentage`.
- `ai_analysis_json` contains `executive_summary`, `sections`, `ai_model`.
- `pdf_report` contains `[{ id: uploadedFile.id }]`.

### Related collections observed elsewhere, not loaded by the current report

`services/nocobase.service.js` queries `nhms_shops` by `id` and `edited_videos` by `nhms_shop_id`. Video services write `edited_videos.url`, `status`, `file_path`, `file_name`, `original_filename`, `uploaded_at`, and `dropbox_file_id`; the edited sync workflow uses `status: "uploaded"`. `nhms_shops.shop_date` is read by video naming. The backend report does not establish its evaluation-to-shop relationship or live time-field configuration. Those must be verified from schema/record evidence before new collection mappings are added.

## Why John shows zero and NO

Confirmed code defects:

- `Number(q.earned || 0)` makes missing, null, empty, and false awarded values indistinguishable from a true zero. The NO column then shows all possible points as missed. No actual answer field is checked.
- Missing section totals and total percentages also default to zero in the scorecard/chart.
- `||` falls through on legitimate zero scores in the evaluation service.
- The renderer accepts only one nested JSON shape and does not parse a JSON string or diagnose a shape mismatch.
- The scorecard date reads a property never supplied by the caller. Cover/narrative dates can silently use generation dates.
- Markers and partial-credit semantics are ignored, and video text has no anchor URL.

The exact cause in John's specific record is NOT proven without the stored `responses_json` and linked result. The supplied PDF demonstrates the symptom, not whether awarded values were absent, misnamed, or explicitly zero. The repository's output naming also lacks the random suffix in the supplied PDF, so deployed-code parity must be checked.

## Scoring and reference differences

The Alana reference has landscape Letter pages (792 × 612 pt), six pages, and section weights 8/15/20/22/20/15. Its Close question weights are 6/4/4/4/2/2. John's portrait A4 output has Close weights 5.5/4.58/4.58/3.67/1.83/1.83. They must not be silently replaced by the reference values.

`templates/scorecard.template.js` defines nominal section maxima totaling 100, but it is not imported by the active report, and several of its question weights differ from the reference. `services/scoring.engine.js` uses `services/template.js`, multipliers, and penalties, but no active evaluation-route caller invokes it. Neither file proves the current live questionnaire configuration.

No survey schema/configuration export, real evaluation fixture, or benchmark provenance study exists in the repository. Benchmarks are static constants matching the reference chart, not a live industry feed.

## Other PDF code, outside this report path

- `services/rep.performance.pdf.generator.js` → `services/rep.performance.pdf.js` and `services/rep.performance.template.js`: a separate representative performance report.
- `services/pdf/pdf.service.js`: unused by this route; writes plain text to a `.pdf` filename.
- `services/pdf/chart.service.js`, `services/pdf/upload.service.js`, `services/pdf/template/*`, and `services/report.template.html`: not used by the active single-evaluation renderer.

## Implementation boundary

Fix layout and preserve missing values using the proven snapshot contract. Do not enable or modify scoring engines or overwrite questionnaire weights. Real answer/marker/note mappings, stored-result score reconciliation, shop linkage, final-video selection, and a real-data PDF require the current schema and records. Local fixtures can verify behavior and layout but cannot certify those live mappings.
