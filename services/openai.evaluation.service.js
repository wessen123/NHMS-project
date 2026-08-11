const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// =====================================
// GENERATE PROFESSIONAL REPORT
// =====================================
exports.generateInsights = async (
  evaluation
) => {

  const start = Date.now();

  // =====================================
  // REDUCE PAYLOAD
  // =====================================

  const payload = {

    sales_rep:
      evaluation.sales_rep || {},

    scores:
      evaluation.scores || {},

    sections:
      evaluation.sections || [],

    final_note:
      evaluation.final_evaluator_note || "",
  };

  // =====================================
  // PROMPT
  // =====================================

  const prompt = `
You are a senior mystery shopping analyst
specializing in new home sales evaluations.

Your job is to create a professional report
similar to industry mystery shopping reports.

Use:

- section scores
- evaluator notes
- question results

Create exactly these report sections:

1. Greeting & Initial Discovery
2. Engagement & Home Demonstration
3. Objection Handling
4. Location & Community Presentation
5. Financial Presentation & Qualification
6. Closing Mechanics & Follow-Up Alignment

For each section provide:

- title
- narrative
- strengths
- opportunities

IMPORTANT RULES:

- Do NOT calculate scores
- Do NOT repeat score values
- Expand evaluator observations
- Use professional coaching language
- Do NOT invent facts
- Base all conclusions on supplied data
- Return valid JSON only

JSON FORMAT:

{
  "executive_summary": "",
  "report_sections": [
    {
      "title": "",
      "narrative": "",
      "strengths": [],
      "opportunities": []
    }
  ]
}

INPUT DATA:

${JSON.stringify(payload, null, 2)}
`;

  // =====================================
  // OPENAI
  // =====================================

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
          content: prompt
        }
      ],

      temperature: 0.3
    });

  // =====================================
  // PARSE
  // =====================================

  const content =
    response.choices[0]
      .message.content;

  let parsed;

  try {

    parsed =
      JSON.parse(content);

  } catch (err) {

    console.error(
      "OpenAI JSON Parse Error"
    );

    console.error(content);

    throw new Error(
      "Invalid OpenAI JSON response"
    );
  }

  // =====================================
  // CONVERT FOR EXISTING PDF CODE
  // =====================================

  const sections =

    (parsed.report_sections || [])
      .map(section => ({

        title:
          section.title,

        summary:
          section.narrative,

        strengths:
          section.strengths || [],

        opportunities:
          section.opportunities || []
      }));

  // =====================================
  // RETURN
  // =====================================

  return {

    executive_summary:
      parsed.executive_summary || "",

    report_sections:
      parsed.report_sections || [],

    // backward compatibility
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
      Date.now() - start,
  };
};