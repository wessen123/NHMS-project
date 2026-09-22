const path = require("path");

const NocoBaseService =
require("./nocobase.service");

const DropboxService =
require("./dropbox.service");

/* =======================================================
HELPERS
======================================================= */

function cleanName(value = "") {

return String(value)
.trim()
.replace(/[^a-zA-Z0-9]+/g, "")
.replace(/\s+/g, "");

}

function formatVideoDate(value) {

let date;

if (value) {


/*
 * Prevent timezone shifting for date-only values.
 *
 * Example:
 * 2025-10-23
 */

if (
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value)
) {

  const [
    year,
    month,
    day
  ] =
    value.split("-");

  return (
    `${month}.${day}.${year.slice(-2)}`
  );

}


date =
  new Date(value);


}

/*

* If the shop date is empty or invalid,
* use today's date.
  */

if (
!date ||
Number.isNaN(
date.getTime()
)
) {


date =
  new Date();


}

const month =
String(
date.getMonth() + 1
)
.padStart(2, "0");

const day =
String(
date.getDate()
)
.padStart(2, "0");

const year =
String(
date.getFullYear()
)
.slice(-2);

return (
`${month}.${day}.${year}`
);

}

/* =======================================================
EDITED VIDEO DROPBOX SYNC SERVICE
======================================================= */

