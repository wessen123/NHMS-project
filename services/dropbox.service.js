
// services/dropbox.service.js

const axios = require("axios");


/* =========================================================
   DROPBOX CONFIGURATION
========================================================= */

const DROPBOX_API_URL =
  "https://api.dropboxapi.com/2";

const DROPBOX_TOKEN_URL =
  "https://api.dropboxapi.com/oauth2/token";


/* =========================================================
   DROPBOX SERVICE
========================================================= */

class DropboxService {


  /* =======================================================
     ACCESS TOKEN
  ======================================================= */

  async getAccessToken() {

    console.log("\n========================================");
    console.log("🔐 GENERATING DROPBOX ACCESS TOKEN");
    console.log("========================================\n");


    if (
      !process.env.DROPBOX_REFRESH_TOKEN
    ) {

      throw new Error(
        "DROPBOX_REFRESH_TOKEN is not configured"
      );

    }


    if (
      !process.env.DROPBOX_APP_KEY
    ) {

      throw new Error(
        "DROPBOX_APP_KEY is not configured"
      );

    }


    if (
      !process.env.DROPBOX_APP_SECRET
    ) {

      throw new Error(
        "DROPBOX_APP_SECRET is not configured"
      );

    }


    try {

      const response =
        await axios.post(

          DROPBOX_TOKEN_URL,

          new URLSearchParams({

            grant_type:
              "refresh_token",

            refresh_token:
              process.env.DROPBOX_REFRESH_TOKEN,

            client_id:
              process.env.DROPBOX_APP_KEY,

            client_secret:
              process.env.DROPBOX_APP_SECRET

          }).toString(),

          {

            headers: {

              "Content-Type":
                "application/x-www-form-urlencoded"

            },

            timeout:
              30000

          }

        );


      const token =
        response.data?.access_token;


      if (!token) {

        throw new Error(
          "Dropbox did not return an access token"
        );

      }


      console.log(
        "✅ DROPBOX ACCESS TOKEN GENERATED"
      );


      return token;

    } catch (error) {

      console.error(
        "❌ DROPBOX TOKEN GENERATION FAILED"
      );

      console.error(
        error.response?.data ||
        error.message
      );


      throw new Error(
        `Dropbox token request failed: ${
          error.response?.data?.error_description ||
          error.message
        }`
      );

    }

  }


  /* =======================================================
     REQUEST HEADERS
  ======================================================= */

  async headers() {

    const token =
      await this.getAccessToken();


    return {

      Authorization:
        `Bearer ${token}`,

      "Content-Type":
        "application/json"

    };

  }


  /* =======================================================
     HANDLE DROPBOX ERROR
  ======================================================= */

  handleError(
    error,
    endpoint
  ) {

    const status =
      error.response?.status ||
      "UNKNOWN";


    const dropboxError =
      error.response?.data;


    const summary =
      dropboxError?.error_summary ||
      dropboxError?.error?.[".tag"] ||
      error.message;


    console.error(
      `❌ DROPBOX REQUEST FAILED: ${endpoint}`
    );

    console.error(
      "HTTP STATUS:",
      status
    );

    console.error(
      "DROPBOX ERROR:",
      JSON.stringify(
        dropboxError ||
        error.message,
        null,
        2
      )
    );


    const formattedError =
      new Error(
        `Dropbox request failed: ${endpoint} ` +
        `(HTTP ${status}) - ${summary}`
      );


    formattedError.status =
      status;

    formattedError.dropboxError =
      dropboxError;


    return formattedError;

  }


  /* =======================================================
     CREATE FOLDER
  ======================================================= */

  async createFolder(
    path
  ) {

    console.log("\n========================================");
    console.log("📁 CREATE DROPBOX FOLDER");
    console.log("PATH:", path);
    console.log("========================================\n");


    try {

      const response =
        await axios.post(

          `${DROPBOX_API_URL}/files/create_folder_v2`,

          {

            path,

            autorename:
              false

          },

          {

            headers:
              await this.headers(),

            timeout:
              30000

          }

        );


      console.log(
        "✅ DROPBOX FOLDER CREATED"
      );


      return response.data;

    } catch (error) {

      const summary =
        error.response?.data?.error_summary ||
        "";


      /*
       * Folder already exists.
       */

      if (
        summary.includes(
          "conflict"
        )
      ) {

        console.log(
          "ℹ️ DROPBOX FOLDER ALREADY EXISTS"
        );


        return {

          already_exists:
            true,

          path

        };

      }


      throw this.handleError(
        error,
        "/files/create_folder_v2"
      );

    }

  }


  /* =======================================================
     CREATE FILE REQUEST
  ======================================================= */

