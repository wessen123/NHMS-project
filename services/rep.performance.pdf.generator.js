const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const {
  getRepPerformanceReportData
} = require(
  "./rep.performance.pdf"
);

const {
  buildRepPerformanceHTML
} = require(
  "./rep.performance.template"
);

// =====================================
// GENERATE REP PDF
// =====================================
async function generateRepPerformancePDF(
  salesRepId
) {

  const report =

    await getRepPerformanceReportData(
      salesRepId
    );

  const html =

    buildRepPerformanceHTML(
      report
    );

  const browser =
    await puppeteer.launch({

      headless: true,

      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox"
      ]
    });

  const page =
    await browser.newPage();

  await page.setContent(
    html,
    {
      waitUntil:
        "networkidle0"
    }
  );

  const reportsDir =
    path.join(
      process.cwd(),
      "uploads",
      "reports"
    );

  if (
    !fs.existsSync(
      reportsDir
    )
  ) {

    fs.mkdirSync(
      reportsDir,
      {
        recursive: true
      }
    );
  }

  const filePath =
    path.join(

      reportsDir,

      `rep-performance-${salesRepId}.pdf`
    );

  await page.pdf({

    path:
      filePath,

    format:
      "A4",

    printBackground:
      true
  });

  await browser.close();

  return {

    filePath,

    report
  };
}

module.exports = {
  generateRepPerformancePDF
};