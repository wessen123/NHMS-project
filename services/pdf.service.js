const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

// =====================================
// SAFE FILE NAME
// =====================================
function safeFileName(text) {
  return String(text || "")
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase();
}

// =====================================
// SCORECARD HTML
// =====================================
// =====================================
// SCORECARD HTML
// =====================================

function buildScorecardHTML(data) {

const sections =
data.responses?.evaluation?.sections || [];

function renderSection(section) {

if (!section) {
  return "";
}

const efficiency =
  section.possible_score > 0
    ? Math.round(
        (
          section.section_score /
          section.possible_score
        ) * 100
      )
    : 0;

let rows = "";

(section.questions || []).forEach((q) => {

  const earned =
    Number(q.earned || 0);

  const possible =
    Number(q.possible || 0);

  const missed =
    Math.max(
      possible - earned,
      0
    );

  rows += `
    <tr>

      <td class="index-col">
        ${q.number || ""}
      </td>

      <td class="question-col">
        ${q.question || ""}
      </td>

      <td class="possible-col">
        ${possible}
      </td>

      <td class="yes-col">
        ${earned > 0 ? earned : ""}
      </td>

      <td class="no-col">
        ${missed > 0 ? missed : ""}
      </td>

    </tr>
  `;
});

return `

  <div class="scorecard-section">

    <table class="nhms-scorecard">

      <tr class="nhms-section-header">
      <table class="nhms-scorecard">

  <colgroup>


<col style="width:3%">

<col style="width:70%">

<col style="width:9%">

<col style="width:9%">

<col style="width:9%">


  </colgroup>

  <tr class="nhms-section-header">


<td colspan="5">

  <div class="header-flex">

    <span>
      ${section.title}
      (${section.possible_score})
    </span>

    <span>
      Efficiency Rating: ${efficiency}%
    </span>

  </div>

</td>

  </tr>

  <tr class="nhms-column-header">


<th class="index-col">
  #
</th>

<th class="question-col">
  Question
</th>

<th class="possible-col">
  Possible
</th>

<th class="yes-col">
  YES
</th>

<th class="no-col">
  NO
</th>


  

       
      </tr>

      ${rows}

    </table>


  </div>
`;

}

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

const closing =
sections.find(
s => s.key === "closing"
);

const presentation =
sections.find(
s => s.key === "presentation"
);

const attitude =
sections.find(
s => s.key === "attitude"
);

return `

<div class="scorecard-grid">

  <div class="scorecard-column">


<table class="nhms-scorecard">

  <tr class="nhms-section-header">

    <td colspan="2">

      Improved Performance Through Evaluation

    </td>

  </tr>

  <tr>

    <td>

      <strong>Date:</strong>
      ${data.generated_at || ""}

    </td>

    <td>

      <strong>Total Score:</strong>
      ${data.percentage || 0}% (100 Possible)

    </td>

  </tr>

  <tr>

    <td colspan="2">

      <strong>Representative (SR):</strong>
      ${data.sales_rep_name || ""}

    </td>

  </tr>

  <tr>

    <td colspan="2">

      <strong>Community:</strong>
      ${data.community_name || ""}

    </td>

  </tr>

</table>

${renderSection(approach)}

${renderSection(qualifying)}

${renderSection(demonstration)}


  </div>

  <div class="scorecard-column">


<table class="nhms-scorecard">

  <tr class="nhms-section-header">

    <td>

      Shop Visit Information

    </td>

  </tr>

  <tr>

    <td>

      <strong>Time In:</strong>
      ${data.metadata?.time_in || ""}

      &nbsp;&nbsp;&nbsp;&nbsp;

      <strong>Time Out:</strong>
      ${data.metadata?.time_out || ""}

    </td>

  </tr>

</table>

${renderSection(closing)}

${renderSection(presentation)}

${renderSection(attitude)}


  </div>

</div>

`;

}

// =====================================
// AI ANALYSIS HTML
// =====================================
function buildAnalysisHTML(sections) {
  let html = "";

  (sections || []).forEach(
    (section) => {
      html += `
        <div class="analysis-section">

          <div class="analysis-title">
            ${section.title || ""}
          </div>

          <div class="analysis-summary">
            ${
              section.narrative ||
              section.summary ||
              ""
            }
          </div>

          <div class="analysis-subtitle">
            Key Strengths
          </div>

          <ul class="analysis-list">

            ${(section.strengths || [])
              .map(
                (item) =>
                  `<li>${item}</li>`
              )
              .join("")}

          </ul>

          <div class="analysis-subtitle">
            Coaching Opportunities
          </div>

          <ul class="analysis-list">

            ${(section.opportunities || [])
              .map(
                (item) =>
                  `<li>${item}</li>`
              )
              .join("")}

          </ul>

        </div>
      `;
    }
  );

  return html;
}

