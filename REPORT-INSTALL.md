# NHMS PDF update — implementation draft pending live field verification

Based on main commit d592b5c9c23558fc057e5b0317f7cd0f08358ff8 of wessen123/NHMS-project.

## Status

The landscape report renderer and missing-data safeguards are implemented and locally tested. This is NOT a completed live integration or a deployment-ready release. The repository has no current NocoBase schema export, evaluation fixture, or live questionnaire configuration. No production endpoint was called and no GitHub branch was pushed.

The included Alana layout preview uses a transcription of the supplied reference PDF, with question wording from the repository's reference template. It is not an export of Alana's NocoBase evaluation and does not establish parity with a stored result. A data-verification page appears before the final chart to state the unresolved checks. The score of 52/100 matches the supplied reference only.

## Complete changed/new source files

- `controllers/evaluation.controller.js`: avoids logging Axios request objects containing authorization headers.
- `services/evaluation.service.js`: parses the existing snapshot, preserves zero, validates before analysis/upload, reuses an existing stored narrative/result, and verifies scores after saving. Existing result regeneration changes only its PDF attachment. It rejects ambiguous multiple results.
- `services/report.fields.js`: deliberately unset answer, marker, and note bindings. Do not guess these fields. The endpoint currently blocks on the unset answer binding.
- `services/report.model.js`: exact existing snapshot mapping, missing-data diagnostics, stored total/section reconciliation, safe URLs, and date handling. No score engine invocation or score redistribution.
- `services/chart.service.js`: original benchmark constants, missing values retained as null, required category order.
- `services/pdf.service.js`: landscape Letter, inline SVG chart, two-column scorecard, six narrative topics, measured pagination, continuation headers, optional notes and diagnostic pages, escaped text, browser cleanup, overflow rejection.
- `templates/report.template.html` and `templates/report.styles.css`: complete report structure and styles.
- `scripts/render-report.js`: offline rendering only; no NocoBase calls.
- `tests/report.test.js` and `tests/report-endpoint.test.js`: focused missing-data, scoring, escaping, and no-write checks.

The original repository files are included for context and dependencies. `services/scoring.engine.js`, `services/template.js`, `templates/scorecard.template.js`, and `constants/industryBenchmarks.js` were not changed. No Docker, schema, or server configuration changes were made.

## Required before live integration is finished

1. Supply current Configure fields/schema and questionnaire configuration, including per-question and section weights and N/A policy.
2. Supply John's full `evaluation.responses_json`, scalar scores, and linked `evaluation_results` record including `section_scores` and `ai_analysis_json`.
3. Establish the exact answer, marker, and note fields/values from that record. Populate `services/report.fields.js` using paths relative to each snapshot question. `answerValues` maps exact recorded values to the internal display states `yes`, `no`, `na`, `nmd`, and `partial`. These states are internal report values, not assumed NocoBase enums.
4. Confirm evaluation-to-shop linkage, visit date/time fields, and authoritative edited-video selection. The existing repository establishes `edited_videos.url` and `edited_videos.nhms_shop_id`, but the current report does not establish its evaluation-to-shop link. The renderer accepts `video_url` explicitly; the endpoint intentionally does not invent a collection mapping. This integration remains unfinished.
5. Compare live weights with 8/15/20/22/20/15. Keep current weights until verified. John's Close weights differ from the reference.
6. Render the real exported record, reconcile total AND section scores, inspect every page, then verify the actual endpoint in the deployment environment. Readback checks do not establish concurrency/uniqueness guarantees; no database constraints were changed.

## Local installation and verification

These are backend files, not a NocoBase JavaScript Block. After the mappings above are completed, replace files at the same repository-relative paths. Existing dependencies from `package.json` are sufficient. Keep the original logo and analysis-topic definitions.

```sh
npm ci
node --test tests/report.test.js tests/report-endpoint.test.js
node scripts/render-report.js report-input.json report-preview.pdf verified-question-field-map.json
```

Use `PUPPETEER_EXECUTABLE_PATH` only if Chromium is managed separately. No credentials are required for offline rendering.

The offline input is the existing renderer DTO, not a new NocoBase collection:

- `evaluation_id`: actual evaluation ID.
- `responses`: the full actual `evaluation.responses_json` object/string.
- `sales_rep_name`: the existing snapshot `sales_rep.full_name`.
- `community_name`: the existing snapshot `metadata.community_name`.
- `metadata`: confirmed visit `shop_date`, `time_in`, `time_out` values. Do not substitute generation time.
- `total_score`, `percentage`: actual stored/snapshot numeric values, preserving zero and null.
- `sections`: the linked result's `ai_analysis_json.sections`, with actual topic `title`, `summary`/`narrative`, `strengths`, and `opportunities`.
- `stored_result`: the actual linked `evaluation_results` record, including `evaluation_id`, `total_score`, `max_score`, `percentage`, and `section_scores`. Never fabricate this object to make validation pass.
- `evaluator_note`: the existing snapshot `final_evaluator_note`.
- `video_url`: the verified final video's URL, once its relationship is established.
- `preview_label`: optional visible label for non-production previews.

The command writes a PDF, an HTML companion, and a `.verification.json` report. A PDF can be produced offline with missing values for diagnosis; `scoreVerified: false` must not be treated as an approved report. The endpoint fails before writes on unresolved required answer mappings and score conflicts.

## Benchmark provenance

`constants/industryBenchmarks.js` is the real code source: 89, 65, 60, 45, 75, 73, 65. These match the supplied Alana chart. The repository contains no study, date, population, or external feed establishing their statistical provenance. The values are preserved, not invented or refreshed.

## Known limits of the draft

- Live mappings for answer, notes, markers, shop details, and final video selection remain outstanding.
- The exact historical cause of John's all-zero data cannot be proven without his saved record and deployed-code version.
- The preview demonstrates layout, not live data loading or result persistence.
- Text and question weights are taken from input. The renderer does not force current questionnaire content into the reference's wording or weights.
- Extremely large scorecards fail an overflow check rather than silently shrinking/clipping or omitting questions.
- Existing multiple evaluation results require selecting the authoritative result; no guessed "latest" result is used.
