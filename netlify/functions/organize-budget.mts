import { smartParseBudget } from "../../src/lib/budget-parser";

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

    const budget = smartParseBudget(text, category, undefined, companyName);
    return new Response(JSON.stringify({ budget, source: "netlify-engine" }), {
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
