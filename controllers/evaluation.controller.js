const evaluationService =
  require("../services/evaluation.service");

const reportRegenerationService =
  require("../services/report-regeneration.service");


exports.processEvaluation =
  async (req, res) => {

    try {

      const evaluationId =
        req.body.evaluationId;

      if (!evaluationId) {
        return res.status(400).json({
          success: false,
          message:
            "evaluationId is required",
        });
      }

      const result =
        await evaluationService
          .processEvaluation(
            evaluationId
          );

      return res.json({
        success: true,
        data: result,
      });

    } catch (err) {

      console.error(
        "[NHMS report]",
        err.message
      );

      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  };


exports.regenerateReport =
  async (req, res) => {

    try {

      const evaluationResultId =
        req.body.evaluation_result_id;

      const evaluationId =
        req.body.evaluation_id;

      if (!evaluationResultId) {
        return res.status(400).json({
          success: false,
          message:
            "evaluation_result_id is required",
        });
      }

      if (!evaluationId) {
        return res.status(400).json({
          success: false,
          message:
            "evaluation_id is required",
        });
      }

      const result =
        await reportRegenerationService
          .regenerateReport({
            evaluationResultId,
            evaluationId,
          });

      return res.json({
        success: true,
        data: result,
      });

    } catch (err) {

      console.error(
        "[NHMS PDF regeneration]",
        err.message
      );

      return res.status(500).json({
        success: false,
        error: err.message,
        code:
          err.code ||
          "PDF_REGENERATION_FAILED",
      });
    }
  };