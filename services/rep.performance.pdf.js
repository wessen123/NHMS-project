const axios = require("axios");

// =====================================
// GET REP PERFORMANCE REPORT DATA
// =====================================
async function getRepPerformanceReportData(
  salesRepId
) {

  // =====================================
  // LOAD REP SUMMARY
  // =====================================

  const summaryResponse =
    await axios.get(

      `${process.env.BASE_URL}/api/rep_performance_summary:list`,

      {
        headers: {
          Authorization:
            `Bearer ${process.env.NOCOBASE_TOKEN}`
        }
      }
    );

  const summaries =
    summaryResponse.data?.data || [];

  const summary =
    summaries.find(

      r =>

        String(
          r.sales_rep_id
        ) ===

        String(
          salesRepId
        )
    );

  if (!summary) {

    throw new Error(
      "Rep Performance Summary Not Found"
    );
  }

  // =====================================
  // LOAD EVALUATIONS
  // =====================================

  const evalResponse =
    await axios.get(

      `${process.env.BASE_URL}/api/evaluation:list`,

      {
        headers: {
          Authorization:
            `Bearer ${process.env.NOCOBASE_TOKEN}`
        }
      }
    );

  const evaluations =
    (evalResponse.data?.data || [])
      .filter(

        e =>

          String(
            e.sales_rep_id
          ) ===

          String(
            salesRepId
          )
      );

  // =====================================
  // SORT NEWEST FIRST
  // =====================================

  evaluations.sort(

    (a, b) =>

      new Date(
        b.createdAt
      ) -

      new Date(
        a.createdAt
      )
  );

  // =====================================
  // BUILD HISTORY TABLE
  // =====================================

  const history =
    evaluations.map(
      evaluation => {

        const data =
          evaluation
            ?.responses_json
            ?.evaluation || {};

        return {

          evaluation_id:
            evaluation.id,

          date:
            data?.metadata
              ?.evaluation_date || "",

          community:
            data?.metadata
              ?.community_name || "",

          score:
            data?.scores
              ?.percentage || 0
        };
      }
    );

  // =====================================
  // TREND CHART DATA
  // =====================================

  const trendData =
    history
      .slice()
      .reverse()
      .map(
        (row, index) => ({

          label:
            `Eval ${index + 1}`,

          score:
            Number(
              row.score || 0
            )
        })
      );

  // =====================================
  // AVERAGE SCORECARD
  // =====================================

  const scorecard = [

    {
      category:
        "Approach",

      score:
        summary.Avg_approach
    },

    {
      category:
        "Qualifying",

      score:
        summary.avg_qualifying
    },

    {
      category:
        "Demonstration",

      score:
        summary.avg_demonstration
    },

    {
      category:
        "Presentation",

      score:
        summary.avg_presentation
    },

    {
      category:
        "Closing",

      score:
        summary.avg_closing
    },

    {
      category:
        "Attitude",

      score:
        summary.avg_attitude
    }
  ];

  return {

    summary,

    history,

    scorecard,

    trendData
  };
}

module.exports = {
  getRepPerformanceReportData
};