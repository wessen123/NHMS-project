const router = require("express").Router();

/* =========================
   CONTROLLER (UNCHANGED)
========================= */
const controller = require("../controllers/upload.controller");

/* =========================
   MAIN ROUTE
   FINAL URL:
   POST /uploadApi/create-order-upload-links
========================= */
router.post(
  "/create-order-upload-links",
  controller.processOrder
);

/* =========================
   OLD ROUTE (KEEP FOR BACKWARD COMPATIBILITY)
   POST /uploadApi/process-order
========================= */
router.post(
  "/process-order",
  controller.processOrder
);

/* =========================
   HEALTH CHECK FOR ROUTER
   GET /uploadApi/health
========================= */
router.get("/health", (req, res) => {
  res.json({ ok: true });
});

module.exports = router;