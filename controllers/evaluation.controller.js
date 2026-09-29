
const evaluationService =
  require("../services/evaluation.service");

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

      // Axios error objects may contain Authorization headers. Log a safe message only.
      console.error("[NHMS report]", err.message);

      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  };