  async createFileRequest(
    title,
    destination
  ) {

    console.log("\n========================================");
    console.log("📤 CREATE DROPBOX FILE REQUEST");
    console.log("TITLE:", title);
    console.log("DESTINATION:", destination);
    console.log("========================================\n");


    try {

      const response =
        await axios.post(

          `${DROPBOX_API_URL}/file_requests/create`,

          {

            title,

            destination,

            open:
              true

          },

          {

            headers:
              await this.headers(),

            timeout:
              30000

          }

        );


      console.log(
        "✅ DROPBOX FILE REQUEST CREATED"
      );

      console.log(
        "FILE REQUEST ID:",
        response.data.id
      );

      console.log(
        "UPLOAD URL:",
        response.data.url
      );


      return {

        upload_link:
          response.data.url,

        file_request_id:
          response.data.id

      };

    } catch (error) {

      throw this.handleError(
        error,
        "/file_requests/create"
      );

    }

  }


  /* =======================================================
     LIST FOLDER

     Handles Dropbox pagination automatically.
  ======================================================= */

  async listFolder(
    path
  ) {

    console.log(
      `📂 LISTING DROPBOX FOLDER: ${path}`
    );


    try {

      const entries =
        [];


      /*
       * FIRST REQUEST
       */

      let response =
        await axios.post(

          `${DROPBOX_API_URL}/files/list_folder`,

          {

            path,

            recursive:
              false,

            include_deleted:
              false

          },

          {

            headers:
              await this.headers(),

            timeout:
              60000

          }

        );


      entries.push(
        ...(
          response.data?.entries ||
          []
        )
      );


      /*
       * PAGINATION
       */

      while (
        response.data?.has_more
      ) {

        console.log(
          "📄 GETTING NEXT DROPBOX PAGE..."
        );


        response =
          await axios.post(

            `${DROPBOX_API_URL}/files/list_folder/continue`,

            {

              cursor:
                response.data.cursor

            },

            {

              headers:
                await this.headers(),

              timeout:
                60000

            }

          );


        entries.push(
          ...(
            response.data?.entries ||
            []
          )
        );

      }


      console.log(
        `✅ DROPBOX ENTRIES FOUND: ${entries.length}`
      );


      return entries;

    } catch (error) {

      throw this.handleError(
        error,
        "/files/list_folder"
      );

    }

  }


  /* =======================================================
     CREATE SHARED LINK
  ======================================================= */

  async createSharedLink(
    path
  ) {

    console.log("\n========================================");
    console.log("🔗 CREATE DROPBOX SHARED LINK");
    console.log("PATH:", path);
    console.log("========================================\n");


    try {

      const response =
        await axios.post(

          `${DROPBOX_API_URL}/sharing/create_shared_link_with_settings`,

          {

            path

          },

          {

            headers:
              await this.headers(),

            timeout:
              30000

          }

        );


      let url =
        response.data.url;


      /*
       * Convert Dropbox preview URL
       * into a raw video URL.
       */

      if (
        url.includes(
          "dl=0"
        )
      ) {

        url =
          url.replace(
            "dl=0",
            "raw=1"
          );

      }


      console.log(
        "✅ DROPBOX SHARED LINK CREATED"
      );

      console.log(
        "URL:",
        url
      );


      return url;

    } catch (error) {

      const tag =
        error.response?.data
          ?.error?.[".tag"];


      /*
       * Shared link already exists.
       */

      if (
        tag ===
        "shared_link_already_exists"
      ) {

        console.log(
          "ℹ️ SHARED LINK ALREADY EXISTS"
        );


        return await this.getExistingSharedLink(
          path
        );

      }


      throw this.handleError(
        error,
        "/sharing/create_shared_link_with_settings"
      );

    }

  }


  /* =======================================================
     GET EXISTING SHARED LINK
  ======================================================= */

  async getExistingSharedLink(
    path
  ) {

    console.log(
      "🔍 LOOKING FOR EXISTING SHARED LINK"
    );


    try {

      const response =
        await axios.post(

          `${DROPBOX_API_URL}/sharing/list_shared_links`,

          {

            path,

            direct_only:
              true

          },

          {

            headers:
              await this.headers(),

            timeout:
              30000

          }

        );


      let url =
        response.data
          ?.links?.[0]
          ?.url ||
        null;


      if (!url) {

        console.warn(
          "⚠️ NO EXISTING SHARED LINK FOUND"
        );

        return null;

      }


      if (
        url.includes(
          "dl=0"
        )
      ) {

        url =
          url.replace(
            "dl=0",
            "raw=1"
          );

      }


      console.log(
        "✅ EXISTING SHARED LINK FOUND"
      );


      return url;

    } catch (error) {

      throw this.handleError(
        error,
        "/sharing/list_shared_links"
      );

    }

  }


