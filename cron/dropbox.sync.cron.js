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

/* =========================
   DROPBOX TOKEN
========================= */
async function getAccessToken() {

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

  return res.data.access_token;
}

/* =========================
   CREATE SHARED LINK
========================= */
async function createSharedLink(token, path) {

  try {

    const res = await axios.post(
      "https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings",
      {
        path
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    return res.data.url;

  } catch (err) {

    /* already exists */
    if (
      err.response?.data?.error?.[".tag"] ===
      "shared_link_already_exists"
    ) {

      const existing = await axios.post(
        "https://api.dropboxapi.com/2/sharing/list_shared_links",
        {
          path,
          direct_only: true
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      return existing.data.links?.[0]?.url;
    }

    throw err;
  }
}

/* =========================
   MAIN SYNC
========================= */
exports.syncDropboxUploads = async () => {

  console.log("\n🔄 CHECKING DROPBOX UPLOADS...");

  try {

    const token = await getAccessToken();

    /* =========================
       GET PENDING VIDEOS
    ========================= */
    const videosRes = await axios.get(
      `${process.env.NOCOBASE_URL}/api/videos:list`,
      {
        params: {
          filter: {
            status: "pending"
          },
          pageSize: 999
        },
        headers: nocoHeaders()
      }
    );

    const videos = videosRes.data.data || [];

    console.log(`📦 Pending videos: ${videos.length}`);

    for (const video of videos) {

      try {

        console.log("\n=================================");
        console.log("🎥 VIDEO:", video.id);
        console.log("📁 Folder:", video.upload_folder);

        /* =========================
           LIST FOLDER FILES
        ========================= */
        const folderRes = await axios.post(
          "https://api.dropboxapi.com/2/files/list_folder",
          {
            path: video.upload_folder
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            }
          }
        );

        const files = folderRes.data.entries || [];

        console.log("📂 Files found:", files.length);

        if (!files.length) continue;

        /* =========================
           FIRST FILE
        ========================= */
        const file = files[0];

        console.log("✅ FILE DETECTED:");
        console.log(JSON.stringify(file, null, 2));

        /* =========================
           CREATE SHARE LINK
        ========================= */
        const sharedLink = await createSharedLink(
          token,
          file.path_lower
        );

        console.log("🔗 SHARED LINK:", sharedLink);

        /* =========================
           UPDATE VIDEO
        ========================= */
        await axios.post(
          `${process.env.NOCOBASE_URL}/api/videos:update`,
          {
            filter: {
              id: video.id
            },

            status: "uploaded",

            url: sharedLink,
            file_path: file.path_display,
            original_filename: file.name,
            mime_type: file[".tag"],

            uploaded_at: new Date().toISOString()
          },
          {
            headers: nocoHeaders()
          }
        );

        console.log("✅ VIDEO UPDATED:", video.id);

      } catch (err) {

        console.error("❌ VIDEO FAILED:", video.id);
        console.error(err.response?.data || err.message);
      }
    }

  } catch (err) {

    console.error("❌ DROPBOX SYNC FAILED");
    console.error(err.response?.data || err.message);
  }
};