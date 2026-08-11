// services/nocobase.service.js

const axios = require("axios");

/* =========================
   NOCOBASE HEADERS
========================= */
function nocoHeaders() {
  return {
    Authorization: `Bearer ${process.env.NOCOBASE_TOKEN}`,
    "Content-Type": "application/json"
  };
}

class NocoBaseService {

  /* =========================
     GET ORDER
  ========================= */
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
        headers: nocoHeaders()
      }
    );

    const order = res.data?.data?.[0] || null;

    console.log("✅ ORDER FOUND:");
    console.log(JSON.stringify(order, null, 2));

    return order;
  }

  /* =========================
     GET CUSTOMER
  ========================= */
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
        headers: nocoHeaders()
      }
    );

    const customer = res.data?.data?.[0] || null;

    console.log("✅ CUSTOMER FOUND:");
    console.log(JSON.stringify(customer, null, 2));

    return customer;
  }

  /* =========================
     GET SHOPS
  ========================= */
 /* =========================
   GET SHOPS
========================= */
async getShops(orderId) {

  console.log("\n=========================");
  console.log("🏠 GET SHOPS");
  console.log("ORDER ID:", orderId);
  console.log("=========================\n");

  let shops = [];

  for (let attempt = 1; attempt <= 5; attempt++) {

    const res = await axios.get(
      `${process.env.NOCOBASE_URL}/api/nhms_shops:list`,
      {
        params: {
          filter: {
            nhms_order_id: orderId
          },
          pageSize: 999
        },
        headers: nocoHeaders()
      }
    );

    shops = res.data?.data || [];

    console.log(
      `ATTEMPT ${attempt}: ${shops.length} SHOPS`
    );

    if (shops.length > 0) {
      break;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 1000)
    );
  }

  console.log(
    `✅ SHOPS FOUND: ${shops.length}`
  );

  return shops;
}

  /* =========================
     CREATE UPLOAD REQUEST
  ========================= */
  async createUploadRequest(data) {

    console.log("\n=========================");
    console.log("📤 CREATE UPLOAD REQUEST");
    console.log("=========================\n");

    console.log(JSON.stringify(data, null, 2));

    const res = await axios.post(
      `${process.env.NOCOBASE_URL}/api/upload_requests:create`,
      data,
      {
        headers: nocoHeaders()
      }
    );

    console.log("✅ UPLOAD REQUEST CREATED");
    console.log(JSON.stringify(res.data, null, 2));

    return res.data?.data || res.data;
  }

  /* =========================
     GET ACTIVE UPLOAD REQUESTS
  ========================= */
  async getActiveUploadRequests() {

    console.log("\n=========================");
    console.log("📂 GET ACTIVE REQUESTS");
    console.log("=========================\n");

    const res = await axios.get(
      `${process.env.NOCOBASE_URL}/api/upload_requests:list`,
      {
        params: {
          filter: {
            status: "active"
          },
          pageSize: 999
        },
        headers: nocoHeaders()
      }
    );

    const requests = res.data?.data || [];

    console.log(`✅ ACTIVE REQUESTS: ${requests.length}`);

    return requests;
  }

  /* =========================
     UPDATE UPLOAD REQUEST
  ========================= */
  async updateUploadRequest(id, values) {

    console.log("\n=========================");
    console.log("✏️ UPDATE REQUEST");
    console.log("REQUEST ID:", id);
    console.log("=========================\n");

    console.log(JSON.stringify(values, null, 2));

    const res = await axios.post(
      `${process.env.NOCOBASE_URL}/api/upload_requests:update?filterByTk=${id}`,
      values,
      {
        headers: nocoHeaders()
      }
    );

    console.log("✅ REQUEST UPDATED");
    console.log(JSON.stringify(res.data, null, 2));

    return res.data?.data || res.data;
  }

  /* =========================
     CREATE VIDEO
  ========================= */
  async createVideo(data) {

    console.log("\n=========================");
    console.log("🎥 CREATE VIDEO");
    console.log("=========================\n");

    console.log(JSON.stringify(data, null, 2));

    const res = await axios.post(
      `${process.env.NOCOBASE_URL}/api/videos:create`,
      data,
      {
        headers: nocoHeaders()
      }
    );

    console.log("✅ VIDEO CREATED");
    console.log(JSON.stringify(res.data, null, 2));

    return res.data?.data || res.data;
  }

  /* =========================
     GET VIDEO BY DROPBOX FILE ID
  ========================= */
  async getVideoByDropboxFileId(dropboxFileId) {

    console.log("\n=========================");
    console.log("🔍 FIND VIDEO");
    console.log("DROPBOX FILE ID:", dropboxFileId);
    console.log("=========================\n");

    const res = await axios.get(
      `${process.env.NOCOBASE_URL}/api/videos:list`,
      {
        params: {
          filter: {
            dropbox_file_id: dropboxFileId
          },
          pageSize: 1
        },
        headers: nocoHeaders()
      }
    );

    const video = res.data?.data?.[0] || null;

    if (video) {
      console.log("✅ VIDEO EXISTS");
    } else {
      console.log("ℹ️ VIDEO NOT FOUND");
    }

    return video;
  }
}

module.exports = new NocoBaseService();