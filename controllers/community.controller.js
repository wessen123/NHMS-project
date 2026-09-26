"use strict";

/* =========================================================
   NHMS COMMUNITY CONTROLLER
   ---------------------------------------------------------
   File:
   controllers/community.controller.js

   Purpose:
   - Receive Community data from NocoBase
   - Validate the incoming request
   - Pass Community data to community.service.js
   - Return Geoapify geocoding result
   - Always return JSON responses

   Expected request body:

   {
     "community_id": 388830554292224,
     "community_code": "COM-0124",
     "name": "Test Community",
     "address": "123 Test Street",
     "city": "Mountain View",
     "state": "CA",
     "zip": "94043"
   }
========================================================= */


const communityService =
  require("../services/community.service");


/* =========================================================
   HELPER: NORMALIZE REQUEST BODY
========================================================= */

function normalizeBody(req) {

  if (!req) {
    return {};
  }

  let body =
    req.body;


  /* -------------------------------------------------------
     Normal Express JSON request
  ------------------------------------------------------- */

  if (
    body &&
    typeof body === "object" &&
    !Buffer.isBuffer(body)
  ) {

    return body;

  }


  /* -------------------------------------------------------
     Handle body arriving as a JSON string
  ------------------------------------------------------- */

  if (
    typeof body === "string"
  ) {

    try {

      const parsed =
        JSON.parse(body);

      if (
        parsed &&
        typeof parsed === "object"
      ) {

        return parsed;

      }

    } catch (error) {

      console.error(
        "Could not parse request body as JSON:",
        error.message
      );

    }

  }


  return {};

}


/* =========================================================
   HELPER: NORMALIZE STRING
========================================================= */

function normalizeString(value) {

  if (
    value === undefined ||
    value === null
  ) {

    return "";

  }

  return String(value).trim();

}


/* =========================================================
   HELPER: SAFE ERROR MESSAGE
========================================================= */

function getErrorMessage(error) {

  if (!error) {
    return "Unknown error";
  }


  if (
    error.response?.data?.message
  ) {

    return String(
      error.response.data.message
    );

  }


  if (
    error.response?.data?.error
  ) {

    return String(
      error.response.data.error
    );

  }


  if (
    typeof error.response?.data ===
    "string"
  ) {

    return error.response.data;

  }


  if (error.message) {

    return error.message;

  }


  return String(error);

}


/* =========================================================
   GEOCODE COMMUNITY
========================================================= */

