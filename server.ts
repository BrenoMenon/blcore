import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import {
  smartParseBudget,
  cleanClientName,
  formatPhone,
  formatCpf,
  formatCnpj,
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

  // Organize budget with Gemini AI
  app.post(["/api/gemini/organize-budget", "/api/organize-budget"], async (req, res) => {
    try {
      const { text, category, companyName, clientName } = req.body;
      if (!text || typeof text !== "string" || !text.trim()) {
        res.status(400).json({ error: "Texto ou áudio para o orçamento é obrigatório" });
        return;
      }

      // Pre-compute high-intelligence deterministic parse immediately
      const instantParsed = smartParseBudget(text, category, clientName, companyName);

      // Attempt Gemini AI to enrich if available and fast
      const candidateKeys = [
        process.env.GEMINI_API_KEY,
        "AQ.Ab8RN6I694aSrVyB6l5glBLPIeA6_7jcAOQ7cI_WNnaoHydk1A"
      ].filter(Boolean) as string[];

      let enrichedBudget = instantParsed;
      let usedGemini = false;

      for (const apiKey of candidateKeys) {
        if (usedGemini) break;
        try {
          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: {
              headers: {
                "User-Agent": "aistudio-build",
              },
            },
          });

          const systemInstruction = `Você é o motor de inteligência artificial de extração do BL Core Gestão.
REGRA DE OURO ABSOLUTA:
NÃO INVENTE, NÃO ADIVINHE E NÃO PREENCHA CAMPOS QUE O USUÁRIO NÃO MENCIONOU.
Se o usuário não falou o CPF, deixe document vazio ("").
Se não falou o telefone, deixe phone vazio ("").
Se não falou endereço, deixe address vazio ("").
Se não falou o nome do cliente, deixe name vazio ("").
Se não falou prazo de validade da proposta, deixe validityDays nulo (null).
Se não falou condições de pagamento, deixe paymentTerms vazio ("").
Se não falou observações, deixe notes vazio ("").
Se não falou detalhes/descrição do item, deixe description vazio ("").

REGRAS DE EXTRAÇÃO:
1. client:
   - name: Apenas o nome real e sobrenome da pessoa ou razão social da empresa (Ex: se o usuário disser "cliente breno menon", o nome DEVE ser apenas "Breno Menon"). NUNCA extraia frases de condição, prazos ou ações como nome (ex: "Liberado Dps Que O Cliente Voltar de Viagem" NÃO é nome de cliente!). Se não houver nome claro, deixe "".
   - phone: Telefone ou WhatsApp com DDD informado pelo usuário, formatado. Se não houver número, retorne "".
   - document: CPF ou CNPJ informado pelo usuário. Se não houver, retorne "".
   - address: Endereço ou cidade informados. Se não houver, retorne "".
   - email: E-mail se informado. Se não houver, retorne "".
2. items: Array com o serviço ou serviços solicitados:
   - name: Nome do serviço solicitado (Ex: "Criação de Landing Page", "Instalação de Ar", etc.).
   - description: "" (vazio se o usuário não detalhou).
   - quantity: Quantidade especificada ou 1.
   - unitPrice: O valor numérico em reais falado pelo usuário para o serviço principal.
   - totalPrice: quantity * unitPrice.
3. categorySpecificFields: Array contendo APENAS campos cujos valores foram expressamente informados (ex: se informou prazo "7 dias" ou "daqui duas semanas", inclua o campo de prazo. Se NÃO informou, deixe o array vazio []).
4. Condições comerciais:
   - paymentTerms: Formas de pagamento, planos recorrentes ou manutenção expressamente falados pelo usuário (ex: "R$ 300 pela landing page (com 2 meses de manutenção inclusos), após R$ 150/mês"). Se não falou nada, deixe "".
   - validityDays: Número de dias de validade APENAS se o usuário falou (ex: "validade 10 dias"). Se não falou nada sobre validade, retorne null.
   - notes: APENAS observações reais ditas pelo usuário ou datas de liberação (ex: "Serviço liberado daqui duas semanas"). Se não falou nada, deixe "".`;

          const prompt = `Estruture este orçamento com fidelidade máxima:\n"""\n${text}\n"""\nEmpresa prestadora: ${companyName || "BL Core Gestão"}\nCategoria sugerida: ${category || instantParsed.category}\nCliente identificado: ${clientName || instantParsed.client.name}`;

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout Gemini")), 10000)
          );

          // Try currently active and available models
          const modelsToTry = [
            "gemini-3.5-flash-lite",
            "gemini-flash-lite-latest",
            "gemini-3.8-flash",
            "gemini-3.6-flash"
          ];
          let response: any = null;

          for (const model of modelsToTry) {
            try {
              const geminiPromise = ai.models.generateContent({
                model,
                contents: prompt,
                config: {
                  systemInstruction,
                  responseMimeType: "application/json",
                },
              });
              response = await Promise.race([geminiPromise, timeoutPromise]);
              if (response && response.text) break;
            } catch {
              // Try next model
            }
          }

          if (response && response.text) {
            const cleanJson = response.text.replace(/```json\s*|```\s*$/gi, "").trim();
            const parsed = JSON.parse(cleanJson);
            if (parsed && typeof parsed === "object") {
              const parsedPhoneDigits = parsed.client?.phone ? String(parsed.client.phone).replace(/\D/g, "") : "";
              const parsedDocDigits = parsed.client?.document ? String(parsed.client.document).replace(/\D/g, "") : "";
              
              // Prevent AI confusion if phone got set to CPF
              let finalDoc = instantParsed.client.document;
              if (!finalDoc && parsedDocDigits.length === 11) {
                finalDoc = formatCpf(parsedDocDigits);
              }
              
              let finalPhone = instantParsed.client.phone;
              if (!finalPhone && (parsedPhoneDigits.length === 10 || parsedPhoneDigits.length === 11) && parsedPhoneDigits !== parsedDocDigits) {
                finalPhone = formatPhone(parsedPhoneDigits);
              }

              const mergedClient = {
                name: parsed.client?.name && parsed.client.name !== "Cliente"
                  ? cleanClientName(parsed.client.name)
                  : (instantParsed.client.name || ""),
                phone: finalPhone || "",
                document: finalDoc || "",
                address: parsed.client?.address || instantParsed.client.address || "",
                email: parsed.client?.email || instantParsed.client.email || "",
              };

              const mergedItems = Array.isArray(parsed.items) && parsed.items.length > 0
                ? parsed.items.map((it: any, idx: number) => {
                    let itPrice = Number(it.unitPrice) || instantParsed.items[0]?.unitPrice || 0;
                    if (itPrice <= 0 && instantParsed.items[0]?.unitPrice > 0) {
                      itPrice = instantParsed.items[0].unitPrice;
                    }
                    const qty = Number(it.quantity) || 1;
                    return {
                      id: `item-${Date.now()}-${idx}`,
                      name: String(it.name || instantParsed.items[0]?.name || "Serviço"),
                      description: String(it.description || ""),
                      quantity: qty,
                      unitPrice: itPrice,
                      totalPrice: qty * itPrice,
                    };
                  })
                : instantParsed.items;

              const subtotal = mergedItems.reduce((acc: number, it: any) => acc + (it.totalPrice || 0), 0);
              const discount = Number(parsed.discount) || instantParsed.discount || 0;
              const total = Math.max(0, subtotal - discount);

              enrichedBudget = {
                title: parsed.title || instantParsed.title,
                category: parsed.category || instantParsed.category,
                client: mergedClient,
                categorySpecificFields:
                  Array.isArray(parsed.categorySpecificFields)
                    ? parsed.categorySpecificFields
                    : instantParsed.categorySpecificFields,
                items: mergedItems,
                subtotal,
                discount,
                total,
                paymentTerms: parsed.paymentTerms ?? instantParsed.paymentTerms ?? "",
                validityDays: parsed.validityDays ? Number(parsed.validityDays) : instantParsed.validityDays,
                notes: parsed.notes ?? instantParsed.notes ?? "",
              };

              usedGemini = true;
            }
          }
        } catch (geminiErr: any) {
          console.log("[Gemini fallback triggered]:", geminiErr?.message || geminiErr);
        }
      }

      res.json({ budget: enrichedBudget, source: usedGemini ? "gemini-ai" : "bl-ai-smart-engine" });
    } catch (err: any) {
      console.error("Erro no processamento do orçamento:", err);
      const safe = smartParseBudget(req.body?.text || "", req.body?.category, req.body?.clientName, req.body?.companyName);
      res.json({ budget: safe, source: "bl-ai-smart-engine" });
    }
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
