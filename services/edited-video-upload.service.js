
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

   PURPOSE

   Create and manage ONE Dropbox edited-video upload request
   for ONE NHMS shop.

   IMPORTANT

   The Dropbox API folder path is stored relative to the
   configured Dropbox application's accessible root.

   Do NOT hardcode:

   /Apps/NHMS/

   unless the Dropbox API account requires that prefix.

   WORKFLOW

   Shop
      ↓
   Validate Shop ID
      ↓
   Check Existing Upload Request
      ↓
   Get Shop
      ↓
   Get Order
      ↓
   Get Customer
      ↓
   Build Dropbox Folder
      ↓
   Create / Verify Dropbox Folder
      ↓
   Create Dropbox File Request
      ↓
   Save Upload Request in NocoBase
      ↓
   Return Upload Request
========================================================= */


class EditedVideoUploadService {


  /* =======================================================
     CREATE EDITED VIDEO UPLOAD REQUEST FOR SHOP
  ======================================================= */

  async createForShop(shopId) {

    const normalizedShopId =
      this.validateShopId(shopId);


    console.log("\n========================================");
    console.log("🎬 EDITED VIDEO UPLOAD REQUEST");
    console.log(
      "SHOP ID:",
      normalizedShopId
    );
    console.log("========================================\n");


    try {


      /* ===================================================
         1. LOAD SHOP / ORDER / CUSTOMER
      =================================================== */

      const context =
        await this.loadShopContext(
          normalizedShopId
        );


      const {
        shop,
        order,
        customer
      } = context;


      /* ===================================================
         2. BUILD CORRECT DROPBOX FOLDER
      =================================================== */

      const uploadFolder =
        this.buildDropboxFolder(
          customer,
          order,
          shop
        );


      console.log(
        "📁 EXPECTED DROPBOX FOLDER:"
      );

      console.log(
        uploadFolder
      );


      /* ===================================================
         3. CHECK EXISTING REQUEST
      =================================================== */

      const existingRequest =
        await this.getExistingRequest(
          normalizedShopId
        );


      if (existingRequest) {


        console.log(
          "ℹ️ EXISTING EDITED VIDEO UPLOAD REQUEST FOUND"
        );


        console.log(
          "REQUEST ID:",
          existingRequest.id
        );


        console.log(
          "CURRENT FOLDER:",
          existingRequest.upload_folder
        );


        /*
         * If the stored path matches the correct path,
         * return the existing request.
         */

        if (
          existingRequest.upload_folder ===
          uploadFolder
        ) {

          console.log(
            "✅ EXISTING REQUEST PATH IS CORRECT"
          );


          return existingRequest;

        }


        /*
         * Existing request contains an old or incorrect path.
         *
         * Update the NocoBase record.
         */

        console.log(
          "⚠️ EXISTING REQUEST HAS DIFFERENT FOLDER PATH"
        );


        console.log(
          "OLD:",
          existingRequest.upload_folder
        );


        console.log(
          "NEW:",
          uploadFolder
        );


        await DropboxService.createFolder(
          uploadFolder
        );


        /*
         * IMPORTANT:
         *
         * A Dropbox File Request cannot simply be assumed
         * to point to the new folder.
         *
         * Create a new request for the correct destination.
         */

        const shopFolderName =
          this.buildShopFolder(
            shop
          );


        const fileRequest =
          await DropboxService.createFileRequest(
            `Edited Video - ${shopFolderName}`,
            uploadFolder
          );


        this.validateFileRequest(
          fileRequest
        );


        const updatedRequest =
          await NocoBaseService
            .updateEditedVideoUploadRequest(
              existingRequest.id,
              {

                upload_folder:
                  uploadFolder,

                upload_link:
                  fileRequest.upload_link,

                file_request_id:
                  fileRequest.file_request_id,

                provider:
                  "dropbox",

                status:
                  "active"

              }
            );


        console.log(
          "✅ EXISTING EDITED VIDEO REQUEST UPDATED"
        );


        return (
          updatedRequest ||
          {
            ...existingRequest,

            upload_folder:
              uploadFolder,

            upload_link:
              fileRequest.upload_link,

            file_request_id:
              fileRequest.file_request_id,

            provider:
              "dropbox",

            status:
              "active"

          }
        );

      }


      /* ===================================================
         4. CREATE / VERIFY DROPBOX FOLDER
      =================================================== */

      console.log(
        "📁 VERIFYING DROPBOX FOLDER..."
      );


      await DropboxService.createFolder(
        uploadFolder
      );


      console.log(
        "✅ DROPBOX FOLDER READY"
      );


      /* ===================================================
         5. CREATE DROPBOX FILE REQUEST
      =================================================== */

      console.log(
        "📤 CREATING DROPBOX FILE REQUEST..."
      );


      const shopFolderName =
        this.buildShopFolder(
          shop
        );


      const fileRequest =
        await DropboxService.createFileRequest(
          `Edited Video - ${shopFolderName}`,
          uploadFolder
        );


      this.validateFileRequest(
        fileRequest
      );


      console.log(
        "✅ DROPBOX FILE REQUEST CREATED"
      );


      console.log(
        "FILE REQUEST ID:",
        fileRequest.file_request_id
      );


      /* ===================================================
         6. PREPARE NOCOBASE DATA
      =================================================== */

      const uploadRequestData =
        this.buildUploadRequestData({

          shop,

          uploadFolder,

          fileRequest

        });


      /* ===================================================
         7. SAVE IN NOCOBASE
      =================================================== */

      console.log(
        "💾 SAVING EDITED VIDEO UPLOAD REQUEST..."
      );


      const createdRequest =
        await NocoBaseService
          .createEditedVideoUploadRequest(
            uploadRequestData
          );


      if (!createdRequest) {

        throw new Error(
          "NocoBase did not return the created edited video upload request"
        );

      }


      /* ===================================================
         8. SUCCESS
      =================================================== */

      console.log("\n========================================");
      console.log("🎉 EDITED VIDEO UPLOAD REQUEST READY");
      console.log("========================================");


      console.log(
        "REQUEST ID:",
        createdRequest.id
      );


      console.log(
        "SHOP ID:",
        createdRequest.nhms_shop_id
      );


      console.log(
        "FOLDER:",
        createdRequest.upload_folder
      );


      console.log(
        "STATUS:",
        createdRequest.status
      );


      console.log(
        "========================================\n"
      );


      return createdRequest;


    } catch (error) {


      console.error(
        "\n========================================"
      );


      console.error(
        "❌ EDITED VIDEO UPLOAD REQUEST FAILED"
      );


      console.error(
        "SHOP ID:",
        normalizedShopId
      );


      console.error(
        "ERROR:",
        error.message
      );


      console.error(
        "========================================\n"
      );


      throw error;

    }

  }


