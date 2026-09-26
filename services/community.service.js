require("dotenv").config();

const axios = require("axios");


/* =========================================================
   NHMS COMMUNITY SERVICE
   ---------------------------------------------------------
   Provider: Geoapify

   Purpose:
   - Receive Community information from NocoBase
   - Build a complete address
   - Include ZIP Code when available
   - Geocode the Community using Geoapify
   - Return normalized location information

   IMPORTANT:
   This version DOES NOT update NocoBase yet.

   First we test:
   NocoBase / cURL
        ↓
   NHMS Backend
        ↓
   Geoapify
        ↓
   Coordinates returned successfully

   After successful testing, NocoBase write-back will be added.
========================================================= */


/* =========================================================
   CONFIGURATION
========================================================= */

const GEOAPIFY_API_KEY =
  process.env.GEOAPIFY_API_KEY;


const GEOAPIFY_GEOCODING_URL =
  "https://api.geoapify.com/v1/geocode/search";


/* =========================================================
   VALIDATE CONFIGURATION
========================================================= */

if (!GEOAPIFY_API_KEY) {

  throw new Error(
    "GEOAPIFY_API_KEY is not configured in the environment"
  );

}


/* =========================================================
   COMMUNITY SERVICE
========================================================= */

class CommunityService {


  /* =======================================================
     NORMALIZE STRING
  ======================================================= */

  normalizeString(value) {

    if (
      value === null ||
      value === undefined
    ) {

      return "";

    }

    return String(value).trim();

  }


  /* =======================================================
     BUILD COMMUNITY ADDRESS

     Example input:

     {
       address: "1600 Amphitheatre Parkway",
       city: "Mountain View",
       state: "CA",
       zip: "94043"
     }

     Result:

     1600 Amphitheatre Parkway, Mountain View, CA, 94043
  ======================================================= */

  buildAddress(data = {}) {

    const address =
      this.normalizeString(
        data.address
      );


    const city =
      this.normalizeString(
        data.city
      );


    const state =
      this.normalizeString(
        data.state
      );


    const zip =
      this.normalizeString(
        data.zip
      );


    return [
      address,
      city,
      state,
      zip
    ]
      .filter(Boolean)
      .join(", ");

  }


  /* =======================================================
     EXTRACT ADDRESS COMPONENTS
  ======================================================= */

  extractAddressComponents(
    properties = {}
  ) {

    const stateCode =
      this.normalizeString(
        properties.state_code
      );


    const countryCode =
      this.normalizeString(
        properties.country_code
      );


    return {

      house_number:
        properties.housenumber ||
        null,

      street:
        properties.street ||
        null,

      address_line1:
        properties.address_line1 ||
        null,

      address_line2:
        properties.address_line2 ||
        null,

      suburb:
        properties.suburb ||
        null,

      district:
        properties.district ||
        null,

      city:
        properties.city ||
        properties.town ||
        properties.village ||
        properties.municipality ||
        null,

      county:
        properties.county ||
        null,

      state:
        stateCode
          ? stateCode.toUpperCase()
          : (
              properties.state ||
              null
            ),

      state_name:
        properties.state ||
        null,

      postal_code:
        properties.postcode ||
        null,

      country:
        countryCode
          ? countryCode.toUpperCase()
          : null,

      country_name:
        properties.country ||
        null

    };

  }


  /* =======================================================
     EXTRACT NUMBER SAFELY
  ======================================================= */

  numberOrNull(value) {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {

      return null;

    }


    const number =
      Number(value);


    return Number.isFinite(number)
      ? number
      : null;

  }


  /* =======================================================
     GEOCODE COMMUNITY
  ======================================================= */

