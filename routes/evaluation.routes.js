
const router =
  require("express").Router();

const controller =
  require("../controllers/evaluation.controller");

router.post(
  "/process-evaluation",
  controller.processEvaluation
);

router.get(
  "/health",
  (req, res) => {
    res.json({
      ok: true,
    });
  }
);

module.exports = router;
