
// services/nocobase.service.js

require("dotenv").config();

const axios = require("axios");


/* =========================================================
   CONFIGURATION
========================================================= */

const NOCOBASE_URL =
  process.env.NOCOBASE_URL;

const NOCOBASE_TOKEN =
  process.env.NOCOBASE_TOKEN;


if (!NOCOBASE_URL) {

  throw new Error(
    "NOCOBASE_URL is not configured"
  );

}


if (!NOCOBASE_TOKEN) {

  throw new Error(
    "NOCOBASE_TOKEN is not configured"
  );

}


/* =========================================================
   NOCOBASE HEADERS
========================================================= */

function nocoHeaders() {

  return {

    Authorization:
      `Bearer ${NOCOBASE_TOKEN}`,

    "Content-Type":
      "application/json"

  };

}


/* =========================================================
   NOCOBASE SERVICE
========================================================= */

class NocoBaseService {


  /* =======================================================
     GET ORDER
  ======================================================= */

  async getOrder(orderId) {

    console.log("\n=========================");
    console.log("📦 GET ORDER");
    console.log("ORDER ID:", orderId);
    console.log("=========================\n");


    const res =
      await axios.get(

        `${NOCOBASE_URL}/api/nhms_orders:list`,

        {

          params: {

            filter: {
              id: Number(orderId)
            },

            pageSize: 1

          },

          headers:
            nocoHeaders()

        }

      );


    const order =
      res.data?.data?.[0] ||
      null;


    if (order) {

      console.log(
        "✅ ORDER FOUND"
      );

    } else {

      console.log(
        "ℹ️ ORDER NOT FOUND"
      );

    }


    return order;

  }


  /* =======================================================
     GET CUSTOMER
  ======================================================= */

  async getCustomer(customerId) {

    console.log("\n=========================");
    console.log("👤 GET CUSTOMER");
    console.log("CUSTOMER ID:", customerId);
    console.log("=========================\n");


    const res =
      await axios.get(

        `${NOCOBASE_URL}/api/nhms_crm_customers:list`,

        {

          params: {

            filter: {
              id: Number(customerId)
            },

            pageSize: 1

          },

          headers:
            nocoHeaders()

        }

      );


    const customer =
      res.data?.data?.[0] ||
      null;


    if (customer) {

      console.log(
        "✅ CUSTOMER FOUND"
      );

    } else {

      console.log(
        "ℹ️ CUSTOMER NOT FOUND"
      );

    }


    return customer;

  }


  /* =======================================================
     GET SHOP

     Used by:
     - Raw video sync
     - Edited video sync
     - Upload request services
  ======================================================= */

  async getShop(shopId) {

    console.log("\n=========================");
    console.log("🏠 GET SHOP");
    console.log("SHOP ID:", shopId);
    console.log("=========================\n");


    const res =
      await axios.get(

        `${NOCOBASE_URL}/api/nhms_shops:list`,

        {

          params: {

            filter: {
              id: Number(shopId)
            },

            pageSize: 1

          },

          headers:
            nocoHeaders()

        }

      );


    const shop =
      res.data?.data?.[0] ||
      null;


    if (shop) {

      console.log(
        "✅ SHOP FOUND"
      );

      console.log(
        "SALES REP:",
        shop.sales_rep_name ||
        "NOT SET"
      );

    } else {

      console.log(
        "ℹ️ SHOP NOT FOUND"
      );

    }


    return shop;

  }


  /* =======================================================
     GET SHOPS FOR ORDER
  ======================================================= */

  async getShops(orderId) {

    console.log("\n=========================");
    console.log("🏠 GET SHOPS");
    console.log("ORDER ID:", orderId);
    console.log("=========================\n");


    let shops = [];


    for (
      let attempt = 1;
      attempt <= 5;
      attempt++
    ) {

      const res =
        await axios.get(

          `${NOCOBASE_URL}/api/nhms_shops:list`,

          {

            params: {

              filter: {

                nhms_order_id:
                  Number(orderId)

              },

              pageSize: 999

            },

            headers:
              nocoHeaders()

          }

        );


      shops =
        res.data?.data ||
        [];


      console.log(
        `ATTEMPT ${attempt}: ${shops.length} SHOPS`
      );


      if (
        shops.length > 0
      ) {

        break;

      }


      await new Promise(

        resolve =>
          setTimeout(
            resolve,
            1000
          )

      );

    }


    console.log(
      `✅ SHOPS FOUND: ${shops.length}`
    );


    return shops;

  }