  async geocodeCommunity(
    data = {}
  ) {

    console.log(
      "\n========================================"
    );

    console.log(
      "📍 NHMS COMMUNITY GEOCODING"
    );

    console.log(
      "========================================"
    );


    /* =====================================================
       NORMALIZE INPUT
    ===================================================== */

    const communityId =
      data.community_id;


    const communityCode =
      this.normalizeString(
        data.community_code
      ) || null;


    const communityName =
      this.normalizeString(
        data.name
      ) || null;


    const address =
      this.normalizeString(
        data.address
      );


    const city =
      this.normalizeString(
        data.city
      );


    const state =
      this.normalizeString(
        data.state
      );


    const zip =
      this.normalizeString(
        data.zip
      );


    /* =====================================================
       LOG INPUT
    ===================================================== */

    console.log(
      "Community ID:",
      communityId ||
      "NOT SET"
    );


    console.log(
      "Community Code:",
      communityCode ||
      "NOT SET"
    );


    console.log(
      "Community Name:",
      communityName ||
      "NOT SET"
    );


    console.log(
      "Address:",
      address ||
      "NOT SET"
    );


    console.log(
      "City:",
      city ||
      "NOT SET"
    );


    console.log(
      "State:",
      state ||
      "NOT SET"
    );


    console.log(
      "ZIP:",
      zip ||
      "NOT SET"
    );


    /* =====================================================
       VALIDATE COMMUNITY ID
    ===================================================== */

    if (
      communityId === null ||
      communityId === undefined ||
      String(communityId).trim() === ""
    ) {

      throw new Error(
        "community_id is required"
      );

    }


    /* =====================================================
       VALIDATE LOCATION INFORMATION
    ===================================================== */

    if (!address) {

      throw new Error(
        "Community address is required"
      );

    }


    if (!city) {

      throw new Error(
        "Community city is required"
      );

    }


    if (!state) {

      throw new Error(
        "Community state is required"
      );

    }


    /* =====================================================
       BUILD COMPLETE ADDRESS
    ===================================================== */

    const fullAddress =
      this.buildAddress({
        address,
        city,
        state,
        zip
      });


    console.log(
      "\nGeoapify Search Address:"
    );


    console.log(
      fullAddress
    );


    /* =====================================================
       CALL GEOAPIFY
    ===================================================== */

    console.log(
      "\n========================================"
    );

    console.log(
      "🌎 SENDING REQUEST TO GEOAPIFY"
    );

    console.log(
      "========================================"
    );


    let response;


    try {

      response =
        await axios.get(
          GEOAPIFY_GEOCODING_URL,
          {

            params: {

              text:
                fullAddress,

              format:
                "geojson",

              limit:
                1,

              apiKey:
                GEOAPIFY_API_KEY

            },

            timeout:
              15000,

            headers: {

              Accept:
                "application/json"

            }

          }
        );

    } catch (error) {

      console.error(
        "\n❌ GEOAPIFY HTTP REQUEST FAILED"
      );


      const status =
        error.response?.status;


      const responseData =
        error.response?.data;


      console.error(
        "HTTP Status:",
        status ||
        "UNKNOWN"
      );


      console.error(
        "Geoapify Response:",
        responseData ||
        error.message
      );


      /* ---------------------------------------------------
         Authentication / API key
      --------------------------------------------------- */

      if (
        status === 401 ||
        status === 403
      ) {

        throw new Error(
          "Geoapify authentication failed. Check GEOAPIFY_API_KEY and API key restrictions."
        );

      }


      /* ---------------------------------------------------
         Rate limit
      --------------------------------------------------- */

      if (
        status === 429
      ) {

        throw new Error(
          "Geoapify API rate limit exceeded"
        );

      }


      /* ---------------------------------------------------
         Other provider error
      --------------------------------------------------- */

      const providerMessage =

        responseData?.message ||

        responseData?.error ||

        error.message ||

        "Unknown Geoapify error";


      throw new Error(
        `Geoapify Geocoding request failed: ${providerMessage}`
      );

    }


    /* =====================================================
       VALIDATE RESPONSE
    ===================================================== */

    const geoapifyData =
      response?.data ||
      {};


    console.log(
      "Geoapify HTTP Status:",
      response.status
    );


    console.log(
      "Geoapify Response Type:",
      geoapifyData.type ||
      "UNKNOWN"
    );


    const features =
      Array.isArray(
        geoapifyData.features
      )
        ? geoapifyData.features
        : [];


    console.log(
      "Geoapify Results:",
      features.length
    );


    if (!features.length) {

      throw new Error(
        `Geoapify could not find the Community address: ${fullAddress}`
      );

    }


    /* =====================================================
       GET BEST RESULT
    ===================================================== */

    const feature =
      features[0] ||
      {};


    const properties =
      feature.properties ||
      {};


    const geometry =
      feature.geometry ||
      {};


    const coordinates =
      Array.isArray(
        geometry.coordinates
      )
        ? geometry.coordinates
        : [];


    /* =====================================================
       COORDINATES

       GeoJSON order:
       [
         longitude,
         latitude
       ]
    ===================================================== */

    const longitude =
      this.numberOrNull(
        properties.lon ??
        coordinates[0]
      );


    const latitude =
      this.numberOrNull(
        properties.lat ??
        coordinates[1]
      );


    if (
      latitude === null ||
      longitude === null
    ) {

      throw new Error(
        "Geoapify returned a result without valid latitude/longitude"
      );

    }


    /* =====================================================
       ADDRESS COMPONENTS
    ===================================================== */

    const components =
      this.extractAddressComponents(
        properties
      );


    /* =====================================================
       GEOAPIFY RANK / CONFIDENCE
    ===================================================== */

    const rank =
      properties.rank ||
      {};


    const confidence =
      this.numberOrNull(
        rank.confidence
      );


    const confidenceCityLevel =
      this.numberOrNull(
        rank.confidence_city_level
      );


    const confidenceStreetLevel =
      this.numberOrNull(
        rank.confidence_street_level
      );


    const confidenceBuildingLevel =
      this.numberOrNull(
        rank.confidence_building_level
      );


    /* =====================================================
       PLACE ID
    ===================================================== */

    const placeId =
      properties.place_id ||
      feature.id ||
      null;


    /* =====================================================
       RESULT TYPE
    ===================================================== */

    const resultType =
      properties.result_type ||
      null;


    /* =====================================================
       FORMATTED ADDRESS
    ===================================================== */

    const formattedAddress =
      properties.formatted ||
      [
        properties.address_line1,
        properties.address_line2
      ]
        .filter(Boolean)
        .join(", ") ||
      fullAddress;


    /* =====================================================
       ZIP CODE

       Keep both:

       input_zip
       = ZIP entered in NHMS

       geocoded_zip
       = ZIP returned by Geoapify

       This is useful for detecting address differences.
    ===================================================== */

    const geocodedZip =
      properties.postcode ||
      components.postal_code ||
      null;


    /* =====================================================
       NORMALIZED LOCATION JSON

       Later this can be stored directly in the
       Community location_json field.
    ===================================================== */

    const locationJson = {

      provider:
        "geoapify",

      place_id:
        placeId,

      result_type:
        resultType,

      formatted_address:
        formattedAddress,

      coordinates: {

        latitude,

        longitude

      },

      confidence: {

        overall:
          confidence,

        city:
          confidenceCityLevel,

        street:
          confidenceStreetLevel,

        building:
          confidenceBuildingLevel

      },

      components

    };


    /* =====================================================
       FINAL NHMS RESPONSE
    ===================================================== */

    const result = {

      community_id:
        communityId,

      community_code:
        communityCode,

      name:
        communityName,

      address,

      city,

      state,

      zip:
        zip || null,

      input_address:
        fullAddress,

      input_zip:
        zip || null,

      geocoded_address:
        formattedAddress,

      formatted_address:
        formattedAddress,

      geocoded_zip:
        geocodedZip,

      latitude,

      longitude,

      place_id:
        placeId,

      result_type:
        resultType,

      location_type:
        resultType,

      confidence,

      confidence_city_level:
        confidenceCityLevel,

      confidence_street_level:
        confidenceStreetLevel,

      confidence_building_level:
        confidenceBuildingLevel,

      components,

      location_json:
        locationJson,

      geocode_status:
        "Verified",

      provider:
        "geoapify",

      geocoded_at:
        new Date().toISOString()

    };


    /* =====================================================
       SUCCESS LOG
    ===================================================== */

    console.log(
      "\n========================================"
    );

    console.log(
      "✅ COMMUNITY GEOCODING SUCCESS"
    );

    console.log(
      "========================================"
    );


    console.log(
      "Community:",
      communityName ||
      communityId
    );


    console.log(
      "Input Address:",
      fullAddress
    );


    console.log(
      "Formatted Address:",
      formattedAddress
    );


    console.log(
      "Input ZIP:",
      zip ||
      "NOT PROVIDED"
    );


    console.log(
      "Geoapify ZIP:",
      geocodedZip ||
      "NOT RETURNED"
    );


    console.log(
      "Latitude:",
      latitude
    );


    console.log(
      "Longitude:",
      longitude
    );


    console.log(
      "Result Type:",
      resultType ||
      "UNKNOWN"
    );


    console.log(
      "Confidence:",
      confidence ??
      "NOT RETURNED"
    );


    console.log(
      "Provider:",
      "geoapify"
    );


    console.log(
      "========================================\n"
    );


    return result;

  }

}


/* =========================================================
   EXPORT
========================================================= */

module.exports =
  new CommunityService();