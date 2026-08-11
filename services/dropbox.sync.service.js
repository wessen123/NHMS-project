
// services/dropbox.sync.service.js

const NocoBaseService = require("./nocobase.service");
const DropboxService = require("./dropbox.service");

exports.syncDropboxUploads = async () => {

  console.log("\n=================================");
  console.log("🔄 DROPBOX SYNC START");
  console.log("=================================\n");

  try {

    /* =================================
       ACTIVE UPLOAD REQUESTS
    ================================= */
    const uploadRequests =
      await NocoBaseService.getActiveUploadRequests();

    console.log(
      `📦 ACTIVE REQUESTS: ${uploadRequests.length}`
    );

    if (!uploadRequests.length) {

      console.log(
        "ℹ️ NO ACTIVE UPLOAD REQUESTS FOUND"
      );

      return;
    }

    /* =================================
       LOOP REQUESTS
    ================================= */
    for (const request of uploadRequests) {

      try {

        console.log("\n---------------------------------");
        console.log(
          `📁 REQUEST ID: ${request.id}`
        );
        console.log(
          `📂 FOLDER: ${request.upload_folder}`
        );
        console.log("---------------------------------\n");

        /* ==============================
           READ DROPBOX FOLDER
        ============================== */
        const files =
          await DropboxService.listFolder(
            request.upload_folder
          );

        console.log(
          `📄 FILES FOUND: ${files.length}`
        );

        if (!files.length) {

          console.log(
            "⏳ NO FILES UPLOADED YET"
          );

          continue;
        }

        /* ==============================
           LOOP ALL FILES
        ============================== */
        for (const file of files) {

          try {

            console.log("\n🎥 FILE FOUND");
            console.log(
              JSON.stringify(file, null, 2)
            );

            /* ==========================
               FILE ONLY
            ========================== */
            if (file[".tag"] !== "file") {

              console.log(
                "⏭️ SKIPPING NON FILE ENTRY"
              );

              continue;
            }

            /* ==========================
               DUPLICATE CHECK
            ========================== */
            const existingVideo =
              await NocoBaseService.getVideoByDropboxFileId(
                file.id
              );

            if (existingVideo) {

              console.log(
                `ℹ️ FILE ALREADY IMPORTED: ${file.id}`
              );

              continue;
            }

            /* ==========================
               SHARED LINK
            ========================== */
            let sharedLink =
              await DropboxService.createSharedLink(
                file.path_lower
              );

            if (
              sharedLink &&
              sharedLink.includes("dl=0")
            ) {
              sharedLink =
                sharedLink.replace(
                  "dl=0",
                  "raw=1"
                );
            }

            /* ==========================
               CREATE VIDEO RECORD
            ========================== */
            const video =
              await NocoBaseService.createVideo({

                nhms_shop_id:
                  request.nhms_shop_id,

                record_type: "raw_video",

                url: sharedLink,

                file_path:
                  file.path_display,

                original_filename:
                  file.name,

                mime_type: null,

                file_size:
                  file.size || null,

                duration: null,

                uploaded_at:
                  new Date().toISOString(),

                status: "uploaded",

                dropbox_file_id:
                  file.id
              });

            console.log(
              `✅ VIDEO CREATED: ${video.id}`
            );

          } catch (fileError) {

            console.error(
              "❌ FILE PROCESS FAILED"
            );

            console.error(
              fileError.response?.data ||
              fileError.message
            );
          }
        }

        /* ==============================
           UPDATE REQUEST STATUS
        ============================== */
        await NocoBaseService.updateUploadRequest(
          request.id,
          {
            status: "active"
          }
        );

        console.log(
          `✅ REQUEST UPDATED: ${request.id}`
        );

      } catch (requestError) {

        console.error(
          `❌ REQUEST FAILED: ${request.id}`
        );

        console.error(
          requestError.response?.data ||
          requestError.message
        );
      }
    }

    console.log("\n=================================");
    console.log("✅ DROPBOX SYNC COMPLETE");
    console.log("=================================\n");

  } catch (error) {

    console.error("\n=================================");
    console.error("❌ DROPBOX SYNC FAILED");
    console.error("=================================\n");

    console.error(
      error.response?.data ||
      error.message
    );

    throw error;
  }
};
