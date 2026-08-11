const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

exports.generateInsights = async (input) => {
  const start = Date.now();

  const prompt = `
You are a senior sales performance coach.

You are ONLY analyzing results (NOT scoring).

INPUT:
${JSON.stringify(input, null, 2)}

RULES:
- Do NOT change scores
- Do NOT recalculate
- Only interpret performance

OUTPUT JSON:
{
  "ai_summary": "",
  "ai_strengths": "",
  "ai_weaknesses": "",
  "ai_recommendations": ""
}
`;

  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Return ONLY JSON." },
      { role: "user", content: prompt },
    ],
  });

  const content = JSON.parse(res.choices[0].message.content);

  return {
    ...content,
    ai_model: process.env.OPENAI_MODEL,
    input_tokens: res.usage?.prompt_tokens || 0,
    output_tokens: res.usage?.completion_tokens || 0,
    processing_time_ms: Date.now() - start,
  };
};