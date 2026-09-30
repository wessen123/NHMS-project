'use strict';
// Compatibility entry point only. The /process-evaluation pipeline imports
// services/pdf.service.js directly and owns its own upload/result write.
const {generatePDF}=require('../pdf.service');
async function generateEvaluationPDF(data) {
  if (!data?.responses?.evaluation?.sections) {
    throw new Error('generateEvaluationPDF requires data.responses containing the full evaluation snapshot; scoreResult alone cannot produce the scorecard');
  }
  const pdf=await generatePDF(data);
  const {uploadToNocoBase}=require('./upload.service');
  const uploaded=await uploadToNocoBase(pdf.filePath,pdf.fileName);
  return {...pdf,uploadedFile:uploaded};
}
module.exports={generateEvaluationPDF};