  /* =======================================================
     MOVE / RENAME FILE

     Dropbox uses the move API for renaming.

     Example:

     FROM:
     /Edited Videos/Hand Wellness Foundation (1).mp4

     TO:
     /Edited Videos/sami_tesfa.mp4
  ======================================================= */

  async moveFile(
    fromPath,
    toPath
  ) {

    console.log("\n========================================");
    console.log("✏️ MOVE / RENAME DROPBOX FILE");
    console.log("FROM:", fromPath);
    console.log("TO:", toPath);
    console.log("========================================\n");


    if (
      !fromPath ||
      !toPath
    ) {

      throw new Error(
        "Both fromPath and toPath are required"
      );

    }


    /*
     * Prevent unnecessary Dropbox API calls.
     */

    if (
      fromPath ===
      toPath
    ) {

      console.log(
        "ℹ️ SOURCE AND DESTINATION ARE THE SAME"
      );


      return {

        already_named:
          true,

        fromPath,

        toPath

      };

    }


    try {

      const response =
        await axios.post(

          `${DROPBOX_API_URL}/files/move_v2`,

          {

            from_path:
              fromPath,

            to_path:
              toPath,

            autorename:
              false,

            allow_ownership_transfer:
              false

          },

          {

            headers:
              await this.headers(),

            timeout:
              60000

          }

        );


      const metadata =
        response.data?.metadata;


      console.log(
        "✅ DROPBOX FILE MOVED / RENAMED"
      );


      console.log(
        "NEW PATH:",
        metadata?.path_display ||
        toPath
      );


      return metadata ||
        response.data;

    } catch (error) {

      const summary =
        error.response?.data?.error_summary ||
        "";


      /*
       * Destination already exists.
       *
       * We throw a clear error because the sync service
       * should decide whether to delete/replace it.
       */

      if (
        summary.includes(
          "conflict"
        )
      ) {

        throw new Error(
          `Dropbox rename failed because destination already exists: ${toPath}`
        );

      }


      throw this.handleError(
        error,
        "/files/move_v2"
      );

    }

  }


  /* =======================================================
     DELETE FILE OR FOLDER

     This is the method your edited-video sync is missing.

     Usage:

     await DropboxService.deleteFile(
       existingVideo.file_path
     );
  ======================================================= */

  async deleteFile(
    path
  ) {

    console.log("\n========================================");
    console.log("🗑️ DELETE DROPBOX FILE");
    console.log("PATH:", path);
    console.log("========================================\n");


    if (!path) {

      console.warn(
        "⚠️ DELETE SKIPPED: FILE PATH IS EMPTY"
      );


      return {

        skipped:
          true,

        reason:
          "empty_path"

      };

    }


    try {

      const response =
        await axios.post(

          `${DROPBOX_API_URL}/files/delete_v2`,

          {

            path

          },

          {

            headers:
              await this.headers(),

            timeout:
              60000

          }

        );


      console.log(
        "✅ DROPBOX FILE DELETED"
      );

      console.log(
        "DELETED PATH:",
        path
      );


      return (
        response.data
      );

    } catch (error) {

      const summary =
        error.response?.data?.error_summary ||
        "";


      /*
       * If the old file was already deleted,
       * do not stop the entire sync.
       */

      if (
        summary.includes(
          "not_found"
        )
      ) {

        console.warn(
          "⚠️ FILE ALREADY DOES NOT EXIST"
        );

        console.warn(
          path
        );


        return {

          already_deleted:
            true,

          path

        };

      }


      throw this.handleError(
        error,
        "/files/delete_v2"
      );

    }

  }


  /* =======================================================
     GET FILE METADATA

     Useful for verification.
  ======================================================= */

  async getFileMetadata(
    path
  ) {

    console.log("\n========================================");
    console.log("🔍 GET DROPBOX FILE METADATA");
    console.log("PATH:", path);
    console.log("========================================\n");


    try {

      const response =
        await axios.post(

          `${DROPBOX_API_URL}/files/get_metadata`,

          {

            path,

            include_media_info:
              false,

            include_deleted:
              false

          },

          {

            headers:
              await this.headers(),

            timeout:
              30000

          }

        );


      return response.data;

    } catch (error) {

      throw this.handleError(
        error,
        "/files/get_metadata"
      );

    }

  }


}


/* =========================================================
   EXPORT SINGLE INSTANCE
========================================================= */

module.exports =
  new DropboxService();