  /* =======================================================
     GET ALL SHOPS
  ======================================================= */

  async getAllShops() {

    console.log("\n=========================");
    console.log("🏠 GET ALL SHOPS");
    console.log("=========================\n");


    const res =
      await axios.get(

        `${NOCOBASE_URL}/api/nhms_shops:list`,

        {

          params: {

            pageSize: 9999

          },

          headers:
            nocoHeaders()

        }

      );


    const shops =
      res.data?.data ||
      [];


    console.log(
      `✅ ALL SHOPS FOUND: ${shops.length}`
    );


    return shops;

  }


  /* =======================================================
     RAW VIDEO UPLOAD REQUESTS
  ======================================================= */

  async createUploadRequest(data) {

    console.log("\n=========================");
    console.log("📤 CREATE UPLOAD REQUEST");
    console.log("=========================\n");


    const res =
      await axios.post(

        `${NOCOBASE_URL}/api/upload_requests:create`,

        data,

        {

          headers:
            nocoHeaders()

        }

      );


    console.log(
      "✅ UPLOAD REQUEST CREATED"
    );


    return (
      res.data?.data ||
      res.data
    );

  }


  async getActiveUploadRequests() {

    console.log("\n=========================");
    console.log("📂 GET ACTIVE RAW VIDEO REQUESTS");
    console.log("=========================\n");


    const res =
      await axios.get(

        `${NOCOBASE_URL}/api/upload_requests:list`,

        {

          params: {

            filter: {
              status: "active"
            },

            pageSize: 999

          },

          headers:
            nocoHeaders()

        }

      );


    const requests =
      res.data?.data ||
      [];


    console.log(
      `✅ ACTIVE RAW VIDEO REQUESTS: ${requests.length}`
    );


    return requests;

  }


  async updateUploadRequest(
    id,
    values
  ) {

    console.log("\n=========================");
    console.log("✏️ UPDATE RAW VIDEO REQUEST");
    console.log("REQUEST ID:", id);
    console.log("=========================\n");


    const res =
      await axios.post(

        `${NOCOBASE_URL}/api/upload_requests:update?filterByTk=${id}`,

        values,

        {

          headers:
            nocoHeaders()

        }

      );


    console.log(
      "✅ RAW VIDEO REQUEST UPDATED"
    );


    return (
      res.data?.data ||
      res.data
    );

  }


  /* =======================================================
     RAW VIDEOS
  ======================================================= */

  async createVideo(data) {

    console.log("\n=========================");
    console.log("🎥 CREATE RAW VIDEO");
    console.log("=========================\n");


    const res =
      await axios.post(

        `${NOCOBASE_URL}/api/videos:create`,

        data,

        {

          headers:
            nocoHeaders()

        }

      );


    console.log(
      "✅ RAW VIDEO CREATED"
    );


    return (
      res.data?.data ||
      res.data
    );

  }


  async getVideoByDropboxFileId(
    dropboxFileId
  ) {

    console.log("\n=========================");
    console.log("🔍 FIND RAW VIDEO");
    console.log(
      "DROPBOX FILE ID:",
      dropboxFileId
    );
    console.log("=========================\n");


    const res =
      await axios.get(

        `${NOCOBASE_URL}/api/videos:list`,

        {

          params: {

            filter: {

              dropbox_file_id:
                dropboxFileId

            },

            pageSize: 1

          },

          headers:
            nocoHeaders()

        }

      );


    const video =
      res.data?.data?.[0] ||
      null;


    if (video) {

      console.log(
        "✅ RAW VIDEO EXISTS"
      );

    } else {

      console.log(
        "ℹ️ RAW VIDEO NOT FOUND"
      );

    }


    return video;

  }


