
// services/edited-video-upload.service.js

const NocoBaseService =
  require("./nocobase.service");

const DropboxService =
  require("./dropbox.service");

const {
  cleanName
} = require("../utils/format");


/* =========================================================
   EDITED VIDEO UPLOAD SERVICE

   PURPOSE:

   Create ONE Dropbox upload request for ONE NHMS shop.

   The request is stored in:

   edited_video_upload_requests

   Fields saved:

   - nhms_shop_id
   - upload_folder
   - upload_link
   - file_request_id
   - provider
   - status

   Status is currently ALWAYS:

   active


   FLOW:

   Shop
      ↓
   Check existing upload request
      ↓
   If exists → return existing request
      ↓
   If not
      ↓
   Get shop
      ↓
   Get order
      ↓
   Get customer
      ↓
   Build Edited Videos folder
      ↓
   Create Dropbox folder
      ↓
   Create Dropbox File Request
      ↓
   Save request in NocoBase
      ↓
   status = active
========================================================= */


class EditedVideoUploadService {


  /* =======================================================
     CREATE EDITED VIDEO UPLOAD REQUEST FOR SHOP
  ======================================================= */

  async createForShop(shopId) {

    console.log("\n========================================");
    console.log("🎬 CREATE EDITED VIDEO UPLOAD REQUEST");
    console.log("SHOP ID:", shopId);
    console.log("========================================\n");


    /* =====================================================
       1. VALIDATE SHOP ID
    ===================================================== */

    if (!shopId) {

      throw new Error(
        "Shop ID is required"
      );

    }


    /* =====================================================
       2. CHECK IF REQUEST ALREADY EXISTS
       
       IMPORTANT:
       
       One shop = one edited video upload request.
       
       If one already exists, DO NOT create another
       Dropbox File Request.
    ===================================================== */

    console.log(
      "🔍 CHECKING EXISTING EDITED VIDEO UPLOAD REQUEST..."
    );


    const existingRequest =
      await NocoBaseService
        .getEditedVideoUploadRequestByShopId(
          shopId
        );


    if (existingRequest) {

      console.log(
        "\nℹ️ EDITED VIDEO UPLOAD REQUEST ALREADY EXISTS"
      );

      console.log(
        "REQUEST ID:",
        existingRequest.id
      );

      console.log(
        "UPLOAD FOLDER:",
        existingRequest.upload_folder
      );

      console.log(
        "UPLOAD LINK:",
        existingRequest.upload_link
      );

      console.log(
        "FILE REQUEST ID:",
        existingRequest.file_request_id
      );

      console.log(
        "PROVIDER:",
        existingRequest.provider
      );

      console.log(
        "STATUS:",
        existingRequest.status
      );

      return existingRequest;
    }


    /* =====================================================
       3. GET ALL SHOPS
       
       We use the existing NocoBase service.
    ===================================================== */

    console.log(
      "\n🏠 GETTING SHOP..."
    );


    const shops =
      await NocoBaseService.getAllShops();


    const shop =
      shops.find(
        item =>
          Number(item.id) === Number(shopId)
      );


    if (!shop) {

      throw new Error(
        `Shop not found: ${shopId}`
      );

    }


    console.log(
      "✅ SHOP FOUND"
    );

    console.log(
      "SHOP ID:",
      shop.id
    );


    /* =====================================================
       4. GET ORDER ID
    ===================================================== */

    if (!shop.nhms_order_id) {

      throw new Error(
        `Shop ${shopId} has no nhms_order_id`
      );

    }


    console.log(
      "ORDER ID:",
      shop.nhms_order_id
    );


    /* =====================================================
       5. GET ORDER
    ===================================================== */

    console.log(
      "\n📦 GETTING ORDER..."
    );


    const order =
      await NocoBaseService.getOrder(
        shop.nhms_order_id
      );


    if (!order) {

      throw new Error(
        `Order not found: ${shop.nhms_order_id}`
      );

    }


    console.log(
      "✅ ORDER FOUND"
    );


    /* =====================================================
       6. GET CUSTOMER ID
       
       IMPORTANT:
       
       This assumes your order record contains:
       
       customer_id
    ===================================================== */

    if (!order.customer_id) {

      throw new Error(
        `Order ${order.id} has no customer_id`
      );

    }


    console.log(
      "CUSTOMER ID:",
      order.customer_id
    );


    /* =====================================================
       7. GET CUSTOMER
    ===================================================== */

    console.log(
      "\n👤 GETTING CUSTOMER..."
    );


    const customer =
      await NocoBaseService.getCustomer(
        order.customer_id
      );


    if (!customer) {

      throw new Error(
        `Customer not found: ${order.customer_id}`
      );

    }


    console.log(
      "✅ CUSTOMER FOUND"
    );


    /* =====================================================
       8. BUILD CUSTOMER FOLDER
       
       Same general naming approach as the edited-video
       Dropbox sync.
    ===================================================== */

    let customerFolder;


    if (customer.company_name) {

      customerFolder =
        cleanName(
          customer.company_name
        );

    } else {

      customerFolder =
        `${cleanName(
          customer.first_name || ""
        )}_${cleanName(
          customer.last_name || ""
        )}`;

    }


    /*
     * Add customer number when available.
     */

    if (customer.customer_no) {

      customerFolder =
        `${customerFolder}_${cleanName(
          customer.customer_no
        )}`;

    }


    /* =====================================================
       9. BUILD ORDER FOLDER
    ===================================================== */

    const orderNo =
      cleanName(
        order.order_no ||
        `ORD-${order.id}`
      );


    /* =====================================================
       10. BUILD SHOP FOLDER
    ===================================================== */

    const shopNo =
      cleanName(
        shop.shop_no ||
        shop.f_jjro07ym6st ||
        `SHOP-${shop.id}`
      );


    /* =====================================================
       11. BUILD EDITED VIDEO FOLDER
       
       FINAL PATH:
       
       /Apps/NHMS/
       CUSTOMER/
       ORDER/
       SHOP/
       Edited Videos
    ===================================================== */

    const editedVideosFolder =
      `/Apps/NHMS/${customerFolder}/${orderNo}/${shopNo}/Edited Videos`;


    console.log(
      "\n========================================"
    );

    console.log(
      "🎬 EDITED VIDEO DROPBOX FOLDER"
    );

    console.log(
      editedVideosFolder
    );

    console.log(
      "========================================\n"
    );


    /* =====================================================
       12. CREATE DROPBOX FOLDER
       
       createFolder() already handles:
       
       - new folder
       - folder already exists
    ===================================================== */

    console.log(
      "📁 CREATING / VERIFYING DROPBOX FOLDER..."
    );


    await DropboxService.createFolder(
      editedVideosFolder
    );


    console.log(
      "✅ DROPBOX FOLDER READY"
    );


    /* =====================================================
       13. CREATE DROPBOX FILE REQUEST
       
       This generates:
       
       upload_link
       file_request_id
    ===================================================== */

    console.log(
      "\n📤 CREATING DROPBOX FILE REQUEST..."
    );


    const fileRequest =
      await DropboxService.createFileRequest(

        `Edited Video - ${shopNo}`,

        editedVideosFolder

      );


    if (!fileRequest) {

      throw new Error(
        "Dropbox file request was not created"
      );

    }


    if (!fileRequest.upload_link) {

      throw new Error(
        "Dropbox file request did not return upload_link"
      );

    }


    if (!fileRequest.file_request_id) {

      throw new Error(
        "Dropbox file request did not return file_request_id"
      );

    }


    console.log(
      "\n✅ DROPBOX FILE REQUEST CREATED"
    );

    console.log(
      "UPLOAD LINK:",
      fileRequest.upload_link
    );

    console.log(
      "FILE REQUEST ID:",
      fileRequest.file_request_id
    );


    /* =====================================================
       14. PREPARE NOCOBASE DATA
       
       ONLY store the fields that belong to the
       Edited Video Upload Requests collection.
    ===================================================== */

    const uploadRequestData = {

      /*
       * Relationship to NHMS Shop
       */

      nhms_shop_id:
        Number(shop.id),


      /*
       * Dropbox folder
       */

      upload_folder:
        editedVideosFolder,


      /*
       * Dropbox upload URL
       */

      upload_link:
        fileRequest.upload_link,


      /*
       * Dropbox File Request ID
       */

      file_request_id:
        fileRequest.file_request_id,


      /*
       * Upload provider
       */

      provider:
        "dropbox",


      /*
       * Current status
       
       * For now this ALWAYS remains active.
       */

      status:
        "active"

    };


    /* =====================================================
       15. LOG DATA BEFORE SAVING
    ===================================================== */

    console.log(
      "\n========================================"
    );

    console.log(
      "💾 SAVING EDITED VIDEO UPLOAD REQUEST"
    );

    console.log(
      JSON.stringify(
        uploadRequestData,
        null,
        2
      )
    );

    console.log(
      "========================================\n"
    );


    /* =====================================================
       16. CREATE NOCOBASE RECORD
    ===================================================== */

    const createdRequest =
      await NocoBaseService
        .createEditedVideoUploadRequest(
          uploadRequestData
        );


    if (!createdRequest) {

      throw new Error(
        "Edited video upload request was not created in NocoBase"
      );

    }


    /* =====================================================
       17. FINAL RESULT
    ===================================================== */

    console.log(
      "\n========================================"
    );

    console.log(
      "🎉 EDITED VIDEO UPLOAD REQUEST READY"
    );

    console.log(
      "========================================"
    );

    console.log(
      "REQUEST ID:",
      createdRequest.id
    );

    console.log(
      "SHOP ID:",
      createdRequest.nhms_shop_id
    );

    console.log(
      "UPLOAD FOLDER:",
      createdRequest.upload_folder
    );

    console.log(
      "UPLOAD LINK:",
      createdRequest.upload_link
    );

    console.log(
      "FILE REQUEST ID:",
      createdRequest.file_request_id
    );

    console.log(
      "PROVIDER:",
      createdRequest.provider
    );

    console.log(
      "STATUS:",
      createdRequest.status
    );

    console.log(
      "========================================\n"
    );


    return createdRequest;
  }
}


/* =========================================================
   EXPORT SINGLE SERVICE INSTANCE
========================================================= */

module.exports =
  new EditedVideoUploadService();
