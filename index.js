
require("dotenv").config();

const express = require("express");
const cron = require("node-cron");


/* =====================================================
   EXPRESS APP
===================================================== */

const app = express();


/* =====================================================
   CONFIGURATION
===================================================== */

const PORT =
  Number(process.env.PORT) || 5000;


/* =====================================================
   DROPBOX RAW VIDEO SYNC
===================================================== */

const {
  syncDropboxUploads
} = require(
  "./services/dropbox.sync.service"
);


/* =====================================================
   DROPBOX EDITED VIDEO SYNC

   IMPORTANT:

   This service exports an INSTANCE:

   module.exports =
     new EditedVideoDropboxSyncService();

   Therefore we import the whole service object and call:

   EditedVideoDropboxSyncService.syncDropboxUploads()
===================================================== */

const EditedVideoDropboxSyncService =
  require(
    "./services/edited-video-dropbox.sync.service"
  );


/* =====================================================
   VALIDATE REQUIRED SYNC METHODS
===================================================== */

if (
  typeof syncDropboxUploads !==
  "function"
) {

  throw new Error(
    "RAW VIDEO SYNC ERROR: syncDropboxUploads is not exported correctly from ./services/dropbox.sync.service"
  );

}


if (
  !EditedVideoDropboxSyncService
) {

  throw new Error(
    "EDITED VIDEO SYNC ERROR: edited-video-dropbox.sync.service did not export a service"
  );

}


if (
  typeof EditedVideoDropboxSyncService
    .syncDropboxUploads !==
  "function"
) {

  throw new Error(
    "EDITED VIDEO SYNC ERROR: syncDropboxUploads is not exported correctly from ./services/edited-video-dropbox.sync.service"
  );

}


/* =====================================================
   EXPRESS MIDDLEWARE
===================================================== */

app.use(
  express.json({
    limit: "10mb"
  })
);


/* =====================================================
   ROUTES
===================================================== */

app.use(
  "/uploadApi",
  require(
    "./routes/upload.routes"
  )
);


app.use(
  "/uploadApi",
  require(
    "./routes/evaluation.routes"
  )
);


/* =====================================================
   HEALTH CHECK
===================================================== */

app.get(
  "/health",
  (req, res) => {

    res.status(200).json({

      status:
        "ok",

      service:
        "upload-server",

      timestamp:
        new Date().toISOString(),

      sync: {

        raw_video:
          "ready",

        edited_video:
          "ready"

      }

    });

  }
);


/* =====================================================
   PREVENT OVERLAPPING DROPBOX SYNCS

   If a sync takes longer than one minute,
   the next cron execution will be skipped.
===================================================== */

let isDropboxSyncRunning =
  false;


/* =====================================================
   RUN RAW VIDEO SYNC
===================================================== */

async function runRawVideoSync() {

  console.log("\n=================================");
  console.log("📥 RAW VIDEO SYNC START");
  console.log("=================================\n");


  try {

    await syncDropboxUploads();


    console.log("\n=================================");
    console.log("✅ RAW VIDEO SYNC FINISHED");
    console.log("=================================\n");


    return {

      success:
        true

    };


  } catch (error) {

    console.error("\n=================================");
    console.error("❌ RAW VIDEO SYNC FAILED");
    console.error("=================================\n");


    console.error(
      error.response?.data ||
      error.stack ||
      error.message ||
      error
    );


    return {

      success:
        false,

      error:
        error.message

    };

  }

}


/* =====================================================
   RUN EDITED VIDEO SYNC
===================================================== */

async function runEditedVideoSync() {

  console.log("\n=================================");
  console.log("🎬 EDITED VIDEO SYNC START");
  console.log("=================================\n");


  try {

    /*
     * The edited-video service exports
     * a service instance.
     */

    await EditedVideoDropboxSyncService
      .syncDropboxUploads();


    console.log("\n=================================");
    console.log("✅ EDITED VIDEO SYNC FINISHED");
    console.log("=================================\n");


    return {

      success:
        true

    };


  } catch (error) {

    console.error("\n=================================");
    console.error("❌ EDITED VIDEO SYNC FAILED");
    console.error("=================================\n");


    console.error(
      error.response?.data ||
      error.stack ||
      error.message ||
      error
    );


    return {

      success:
        false,

      error:
        error.message

    };

  }

}


/* =====================================================
   RUN ALL DROPBOX SYNCS
===================================================== */

