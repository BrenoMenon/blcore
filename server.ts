import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import {
  smartParseBudget,
} from "./src/lib/budget-parser";
import { parseBudgetWithGemini } from "./src/lib/gemini-budget-parser";

dotenv.config();

const currentDirname = process.cwd();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "BL Core Gestão" });
  });

  // Direct download route for the updated project zip
  app.get("/api/download-zip", (_req, res) => {
    const zipPath = path.join(process.cwd(), "public", "blcore.zip");
    const rootZipPath = path.join(process.cwd(), "blcore.zip");
    const target = fs.existsSync(zipPath) ? zipPath : fs.existsSync(rootZipPath) ? rootZipPath : null;

    if (target) {
      res.setHeader("Content-Disposition", 'attachment; filename="blcore.zip"');
      res.setHeader("Content-Type", "application/zip");
      res.sendFile(target);
    } else {
      res.status(404).json({ error: "Arquivo zip não encontrado no servidor." });
    }
  });

  // Organize the budget. Tries Gemini first (much better at free-form
  // dictated text); if there's no API key configured or the call fails for
  // any reason, falls back to the deterministic regex engine so this route
  // never breaks the user's flow.
  app.post(["/api/gemini/organize-budget", "/api/organize-budget"], async (req, res) => {
    const { text, category, companyName, clientName } = req.body ?? {};
    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "Texto ou áudio para o orçamento é obrigatório" });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    let budget;
    let source = "bl-ai-smart-engine";
    let debug: string | undefined;

    if (!apiKey) {
      debug = "GEMINI_API_KEY não está definida nas variáveis de ambiente.";
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

    res.json({ budget, source, debug });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
