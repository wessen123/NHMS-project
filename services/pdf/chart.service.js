const { ChartJSNodeCanvas } = require("chartjs-node-canvas");

const width = 900;
const height = 600;

const chartCanvas = new ChartJSNodeCanvas({ width, height });

/**
 * RADAR CHART
 */
async function generateRadarChart(sectionScores) {
  const labels = Object.keys(sectionScores);
  const values = Object.values(sectionScores);

  const config = {
    type: "radar",
    data: {
      labels,
      datasets: [
        {
          label: "Performance",
          data: values,
          fill: true,
          backgroundColor: "rgba(54, 162, 235, 0.2)",
          borderColor: "rgba(54, 162, 235, 1)",
        },
      ],
    },
    options: {
      responsive: false,
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
        },
      },
    },
  };

  return await chartCanvas.renderToBuffer(config);
}

/**
 * BENCHMARK CHART
 */
async function generateBenchmarkChart(repScore, industryAvg = 74) {
  const config = {
    type: "bar",
    data: {
      labels: ["Industry Avg", "Rep Score"],
      datasets: [
        {
          label: "Comparison",
          data: [industryAvg, repScore],
          backgroundColor: ["#999", "#4CAF50"],
        },
      ],
    },
    options: {
      responsive: false,
    },
  };

  return await chartCanvas.renderToBuffer(config);
}

module.exports = {
  generateRadarChart,
  generateBenchmarkChart,
};