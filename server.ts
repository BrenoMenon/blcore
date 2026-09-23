import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import {
  smartParseBudget,
} from "./src/lib/budget-parser";

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

  // Organize the budget with the deterministic extraction engine. Keeping this
  // endpoint independent from an external model prevents unavailable services or
  // malformed model output from corrupting explicit customer and pricing data.
  app.post(["/api/gemini/organize-budget", "/api/organize-budget"], (req, res) => {
    const { text, category, companyName, clientName } = req.body ?? {};
    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "Texto ou áudio para o orçamento é obrigatório" });
      return;
    }

    const budget = smartParseBudget(text, category, clientName, companyName);
    res.json({ budget, source: "bl-ai-smart-engine" });
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
