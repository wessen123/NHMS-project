const express = require("express");

const router = express.Router();


/* =====================================================
   COMMUNITY GEOCODING API

   PHASE 1:
   Receive Community data from NocoBase workflow.

   Google Geocoding will be added after this endpoint
   has been successfully tested.
===================================================== */

router.post(
  "/geocode-community",
  async (req, res) => {

    try {

      console.log("\n=================================");
      console.log("📍 COMMUNITY DATA RECEIVED");
      console.log("=================================");

      console.log(
        JSON.stringify(
          req.body,
          null,
          2
        )
      );

      console.log("=================================\n");


      const {
        community_id,
        community_code,
        name,
        address,
        city,
        state
      } = req.body || {};


      if (!community_id) {

        return res.status(400).json({
          success: false,
          message: "community_id is required"
        });

      }


      return res.status(200).json({

        success: true,

        message:
          "Community data received successfully",

        community: {
          community_id,
          community_code:
            community_code || null,
          name:
            name || null,
          address:
            address || null,
          city:
            city || null,
          state:
            state || null
        },

        received_at:
          new Date().toISOString()

      });


    } catch (error) {

      console.error(
        "❌ COMMUNITY API ERROR:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          "Community API failed",

        error:
          error.message

      });

    }

  }
);


module.exports = router;