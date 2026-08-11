function getQualityStatus(score) {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "warning";
  return "critical";
}

function getPerformanceTier(score) {
  if (score >= 90) return "elite";
  if (score >= 80) return "platinum";
  if (score >= 70) return "gold";
  if (score >= 60) return "silver";
  return "bronze";
}

module.exports = {
  getQualityStatus,
  getPerformanceTier,
};