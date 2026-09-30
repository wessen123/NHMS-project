# NHMS evaluation backend update

This package updates the supplied `processEvaluation(evaluationId)` pipeline. It uses the current questionnaire JSON and the local HTML/CSS source that produced `alana-reference-layout-preview.pdf`.

## Install the complete files

Back up the corresponding files in your existing uploadApi Node project, then copy these paths from the package into that project, preserving their directories:

- `services/evaluation.service.js`
- `services/openai.evaluation.js`
- `services/report.model.js`
- `services/pdf.service.js`
- `services/chart.service.js`
- `templates/questionnaire.schema.json`
- `templates/analysis.sections.js`
- `templates/report.template.html`
- `templates/report.styles.css`
- `templates/logo.png`
- `constants/industryBenchmarks.js`

The active pipeline is:

`existing HTTP controller -> services/evaluation.service.js -> services/openai.evaluation.js -> services/pdf.service.js -> attachment upload -> evaluation_results create/update`

Your controller must pass `req.body.evaluationId` to `processEvaluation`. The local reference project's controller already follows this contract, but the deployed route/controller has not been inspected. Keep your existing route mount and authentication middleware.

The separately pasted function named `generateEvaluationPDF` writes text rather than a PDF. The package includes an optional real-PDF replacement at `services/pdf/pdf.service.js` for that legacy entry point. Only copy that optional file if it is the actual location used by another existing caller. Its caller must provide `data.responses` containing the full snapshot; `scoreResult` alone is not enough to render a questionnaire. Its existing sibling `upload.service.js` remains in place. The main endpoint uses the root `services/pdf.service.js` and must not call the legacy wrapper as well (that would upload twice).

Keep `services/nocobase.service.js` as supplied. The evaluation service already performs its own NocoBase calls; unrelated order/shop methods do not need replacement. No database schema changes, Docker changes, route additions, or server configuration files are included.

The existing project needs `axios`, `form-data`, `openai` and `puppeteer`, with a working Chromium installation. These dependencies were listed in the local reference project's package.json. Use the current project's dependency installation process rather than replacing package.json. If dependencies are absent, install them in that project:

```bash
npm install axios form-data openai puppeteer
```

Existing environment variables:

- `NOCOBASE_URL` or `BASE_URL`: NocoBase origin, e.g. `https://portal.newhomemysteryshops.com`, without a trailing `/api` or `/uploadApi`.
- `NOCOBASE_TOKEN`: current backend NocoBase token.
- `OPENAI_API_KEY`: current OpenAI key.
- `OPENAI_MODEL`: keeps your configured model; defaults to the supplied code's `gpt-4o-mini`. It must support Chat Completions structured JSON output.
- `PUPPETEER_EXECUTABLE_PATH`: optional existing Chromium path if your host uses a system browser.

After copying the files, run the tests from the backend root and restart the existing Node process through your normal deployment method:

```bash
node tests/report.test.js
```

Tests require the included `tests/sample-responses.json`. They mock all AI, upload and NocoBase interactions and do not modify production data.

## HTTP request node ph2cu8bxq0e

| Setting | Value |
|---|---|
| HTTP method | POST |
| URL | https://portal.newhomemysteryshops.com/uploadApi/process-evaluation |
| Content-Type | application/json |
| Headers | Retain any authorization required by your existing uploadApi endpoint. Do not put the NocoBase backend token into a public client. |
| Parameters | None |
| Body | JSON object with `evaluationId` mapped to the saved **evaluation record's id** using NocoBase's upstream-variable picker |
| Timeout | 600000 ms as a starting allowance for two AI stages, browser rendering and upload; your existing upstream/proxy timeout also applies |
| Ignore failed request and continue | Off |

Body shape (replace the placeholder using the variable picker):

```json
{
  "evaluationId": "<ID of the saved evaluation record>"
}
```

Do not pass `responses_json.evaluation.shop.id`, the order ID, or the shop ID. Your sample snapshot does not include the containing evaluation record ID, so it cannot provide a literal ready-to-run request ID. The backend fetches the latest `evaluation.responses_json` itself; do not paste the entire snapshot into this request.

Run this node after the evaluation record save completes and while the record has `status: submitted` and `submitted_at`. Trigger it after submitted-answer edits as well if those should regenerate reports. Do not trigger it from `evaluation_results` updates, which could cause a loop. No workflow configuration was changed here.

Expected success response from a controller that wraps the service result:

```json
{
  "success": true,
  "data": {
    "success": true,
    "evaluation_id": "the evaluation record id",
    "result_id": "the linked result id",
    "attachment_id": "the uploaded PDF attachment id",
    "score_verified": true,
    "total_score": 64,
    "percentage": 64,
    "page_count": 5,
    "notes_requiring_attention": [],
    "report_issues": []
  }
}
```

IDs and page count depend on the actual result. The sample's seven placeholder notes (six section notes plus the final note) are returned with `status: insufficient`; missing visit times appear in `report_issues`.

## Saved data and scoring

