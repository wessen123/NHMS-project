const router =
  require("express").Router();


/* =========================================================
   CONTROLLERS
========================================================= */

const uploadController =
  require(
    "../controllers/upload.controller"
  );


const communityController =
  require(
    "../controllers/community.controller"
  );

router.post(
  "/video-delete",
  uploadController.deleteVideo
);


/* =========================================================
   ORDER UPLOAD LINK ROUTE

   FINAL URL:

   POST /uploadApi/create-order-upload-links
========================================================= */

router.post(

  "/create-order-upload-links",

  uploadController.processOrder

);


/* =========================================================
   OLD ORDER ROUTE

   KEEP FOR BACKWARD COMPATIBILITY

   POST /uploadApi/process-order
========================================================= */

router.post(

  "/process-order",

  uploadController.processOrder

);


/* =========================================================
   COMMUNITY GEOCODING

   FINAL URL:

   POST /uploadApi/geocode-community

   Receives Community information from a NocoBase workflow
   and sends the address to Google Geocoding API.

   PHASE 1:
   Coordinates are returned to the caller.

   NocoBase Community updating will be added after this
   connection has been verified.
========================================================= */

router.post(

  "/geocode-community",

  communityController.geocodeCommunity

);


/* =========================================================
   HEALTH CHECK

   GET /uploadApi/health
========================================================= */

router.get(
  "/health",
  (req, res) => {

    res.json({

      ok:
        true,

      service:
        "upload-api",

      community_geocoding:
        "ready"

    });

  }
);


/* =========================================================
   EXPORT ROUTER
========================================================= */

module.exports =
  router;