class EditedVideoDropboxSyncService {

/* =====================================================
MAIN SYNC
===================================================== */

async syncDropboxUploads() {


console.log(
  "\n========================================"
);

console.log(
  "🎬 EDITED VIDEO DROPBOX SYNC START"
);

console.log(
  "========================================\n"
);


let processedRequests = 0;

let importedVideos = 0;


try {

  /* ================================================
     GET ACTIVE EDITED VIDEO REQUESTS
  ================================================= */

  console.log(
    "📂 GET ACTIVE EDITED VIDEO REQUESTS"
  );


  const requests =
    await NocoBaseService
      .getActiveEditedVideoUploadRequests();


  console.log(
    `📦 ACTIVE EDITED VIDEO REQUESTS: ${requests.length}`
  );


  if (
    !requests.length
  ) {

    console.log(
      "ℹ️ NO ACTIVE EDITED VIDEO REQUESTS FOUND"
    );

    return {
      success: true,
      processed_requests: 0,
      imported_videos: 0
    };

  }


  /* ================================================
     PROCESS EACH REQUEST
  ================================================= */

  for (
    const request of requests
  ) {

    processedRequests++;


    let requestProcessedVideos =
      0;


    try {

      /* ============================================
         VALIDATE REQUEST
      ============================================= */

      this.validateUploadRequest(
        request
      );


      console.log(
        "\n----------------------------------------"
      );

      console.log(
        `📁 EDITED VIDEO REQUEST ID: ${request.id}`
      );

      console.log(
        `🏠 SHOP ID: ${request.nhms_shop_id}`
      );

      console.log(
        `📂 FOLDER: ${request.upload_folder}`
      );

      console.log(
        "----------------------------------------\n"
      );


      /* ============================================
         LOAD SHOP VIDEO CONTEXT

         Expected:

         {
           shop,
           salesRep,
           community
         }
      ============================================= */

      const context =
        await NocoBaseService
          .getShopVideoContext(
            request.nhms_shop_id
          );


      if (
        !context ||
        !context.shop
      ) {

        throw new Error(
          `Shop context not found for shop ${request.nhms_shop_id}`
        );

      }


      const {
        shop,
        salesRep,
        community
      } =
        context;


      console.log(
        "🏠 SHOP CONTEXT LOADED"
      );

      console.log(
        "SHOP:",
        shop.id
      );

      console.log(
        "SALES REP:",
        salesRep?.full_name ||
        `${salesRep?.first_name || ""} ${salesRep?.last_name || ""}`.trim() ||
        shop.sales_rep_name ||
        "NOT FOUND"
      );

      console.log(
        "COMMUNITY:",
        community?.name ||
        "NOT FOUND"
      );

      console.log(
        "SHOP DATE:",
        shop.shop_date ||
        "EMPTY - USING TODAY"
      );


      /* ============================================
         LIST DROPBOX FOLDER
      ============================================= */

      console.log(
        `📂 LISTING DROPBOX FOLDER: ${request.upload_folder}`
      );


      let files;


      try {

        files =
          await DropboxService
            .listFolder(
              request.upload_folder
            );


      } catch (
        error
      ) {

        /*
         * Folder may not exist yet.
         *
         * Keep request active so the next cron run
         * can try again.
         */

        if (
          this.isDropboxNotFoundError(
            error
          )
        ) {

          console.log(
            "ℹ️ DROPBOX FOLDER NOT FOUND YET"
          );

          console.log(
            "📌 REQUEST REMAINS ACTIVE"
          );

          continue;

        }


        throw error;

      }


      console.log(
        `📄 DROPBOX ENTRIES FOUND: ${files.length}`
      );


      if (
        !files.length
      ) {

        console.log(
          "⏳ NO EDITED VIDEO UPLOADED YET"
        );

        continue;

      }


      /* ============================================
         FILTER VIDEO FILES
      ============================================= */

      const videoFiles =
        files.filter(
          file =>
            this.isVideoFile(
              file
            )
        );


      console.log(
        `🎬 VIDEO FILES FOUND: ${videoFiles.length}`
      );


      if (
        !videoFiles.length
      ) {

        console.log(
          "ℹ️ NO VIDEO FILES FOUND"
        );

        continue;

      }


      /*
       * Use the most recently modified video.
       *
       * This allows a new upload to replace
       * the previous edited video.
       */

      videoFiles.sort(
        (
          a,
          b
        ) => {

          const aTime =
            new Date(
              a.server_modified ||
              a.client_modified ||
              0
            ).getTime();


          const bTime =
            new Date(
              b.server_modified ||
              b.client_modified ||
              0
            ).getTime();


          return (
            bTime -
            aTime
          );

        }
      );


      const newFile =
        videoFiles[0];


      console.log(
        "\n🎬 NEWEST EDITED VIDEO FOUND"
      );

      console.log(
        "ORIGINAL FILE:",
        newFile.name
      );

      console.log(
        "ORIGINAL FILE PATH:",
        newFile.path_display
      );

      console.log(
        "DROPBOX FILE ID:",
        newFile.id
      );


      /* ============================================
         BUILD FINAL FILE NAME
      ============================================= */

      const finalFileName =
        this.buildEditedVideoFilename(
          {
            shop,
            salesRep,
            community,
            file: newFile
          }
        );


      console.log(
        "\n📝 FINAL FILE NAMING"
      );

      console.log(
        "SALES REP:",
        this.getSalesRepName(
          shop,
          salesRep
        )
      );

      console.log(
        "COMMUNITY:",
        community?.name ||
        "NOT FOUND"
      );

      console.log(
        "DATE:",
        formatVideoDate(
          shop.shop_date
        )
      );

      console.log(
        "FINAL FILE NAME:",
        finalFileName
      );


      /* ============================================
         GET EXISTING EDITED VIDEO
      ============================================= */

      const existingVideo =
        await NocoBaseService
          .getEditedVideoByShopId(
            request.nhms_shop_id
          );


      /* ============================================
         SAFETY CHECK

         If the newest Dropbox file is already
         the same file stored in NocoBase,
         do not delete or replace it.
      ============================================= */

      if (
        existingVideo &&
        existingVideo.dropbox_file_id &&
        existingVideo.dropbox_file_id ===
        newFile.id
      ) {

        console.log(
          "ℹ️ NEWEST DROPBOX FILE ALREADY EXISTS IN NOCOBASE"
        );


        /*
         * Make sure filename is still correct.
         */

        const alreadyFinal =
          await this.renameDropboxFileIfNeeded(
            newFile,
            finalFileName
          );


        const alreadyFinalPath =
          alreadyFinal.path_display ||
          alreadyFinal.path_lower;


        let alreadyFinalUrl =
          existingVideo.url;


        if (
          alreadyFinalPath
        ) {

          alreadyFinalUrl =
            await DropboxService
              .createSharedLink(
                alreadyFinalPath
              );

        }


        await NocoBaseService
          .updateEditedVideo(
            existingVideo.id,
            {

              original_filename:
                newFile.name,

              file_name:
                finalFileName,

              file_path:
                alreadyFinalPath,

              url:
                alreadyFinalUrl,

              file_size:
                alreadyFinal.size ||
                existingVideo.file_size ||
                null,

              dropbox_file_id:
                alreadyFinal.id ||
                newFile.id,

              uploaded_at:
                new Date()
                  .toISOString(),

              status:
                "uploaded"

            }
          );


        console.log(
          "✅ EXISTING EDITED VIDEO RECORD CONFIRMED"
        );


        requestProcessedVideos++;

        importedVideos++;

        continue;

      }


      /* ============================================
         REPLACE OLD EDITED VIDEO

         Delete old Dropbox file first.

         The NocoBase record is preserved and will
         be updated with the new file.
      ============================================= */

      if (
        existingVideo
      ) {

        await this.deletePreviousEditedVideo(
          existingVideo,
          newFile
        );

      }


      /* ============================================
         RENAME NEW DROPBOX FILE
      ============================================= */

      const renamedFile =
        await this.renameDropboxFileIfNeeded(
          newFile,
          finalFileName
        );


      const finalFilePath =
        renamedFile.path_display ||
        renamedFile.path_lower;


      if (
        !finalFilePath
      ) {

        throw new Error(
          "Renamed Dropbox file does not contain a valid path"
        );

      }


      console.log(
        "\n🔗 CREATING FINAL SHARE LINK"
      );


      const sharedLink =
        await DropboxService
          .createSharedLink(
            finalFilePath
          );


      /* ============================================
         UPDATE OR CREATE NOCOBASE RECORD
      ============================================= */

      const videoData =
        {

          nhms_shop_id:
            request.nhms_shop_id,

          source_video_id:
            existingVideo?.source_video_id ||
            null,

          video_editor_id:
            existingVideo?.video_editor_id ||
            null,

          original_filename:
            newFile.name,

          file_name:
            finalFileName,

          file_path:
            finalFilePath,

          url:
            sharedLink,

          dropbox_file_id:
            renamedFile.id ||
            newFile.id,

          file_size:
            renamedFile.size ||
            newFile.size ||
            null,

          duration:
            existingVideo?.duration ||
            null,

          mime_type:
            existingVideo?.mime_type ||
            null,

          status:
            "uploaded",

          submitted_at:
            existingVideo?.submitted_at ||
            null

        };


      if (
        existingVideo
      ) {

        console.log(
          "\n🔄 UPDATING EXISTING EDITED VIDEO"
        );


        await NocoBaseService
          .updateEditedVideo(
            existingVideo.id,
            videoData
          );


        console.log(
          `✅ EDITED VIDEO UPDATED: ${existingVideo.id}`
        );


      } else {

        console.log(
          "\n➕ CREATING NEW EDITED VIDEO"
        );


        const createdVideo =
          await NocoBaseService
            .createEditedVideo(
              videoData
            );


        console.log(
          `✅ EDITED VIDEO CREATED: ${createdVideo.id}`
        );

      }


      requestProcessedVideos++;

      importedVideos++;


      /* ============================================
         CLEAN UP ANY EXTRA VIDEO FILES

         Only one final edited video should remain.

         We keep the final renamed file.
      ============================================= */

      const finalPathLower =
        finalFilePath.toLowerCase();


      for (
        const file of videoFiles
      ) {

        const filePath =
          file.path_display ||
          file.path_lower ||
          "";


        /*
         * Skip the newly processed final file.
         */

        if (
          filePath.toLowerCase() ===
          finalPathLower
        ) {

          continue;

        }


        /*
         * Do not automatically delete other files here.
         *
         * This protects editors if they uploaded
         * multiple candidate files.
         *
         * The next replacement only deletes the file
         * currently referenced by NocoBase.
         */

      }


      /* ============================================
         UPDATE REQUEST STATUS
      ============================================= */

      if (
        requestProcessedVideos > 0
      ) {

        await NocoBaseService
          .updateEditedVideoUploadRequest(
            request.id,
            {
              status:
                "uploaded"
            }
          );


        console.log(
          `📌 REQUEST STATUS UPDATED TO UPLOADED: ${request.id}`
        );

      }


      console.log(
        `✅ EDITED VIDEO REQUEST PROCESSED: ${request.id}`
      );


    } catch (
      requestError
    ) {

      console.error(
        "\n========================================"
      );

      console.error(
        "❌ EDITED VIDEO REQUEST FAILED"
      );

      console.error(
        "========================================"
      );

      console.error(
        "REQUEST ID:",
        request.id
      );

      console.error(
        requestError.response?.data ||
        requestError.stack ||
        requestError.message
      );

      console.error(
        "========================================\n"
      );


      /*
       * Do not mark the request as failed here.
       *
       * Keeping it active allows the next cron run
       * to retry.
       */

    }

  }


  console.log(
    "\n========================================"
  );

  console.log(
    "✅ EDITED VIDEO DROPBOX SYNC COMPLETE"
  );

  console.log(
    "========================================"
  );

  console.log(
    `📦 REQUESTS PROCESSED: ${processedRequests}`
  );

  console.log(
    `🎬 VIDEOS IMPORTED/UPDATED: ${importedVideos}`
  );

  console.log(
    "========================================\n"
  );


  return {

    success:
      true,

    processed_requests:
      processedRequests,

    imported_videos:
      importedVideos

  };


} catch (
  error
) {

  console.error(
    "\n========================================"
  );

  console.error(
    "❌ EDITED VIDEO DROPBOX SYNC FAILED"
  );

  console.error(
    "========================================"
  );

  console.error(
    error.response?.data ||
    error.stack ||
    error.message
  );

  console.error(
    "========================================\n"
  );


  throw error;

}


}

/* =====================================================
VALIDATE REQUEST
===================================================== */

validateUploadRequest(
request
) {


if (
  !request
) {

  throw new Error(
    "Edited video upload request is required"
  );

}


if (
  !request.id
) {

  throw new Error(
    "Edited video upload request is missing an ID"
  );

}


if (
  !request.nhms_shop_id
) {

  throw new Error(
    `Edited video upload request ${request.id} is missing nhms_shop_id`
  );

}


if (
  !request.upload_folder
) {

  throw new Error(
    `Edited video upload request ${request.id} is missing upload_folder`
  );

}


}

/* =====================================================
CHECK VIDEO FILE
===================================================== */

isVideoFile(
file
) {


if (
  !file ||
  file[".tag"] !==
  "file"
) {

  return false;

}


const videoExtensions =
  [

    ".mp4",
    ".mov",
    ".avi",
    ".mkv",
    ".m4v",
    ".wmv",
    ".webm"

  ];


const extension =
  path.extname(
    file.name ||
    ""
  )
    .toLowerCase();


return (
  videoExtensions.includes(
    extension
  )
);


}

/* =====================================================
GET SALES REP NAME
===================================================== */

getSalesRepName(
shop,
salesRep
) {


/*
 * Priority 1:
 * Full Name
 */

if (
  salesRep?.full_name
) {

  return (
    String(
      salesRep.full_name
    )
      .trim()
  );

}


/*
 * Priority 2:
 * First Name + Last Name
 */

const firstName =
  String(
    salesRep?.first_name ||
    ""
  )
    .trim();


const lastName =
  String(
    salesRep?.last_name ||
    ""
  )
    .trim();


const combinedName =
  `${firstName} ${lastName}`
    .trim();


if (
  combinedName
) {

  return combinedName;

}


/*
 * Priority 3:
 * Legacy shop field
 */

if (
  shop?.sales_rep_name
) {

  return (
    String(
      shop.sales_rep_name
    )
      .trim()
  );

}


return "";


}

/* =====================================================
BUILD EDITED VIDEO FILE NAME


 Format:

 SalesRep_Community_MM.DD.YY.ext

 Example:

 DanielleRobbins_AmorusoRanch_10.23.25.mp4


===================================================== */

buildEditedVideoFilename(
{
shop,
salesRep,
community,
file
}
) {

const extension =
  path.extname(
    file?.name ||
    ""
  )
    .toLowerCase();


if (
  !extension
) {

  throw new Error(
    `Cannot determine file extension for ${file?.name}`
  );

}


const salesRepRawName =
  this.getSalesRepName(
    shop,
    salesRep
  );


const salesRepName =
  cleanName(
    salesRepRawName
  );


const communityName =
  cleanName(
    community?.name ||
    ""
  );


const formattedDate =
  formatVideoDate(
    shop?.shop_date
  );


/*
 * Professional fallbacks.
 */

const finalSalesRepName =
  salesRepName ||
  `SalesRep${shop?.id || ""}`;


const finalCommunityName =
  communityName ||
  `Community${shop?.id || ""}`;


return (
  `${finalSalesRepName}_${finalCommunityName}_${formattedDate}${extension}`
);


}

/* =====================================================
DELETE PREVIOUS EDITED VIDEO


 Deletes only the Dropbox file.

 The NocoBase record remains and is updated
 with the new video.
```

===================================================== */

async deletePreviousEditedVideo(
existingVideo,
newFile
) {


const oldPath =
  existingVideo?.file_path;


if (
  !oldPath
) {

  console.log(
    "ℹ️ EXISTING VIDEO HAS NO FILE PATH"
  );

  return;

}


const newPath =
  newFile?.path_display ||
  newFile?.path_lower ||
  "";


/*
 * Safety:
 * Never delete the newly detected file.
 */

if (
  newPath &&
  oldPath.toLowerCase() ===
  newPath.toLowerCase()
) {

  console.log(
    "⚠️ OLD FILE AND NEW FILE HAVE THE SAME PATH"
  );

  console.log(
    "⚠️ SKIPPING DELETE FOR SAFETY"
  );

  return;

}


console.log(
  "\n🗑️ DELETING OLD EDITED VIDEO"
);

console.log(
  "OLD FILE PATH:",
  oldPath
);


try {

  await DropboxService
    .deleteFile(
      oldPath
    );


  console.log(
    "✅ OLD EDITED VIDEO DELETED FROM DROPBOX"
  );


} catch (
  error
) {

  /*
   * If manually deleted already,
   * continue with the replacement.
   */

  if (
    this.isDropboxNotFoundError(
      error
    )
  ) {

    console.log(
      "ℹ️ OLD DROPBOX FILE ALREADY DOES NOT EXIST"
    );

    return;

  }


  throw error;

}


}

/* =====================================================
RENAME DROPBOX FILE
===================================================== */

async renameDropboxFileIfNeeded(
file,
finalFileName
) {


const currentPath =
  file.path_display ||
  file.path_lower;


if (
  !currentPath
) {

  throw new Error(
    `Dropbox file ${file.id} does not have a valid path`
  );

}


/*
 * Already correctly named.
 */

if (
  file.name ===
  finalFileName
) {

  console.log(
    "ℹ️ DROPBOX FILE ALREADY HAS FINAL NAME"
  );

  return file;

}


const directory =
  path.posix.dirname(
    currentPath
  );


const destinationPath =
  path.posix.join(
    directory,
    finalFileName
  );


console.log(
  "\n🔄 RENAMING DROPBOX FILE"
);

console.log(
  "FROM:",
  currentPath
);

console.log(
  "TO:",
  destinationPath
);


/*
 * Your DropboxService must implement moveFile().
 */

const movedFile =
  await DropboxService
    .moveFile(
      currentPath,
      destinationPath
    );


console.log(
  "✅ DROPBOX FILE RENAMED"
);


/*
 * Dropbox move response normally contains metadata.
 *
 * Normalize the returned object.
 */

return (
  movedFile?.metadata ||
  movedFile
);


}

/* =====================================================
DROPBOX NOT FOUND ERROR
===================================================== */

isDropboxNotFoundError(
error
) {


const status =
  error?.response?.status;


const data =
  error?.response?.data;


const errorSummary =
  data?.error_summary ||
  "";


const tag =
  data?.error?.[".tag"] ||
  "";


return (

  status === 409 &&

  (

    errorSummary.includes(
      "path/not_found"
    ) ||

    errorSummary.includes(
      "not_found"
    ) ||

    tag ===
    "not_found"

  )

);


}

}

/* =======================================================
EXPORT

IMPORTANT:

index.js can call:

EditedVideoDropboxSyncService
.syncDropboxUploads()
======================================================= */

module.exports =
new EditedVideoDropboxSyncService();