  async getVideosByShopId(
    shopId
  ) {

    console.log("\n=========================");
    console.log("🎥 GET RAW VIDEOS");
    console.log("SHOP ID:", shopId);
    console.log("=========================\n");


    const res =
      await axios.get(

        `${NOCOBASE_URL}/api/videos:list`,

        {

          params: {

            filter: {

              nhms_shop_id:
                Number(shopId)

            },

            pageSize: 999

          },

          headers:
            nocoHeaders()

        }

      );


    const videos =
      res.data?.data ||
      [];


    console.log(
      `✅ RAW VIDEOS FOUND: ${videos.length}`
    );


    return videos;

  }


  /* =======================================================
     EDITED VIDEO UPLOAD REQUESTS
  ======================================================= */

  async getActiveEditedVideoUploadRequests() {

    console.log("\n========================================");
    console.log("📂 GET ACTIVE EDITED VIDEO REQUESTS");
    console.log("========================================\n");


    const res =
      await axios.get(

        `${NOCOBASE_URL}/api/edited_video_upload_requests:list`,

        {

          params: {

            filter: {
              status: "active"
            },

            pageSize: 999

          },

          headers:
            nocoHeaders()

        }

      );


    const requests =
      res.data?.data ||
      [];


    console.log(
      `✅ ACTIVE EDITED VIDEO REQUESTS: ${requests.length}`
    );


    return requests;

  }


  async getEditedVideoUploadRequestByShopId(
    shopId
  ) {

    console.log("\n=========================");
    console.log("🔍 FIND EDITED VIDEO UPLOAD REQUEST");
    console.log("SHOP ID:", shopId);
    console.log("=========================\n");


    const res =
      await axios.get(

        `${NOCOBASE_URL}/api/edited_video_upload_requests:list`,

        {

          params: {

            filter: {

              nhms_shop_id:
                Number(shopId)

            },

            sort:
              "-updatedAt",

            pageSize: 10

          },

          headers:
            nocoHeaders()

        }

      );


    const requests =
      res.data?.data ||
      [];


    const request =
      requests[0] ||
      null;


    if (request) {

      console.log(
        "✅ EDITED VIDEO UPLOAD REQUEST FOUND"
      );

    } else {

      console.log(
        "ℹ️ NO EDITED VIDEO UPLOAD REQUEST FOUND"
      );

    }


    return request;

  }


  async createEditedVideoUploadRequest(
    data
  ) {

    console.log("\n=========================");
    console.log("📤 CREATE EDITED VIDEO UPLOAD REQUEST");
    console.log("=========================\n");


    console.log(
      JSON.stringify(
        data,
        null,
        2
      )
    );


    const res =
      await axios.post(

        `${NOCOBASE_URL}/api/edited_video_upload_requests:create`,

        data,

        {

          headers:
            nocoHeaders()

        }

      );


    console.log(
      "✅ EDITED VIDEO UPLOAD REQUEST CREATED"
    );


    return (
      res.data?.data ||
      res.data
    );

  }


  async updateEditedVideoUploadRequest(
    id,
    values
  ) {

    console.log("\n========================================");
    console.log("✏️ UPDATE EDITED VIDEO UPLOAD REQUEST");
    console.log("REQUEST ID:", id);
    console.log("========================================\n");


    console.log(
      JSON.stringify(
        values,
        null,
        2
      )
    );


    const res =
      await axios.post(

        `${NOCOBASE_URL}/api/edited_video_upload_requests:update?filterByTk=${id}`,

        values,

        {

          headers:
            nocoHeaders()

        }

      );


    console.log(
      "✅ EDITED VIDEO UPLOAD REQUEST UPDATED"
    );


    return (
      res.data?.data ||
      res.data
    );

  }


  /* =======================================================
     EDITED VIDEOS
  ======================================================= */


  /* =======================================================
     FIND EDITED VIDEO BY DROPBOX FILE ID
  ======================================================= */

