const OpenAI =
  require("openai");

const openai =
  new OpenAI({
    apiKey:
      process.env.OPENAI_API_KEY,
  });

// =====================================
// GENERATE REP PERFORMANCE INSIGHTS
// =====================================
async function generateRepPerformanceInsights(
  payload
) {

  const start =
    Date.now();

  const prompt = `

You are a senior sales performance analyst
specializing in new home mystery shopping.

Analyze ALL evaluations completed for
this sales representative.

The data includes:

- Average scores
- Historical performance
- Evaluator notes from multiple evaluations
- Final evaluator comments

Create:

1. Executive Summary

2. Approach Analysis

3. Qualifying Analysis

4. Demonstration Analysis

5. Presentation Analysis

6. Closing Analysis

7. Attitude Analysis

For EACH section provide:

- summary
- strengths
- opportunities

IMPORTANT:

- Focus on recurring patterns
- Identify consistent strengths
- Identify recurring weaknesses
- Use coaching language
- Do not invent facts
- Base conclusions only on supplied notes
- Do not repeat raw scores excessively
- Return valid JSON only

JSON FORMAT:

{
  "executive_summary": "",

  "sections": [
    {
      "key": "approach",
      "title": "Approach",
      "summary": "",
      "strengths": [],
      "opportunities": []
    }
  ]
}

INPUT DATA:

${JSON.stringify(
  payload,
  null,
  2
)}

`;

  const response =
    await openai.chat.completions.create({

      model:
        process.env.OPENAI_MODEL ||
        "gpt-4o-mini",

      messages: [

        {
          role: "system",
          content:
            "Return only valid JSON."
        },

        {
          role: "user",
          content:
            prompt
        }
      ],

      temperature:
        0.3
    });

  const content =
    response.choices?.[0]
      ?.message?.content || "";

  let parsed;

  try {

    parsed =
      JSON.parse(
        content
      );

  } catch (err) {

    console.error(
      "REP PERFORMANCE JSON ERROR"
    );

    console.error(
      content
    );

    throw new Error(
      "Invalid AI response"
    );
  }

  const sections =
    (parsed.sections || [])
      .map(
        section => ({

          key:
            section.key,

          title:
            section.title,

          summary:
            section.summary,

          strengths:
            section.strengths || [],

          opportunities:
            section.opportunities || []
        })
      );

  return {

    executive_summary:
      parsed.executive_summary || "",

    sections,

    ai_model:
      process.env.OPENAI_MODEL ||
      "gpt-4o-mini",

    input_tokens:
      response.usage
        ?.prompt_tokens || 0,

    output_tokens:
      response.usage
        ?.completion_tokens || 0,

    processing_time_ms:
      Date.now() - start
  };
}

module.exports = {
  generateRepPerformanceInsights
};