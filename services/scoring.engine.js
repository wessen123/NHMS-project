/**
 * =========================
 * INDUSTRY STANDARD SCORING ENGINE
 * =========================
 * - Weighted scoring
 * - Critical section multipliers
 * - Penalty rules
 * - Benchmark normalization
 * - Grade classification
 */

const TEMPLATE = require("./template");

/**
 * =========================
 * CONFIGURATION (INDUSTRY RULES)
 * =========================
 */
const SECTION_MULTIPLIER = {
  approach: 1.0,
  qualifying: 1.2,
  demonstration: 1.1,
  presentation: 1.1,
  closing: 1.5,   // MOST IMPORTANT
  attitude: 1.0,
};

/**
 * Critical failure rules (industry standard)
 */
function applyPenalties(responses, score) {
  let penalty = 0;

  // Example: failure to close = major deduction
  if (responses.close_1?.value === "no") penalty += 10;
  if (responses.qual_1?.value === "no") penalty += 8;

  // attitude failure = soft penalty
  if (responses.att_2?.value === "no") penalty += 3;

  return Math.max(score - penalty, 0);
}

/**
 * =========================
 * MAIN SCORING FUNCTION
 * =========================
 */
function calculateFullScore(template, responses, benchmarks = null) {
  let section_scores = {};
  let weightedTotal = 0;
  let weightedMax = 0;

  template.forEach((section) => {
    let earned = 0;
    let max = 0;

    section.questions.forEach((q) => {

      // =========================
      // GROUP QUESTIONS
      // =========================
      if (q.type === "group") {
        q.sub.forEach((s) => {
          const ans = responses?.[s.id];

          max += s.weight;

          if (ans?.value === "yes") {
            earned += s.weight;
          }
        });
      }

      // =========================
      // NORMAL QUESTIONS
      // =========================
      else {
        const ans = responses?.[q.id];

        max += q.weight || 1;

        if (ans?.value === "yes") {
          earned += q.weight || 1;
        }
      }
    });

    const rawPercent = max > 0 ? (earned / max) * 100 : 0;

    // =========================
    // APPLY SECTION MULTIPLIER
    // =========================
    const multiplier = SECTION_MULTIPLIER[section.key] || 1;

    const adjusted = rawPercent * multiplier;

    section_scores[section.key] = Math.min(Math.round(adjusted), 100);

    weightedTotal += adjusted;
    weightedMax += 100 * multiplier;
  });

  // =========================
  // TOTAL SCORE
  // =========================
  let total = weightedMax > 0 ? (weightedTotal / weightedMax) * 100 : 0;

  // =========================
  // APPLY PENALTIES
  // =========================
  total = applyPenalties(responses, total);

  // =========================
  // BENCHMARK NORMALIZATION (OPTIONAL)
  // =========================
  let performance_index = null;

  if (benchmarks?.global_avg) {
    performance_index = Math.round((total / benchmarks.global_avg) * 100);
  }

  // =========================
  // INDUSTRY GRADE
  // =========================
  let grade = "F";

  if (total >= 90) grade = "A";
  else if (total >= 80) grade = "B";
  else if (total >= 70) grade = "C";
  else if (total >= 60) grade = "D";
  else grade = "F";

  return {
    total_score: Math.round(total),
    max_score: 100,
    percentage: Math.round(total), // IMPORTANT: still 0–100 internally

    section_scores,

    grade, // 🔥 INDUSTRY STANDARD ADDITION

    performance_index, // 🔥 BENCHMARK LAYER

    interpretation: {
      band:
        grade === "A"
          ? "Top Performer"
          : grade === "B"
          ? "Above Average"
          : grade === "C"
          ? "Average"
          : grade === "D"
          ? "Below Average"
          : "Critical Improvement Needed",
    },
  };
}

/**
 * =========================
 * WRAPPER
 * =========================
 */
function scoreEvaluation(responses_snapshot, benchmarks = null) {
  return calculateFullScore(TEMPLATE, responses_snapshot, benchmarks);
}

module.exports = {
  calculateFullScore,
  scoreEvaluation,
};