  async getEditedVideoByDropboxFileId(
    dropboxFileId
  ) {

    console.log("\n=========================");
    console.log("🔍 FIND EDITED VIDEO");
    console.log(
      "DROPBOX FILE ID:",
      dropboxFileId
    );
    console.log("=========================\n");


    if (!dropboxFileId) {

      console.log(
        "ℹ️ DROPBOX FILE ID IS EMPTY"
      );

      return null;

    }


    const res =
      await axios.get(

        `${NOCOBASE_URL}/api/edited_videos:list`,

        {

          params: {

            filter: {

              dropbox_file_id:
                dropboxFileId

            },

            pageSize: 1

          },

          headers:
            nocoHeaders()

        }

      );


    const editedVideo =
      res.data?.data?.[0] ||
      null;


    if (editedVideo) {

      console.log(
        "✅ EDITED VIDEO EXISTS"
      );

      console.log(
        "EDITED VIDEO ID:",
        editedVideo.id
      );

    } else {

      console.log(
        "ℹ️ EDITED VIDEO NOT FOUND"
      );

    }


    return editedVideo;

  }


  /* =======================================================
     FIND CURRENT EDITED VIDEO BY SHOP

     RULE:

     ONE SHOP = ONE CURRENT EDITED VIDEO

     If duplicates already exist, the newest updated
     record is returned.
  ======================================================= */

  async getEditedVideoByShopId(
    shopId
  ) {

    console.log("\n========================================");
    console.log("🔍 FIND CURRENT EDITED VIDEO BY SHOP");
    console.log("SHOP ID:", shopId);
    console.log("========================================\n");


    const res =
      await axios.get(

        `${NOCOBASE_URL}/api/edited_videos:list`,

        {

          params: {

            filter: {

              nhms_shop_id:
                Number(shopId)

            },

            /*
             * Newest record first.
             */

            sort:
              "-updatedAt",

            pageSize:
              10

          },

          headers:
            nocoHeaders()

        }

      );


    const editedVideos =
      res.data?.data ||
      [];


    if (
      editedVideos.length > 1
    ) {

      console.warn(
        `⚠️ MULTIPLE EDITED VIDEO RECORDS FOUND FOR SHOP ${shopId}`
      );

      console.warn(
        `⚠️ USING MOST RECENT RECORD: ${editedVideos[0].id}`
      );

    }


    const editedVideo =
      editedVideos[0] ||
      null;


    if (editedVideo) {

      console.log(
        "✅ EXISTING EDITED VIDEO FOUND"
      );

      console.log(
        "EDITED VIDEO ID:",
        editedVideo.id
      );

      console.log(
        "FILE NAME:",
        editedVideo.file_name ||
        editedVideo.original_filename ||
        "NOT SET"
      );

      console.log(
        "DROPBOX FILE ID:",
        editedVideo.dropbox_file_id ||
        "NOT SET"
      );

      console.log(
        "FILE PATH:",
        editedVideo.file_path ||
        "NOT SET"
      );

    } else {

      console.log(
        "ℹ️ NO EDITED VIDEO FOUND"
      );

    }


    return editedVideo;

  }


  /* =======================================================
     GET ALL EDITED VIDEOS FOR SHOP

     Useful for checking duplicate records.
  ======================================================= */

  async getEditedVideosByShopId(
    shopId
  ) {

    console.log("\n=========================");
    console.log("🎬 GET EDITED VIDEOS");
    console.log("SHOP ID:", shopId);
    console.log("=========================\n");


    const res =
      await axios.get(

        `${NOCOBASE_URL}/api/edited_videos:list`,

        {

          params: {

            filter: {

              nhms_shop_id:
                Number(shopId)

            },

            sort:
              "-updatedAt",

            pageSize:
              999

          },

          headers:
            nocoHeaders()

        }

      );


    const editedVideos =
      res.data?.data ||
      [];


    console.log(
      `✅ EDITED VIDEOS FOUND: ${editedVideos.length}`
    );


    return editedVideos;

  }


  /* =======================================================
     CREATE EDITED VIDEO

     Used only when this shop does not already have
     an Edited Videos record.
  ======================================================= */

  async createEditedVideo(
    data
  ) {

    console.log("\n========================================");
    console.log("🎬 CREATE EDITED VIDEO");
    console.log("========================================\n");


    console.log(
      JSON.stringify(
        data,
        null,
        2
      )
    );


    const res =
      await axios.post(

        `${NOCOBASE_URL}/api/edited_videos:create`,

        data,

        {

          headers:
            nocoHeaders()

        }

      );


    const createdVideo =
      res.data?.data ||
      res.data;


    console.log(
      "✅ EDITED VIDEO CREATED"
    );


    if (
      createdVideo?.id
    ) {

      console.log(
        "EDITED VIDEO ID:",
        createdVideo.id
      );

    }


    return createdVideo;

  }

