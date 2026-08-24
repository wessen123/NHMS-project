// services/dropbox.edited.sync.service.js

const NocoBaseService =
  require("./nocobase.service");

const DropboxService =
  require("./dropbox.service");

const {
  cleanName
} = require("../utils/format");


/* =================================
   SYNC EDITED VIDEOS FROM DROPBOX
================================= */

exports.syncDropboxEditedVideos =
async () => {

  console.log("\n=================================");
  console.log("🎬 EDITED VIDEO SYNC START");
  console.log("=================================\n");

  try {

    /* =================================
       GET ALL SHOPS
    ================================= */

    const shops =
      await NocoBaseService.getAllShops();

    console.log(
      `🏠 SHOPS FOUND: ${shops.length}`
    );

    if (!shops.length) {

      console.log(
        "ℹ️ NO SHOPS FOUND"
      );

      return;
    }


    /* =================================
       LOOP THROUGH EVERY SHOP
    ================================= */

    for (const shop of shops) {

      try {

        console.log("\n---------------------------------");
        console.log(
          `🏠 SHOP ID: ${shop.id}`
        );
        console.log("---------------------------------\n");


        /* =================================
           GET ORDER
        ================================= */

        if (!shop.nhms_order_id) {

          console.log(
            "⚠️ SHOP HAS NO ORDER ID"
          );

          continue;
        }


        const order =
          await NocoBaseService.getOrder(
            shop.nhms_order_id
          );


        if (!order) {

          console.log(
            `⚠️ ORDER NOT FOUND: ${shop.nhms_order_id}`
          );

          continue;
        }


        /* =================================
           GET CUSTOMER
        ================================= */

        if (!order.customer_id) {

          console.log(
            "⚠️ ORDER HAS NO CUSTOMER ID"
          );

          continue;
        }


        const customer =
          await NocoBaseService.getCustomer(
            order.customer_id
          );


        if (!customer) {

          console.log(
            `⚠️ CUSTOMER NOT FOUND: ${order.customer_id}`
          );

          continue;
        }


        /* =================================
           CUSTOMER FOLDER
        ================================= */

        const customerName =
          customer.company_name
            ? cleanName(
                customer.company_name
              )
            : `${cleanName(
                customer.first_name || ""
              )}_${cleanName(
                customer.last_name || ""
              )}`;


        const customerFolder =
          `${customerName}_${customer.customer_no}`;


        /* =================================
           ORDER NUMBER
        ================================= */

        const orderNo =
          cleanName(
            order.order_no ||
            `ORD-${order.id}`
          );


        /* =================================
           SHOP NUMBER
        ================================= */

        const shopNo =
          cleanName(
            shop.shop_no ||
            shop.f_jjro07ym6st ||
            `SHOP-${shop.id}`
          );


        /* =================================
           EDITED VIDEOS FOLDER
        ================================= */

        const editedVideosFolder =
          `/Apps/NHMS/${customerFolder}/${orderNo}/${shopNo}/Edited Videos`;


        console.log(
          "🎬 EDITED VIDEOS FOLDER:"
        );

        console.log(
          editedVideosFolder
        );


        /* =================================
           LIST DROPBOX FOLDER
        ================================= */

        let files;

        try {

          files =
            await DropboxService.listFolder(
              editedVideosFolder
            );

        } catch (folderError) {

          const summary =
            folderError.response?.data
              ?.error_summary || "";


          if (
            summary.includes(
              "path/not_found"
            )
          ) {

            console.log(
              "⚠️ EDITED VIDEOS FOLDER NOT FOUND"
            );

            continue;
          }


          throw folderError;
        }


        console.log(
          `📄 FILES FOUND: ${files.length}`
        );


        if (!files.length) {

          console.log(
            "⏳ NO EDITED VIDEOS YET"
          );

          continue;
        }


        /* =================================
           LOOP DROPBOX FILES
        ================================= */

        for (const file of files) {

          try {

            /* ==============================
               IGNORE FOLDERS
            ============================== */

            if (
              file[".tag"] !== "file"
            ) {

              console.log(
                "⏭️ SKIPPING NON-FILE ENTRY:",
                file.name
              );

              continue;
            }


            /* ==============================
               LOG FILE
            ============================== */

            console.log(
              "\n🎬 EDITED VIDEO FOUND"
            );

            console.log(
              "NAME:",
              file.name
            );

            console.log(
              "DROPBOX ID:",
              file.id
            );

            console.log(
              "PATH:",
              file.path_display
            );

            console.log(
              "SIZE:",
              file.size
            );


            /* =================================
               IMPORTANT:
               CHECK IF THIS DROPBOX FILE
               WAS ALREADY PROCESSED
            ================================= */

            const existingByDropboxId =
              await NocoBaseService
                .getEditedVideoByDropboxFileId(
                  file.id
                );


            if (existingByDropboxId) {

              console.log(
                "⏭️ FILE ALREADY IMPORTED:"
              );

              console.log(
                file.id
              );

              continue;
            }


            /* =================================
               CREATE SHARED LINK
            ================================= */

            let sharedLink =
              await DropboxService
                .createSharedLink(
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


            console.log(
              "🔗 SHARED LINK:"
            );

            console.log(
              sharedLink
            );


            /* =================================
               FIND RAW SOURCE VIDEO
            ================================= */

            const rawVideos =
              await NocoBaseService
                .getVideosByShopId(
                  shop.id
                );


            let sourceVideoId =
              null;


            /*
             * If exactly one raw video exists,
             * safely link it.
             */

            if (
              rawVideos.length === 1
            ) {

              sourceVideoId =
                rawVideos[0].id;


              console.log(
                "🔗 SOURCE VIDEO:",
                sourceVideoId
              );

            } else {

              console.log(
                `ℹ️ RAW VIDEOS FOUND: ${rawVideos.length}`
              );

              console.log(
                "⚠️ SOURCE VIDEO NOT AUTOMATICALLY LINKED"
              );
            }


            /* =================================
               VIDEO EDITOR
            ================================= */

            let videoEditorId =
              null;


            if (
              shop.video_editor_id
            ) {

              videoEditorId =
                Number(
                  shop.video_editor_id
                );
            }


            /* =================================
               DATA TO SAVE
            ================================= */

            const editedVideoData = {

              /* SHOP */

              nhms_shop_id:
                Number(shop.id),


              /* SOURCE RAW VIDEO */

              source_video_id:
                sourceVideoId,


              /* VIDEO EDITOR */

              video_editor_id:
                videoEditorId,


              /* FILE INFORMATION */

              original_filename:
                file.name,


              file_path:
                file.path_display,


              url:
                sharedLink,


              dropbox_file_id:
                file.id,


              file_size:
                file.size || null,


              duration:
                null,


              mime_type:
                null,


              /* WORKFLOW */

              status:
                "submitted",


              submitted_at:
                new Date().toISOString(),


              revision_count:
                0
            };


            console.log(
              "\n==============================="
            );

            console.log(
              "🎬 EDITED VIDEO DATA"
            );

            console.log(
              JSON.stringify(
                editedVideoData,
                null,
                2
              )
            );

            console.log(
              "===============================\n"
            );


            /* =================================
               IMPORTANT:
               FIND EXISTING EDITED VIDEO
               BY SHOP ID
            ================================= */

            const existingEditedVideo =
              await NocoBaseService
                .getEditedVideoByShopId(
                  shop.id
                );


            /* =================================
               EXISTING RECORD
               → UPDATE
            ================================= */

            if (existingEditedVideo) {

              console.log(
                "\n================================="
              );

              console.log(
                "♻️ EXISTING EDITED VIDEO FOUND"
              );

              console.log(
                "UPDATING EXISTING RECORD"
              );

              console.log(
                "NocoBase ID:",
                existingEditedVideo.id
              );

              console.log(
                "SHOP ID:",
                shop.id
              );

              console.log(
                "OLD DROPBOX FILE ID:",
                existingEditedVideo.dropbox_file_id
              );

              console.log(
                "NEW DROPBOX FILE ID:",
                file.id
              );

              console.log(
                "=================================\n"
              );


              const updatedEditedVideo =
                await NocoBaseService
                  .updateEditedVideo(
                    existingEditedVideo.id,
                    editedVideoData
                  );


              console.log(
                "\n================================="
              );

              console.log(
                "✅ EDITED VIDEO UPDATED"
              );

              console.log(
                "NocoBase ID:",
                existingEditedVideo.id
              );

              console.log(
                "SHOP ID:",
                shop.id
              );

              console.log(
                "NEW FILE:",
                file.name
              );

              console.log(
                "=================================\n"
              );


              continue;
            }


            /* =================================
               NO RECORD
               → CREATE
            ================================= */

            console.log(
              "\n================================="
            );

            console.log(
              "🆕 NO EDITED VIDEO EXISTS"
            );

            console.log(
              "CREATING FIRST RECORD"
            );

            console.log(
              "SHOP ID:",
              shop.id
            );

            console.log(
              "=================================\n"
            );


            const createdEditedVideo =
              await NocoBaseService
                .createEditedVideo(
                  editedVideoData
                );


            console.log(
              "\n================================="
            );

            console.log(
              "✅ EDITED VIDEO CREATED"
            );

            console.log(
              "NocoBase ID:",
              createdEditedVideo.id
            );

            console.log(
              "SHOP ID:",
              shop.id
            );

            console.log(
              "FILE:",
              file.name
            );

            console.log(
              "=================================\n"
            );

          } catch (fileError) {

            console.error(
              "\n❌ EDITED FILE PROCESS FAILED"
            );

            console.error(
              "FILE:",
              file.name
            );

            console.error(
              fileError.response?.data ||
              fileError.message
            );
          }
        }

      } catch (shopError) {

        console.error(
          `\n❌ EDITED SYNC FAILED FOR SHOP: ${shop.id}`
        );

        console.error(
          shopError.response?.data ||
          shopError.message
        );
      }
    }


    /* =================================
       COMPLETE
    ================================= */

    console.log(
      "\n================================="
    );

    console.log(
      "✅ EDITED VIDEO SYNC COMPLETE"
    );

    console.log(
      "=================================\n"
    );


  } catch (error) {

    console.error(
      "\n================================="
    );

    console.error(
      "❌ EDITED VIDEO SYNC FAILED"
    );

    console.error(
      "=================================\n"
    );

    console.error(
      error.response?.data ||
      error.message
    );

    throw error;
  }
};