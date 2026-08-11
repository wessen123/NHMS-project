const INDUSTRY =
require("../constants/industryBenchmarks");

// =====================================
// SECTION PERCENTAGE
// =====================================
function sectionPercent(section) {
const earned =
Number(section?.section_score || 0);

const possible =
Number(section?.possible_score || 0);

if (!possible) {
return 0;
}

return Math.round(
(earned / possible) * 100
);
}

// =====================================
// FIND SECTION
// =====================================
function getSection(
sections,
key
) {
return (
sections.find(
(s) =>
String(s?.key || "")
.toLowerCase()
.trim() ===
String(key)
.toLowerCase()
.trim()
) || {}
);
}

// =====================================
// GENERATE CHART DATA
// =====================================
function generateChartData(
evaluation
) {
const sections =
evaluation?.sections || [];

return [
{
category: "Approach",
industry: Number(
INDUSTRY.approach || 0
),
salesRep: sectionPercent(
getSection(
sections,
"approach"
)
),
},

{
  category: "Qualify",
  industry: Number(
    INDUSTRY.qualifying || 0
  ),
  salesRep: sectionPercent(
    getSection(
      sections,
      "qualifying"
    )
  ),
},

{
  category: "Demonstration",
  industry: Number(
    INDUSTRY.demonstration || 0
  ),
  salesRep: sectionPercent(
    getSection(
      sections,
      "demonstration"
    )
  ),
},

{
  category: "Close",
  industry: Number(
    INDUSTRY.closing || 0
  ),
  salesRep: sectionPercent(
    getSection(
      sections,
      "closing"
    )
  ),
},

{
  category: "Presentation",
  industry: Number(
    INDUSTRY.presentation || 0
  ),
  salesRep: sectionPercent(
    getSection(
      sections,
      "presentation"
    )
  ),
},

{
  category: "Gen Attitude",
  industry: Number(
    INDUSTRY.attitude || 0
  ),
  salesRep: sectionPercent(
    getSection(
      sections,
      "attitude"
    )
  ),
},

{
  category: "Total",
  industry: Number(
    INDUSTRY.total || 0
  ),
  salesRep: Math.round(
    Number(
      evaluation?.scores?.percentage ??
      evaluation?.percentage ??
      0
    )
  ),
},

];
}
function generateRepChartData(
  summary
) {

  return [

    {
      category: "Approach",
      industry: Number(
        INDUSTRY.approach || 0
      ),
      salesRep: Math.round(
        summary.avg_approach || 0
      )
    },

    {
      category: "Qualifying",
      industry: Number(
        INDUSTRY.qualifying || 0
      ),
      salesRep: Math.round(
        summary.avg_qualifying || 0
      )
    },

    {
      category: "Demonstration",
      industry: Number(
        INDUSTRY.demonstration || 0
      ),
      salesRep: Math.round(
        summary.avg_demonstration || 0
      )
    },

    {
      category: "Presentation",
      industry: Number(
        INDUSTRY.presentation || 0
      ),
      salesRep: Math.round(
        summary.avg_presentation || 0
      )
    },

    {
      category: "Closing",
      industry: Number(
        INDUSTRY.closing || 0
      ),
      salesRep: Math.round(
        summary.avg_closing || 0
      )
    },

    {
      category: "Attitude",
      industry: Number(
        INDUSTRY.attitude || 0
      ),
      salesRep: Math.round(
        summary.avg_attitude || 0
      )
    },

    {
      category: "Overall",
      industry: Number(
        INDUSTRY.total || 0
      ),
      salesRep: Math.round(
        summary.avg_score || 0
      )
    }

  ];
}
// =====================================
// EXPORT
// =====================================
module.exports = {
generateChartData,
};
