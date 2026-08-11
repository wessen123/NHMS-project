const OpenAI = require("openai");

const ANALYSIS_SECTIONS =
  require("../templates/analysis.sections");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

exports.generateInsights =
  async (evaluation) => {

    const start = Date.now();

    console.log("\n=================================");
    console.log("🤖 STARTING AI ANALYSIS");
    console.log("=================================");

    console.log(
      "OPENAI KEY EXISTS:",
      !!process.env.OPENAI_API_KEY
    );

    console.log(
      "MODEL:",
      process.env.OPENAI_MODEL ||
      "gpt-4o-mini"
    );

    // =====================================
    // BUILD ANALYSIS STRUCTURE
    // =====================================

    const sectionTemplate =
      ANALYSIS_SECTIONS.map(
        (section) => ({
          title: section.title,
          focus: section.focus,
        })
      );

    // =====================================
    // PROMPT
    // =====================================

    const prompt = `
You are an enterprise sales performance analyst specializing in new home sales evaluations.

IMPORTANT RULES:

- DO NOT calculate scores
- Scores are already finalized
- Use evaluator notes as supporting context
- Maintain professional coaching language
- Be constructive and realistic
- Focus on behavior, sales process, communication, qualification, presentation, closing, and customer experience
- Return ONLY valid JSON
- No markdown
- No explanations outside JSON

Generate:

1. Executive Summary
2. Coaching Analysis for EACH predefined section

Each section must include:

- title
- summary
- strengths
- opportunities

RETURN FORMAT:

{
  "executive_summary": "",
  "sections": [
    {
      "title": "",
      "summary": "",
      "strengths": [],
      "opportunities": []
    }
  ]
}

SECTION STRUCTURE:
${JSON.stringify(sectionTemplate, null, 2)}

EVALUATION DATA:
${JSON.stringify(evaluation, null, 2)}
`;

    let response;

    // =====================================
    // OPENAI REQUEST
    // =====================================

    try {

      console.log(
        "📤 Sending request to OpenAI..."
      );

      response =
        await openai.chat.completions.create({

          model:
            process.env.OPENAI_MODEL ||
            "gpt-4o-mini",

          messages: [

            {
              role: "system",
              content:
                "Return only valid JSON.",
            },

            {
              role: "user",
              content: prompt,
            },
          ],

          temperature: 0.3,

          response_format: {
            type: "json_object",
          },
        });

      console.log(
        "✅ OpenAI response received"
      );

      console.log(
        "Prompt Tokens:",
        response?.usage?.prompt_tokens || 0
      );

      console.log(
        "Completion Tokens:",
        response?.usage?.completion_tokens || 0
      );

      console.log(
        "Total Tokens:",
        response?.usage?.total_tokens || 0
      );

    } catch (error) {

      console.error("\n=================================");
      console.error("❌ OPENAI API ERROR");
      console.error("=================================");

      console.error(
        "Status:",
        error.status || "Unknown"
      );

      console.error(
        "Message:",
        error.message
      );

      console.error(
        "Code:",
        error.code
      );

      if (error.response) {

        console.error(
          "Response Data:"
        );

        console.error(
          JSON.stringify(
            error.response.data,
            null,
            2
          )
        );
      }

      throw error;
    }

    // =====================================
    // CONTENT
    // =====================================

    const content =
      response?.choices?.[0]
        ?.message?.content || "{}";

    console.log("\n=================================");
    console.log("📥 RAW OPENAI RESPONSE");
    console.log("=================================");

    console.log(content);

    let parsed;

    try {

      parsed =
        JSON.parse(content);

      console.log(
        "✅ JSON parsed successfully"
      );

    } catch (err) {

      console.error("\n=================================");
      console.error(
        "❌ OPENAI JSON PARSE ERROR"
      );
      console.error("=================================");

      console.error(content);

      throw new Error(
        "Invalid OpenAI JSON response"
      );
    }

    // =====================================
    // RETURN
    // =====================================

    const result = {

      executive_summary:
        parsed.executive_summary || "",

      sections:
        parsed.sections || [],

      ai_model:
        process.env.OPENAI_MODEL ||
        "gpt-4o-mini",

      input_tokens:
        response?.usage
          ?.prompt_tokens || 0,

      output_tokens:
        response?.usage
          ?.completion_tokens || 0,

      processing_time_ms:
        Date.now() - start,
    };

    console.log("\n=================================");
    console.log("✅ AI ANALYSIS COMPLETE");
    console.log(
      `⏱ ${result.processing_time_ms}ms`
    );
    console.log("=================================\n");

    return result;
  };