async function runDropboxSyncs() {


  /* ===================================================
     PREVENT OVERLAPPING RUNS
  =================================================== */

  if (
    isDropboxSyncRunning
  ) {

    console.warn(
      "\n⚠️ DROPBOX SYNC ALREADY RUNNING"
    );

    console.warn(
      "⏭️ SKIPPING THIS CRON CYCLE\n"
    );


    return {

      skipped:
        true,

      reason:
        "sync_already_running"

    };

  }


  isDropboxSyncRunning =
    true;


  const startedAt =
    new Date();


  console.log("\n=================================");
  console.log("⏰ ALL DROPBOX SYNCS START");
  console.log("=================================");

  console.log(
    startedAt.toISOString()
  );

  console.log("=================================\n");


  let rawVideoResult;
  let editedVideoResult;


  try {


    /* =================================================
       1. RAW VIDEO SYNC
    ================================================= */

    rawVideoResult =
      await runRawVideoSync();


    /* =================================================
       2. EDITED VIDEO SYNC

       Run even if raw video sync fails.
    ================================================= */

    editedVideoResult =
      await runEditedVideoSync();


    return {

      success:

        rawVideoResult.success &&

        editedVideoResult.success,


      raw_video:
        rawVideoResult,


      edited_video:
        editedVideoResult

    };


  } catch (error) {

    /*
     * This should rarely be reached because
     * each sync handles its own errors.
     */

    console.error(
      "\n❌ UNEXPECTED DROPBOX SYNC ERROR"
    );


    console.error(
      error.stack ||
      error.message ||
      error
    );


    return {

      success:
        false,

      error:
        error.message

    };


  } finally {


    /* =================================================
       ALWAYS RELEASE LOCK
    ================================================= */

    isDropboxSyncRunning =
      false;


    const finishedAt =
      new Date();


    const durationSeconds =
      (
        finishedAt -
        startedAt
      ) / 1000;


    console.log("\n=================================");
    console.log("🏁 ALL DROPBOX SYNCS FINISHED");
    console.log("=================================");

    console.log(
      "FINISHED:",
      finishedAt.toISOString()
    );

    console.log(
      "DURATION:",
      `${durationSeconds.toFixed(2)} seconds`
    );

    console.log("=================================\n");

  }

}


/* =====================================================
   CRON JOB

   RUN EVERY 1 MINUTE
===================================================== */

const dropboxCronJob =
  cron.schedule(

    "*/1 * * * *",

    async () => {

      try {

        await runDropboxSyncs();

      } catch (error) {

        console.error(
          "\n❌ CRON EXECUTION ERROR"
        );


        console.error(
          error.stack ||
          error.message ||
          error
        );

      }

    },

    {

      scheduled:
        true

    }

  );


/* =====================================================
   START SERVER
===================================================== */

app.listen(
  PORT,
  () => {

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

    console.log(
      "✅ API READY"
    );

    console.log(
      "✅ DROPBOX RAW VIDEO SYNC READY"
    );

    console.log(
      "✅ DROPBOX EDITED VIDEO SYNC READY"
    );

    console.log(
      "✅ EVALUATION AI READY"
    );

    console.log(
      "⏰ DROPBOX CRON: EVERY 1 MINUTE"
    );

    console.log(
      `🟢 CRON STATUS: ${
        dropboxCronJob
          ? "RUNNING"
          : "NOT RUNNING"
      }`
    );

    console.log("=================================\n");


    /* ===============================================
       RUN INITIAL SYNC

       Run immediately after server startup.
    =============================================== */

    console.log(
      "🚀 RUNNING INITIAL DROPBOX SYNC..."
    );


    setImmediate(
      () => {

        runDropboxSyncs()
          .then(
            result => {

              console.log(
                "🏁 INITIAL DROPBOX SYNC RESULT:"
              );

              console.log(
                JSON.stringify(
                  result,
                  null,
                  2
                )
              );

            }
          )
          .catch(
            error => {

              console.error(
                "❌ INITIAL DROPBOX SYNC FAILED:"
              );


              console.error(
                error.stack ||
                error.message ||
                error
              );

            }
          );

      }
    );

  }
);


/* =====================================================
   GRACEFUL SHUTDOWN
===================================================== */

function shutdown(signal) {

  console.log(
    `\n⚠️ ${signal} RECEIVED`
  );


  console.log(
    "🛑 STOPPING DROPBOX CRON..."
  );


  if (
    dropboxCronJob &&
    typeof dropboxCronJob.stop ===
      "function"
  ) {

    dropboxCronJob.stop();

  }


  console.log(
    "🛑 SERVER SHUTDOWN"
  );


  process.exit(
    0
  );

}


process.on(
  "SIGTERM",
  () => shutdown(
    "SIGTERM"
  )
);


process.on(
  "SIGINT",
  () => shutdown(
    "SIGINT"
  )
);
