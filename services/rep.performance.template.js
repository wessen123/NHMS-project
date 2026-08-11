const fs = require("fs");
const path = require("path");

// =====================================
// BUILD SCORECARD TABLE
// =====================================
function buildScorecardTable(
  scorecard
) {

  const rows =
    scorecard.map(
      row => `
<tr>
  <td>${row.category}</td>
  <td>${row.score}</td>
</tr>
`
    ).join("");

  return `
<table>

  <thead>

    <tr>
      <th>Category</th>
      <th>Average Score</th>
    </tr>

  </thead>

  <tbody>
    ${rows}
  </tbody>

</table>
`;
}

// =====================================
// BUILD HISTORY TABLE
// =====================================
function buildHistoryTable(
  history
) {

  const rows =
    history.map(
      row => `
<tr>
  <td>${row.date}</td>
  <td>${row.community}</td>
  <td>${row.score}%</td>
</tr>
`
    ).join("");

  return `
<table>

  <thead>

    <tr>
      <th>Date</th>
      <th>Community</th>
      <th>Score</th>
    </tr>

  </thead>

  <tbody>
    ${rows}
  </tbody>

</table>
`;
}

// =====================================
// BUILD HTML
// =====================================
function buildRepPerformanceHTML(
  report
) {

  const templatePath =
    path.join(
      __dirname,
      "../templates/rep.performance.template.html"
    );

  let html =
    fs.readFileSync(
      templatePath,
      "utf8"
    );

  const summary =
    report.summary;

  html = html

    .replace(
      "{{SALES_REP}}",
      summary.sales_rep_name || "Sales Rep"
    )

    .replace(
      "{{AVG_SCORE}}",
      String(
        summary.avg_score || 0
      )
    )

    .replace(
      "{{TOTAL_EVALUATIONS}}",
      String(
        summary.total_evaluations || 0
      )
    )

    .replace(
      "{{BEST_SCORE}}",
      String(
        summary.best_score || 0
      )
    )

    .replace(
      "{{WORST_SCORE}}",
      String(
        summary.worst_score || 0
      )
    )

    .replace(
      "{{AI_SUMMARY}}",
      summary.ai_summary || ""
    )

    .replace(
      "{{AI_APPROACH}}",
      summary.ai_approach_summary || ""
    )

    .replace(
      "{{AI_QUALIFYING}}",
      summary.ai_qualifying_summary || ""
    )

    .replace(
      "{{AI_DEMONSTRATION}}",
      summary.ai_demonstration_summary || ""
    )

    .replace(
      "{{AI_PRESENTATION}}",
      summary.ai_presentation_summary || ""
    )

    .replace(
      "{{AI_CLOSING}}",
      summary.ai_closing_summary || ""
    )

    .replace(
      "{{AI_ATTITUDE}}",
      summary.ai_attitude_summary || ""
    )

    .replace(
      "{{SCORECARD_TABLE}}",
      buildScorecardTable(
        report.scorecard
      )
    )

    .replace(
      "{{HISTORY_TABLE}}",
      buildHistoryTable(
        report.history
      )
    );

  return html;
}

module.exports = {
  buildRepPerformanceHTML
};