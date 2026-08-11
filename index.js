require("dotenv").config();

const express = require("express");
const cron = require("node-cron");

const { syncDropboxUploads } = require("./services/dropbox.sync.service");

const app = express();

app.use(express.json());

/* =========================
   ROUTES MOUNT POINT
========================= */
app.use("/uploadApi", require("./routes/upload.routes"));

/* =========================
   🚀 NEW: AI EVALUATION ROUTES
========================= */
app.use("/uploadApi", require("./routes/evaluation.routes"));

/* =========================
   HEALTH CHECK
========================= */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "upload-server"
  });
});

/* =========================
   DROPBOX SYNC CRON
   EVERY 1 MINUTE
========================= */
cron.schedule("*/1 * * * *", async () => {

  console.log("\n=================================");
  console.log("⏰ RUNNING DROPBOX SYNC");
  console.log("=================================\n");

  try {

    await syncDropboxUploads();

    console.log("\n✅ DROPBOX SYNC FINISHED\n");

  } catch (err) {

    console.error("\n❌ CRON FAILED");
    console.error(err.response?.data || err.message);
  }

});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

  console.log(`[UPLOAD-SERVER] running on port ${PORT}`);

  console.log("\n=================================");
  console.log("🚀 SYSTEM READY");
  console.log("✅ API READY");
  console.log("✅ DROPBOX READY");
  console.log("✅ EVALUATION AI READY");
  console.log("=================================\n");

});