async function geocodeCommunity(
  req,
  res,
  next
) {

  console.log(
    "\n========================================"
  );

  console.log(
    "📍 NHMS COMMUNITY GEOCODE CONTROLLER"
  );

  console.log(
    "========================================"
  );


  try {

    /* =====================================================
       READ REQUEST BODY

       IMPORTANT:
       community_id comes from req.body.community_id.

       We DO NOT use:
       req.params.community_id
       req.query.community_id
       req.data.community_id
    ===================================================== */

    const body =
      normalizeBody(req);


    console.log(
      "Content-Type:",
      req.headers?.["content-type"] ||
      "NOT SET"
    );


    console.log(
      "BODY RECEIVED:"
    );


    console.log(
      JSON.stringify(
        body,
        null,
        2
      )
    );


    /* =====================================================
       COMMUNITY ID

       NocoBase Snowflake IDs can be large.

       Keep the value exactly as received.
       Do NOT convert it with Number().
    ===================================================== */

    const communityId =
      body.community_id;


    console.log(
      "COMMUNITY ID RECEIVED:",
      communityId ??
      "NOT SET"
    );


    console.log(
      "COMMUNITY ID TYPE:",
      typeof communityId
    );


    /* =====================================================
       VALIDATE COMMUNITY ID

       Do not use only:

       if (!communityId)

       because we want explicit validation.
    ===================================================== */

    if (
      communityId === undefined ||
      communityId === null ||
      String(communityId).trim() === ""
    ) {

      console.error(
        "❌ community_id is missing"
      );


      return res
        .status(400)
        .json({

          success:
            false,

          message:
            "community_id is required",

          received_body:
            body

        });

    }


    /* =====================================================
       NORMALIZE COMMUNITY INFORMATION
    ===================================================== */

    const communityData = {

      community_id:
        communityId,

      community_code:
        normalizeString(
          body.community_code
        ) || null,

      name:
        normalizeString(
          body.name
        ) || null,

      address:
        normalizeString(
          body.address
        ),

      city:
        normalizeString(
          body.city
        ),

      state:
        normalizeString(
          body.state
        ),

      zip:
        normalizeString(
          body.zip
        ) || null

    };


    console.log(
      "\nNORMALIZED COMMUNITY:"
    );


    console.log(
      JSON.stringify(
        communityData,
        null,
        2
      )
    );


    /* =====================================================
       VALIDATE ADDRESS
    ===================================================== */

    if (!communityData.address) {

      console.error(
        "❌ Community address missing"
      );


      return res
        .status(400)
        .json({

          success:
            false,

          message:
            "Community address is required",

          community_id:
            communityId

        });

    }


    /* =====================================================
       VALIDATE CITY
    ===================================================== */

    if (!communityData.city) {

      console.error(
        "❌ Community city missing"
      );


      return res
        .status(400)
        .json({

          success:
            false,

          message:
            "Community city is required",

          community_id:
            communityId

        });

    }


    /* =====================================================
       VALIDATE STATE
    ===================================================== */

    if (!communityData.state) {

      console.error(
        "❌ Community state missing"
      );


      return res
        .status(400)
        .json({

          success:
            false,

          message:
            "Community state is required",

          community_id:
            communityId

        });

    }


    /* =====================================================
       LOG ADDRESS
    ===================================================== */

    console.log(
      "\n========================================"
    );

    console.log(
      "COMMUNITY INFORMATION"
    );

    console.log(
      "========================================"
    );


    console.log(
      "ID:",
      communityData.community_id
    );


    console.log(
      "CODE:",
      communityData.community_code ||
      "NOT SET"
    );


    console.log(
      "NAME:",
      communityData.name ||
      "NOT SET"
    );


    console.log(
      "ADDRESS:",
      communityData.address
    );


    console.log(
      "CITY:",
      communityData.city
    );


    console.log(
      "STATE:",
      communityData.state
    );


    console.log(
      "ZIP:",
      communityData.zip ||
      "NOT SET"
    );


    /* =====================================================
       CALL COMMUNITY SERVICE

       community.service.js expects:

       {
         community_id,
         community_code,
         name,
         address,
         city,
         state,
         zip
       }
    ===================================================== */

    console.log(
      "\n========================================"
    );

    console.log(
      "🌎 CALLING COMMUNITY SERVICE"
    );

    console.log(
      "========================================"
    );


    const result =
      await communityService
        .geocodeCommunity(
          communityData
        );


    /* =====================================================
       VALIDATE SERVICE RESULT
    ===================================================== */

    if (!result) {

      throw new Error(
        "Community service returned no geocoding result"
      );

    }


    if (
      result.latitude === undefined ||
      result.latitude === null ||
      result.longitude === undefined ||
      result.longitude === null
    ) {

      throw new Error(
        "Community service returned an invalid geocoding result"
      );

    }


    /* =====================================================
       SUCCESS LOG
    ===================================================== */

    console.log(
      "\n========================================"
    );

    console.log(
      "✅ COMMUNITY GEOCODE CONTROLLER SUCCESS"
    );

    console.log(
      "========================================"
    );


    console.log(
      "Community ID:",
      communityId
    );


    console.log(
      "Provider:",
      result.provider ||
      "UNKNOWN"
    );


    console.log(
      "Latitude:",
      result.latitude
    );


    console.log(
      "Longitude:",
      result.longitude
    );


    console.log(
      "Formatted Address:",
      result.formatted_address ||
      "NOT SET"
    );


    console.log(
      "========================================\n"
    );


    /* =====================================================
       RETURN JSON RESPONSE
    ===================================================== */

    return res
      .status(200)
      .json({

        success:
          true,

        message:
          "Community geocoded successfully",

        data:
          result

      });


  } catch (error) {

    /* =====================================================
       ERROR HANDLING

       IMPORTANT:
       Do not throw the error outside this function.

       NocoBase should receive JSON instead of Express's
       default HTML error page.
    ===================================================== */

    console.error(
      "\n========================================"
    );

    console.error(
      "❌ COMMUNITY GEOCODING ERROR"
    );

    console.error(
      "========================================"
    );


    console.error(
      "Message:",
      getErrorMessage(error)
    );


    if (error.stack) {

      console.error(
        "Stack:",
        error.stack
      );

    }


    if (
      error.response?.status
    ) {

      console.error(
        "Provider HTTP Status:",
        error.response.status
      );

    }


    if (
      error.response?.data
    ) {

      console.error(
        "Provider Response:",
        JSON.stringify(
          error.response.data,
          null,
          2
        )
      );

    }


    console.error(
      "========================================\n"
    );


    return res
      .status(500)
      .json({

        success:
          false,

        message:
          "Community geocoding failed",

        error:
          getErrorMessage(error)

      });

  }

}


/* =========================================================
   HEALTH / TEST CONTROLLER
========================================================= */

async function health(
  req,
  res
) {

  return res
    .status(200)
    .json({

      success:
        true,

      service:
        "NHMS Community Geocoding",

      provider:
        "geoapify",

      status:
        "online",

      timestamp:
        new Date().toISOString()

    });

}


/* =========================================================
   EXPORT CONTROLLER
========================================================= */

module.exports = {

  geocodeCommunity,

  health

};