import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/gemini/organize-budget")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { smartParseBudget } = await import("@/lib/budget-parser");
        const { parseBudgetWithGemini } = await import("@/lib/gemini-budget-parser");

        const body = (await request.json().catch(() => ({}))) as {
          text?: string;
          category?: string;
          companyName?: string;
          clientName?: string;
        };
        const { text, category, companyName, clientName } = body;

        if (!text || typeof text !== "string" || !text.trim()) {
          return Response.json(
            { error: "Texto ou áudio para o orçamento é obrigatório" },
            { status: 400 },
          );
        }

        const apiKey = process.env["GEMINI_API_KEY"];
        let budget;
        let source = "bl-ai-smart-engine";
        let debug: string | undefined;

        if (apiKey) {
          try {
            budget = await parseBudgetWithGemini(text, category, clientName, companyName, apiKey);
            source = "gemini";
          } catch (aiError) {
            debug = aiError instanceof Error ? aiError.message : String(aiError);
            console.error("Gemini parse failed, falling back to regex engine:", debug);
          }
        } else {
          debug = "GEMINI_API_KEY não está definida.";
        }

        if (!budget) {
          budget = smartParseBudget(text, category, clientName, companyName);
        }

        return Response.json({ budget, source, debug });
      },
    },
  },
});
