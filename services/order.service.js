
// services/order.service.js

const NocoBaseService = require("./nocobase.service");
const DropboxService = require("./dropbox.service");
const { cleanName } = require("../utils/format");

exports.processOrder = async (orderId) => {

  console.log("\n=================================");
  console.log("🚀 PROCESS ORDER START");
  console.log("ORDER ID:", orderId);
  console.log("=================================\n");

  try {

    /* =================================
       ORDER
    ================================= */
    const order =
      await NocoBaseService.getOrder(orderId);

    if (!order) {
      throw new Error(
        `Order ${orderId} not found`
      );
    }

    console.log("✅ ORDER FOUND");
    console.log(order.order_no);


    /* =================================
       CUSTOMER
    ================================= */
    const customer =
      await NocoBaseService.getCustomer(
        order.customer_id
      );

    if (!customer) {
      throw new Error(
        `Customer ${order.customer_id} not found`
      );
    }

    const customerName =
      customer.company_name
        ? cleanName(customer.company_name)
        : `${cleanName(customer.first_name || "")}_${cleanName(customer.last_name || "")}`;

    const customerFolder =
      `${customerName}_${customer.customer_no}`;

    console.log("✅ CUSTOMER");
    console.log(customerFolder);


    /* =================================
       SHOPS
    ================================= */
    const shops =
      await NocoBaseService.getShops(orderId);

    console.log(
      `✅ SHOPS FOUND: ${shops.length}`
    );

    const results = [];


    /* =================================
       PROCESS EACH SHOP
    ================================= */
    for (const shop of shops) {

      try {

        console.log("\n---------------------------------");
        console.log("🏠 SHOP:", shop.id);
        console.log("---------------------------------\n");


        /* ==============================
           SHOP NUMBER
        ============================== */

        const shopNo =
          cleanName(
            shop.shop_no ||
            shop.f_jjro07ym6st ||
            `SHOP-${shop.id}`
          );


        /* ==============================
           ORDER NUMBER
        ============================== */

        const orderNo =
          cleanName(
            order.order_no ||
            `ORD-${order.id}`
          );


        /* ==============================
           SHOP DROPBOX FOLDER
        ============================== */

        const folderPath =
          `/Apps/NHMS/${customerFolder}/${orderNo}/${shopNo}`;

        console.log("📁 SHOP FOLDER:");
        console.log(folderPath);


        /* ==============================
           CREATE SHOP FOLDER
        ============================== */

        await DropboxService.createFolder(
          folderPath
        );

        console.log(
          "✅ SHOP FOLDER READY"
        );


        /* ==============================
           EDITED VIDEOS FOLDER
        ============================== */

        const editedVideosFolder =
          `${folderPath}/Edited Videos`;

        console.log(
          "🎬 EDITED VIDEOS FOLDER:"
        );

        console.log(
          editedVideosFolder
        );


        await DropboxService.createFolder(
          editedVideosFolder
        );

        console.log(
          "✅ EDITED VIDEOS FOLDER READY"
        );


        /* =================================================
           SHOPPER FILE REQUEST
           
           Shopper uploads go into:
           
           /SHOP
           
           NOT:
           
           /SHOP/Edited Videos
        ================================================= */

        const fileRequest =
          await DropboxService.createFileRequest(
            `NHMS ${shopNo}`,
            folderPath
          );

        console.log(
          "✅ SHOPPER FILE REQUEST CREATED"
        );

        console.log(
          "SHOPPER FILE REQUEST ID:",
          fileRequest.file_request_id
        );

        console.log(
          "SHOPPER UPLOAD LINK:",
          fileRequest.upload_link
        );


        /* =================================================
           CREATE SHOPPER UPLOAD REQUEST RECORD
           
           Collection:
           upload_requests
        ================================================= */

        const uploadRequest =
          await NocoBaseService.createUploadRequest({

            nhms_shop_id:
              Number(shop.id),

            upload_folder:
              folderPath,

            upload_link:
              fileRequest.upload_link,

            file_request_id:
              fileRequest.file_request_id,

            provider:
              "dropbox",

            status:
              "active"
          });


        console.log(
          "✅ SHOPPER UPLOAD REQUEST RECORD CREATED"
        );

        console.log(
          "SHOPPER UPLOAD REQUEST ID:",
          uploadRequest.id
        );


        /* =================================================
           EDITED VIDEO FILE REQUEST
           
           Editor uploads go into:
           
           /SHOP/Edited Videos
        ================================================= */

        const editedFileRequest =
          await DropboxService.createFileRequest(
            `Edited Video ${shopNo}`,
            editedVideosFolder
          );

        console.log(
          "✅ EDITED VIDEO FILE REQUEST CREATED"
        );

        console.log(
          "EDITED FILE REQUEST ID:",
          editedFileRequest.file_request_id
        );

        console.log(
          "EDITED VIDEO UPLOAD LINK:",
          editedFileRequest.upload_link
        );


        /* =================================================
           CREATE EDITED VIDEO UPLOAD REQUEST RECORD
           
           Collection:
           edited_video_upload_requests
        ================================================= */

        const editedUploadRequest =
          await NocoBaseService.createEditedVideoUploadRequest({

            nhms_shop_id:
              Number(shop.id),

            upload_folder:
              editedVideosFolder,

            upload_link:
              editedFileRequest.upload_link,

            file_request_id:
              editedFileRequest.file_request_id,

            provider:
              "dropbox",

            status:
              "active"
          });


        console.log(
          "✅ EDITED VIDEO UPLOAD REQUEST RECORD CREATED"
        );

        console.log(
          "EDITED REQUEST ID:",
          editedUploadRequest.id
        );


        /* ==============================
           SHOP RESULT
        ============================== */

        results.push({

          success:
            true,

          shop_id:
            shop.id,

          shop_no:
            shopNo,


          /* =========================
             SHOPPER UPLOAD
          ========================= */

          upload_request_id:
            uploadRequest.id,

          upload_folder:
            folderPath,

          upload_link:
            fileRequest.upload_link,

          file_request_id:
            fileRequest.file_request_id,


          /* =========================
             EDITED VIDEO UPLOAD
          ========================= */

          edited_video_upload_request_id:
            editedUploadRequest.id,

          edited_videos_folder:
            editedVideosFolder,

          edited_video_upload_link:
            editedFileRequest.upload_link,

          edited_video_file_request_id:
            editedFileRequest.file_request_id
        });


      } catch (shopError) {

        console.error(
          `❌ SHOP FAILED: ${shop.id}`
        );

        console.error(
          shopError.response?.data ||
          shopError.message
        );


        results.push({

          success:
            false,

          shop_id:
            shop.id,

          error:
            shopError.response?.data ||
            shopError.message
        });
      }
    }


    /* =================================
       ORDER COMPLETE
    ================================= */

    console.log("\n=================================");
    console.log("✅ ORDER COMPLETE");
    console.log("=================================\n");


    console.log(
      JSON.stringify(
        results,
        null,
        2
      )
    );


    return {

      success:
        true,

      order_id:
        orderId,

      order_no:
        order.order_no,

      customer:
        customerFolder,

      total_shops:
        shops.length,

      results
    };


  } catch (error) {

    console.error("\n=================================");
    console.error("❌ PROCESS ORDER FAILED");
    console.error("=================================\n");


    console.error(
      error.response?.data ||
      error.message
    );


    throw error;
  }
};