// =====================================
// GENERATE PDF
// =====================================
async function generatePDF(data) {
  const templatePath =
    path.join(
      process.cwd(),
      "templates",
      "report.template.html"
    );

  const cssPath =
    path.join(
      process.cwd(),
      "templates",
      "report.styles.css"
    );

  const logoPath =
    path.join(
      process.cwd(),
      "templates",
      "logo.png"
    );
    if (!fs.existsSync(logoPath)) {

  throw new Error(
    `Logo not found: ${logoPath}`
  );
}

console.log(
  "✓ Logo Loaded:",
  logoPath
);

  const reportsDir =
    path.join(
      process.cwd(),
      "uploads",
      "reports"
    );

  // =====================================
  // CREATE FOLDER
  // =====================================
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, {
      recursive: true,
    });
  }

  const now = new Date();

  const formattedDate =
    now
      .toISOString()
      .replaceAll(/[:.]/g, "-");

  const repName =
    safeFileName(
      data.sales_rep_name
    );

  const fileName =
    `${repName}_${formattedDate}.pdf`;

  const filePath =
    path.join(
      reportsDir,
      fileName
    );

  // =====================================
  // LOAD HTML
  // =====================================
  let html =
    fs.readFileSync(
      templatePath,
      "utf8"
    );

  const css =
    fs.readFileSync(
      cssPath,
      "utf8"
    );

  // =====================================
  // BUILD HTML
  // =====================================
  const scorecardHTML =
    buildScorecardHTML(data);

  const analysisHTML =
  buildAnalysisHTML(
    data.sections || []
  );

  // =====================================
  // INLINE CSS
  // =====================================
html = html.replace(
  "</head>",
  `<style>
${css}
</style>
</head>`
);
  console.log(
  "CSS SIZE:",
  css.length
);
console.log(
  "STYLE TAG FOUND:",
  html.includes(
    "report.styles.css"
  )
);

const logoBase64 =
  fs.readFileSync(
    logoPath
  ).toString("base64");

html = html.replaceAll(
  "{{LOGO_PATH}}",
  `data:image/png;base64,${logoBase64}`
);
  // =====================================
  // VARIABLES
  // =====================================
  html = html

  

    .replaceAll(
      "{{SALES_REP_NAME}}",
      data.sales_rep_name ||
        "N/A"
    )

    .replaceAll(
      "{{COMMUNITY_NAME}}",
      data.community_name ||
        "N/A"
    )

  
    .replaceAll(
      "{{GENERATED_AT}}",
      now.toLocaleString()
    )
  .replaceAll(
    "{{TIME_IN}}",
    String(
      data.metadata?.time_in || "N/A"
    )
  )
.replaceAll(
    "{{TIME_OUT}}",
    String(
      data.metadata?.time_out || "N/A"
    )
  )
  .replaceAll(
  "{{REPORT_DATE}}",
  new Date(
    data.metadata?.shop_date ||
    Date.now()
  ).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric"
    }
  )
)
  
    .replace(
      "{{PERCENTAGE}}",
      String(
        data.percentage || 0
      )
    )

    .replace(
      "{{EVALUATOR_NOTE}}",
      data.evaluator_note || ""
    )

    .replace(
      "{{EXECUTIVE_SUMMARY}}",
      data.executive_summary ||
        ""
    )

    .replace(
      "{{SCORECARD_HTML}}",
      scorecardHTML
    )

    .replace(
      "{{AI_ANALYSIS_HTML}}",
      analysisHTML
    )

    .replace(
      "{{CHART_DATA}}",
      JSON.stringify(
        data.chartData || []
      )
    );
    console.log(
  "TIME_IN LEFT:",
  html.includes("{{TIME_IN}}")
);

console.log(
  "TIME_OUT LEFT:",
  html.includes("{{TIME_OUT}}")
);

console.log(
  html.match(/\{\{.*?\}\}/g)
);
 

  // =====================================
  // BROWSER
  // =====================================
  const browser =
  await puppeteer.launch({

    headless: "new",

    args: [

      "--no-sandbox",

      "--disable-setuid-sandbox",

      "--font-render-hinting=medium",
    ],
  });

  const page =
  await browser.newPage();
  const timeSnippet =
  html.substring(
    html.indexOf("Time In"),
    html.indexOf("Representative")
  );

console.log(timeSnippet);

await page.setContent(
  html,
  {
    waitUntil:
      "domcontentloaded",

    timeout: 0,
  }
);
const chartLoaded =
  await page.evaluate(() => {

    return typeof Chart !==
      "undefined";

  });

console.log(
  "CHART LOADED:",
  chartLoaded
);

await new Promise(
  resolve =>
    setTimeout(
      resolve,
      3000
    )
);

// Give Chart.js time to render




const chartInfo =
  await page.evaluate(() => {

    const canvas =
      document.getElementById(
        "comparisonChart"
      );

    return {

      chartLoaded:
        typeof Chart !==
        "undefined",

      canvasExists:
        !!canvas,

      canvasWidth:
        canvas?.width,

      canvasHeight:
        canvas?.height,

      chartData:
        typeof chartData !==
        "undefined"
          ? chartData
          : null
    };
  });

console.log(
  "CHART INFO:",
  JSON.stringify(
    chartInfo,
    null,
    2
  )
);
  // =====================================
  // PDF
  // =====================================
 await page.pdf({

  path: filePath,

  format: "A4",

  printBackground: true,

  preferCSSPageSize: true,

  displayHeaderFooter: false,

  margin: {

    top: "35px",

    right: "25px",

    bottom: "25px",

    left: "25px",
  },
});

  await browser.close();

  return {
    fileName,
    filePath,
  };
}

// =====================================
// EXPORT
// =====================================
module.exports = {
  generatePDF,
};