  /* =======================================================
     GET SALES REP
  ======================================================= */

  async getSalesRep(
    salesRepId
  ) {

    console.log("\n=========================");
    console.log("👤 GET SALES REP");
    console.log("SALES REP ID:", salesRepId);
    console.log("=========================\n");


    if (!salesRepId) {

      console.log(
        "ℹ️ SALES REP ID IS EMPTY"
      );

      return null;

    }


    const res =
      await axios.get(

        `${NOCOBASE_URL}/api/sales_reps:list`,

        {

          params: {

            filter: {
              id: Number(salesRepId)
            },

            pageSize: 1

          },

          headers:
            nocoHeaders()

        }

      );


    const salesRep =
      res.data?.data?.[0] ||
      null;


    if (salesRep) {

      console.log(
        "✅ SALES REP FOUND"
      );

      console.log(
        "FIRST NAME:",
        salesRep.first_name ||
        "NOT SET"
      );

      console.log(
        "LAST NAME:",
        salesRep.last_name ||
        "NOT SET"
      );

      console.log(
        "FULL NAME:",
        salesRep.full_name ||
        "NOT SET"
      );

    } else {

      console.log(
        "ℹ️ SALES REP NOT FOUND"
      );

    }


    return salesRep;

  }


  /* =======================================================
     GET COMMUNITY SERVICE
  ======================================================= */

  async getCommunityService(
    communityServiceId
  ) {

    console.log("\n=========================");
    console.log("🏘️ GET COMMUNITY SERVICE");
    console.log(
      "COMMUNITY SERVICE ID:",
      communityServiceId
    );
    console.log("=========================\n");


    if (!communityServiceId) {

      console.log(
        "ℹ️ COMMUNITY SERVICE ID IS EMPTY"
      );

      return null;

    }


    const res =
      await axios.get(

        `${NOCOBASE_URL}/api/community_services:list`,

        {

          params: {

            filter: {
              id:
                Number(
                  communityServiceId
                )
            },

            pageSize: 1

          },

          headers:
            nocoHeaders()

        }

      );


    const communityService =
      res.data?.data?.[0] ||
      null;


    if (communityService) {

      console.log(
        "✅ COMMUNITY SERVICE FOUND"
      );

      console.log(
        "COMMUNITY ID:",
        communityService.community_id ||
        "NOT SET"
      );

    } else {

      console.log(
        "ℹ️ COMMUNITY SERVICE NOT FOUND"
      );

    }


    return communityService;

  }


  /* =======================================================
     GET COMMUNITY
  ======================================================= */

  async getCommunity(
    communityId
  ) {

    console.log("\n=========================");
    console.log("🏡 GET COMMUNITY");
    console.log(
      "COMMUNITY ID:",
      communityId
    );
    console.log("=========================\n");


    if (!communityId) {

      console.log(
        "ℹ️ COMMUNITY ID IS EMPTY"
      );

      return null;

    }


    const res =
      await axios.get(

        `${NOCOBASE_URL}/api/communities:list`,

        {

          params: {

            filter: {
              id:
                Number(
                  communityId
                )
            },

            pageSize: 1

          },

          headers:
            nocoHeaders()

        }

      );


    const community =
      res.data?.data?.[0] ||
      null;


    if (community) {

      console.log(
        "✅ COMMUNITY FOUND"
      );

      console.log(
        "COMMUNITY NAME:",
        community.name ||
        "NOT SET"
      );

    } else {

      console.log(
        "ℹ️ COMMUNITY NOT FOUND"
      );

    }


    return community;

  }


  /* =======================================================
     GET COMPLETE SHOP VIDEO CONTEXT

     Used for edited video file naming.

     Returns:
     {
       shop,
       salesRep,
       communityService,
       community
     }
  ======================================================= */

