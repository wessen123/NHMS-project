// services/nocobase.service.js

require("dotenv").config();

const axios = require("axios");


/* =========================================================
   NOCOBASE HEADERS
========================================================= */

function nocoHeaders() {

  return {
    Authorization:
      `Bearer ${process.env.NOCOBASE_TOKEN}`,

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


    const res = await axios.get(

      `${process.env.NOCOBASE_URL}/api/nhms_orders:list`,

      {
        params: {

          filter: {
            id: orderId
          },

          pageSize: 1
        },

        headers:
          nocoHeaders()
      }
    );


    const order =
      res.data?.data?.[0] || null;


    if (order) {

      console.log(
        "✅ ORDER FOUND:"
      );

      console.log(
        JSON.stringify(
          order,
          null,
          2
        )
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


    const res = await axios.get(

      `${process.env.NOCOBASE_URL}/api/nhms_crm_customers:list`,

      {
        params: {

          filter: {
            id: customerId
          },

          pageSize: 1
        },

        headers:
          nocoHeaders()
      }
    );


    const customer =
      res.data?.data?.[0] || null;


    if (customer) {

      console.log(
        "✅ CUSTOMER FOUND:"
      );

      console.log(
        JSON.stringify(
          customer,
          null,
          2
        )
      );

    } else {

      console.log(
        "ℹ️ CUSTOMER NOT FOUND"
      );
    }


    return customer;
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


    /*
     * NocoBase can sometimes return
     * no records immediately after
     * an order is created.
     *
     * Therefore retry up to 5 times.
     */

    for (
      let attempt = 1;
      attempt <= 5;
      attempt++
    ) {

      const res =
        await axios.get(

          `${process.env.NOCOBASE_URL}/api/nhms_shops:list`,

          {
            params: {

              filter: {
                nhms_order_id:
                  orderId
              },

              pageSize: 999
            },

            headers:
              nocoHeaders()
          }
        );


      shops =
        res.data?.data || [];


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
     
     Used by:
     
     dropbox.edited.sync.service.js
     
     This gets all shops so the sync service can check:
     
     /Edited Videos
     
     for every shop.
  ======================================================= */

  async getAllShops() {

    console.log("\n=========================");
    console.log("🏠 GET ALL SHOPS");
    console.log("=========================\n");


    const res =
      await axios.get(

        `${process.env.NOCOBASE_URL}/api/nhms_shops:list`,

        {
          params: {

            pageSize: 9999
          },

          headers:
            nocoHeaders()
        }
      );


    const shops =
      res.data?.data || [];


    console.log(
      `✅ ALL SHOPS FOUND: ${shops.length}`
    );


    return shops;
  }



  /* =======================================================
     CREATE UPLOAD REQUEST
  ======================================================= */

  async createUploadRequest(data) {

    console.log("\n=========================");
    console.log("📤 CREATE UPLOAD REQUEST");
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

        `${process.env.NOCOBASE_URL}/api/upload_requests:create`,

        data,

        {
          headers:
            nocoHeaders()
        }
      );


    console.log(
      "✅ UPLOAD REQUEST CREATED"
    );


    console.log(
      JSON.stringify(
        res.data,
        null,
        2
      )
    );


    return (
      res.data?.data ||
      res.data
    );
  }



  /* =======================================================
     GET ACTIVE UPLOAD REQUESTS
  ======================================================= */

  async getActiveUploadRequests() {

    console.log("\n=========================");
    console.log("📂 GET ACTIVE REQUESTS");
    console.log("=========================\n");


    const res =
      await axios.get(

        `${process.env.NOCOBASE_URL}/api/upload_requests:list`,

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
      res.data?.data || [];


    console.log(
      `✅ ACTIVE REQUESTS: ${requests.length}`
    );


    return requests;
  }



  /* =======================================================
     UPDATE UPLOAD REQUEST
  ======================================================= */

  async updateUploadRequest(
    id,
    values
  ) {

    console.log("\n=========================");
    console.log("✏️ UPDATE REQUEST");
    console.log("REQUEST ID:", id);
    console.log("=========================\n");


    console.log(
      JSON.stringify(
        values,
        null,
        2
      )
    );


    const res =
      await axios.post(

        `${process.env.NOCOBASE_URL}/api/upload_requests:update?filterByTk=${id}`,

        values,

        {
          headers:
            nocoHeaders()
        }
      );


    console.log(
      "✅ REQUEST UPDATED"
    );


    console.log(
      JSON.stringify(
        res.data,
        null,
        2
      )
    );


    return (
      res.data?.data ||
      res.data
    );
  }



  /* =======================================================
     CREATE RAW VIDEO
     
     Collection:
     
     videos
  ======================================================= */

  async createVideo(data) {

    console.log("\n=========================");
    console.log("🎥 CREATE RAW VIDEO");
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

        `${process.env.NOCOBASE_URL}/api/videos:create`,

        data,

        {
          headers:
            nocoHeaders()
        }
      );


    console.log(
      "✅ RAW VIDEO CREATED"
    );


    console.log(
      JSON.stringify(
        res.data,
        null,
        2
      )
    );


    return (
      res.data?.data ||
      res.data
    );
  }



  /* =======================================================
     GET RAW VIDEO BY DROPBOX FILE ID
     
     Used by:
     
     dropbox.sync.service.js
  ======================================================= */

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

        `${process.env.NOCOBASE_URL}/api/videos:list`,

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



  /* =======================================================
     GET ALL RAW VIDEOS FOR SHOP
     
     Collection:
     
     videos
     
     Field:
     
     nhms_shop_id
     
     Used by:
     
     dropbox.edited.sync.service.js
  ======================================================= */

  async getVideosByShopId(
    shopId
  ) {

    console.log("\n=========================");
    console.log("🎥 GET RAW VIDEOS");
    console.log(
      "SHOP ID:",
      shopId
    );
    console.log("=========================\n");


    const res =
      await axios.get(

        `${process.env.NOCOBASE_URL}/api/videos:list`,

        {
          params: {

            filter: {

              nhms_shop_id:
                shopId
            },

            pageSize: 999
          },

          headers:
            nocoHeaders()
        }
      );


    const videos =
      res.data?.data || [];


    console.log(
      `✅ RAW VIDEOS FOUND: ${videos.length}`
    );


    return videos;
  }



  /* =======================================================
     CREATE EDITED VIDEO
     
     Collection:
     
     edited_videos
  ======================================================= */

  async createEditedVideo(
    data
  ) {

    console.log("\n=========================");
    console.log("🎬 CREATE EDITED VIDEO");
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

        `${process.env.NOCOBASE_URL}/api/edited_videos:create`,

        data,

        {
          headers:
            nocoHeaders()
        }
      );


    console.log(
      "✅ EDITED VIDEO CREATED"
    );


    console.log(
      JSON.stringify(
        res.data,
        null,
        2
      )
    );


    return (
      res.data?.data ||
      res.data
    );
  }



  /* =======================================================
     GET EDITED VIDEO BY DROPBOX FILE ID
     
     Prevents duplicate edited-video
     records during every sync.
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


    const res =
      await axios.get(

        `${process.env.NOCOBASE_URL}/api/edited_videos:list`,

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

    } else {

      console.log(
        "ℹ️ EDITED VIDEO NOT FOUND"
      );
    }


    return editedVideo;
  }



  /* =======================================================
     GET EDITED VIDEOS FOR SHOP
     
     Useful later for:
     
     - Video Editor dashboard
     - QC dashboard
     - Client delivery
     - Revision workflow
  ======================================================= */

  async getEditedVideosByShopId(
    shopId
  ) {

    console.log("\n=========================");
    console.log("🎬 GET EDITED VIDEOS");
    console.log(
      "SHOP ID:",
      shopId
    );
    console.log("=========================\n");


    const res =
      await axios.get(

        `${process.env.NOCOBASE_URL}/api/edited_videos:list`,

        {
          params: {

            filter: {

              nhms_shop_id:
                shopId
            },

            pageSize: 999
          },

          headers:
            nocoHeaders()
        }
      );


    const editedVideos =
      res.data?.data || [];


    console.log(
      `✅ EDITED VIDEOS FOUND: ${editedVideos.length}`
    );


    return editedVideos;
  }

/* =========================
   GET EDITED VIDEO BY SHOP
========================= */
async getEditedVideoByShopId(shopId) {

  console.log("\n=========================");
  console.log("🔍 FIND EDITED VIDEO BY SHOP");
  console.log("SHOP ID:", shopId);
  console.log("=========================\n");

  const res = await axios.get(
    `${process.env.NOCOBASE_URL}/api/edited_videos:list`,
    {
      params: {
        filter: {
          nhms_shop_id: Number(shopId)
        },
        pageSize: 1
      },
      headers: nocoHeaders()
    }
  );

  const editedVideo = res.data?.data?.[0] || null;

  if (editedVideo) {
    console.log("✅ EXISTING EDITED VIDEO FOUND");
    console.log("EDITED VIDEO ID:", editedVideo.id);
  } else {
    console.log("ℹ️ NO EDITED VIDEO FOUND");
  }

  return editedVideo;
}


/* =========================
   CREATE EDITED VIDEO
========================= */
async createEditedVideo(data) {

  console.log("\n=========================");
  console.log("🎬 CREATE EDITED VIDEO");
  console.log("=========================\n");

  console.log(JSON.stringify(data, null, 2));

  const res = await axios.post(
    `${process.env.NOCOBASE_URL}/api/edited_videos:create`,
    data,
    {
      headers: nocoHeaders()
    }
  );

  console.log("✅ EDITED VIDEO CREATED");
  console.log(JSON.stringify(res.data, null, 2));

  return res.data?.data || res.data;
}



/* =======================================================
   GET EDITED VIDEO UPLOAD REQUEST BY SHOP ID

   Collection:
   edited_video_upload_requests

   Used to check if an edited-video upload request
   already exists for this shop.
======================================================= */

async getEditedVideoUploadRequestByShopId(shopId) {

  console.log("\n=========================");
  console.log("🔍 FIND EDITED VIDEO UPLOAD REQUEST");
  console.log("SHOP ID:", shopId);
  console.log("=========================\n");

  const res = await axios.get(

    `${process.env.NOCOBASE_URL}/api/edited_video_upload_requests:list`,

    {
      params: {

        filter: {
          nhms_shop_id:
            Number(shopId)
        },

        pageSize: 1
      },

      headers:
        nocoHeaders()
    }
  );

  const request =
    res.data?.data?.[0] || null;

  if (request) {

    console.log(
      "✅ EDITED VIDEO UPLOAD REQUEST FOUND"
    );

    console.log(
      "REQUEST ID:",
      request.id
    );

    console.log(
      "UPLOAD FOLDER:",
      request.upload_folder
    );

    console.log(
      "UPLOAD LINK:",
      request.upload_link
    );

    console.log(
      "FILE REQUEST ID:",
      request.file_request_id
    );

    console.log(
      "STATUS:",
      request.status
    );

  } else {

    console.log(
      "ℹ️ NO EDITED VIDEO UPLOAD REQUEST FOUND"
    );
  }

  return request;
}


/* =======================================================
   CREATE EDITED VIDEO UPLOAD REQUEST

   Collection:
   edited_video_upload_requests

   Stores:
   - Shop ID
   - Edited Videos Dropbox folder
   - Dropbox upload link
   - Dropbox file request ID
   - Provider
   - Status
======================================================= */

async createEditedVideoUploadRequest(data) {

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

      `${process.env.NOCOBASE_URL}/api/edited_video_upload_requests:create`,

      data,

      {
        headers:
          nocoHeaders()
      }
    );

  console.log(
    "✅ EDITED VIDEO UPLOAD REQUEST CREATED"
  );

  console.log(
    JSON.stringify(
      res.data,
      null,
      2
    )
  );

  return (
    res.data?.data ||
    res.data
  );
}


/* =======================================================
   UPDATE EDITED VIDEO UPLOAD REQUEST

   Used when:
   - status changes
   - upload link changes
   - folder changes
   - file request ID changes
======================================================= */

async updateEditedVideoUploadRequest(
  id,
  values
) {

  console.log("\n=========================");
  console.log("✏️ UPDATE EDITED VIDEO UPLOAD REQUEST");
  console.log("REQUEST ID:", id);
  console.log("=========================\n");

  console.log(
    JSON.stringify(
      values,
      null,
      2
    )
  );

  const res =
    await axios.post(

      `${process.env.NOCOBASE_URL}/api/edited_video_upload_requests:update?filterByTk=${id}`,

      values,

      {
        headers:
          nocoHeaders()
      }
    );

  console.log(
    "✅ EDITED VIDEO UPLOAD REQUEST UPDATED"
  );

  console.log(
    JSON.stringify(
      res.data,
      null,
      2
    )
  );

  return (
    res.data?.data ||
    res.data
  );
}


/* =========================
   UPDATE EDITED VIDEO
========================= */
async updateEditedVideo(id, values) {

  console.log("\n=========================");
  console.log("✏️ UPDATE EDITED VIDEO");
  console.log("EDITED VIDEO ID:", id);
  console.log("=========================\n");

  console.log(JSON.stringify(values, null, 2));

  const res = await axios.post(
    `${process.env.NOCOBASE_URL}/api/edited_videos:update?filterByTk=${id}`,
    values,
    {
      headers: nocoHeaders()
    }
  );

  console.log("✅ EDITED VIDEO UPDATED");
  console.log(JSON.stringify(res.data, null, 2));

  return res.data?.data || res.data;
}

  /* =======================================================
     UPDATE EDITED VIDEO
     
     Useful for:
     
     submitted
     approved
     revision_required
     rejected
  ======================================================= */

  async updateEditedVideo(
    id,
    values
  ) {

    console.log("\n=========================");
    console.log("✏️ UPDATE EDITED VIDEO");
    console.log(
      "EDITED VIDEO ID:",
      id
    );
    console.log("=========================\n");


    console.log(
      JSON.stringify(
        values,
        null,
        2
      )
    );


    const res =
      await axios.post(

        `${process.env.NOCOBASE_URL}/api/edited_videos:update?filterByTk=${id}`,

        values,

        {
          headers:
            nocoHeaders()
        }
      );


    console.log(
      "✅ EDITED VIDEO UPDATED"
    );


    console.log(
      JSON.stringify(
        res.data,
        null,
        2
      )
    );


    return (
      res.data?.data ||
      res.data
    );
  }


}


/* =========================================================
   EXPORT SINGLE SERVICE INSTANCE
========================================================= */

module.exports =
  new NocoBaseService();