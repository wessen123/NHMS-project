"use strict";
const INDUSTRY = require("../constants/industryBenchmarks");
const { number, SECTION_DEFINITIONS } = require("./report.model");
function generateChartData(evaluation) {
  const sections = evaluation?.sections || [];
  return SECTION_DEFINITIONS.map(([key, category]) => {
    const section = sections.find(s => s.key === key);
    const earned = number(section?.section_score);
    const possible = number(section?.possible_score);
    return { category, industry: number(INDUSTRY[key]),
      salesRep: earned !== null && possible > 0 ? Math.round(earned / possible * 100) : null };
  }).concat({ category: "Total", industry: number(INDUSTRY.total),
    salesRep: number(evaluation?.scores?.percentage ?? evaluation?.percentage) });
}
module.exports = { generateChartData };
