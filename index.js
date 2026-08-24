require("dotenv").config();

const express = require("express");
const cron = require("node-cron");

/* =========================
   DROPBOX RAW VIDEO SYNC
========================= */
const {
  syncDropboxUploads
} = require("./services/dropbox.sync.service");

/* =========================
   DROPBOX EDITED VIDEO SYNC
========================= */
const {
  syncDropboxEditedVideos
} = require("./services/dropbox.edited.sync.service");

const app = express();

app.use(express.json());

/* =========================
   ROUTES MOUNT POINT
========================= */

app.use(
  "/uploadApi",
  require("./routes/upload.routes")
);

/* =========================
   AI EVALUATION ROUTES
========================= */

app.use(
  "/uploadApi",
  require("./routes/evaluation.routes")
);

/* =========================
   HEALTH CHECK
========================= */

app.get("/health", (req, res) => {

  res.json({
    status: "ok",
    service: "upload-server"
  });

});

/* =====================================================
   DROPBOX SYNC CRON
   RUNS EVERY 1 MINUTE
===================================================== */

cron.schedule("*/1 * * * *", async () => {

  console.log("\n=================================");
  console.log("⏰ DROPBOX SYNC START");
  console.log("=================================");
  console.log(
    new Date().toISOString()
  );
  console.log("=================================\n");


  /* ===================================================
     1. RAW VIDEO SYNC
  =================================================== */

  try {

    console.log("\n=================================");
    console.log("📥 RAW VIDEO SYNC START");
    console.log("=================================\n");

    await syncDropboxUploads();

    console.log("\n=================================");
    console.log("✅ RAW VIDEO SYNC FINISHED");
    console.log("=================================\n");

  } catch (error) {

    console.error("\n=================================");
    console.error("❌ RAW VIDEO SYNC FAILED");
    console.error("=================================\n");

    console.error(
      error.response?.data ||
      error.message
    );

  }


  /* ===================================================
     2. EDITED VIDEO SYNC
  =================================================== */

  try {

    console.log("\n=================================");
    console.log("🎬 EDITED VIDEO SYNC START");
    console.log("=================================\n");

    await syncDropboxEditedVideos();

    console.log("\n=================================");
    console.log("✅ EDITED VIDEO SYNC FINISHED");
    console.log("=================================\n");

  } catch (error) {

    console.error("\n=================================");
    console.error("❌ EDITED VIDEO SYNC FAILED");
    console.error("=================================\n");

    console.error(
      error.response?.data ||
      error.message
    );

  }


  /* ===================================================
     COMPLETE
  =================================================== */

  console.log("\n=================================");
  console.log("✅ ALL DROPBOX SYNCS FINISHED");
  console.log("=================================");
  console.log(
    new Date().toISOString()
  );
  console.log("=================================\n");

});


/* =====================================================
   START SERVER
===================================================== */

const PORT =
  process.env.PORT || 5000;

app.listen(PORT, () => {

  console.log("\n=================================");
  console.log("🚀 UPLOAD SERVER STARTED");
  console.log("=================================");

  console.log(
    `🌐 PORT: ${PORT}`
  );

  console.log(
    `🌐 HEALTH: http://localhost:${PORT}/health`
  );

  console.log("=================================");
  console.log("✅ API READY");
  console.log("✅ DROPBOX RAW VIDEO SYNC READY");
  console.log("✅ DROPBOX EDITED VIDEO SYNC READY");
  console.log("✅ EVALUATION AI READY");
  console.log("⏰ DROPBOX CRON: EVERY 1 MINUTE");
  console.log("=================================\n");

});