| Location | Behavior |
|---|---|
| `evaluation.responses_json` | Read only. Original evaluator wording and answers remain unchanged. |
| `evaluation_results.responses_snapshot` | Exact original snapshot used for the generation, including each question's `yes_column` and `no_column`. |
| `evaluation_results.ai_analysis_json.refined_notes` | Entries with `key`, `original`, `refined`, and `status`. |
| `evaluation_results.ai_analysis_json.refined_evaluation` | Copy of the evaluation with only section/final notes replaced. Answers, scores and metadata must remain identical. |
| `evaluation_results.ai_analysis_json.source_hash` | Fingerprint of the original snapshot, used to identify stale analysis. |
| Existing result score, AI and PDF fields | Created for a new evaluation or updated together on the existing linked result. |
| `evaluation_results.pdf_report` | Attached using the uploaded attachment ID. |

The nested `refined_notes`, `refined_evaluation`, `source_hash`, and `prompt_version` keys are JSON properties inside the **existing** `ai_analysis_json` field; they are not new collection columns. This package uses the result fields already written by your supplied evaluation service. Live field types and write permissions still need verification in your environment.

YES gets full points. NO gets zero. N/A gets full points in YES and `N/A` in NO. For `limited` and `some`, the entered score (including zero, decimals or full points) goes in YES and `*` or `**` goes in NO. Legacy `nmd` shows the entered score in YES and `NMD` in NO. The informational question has null scores and does not affect the total.

The backend validates the 40 current question entries and all saved totals before publication. It does not redistribute points or run the older scoring engine. Provided YES/NO column values must agree with the answer and score. Older rows without the column properties can be rendered by deriving the same display values. Disagreements fail with a question-specific error rather than silently changing stored data.

## Notes and analysis

1. Strip only the generated section heading prefix (for example `APPROACH Notes:`).
2. Keep blank notes blank. Flag obvious placeholders such as `test`, `N/A`, or digits as insufficient; do not fabricate observations.
3. Copyedit meaningful notes in one structured AI request. Preserve uncertainty and negation. Ambiguous notes retain their original content and get `review_needed`.
4. Pass the refined notes and recorded question evidence to a separate structured AI analysis request.
5. Validate output shape and preserve original/refined pairs. The code also verifies that note refinement did not alter any non-note data.

Structured output constrains JSON structure, not factual truth. Review the refined notes and final coaching on the first live runs, particularly where the source note is ambiguous. Prompt instructions prohibit invented observations, changed scores, and treating N/A full credit as an observed success.

An unchanged snapshot with a matching prompt version and model reuses its existing refined notes and analysis. Changed answers/notes, or results created by the old pipeline, regenerate analysis. Existing old scores are deliberately updated from the validated new evaluation when regenerating; they are no longer left inconsistent with the new PDF.

## PDF layout and preview

The renderer preserves the reference's landscape US Letter size, logo, cover placement, blue scorecard styling, column arrangement, narrative typography, and comparison chart styling. The scorecard always contains the complete supplied questionnaire, including the informational question. It places grading marks in NO per your latest instruction, even though the older reference put some marks beside the YES score.

The real questionnaire has longer wording and an additional informational row compared with the reference transcription. The renderer fits it on one readable scorecard page, rather than omitting questions. Narrative page count follows actual text length; it is not hard-coded to the reference's seven pages. Meaningful refined section/final notes appear on dedicated evaluator-note pages after coaching. Missing visit times show `Not recorded`; they are not invented.

The included John Davis preview is a five-page **offline layout preview** using the supplied 64/100 snapshot. All provided notes say `test`, so its coaching pages explicitly state that no live AI analysis was run. This preview is not a uploaded/final client report. The runtime PDF has no preview banner unless `preview_label` is explicitly supplied.

To reproduce the preview locally (with Puppeteer and Chromium installed):

```bash
node scripts/preview.js tests/sample-responses.json john-davis-preview.pdf
```

The offline preview script deliberately refuses to call AI. If you replace the fixture with meaningful notes, use a supplied/mocked analysis for layout testing instead of expecting that script to refine them online.

## Verification and operational limits

Validated locally: sample scores; all YES/NO column mappings; zero/decimal/full manual credit; informational row; malformed snapshot rejection; HTML escaping; placeholder handling; copyediting before analysis; preservation of originals; AI failure handling; new-result creation; existing-result regeneration and cache reuse; source drift detection; upload failure handling. The generated PDF was opened with Poppler and every page visually reviewed.

Not executed: live OpenAI requests, endpoint authentication, real NocoBase reads/writes, live attachment upload, and the deployed workflow.

Requests for the same evaluation are coalesced within one Node process. Fresh reads detect source/result changes before upload/write. These checks are not a database transaction or a distributed lock: serialize jobs for an evaluation across multiple backend processes and avoid editing it while a report job is running. If a failure occurs after upload, an unused attachment can remain; if the final verification fails after a successful write, inspect the stored result before retrying. No automatic destructive cleanup is performed.

Video links use the known `edited_videos.nhms_shop_id` and `url` fields. No video shows unavailable. Multiple videos stop publication rather than guessing which is final; provide the final-selection rule if that applies to your shops.

Official API reference used for the structured JSON requests: https://developers.openai.com/api/docs/guides/structured-outputs
