#!/usr/bin/env node
"use strict";
// Offline renderer: performs no API requests and never writes to NocoBase.
// Input is the explicit generatePDF DTO described in REPORT-INSTALL.md.
const fs = require("fs");
const path = require("path");
const { generatePDF } = require("../services/pdf.service");
async function main() {
  const [inputPath, outputPath, mappingPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) throw new Error("Usage: node scripts/render-report.js input.json output.pdf [verified-question-field-map.json]");
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const options = { outputPath: path.resolve(outputPath), htmlPath: path.resolve(outputPath).replace(/\.pdf$/i, ".html") };
  if (mappingPath) options.fields = JSON.parse(fs.readFileSync(mappingPath, "utf8"));
  const result = await generatePDF(input, options);
  fs.writeFileSync(path.resolve(outputPath).replace(/\.pdf$/i, ".verification.json"), JSON.stringify({
    pageCount: result.pageCount, scoreVerified: result.scoreVerified, issues: result.issues,
  }, null, 2));
  console.log(JSON.stringify({ filePath: result.filePath, pageCount: result.pageCount, scoreVerified: result.scoreVerified, issueCount: result.issues.length }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
