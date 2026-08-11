
// services/dropbox.service.js

const axios = require("axios");

class DropboxService {

  /* =========================
     ACCESS TOKEN
  ========================= */
  async getAccessToken() {

    console.log("\n=========================");
    console.log("🔐 DROPBOX TOKEN");
    console.log("=========================\n");

    const res = await axios.post(
      "https://api.dropboxapi.com/oauth2/token",

      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: process.env.DROPBOX_REFRESH_TOKEN,
        client_id: process.env.DROPBOX_APP_KEY,
        client_secret: process.env.DROPBOX_APP_SECRET
      }).toString(),

      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    console.log("✅ TOKEN GENERATED");

    return res.data.access_token;
  }

  /* =========================
     HEADERS
  ========================= */
  async headers() {

    const token = await this.getAccessToken();

    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    };
  }

  /* =========================
     CREATE FOLDER
  ========================= */
  async createFolder(path) {

    console.log("\n=========================");
    console.log("📁 CREATE FOLDER");
    console.log(path);
    console.log("=========================\n");

    try {

      const response = await axios.post(
        "https://api.dropboxapi.com/2/files/create_folder_v2",
        {
          path,
          autorename: false
        },
        {
          headers: await this.headers()
        }
      );

      console.log("✅ FOLDER CREATED");

      return response.data;

    } catch (err) {

      const summary =
        err.response?.data?.error_summary || "";

      if (summary.includes("conflict")) {

        console.log("ℹ️ FOLDER ALREADY EXISTS");

        return {
          already_exists: true
        };
      }

      console.error("❌ CREATE FOLDER FAILED");
      console.error(err.response?.data || err.message);

      throw err;
    }
  }

  /* =========================
     CREATE FILE REQUEST
  ========================= */
  async createFileRequest(title, destination) {

    console.log("\n=========================");
    console.log("📤 CREATE FILE REQUEST");
    console.log("TITLE:", title);
    console.log("DESTINATION:", destination);
    console.log("=========================\n");

    const response = await axios.post(
      "https://api.dropboxapi.com/2/file_requests/create",
      {
        title,
        destination,
        open: true
      },
      {
        headers: await this.headers()
      }
    );

    console.log("✅ FILE REQUEST CREATED");
    console.log(JSON.stringify(response.data, null, 2));

    return {
      upload_link: response.data.url,
      file_request_id: response.data.id
    };
  }

  /* =========================
     LIST FOLDER
  ========================= */
  async listFolder(path) {

    console.log("\n=========================");
    console.log("📂 LIST FOLDER");
    console.log(path);
    console.log("=========================\n");

    const response = await axios.post(
      "https://api.dropboxapi.com/2/files/list_folder",
      {
        path
      },
      {
        headers: await this.headers()
      }
    );

    const files = response.data.entries || [];

    console.log(`✅ FILES FOUND: ${files.length}`);

    return files;
  }

  /* =========================
     CREATE SHARED LINK
  ========================= */
  async createSharedLink(path) {

    console.log("\n=========================");
    console.log("🔗 CREATE SHARE LINK");
    console.log(path);
    console.log("=========================\n");

    try {

      const response = await axios.post(
        "https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings",
        {
          path
        },
        {
          headers: await this.headers()
        }
      );

      let url = response.data.url;

      url = url.replace("dl=0", "raw=1");

      console.log("✅ SHARE LINK CREATED");
      console.log(url);

      return url;

    } catch (err) {

      const tag =
        err.response?.data?.error?.[".tag"];

      if (tag === "shared_link_already_exists") {

        console.log("ℹ️ SHARE LINK EXISTS");

        const existing = await axios.post(
          "https://api.dropboxapi.com/2/sharing/list_shared_links",
          {
            path,
            direct_only: true
          },
          {
            headers: await this.headers()
          }
        );

        let url =
          existing.data.links?.[0]?.url || null;

        if (url) {
          url = url.replace("dl=0", "raw=1");
        }

        return url;
      }

      console.error("❌ SHARE LINK FAILED");
      console.error(err.response?.data || err.message);

      throw err;
    }
  }
}

module.exports = new DropboxService();
