import { smartParseBudget } from "../../src/lib/budget-parser";
import { parseBudgetWithGemini } from "../../src/lib/gemini-budget-parser";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const text = body.text || "";
    const category = body.category;
    const companyName = body.companyName;
    const clientName = body.clientName;

    const apiKey = process.env.GEMINI_API_KEY;
    let budget;
    let source = "bl-ai-smart-engine";
    let debug: string | undefined;

    if (!apiKey) {
      debug = "GEMINI_API_KEY não está definida nas variáveis de ambiente da Netlify.";
      console.error(debug);
    } else {
      try {
        budget = await parseBudgetWithGemini(text, category, clientName, companyName, apiKey);
        source = "gemini";
      } catch (aiError) {
        debug = aiError instanceof Error ? aiError.message : String(aiError);
        console.error("Gemini parse failed, falling back to regex engine:", debug);
      }
    }

    if (!budget) {
      budget = smartParseBudget(text, category, clientName, companyName);
    }

    return new Response(JSON.stringify({ budget, source, debug }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
