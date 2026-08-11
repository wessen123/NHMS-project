const fs = require("fs");
const path = require("path");
const { uploadToNocoBase } = require("./upload.service");

async function generateEvaluationPDF(data) {
  console.log("📄 PDF GENERATION START");

  const fileName = `evaluation_${data.evaluation_id}.pdf`;
  const filePath = path.join(process.cwd(), "uploads", "pdfs", fileName);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const content = `
EVALUATION REPORT

ID: ${data.evaluation_id}
TOTAL SCORE: ${data.scoreResult.total_score}
GRADE: ${data.scoreResult.grade}

QUALITY: ${data.quality_status}
TIER: ${data.performance_tier}

AI SUMMARY:
${data.aiResult.ai_summary}
`;

  fs.writeFileSync(filePath, content);

  console.log("📄 PDF CREATED:", filePath);

  const uploaded = await uploadToNocoBase(filePath, fileName);

  return {
    filePath,
    uploadedFile: uploaded,
  };
}

module.exports = {
  generateEvaluationPDF,
};