  async getShopVideoContext(
    shopId
  ) {

    console.log("\n========================================");
    console.log("🎬 GET SHOP VIDEO CONTEXT");
    console.log(
      "SHOP ID:",
      shopId
    );
    console.log("========================================\n");


    /* =====================================
       1. GET SHOP
    ===================================== */

    const shop =
      await this.getShop(
        shopId
      );


    if (!shop) {

      throw new Error(
        `Shop not found: ${shopId}`
      );

    }


    /* =====================================
       2. GET SALES REP
    ===================================== */

    const salesRep =
      shop.sales_rep_id
        ? await this.getSalesRep(
            shop.sales_rep_id
          )
        : null;


    /* =====================================
       3. GET COMMUNITY SERVICE
    ===================================== */

    const communityService =
      shop.community_service_id
        ? await this.getCommunityService(
            shop.community_service_id
          )
        : null;


    /* =====================================
       4. GET COMMUNITY

       Community comes from the shop's
       community service.

       This is intentionally NOT taken
       from the Sales Rep's community_id.
    ===================================== */

    const community =
      communityService?.community_id
        ? await this.getCommunity(
            communityService.community_id
          )
        : null;


    /* =====================================
       COMPLETE CONTEXT
    ===================================== */

    const context = {

      shop,

      salesRep,

      communityService,

      community

    };


    console.log(
      "\n========================================"
    );

    console.log(
      "✅ SHOP VIDEO CONTEXT READY"
    );

    console.log(
      "========================================"
    );

    console.log(
      "SHOP DATE:",
      shop.shop_date ||
      "EMPTY - TODAY WILL BE USED"
    );

    console.log(
      "SALES REP:",
      salesRep?.full_name ||
      [
        salesRep?.first_name,
        salesRep?.last_name
      ]
        .filter(Boolean)
        .join(" ") ||
      shop.sales_rep_name ||
      "NOT FOUND"
    );

    console.log(
      "COMMUNITY:",
      community?.name ||
      "NOT FOUND"
    );

    console.log(
      "========================================\n"
    );


    return context;

  }
  /* =======================================================
     UPDATE EDITED VIDEO

     IMPORTANT:

     The existing NocoBase record is preserved.

     When a new edited video is uploaded:

     - The old Dropbox file is deleted.
     - The new Dropbox file is renamed.
     - This SAME NocoBase record is updated.

     No new NocoBase record is created.
  ======================================================= */

  async updateEditedVideo(
    id,
    values
  ) {

    if (!id) {

      throw new Error(
        "Edited video ID is required for update"
      );

    }


    console.log("\n========================================");
    console.log("♻️ UPDATE CURRENT EDITED VIDEO");
    console.log("========================================");

    console.log(
      "EDITED VIDEO RECORD ID:",
      id
    );

    console.log(
      "NEW FILE NAME:",
      values.file_name ||
      "NOT SET"
    );

    console.log(
      "NEW ORIGINAL FILE NAME:",
      values.original_filename ||
      "NOT SET"
    );

    console.log(
      "NEW DROPBOX FILE ID:",
      values.dropbox_file_id ||
      "NOT SET"
    );

    console.log(
      "NEW FILE PATH:",
      values.file_path ||
      "NOT SET"
    );

    console.log(
      "NEW STATUS:",
      values.status ||
      "NOT SET"
    );

    console.log(
      "========================================\n"
    );


    console.log(
      "UPDATE DATA:"
    );

    console.log(
      JSON.stringify(
        values,
        null,
        2
      )
    );


    const res =
      await axios.post(

        `${NOCOBASE_URL}/api/edited_videos:update?filterByTk=${id}`,

        values,

        {

          headers:
            nocoHeaders()

        }

      );


    const updatedVideo =
      res.data?.data ||
      res.data;


    console.log(
      "\n========================================"
    );

    console.log(
      "✅ EDITED VIDEO UPDATED SUCCESSFULLY"
    );

    console.log(
      "========================================"
    );


    console.log(
      JSON.stringify(
        updatedVideo,
        null,
        2
      )
    );


    return updatedVideo;

  }


}


/* =========================================================
   EXPORT SINGLE SERVICE INSTANCE
========================================================= */

module.exports =
  new NocoBaseService();