  /* =======================================================
     VALIDATE SHOP ID
  ======================================================= */

  validateShopId(shopId) {

    const normalizedShopId =
      Number(shopId);


    if (

      !Number.isInteger(
        normalizedShopId
      )

      ||

      normalizedShopId <= 0

    ) {

      throw new Error(
        "A valid Shop ID is required"
      );

    }


    return normalizedShopId;

  }


  /* =======================================================
     GET EXISTING UPLOAD REQUEST
  ======================================================= */

  async getExistingRequest(shopId) {

    console.log(
      "🔍 CHECKING EXISTING UPLOAD REQUEST..."
    );


    return await NocoBaseService
      .getEditedVideoUploadRequestByShopId(
        shopId
      );

  }


  /* =======================================================
     LOAD SHOP CONTEXT
  ======================================================= */

  async loadShopContext(shopId) {


    /* =====================================================
       GET SHOP
    ===================================================== */

    console.log(
      "🏠 GETTING SHOP..."
    );


    const shop =
      await NocoBaseService.getShop(
        shopId
      );


    if (!shop) {

      throw new Error(
        `Shop not found: ${shopId}`
      );

    }


    if (!shop.nhms_order_id) {

      throw new Error(
        `Shop ${shopId} does not have an nhms_order_id`
      );

    }


    console.log(
      "✅ SHOP FOUND:",
      shop.id
    );


    /* =====================================================
       GET ORDER
    ===================================================== */

    console.log(
      "📦 GETTING ORDER..."
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


    if (!order.customer_id) {

      throw new Error(
        `Order ${order.id} does not have a customer_id`
      );

    }


    console.log(
      "✅ ORDER FOUND:",
      order.id
    );


    /* =====================================================
       GET CUSTOMER
    ===================================================== */

    console.log(
      "👤 GETTING CUSTOMER..."
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
      "✅ CUSTOMER FOUND:",
      customer.id
    );


    return {

      shop,

      order,

      customer

    };

  }


  /* =======================================================
     BUILD CUSTOMER FOLDER
  ======================================================= */

  buildCustomerFolder(customer) {

    let customerFolder;


    if (customer.company_name) {

      customerFolder =
        cleanName(
          customer.company_name
        );

    } else {


      const firstName =
        cleanName(
          customer.first_name || ""
        );


      const lastName =
        cleanName(
          customer.last_name || ""
        );


      customerFolder =
        [
          firstName,
          lastName
        ]
          .filter(Boolean)
          .join("_");

    }


    if (customer.customer_no) {

      customerFolder =
        `${customerFolder}_${cleanName(
          customer.customer_no
        )}`;

    }


    if (!customerFolder) {

      customerFolder =
        `CUSTOMER-${customer.id}`;

    }


    return customerFolder;

  }


  /* =======================================================
     BUILD ORDER FOLDER
  ======================================================= */

  buildOrderFolder(order) {

    return cleanName(

      order.order_no ||

      `ORD-${order.id}`

    );

  }


  /* =======================================================
     BUILD SHOP FOLDER
  ======================================================= */

  buildShopFolder(shop) {

    return cleanName(

      shop.shop_no ||

      shop.f_jjro07ym6st ||

      `SHOP-${shop.id}`

    );

  }


  /* =======================================================
     BUILD DROPBOX FOLDER

     IMPORTANT

     Dropbox API paths are relative to the application's
     accessible Dropbox root.

     Therefore we do NOT add:

     /Apps/NHMS/

  ======================================================= */

  buildDropboxFolder(
    customer,
    order,
    shop
  ) {


    const customerFolder =
      this.buildCustomerFolder(
        customer
      );


    const orderFolder =
      this.buildOrderFolder(
        order
      );


    const shopFolder =
      this.buildShopFolder(
        shop
      );


    return (

      `/${customerFolder}/` +

      `${orderFolder}/` +

      `${shopFolder}/` +

      `Edited Videos`

    );

  }


  /* =======================================================
     VALIDATE DROPBOX FILE REQUEST
  ======================================================= */

  validateFileRequest(fileRequest) {


    if (!fileRequest) {

      throw new Error(
        "Dropbox file request was not created"
      );

    }


    if (!fileRequest.upload_link) {

      throw new Error(
        "Dropbox file request did not return an upload_link"
      );

    }


    if (!fileRequest.file_request_id) {

      throw new Error(
        "Dropbox file request did not return a file_request_id"
      );

    }

  }


  /* =======================================================
     BUILD NOCOBASE UPLOAD REQUEST DATA
  ======================================================= */

  buildUploadRequestData({

    shop,

    uploadFolder,

    fileRequest

  }) {


    return {


      nhms_shop_id:
        Number(shop.id),


      upload_folder:
        uploadFolder,


      upload_link:
        fileRequest.upload_link,


      file_request_id:
        fileRequest.file_request_id,


      provider:
        "dropbox",


      status:
        "active"

    };

  }


}


/* =========================================================
   EXPORT SINGLE SERVICE INSTANCE
========================================================= */

module.exports =
  new EditedVideoUploadService();

