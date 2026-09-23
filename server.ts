import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  app.post("/api/gemini/organize-budget", async (req, res) => {
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

          const systemInstruction = `Você é o especialista de elite em geração de orçamentos e propostas comerciais do sistema BL Core Gestão.
Transforme a solicitação do usuário em uma proposta comercial completa, estruturada e detalhada em formato JSON estrito.
REGRAS MANDATÓRIAS DE EXTRAÇÃO:
1. client:
   - name: Nome completo do cliente (apenas nome de pessoa ou razão social da empresa, NUNCA palavras como 'gestão', 'orçamento', 'serviço')
   - phone: Telefone ou WhatsApp formatado como (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
   - document: CPF (formato XXX.XXX.XXX-XX) ou CNPJ (XX.XXX.XXX/XXXX-XX)
   - address: Endereço completo, cidade e bairro identificados no texto
   - email: E-mail se informado
2. items: Array com o serviço ou serviços solicitados:
   - name: Nome do serviço conforme o usuário pediu (Ex: "Criação de Landing Page Personalizada por IA").
   - description: Descrição profissional e comercial atraente dos entregáveis do serviço.
   - quantity: Quantidade (padrão 1).
   - unitPrice: O valor monetário do serviço em reais (ex: 800). NUNCA confunda o prazo (ex: 7 dias) com o valor monetário!
   - totalPrice: quantity * unitPrice.
3. categorySpecificFields: 3 ou mais tópicos adaptados ao ramo:
   - Plataforma / Escopo
   - Prazo de Entrega (conforme especificado no texto, ex: 7 dias)
   - Suporte Técnico / Garantia
4. Condições comerciais:
   - paymentTerms: Condições de pagamento. Se o cliente especificou observação de pagamento (ex: "ele só vai pagar quando fechar a venda do sítio dele"), COLOQUE ESSA CONDIÇÃO CLARAMENTE aqui!
   - validityDays: Validade da proposta (ex: 15).
   - notes: Observações gerais. SE HOUVER OBS NO TEXTO (ex: obs do sítio), MANTENHA E DESTAQUE ESSA OBSERVAÇÃO AQUI!`;

          const prompt = `Estruture este orçamento com fidelidade máxima:\n"""\n${text}\n"""\nEmpresa prestadora: ${companyName || "BL Core Gestão"}\nCategoria sugerida: ${category || instantParsed.category}\nCliente identificado: ${clientName || instantParsed.client.name}`;

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout Gemini")), 10000)
          );

          // Try available models
          const modelsToTry = ["gemini-3.6-flash", "gemini-3.8-flash", "gemini-flash-latest"];
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
              const mergedClient = {
                name: parsed.client?.name && parsed.client.name !== "Cliente"
                  ? cleanClientName(parsed.client.name)
                  : instantParsed.client.name,
                phone: parsed.client?.phone && parsed.client.phone !== "(00) 00000-0000"
                  ? parsed.client.phone
                  : instantParsed.client.phone,
                document: parsed.client?.document || instantParsed.client.document,
                address: parsed.client?.address || instantParsed.client.address,
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
                      name: String(it.name || instantParsed.items[0]?.name || "Serviço Especializado"),
                      description: String(it.description || instantParsed.items[0]?.description || "Execução com padrão profissional"),
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
                  Array.isArray(parsed.categorySpecificFields) && parsed.categorySpecificFields.length > 0
                    ? parsed.categorySpecificFields
                    : instantParsed.categorySpecificFields,
                items: mergedItems,
                subtotal,
                discount,
                total,
                paymentTerms: parsed.paymentTerms || instantParsed.paymentTerms,
                validityDays: Number(parsed.validityDays) || instantParsed.validityDays,
                notes: parsed.notes || instantParsed.notes,
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

function cleanClientName(name: string): string {
  if (!name) return "Cliente";
  const forbidden = ["orçamento", "orcamento", "serviço", "servico", "gestão", "gestao", "troca", "cliente", "para", "com", "de", "do", "da"];
  const words = name.split(/\s+/).filter((w) => !forbidden.includes(w.toLowerCase()));
  if (words.length === 0) return "Cliente";
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  } else if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return raw;
}

function formatCpf(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return raw;
}

function formatCnpj(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return raw;
}

function smartParseBudget(rawText: string, category?: string, clientNameSuggestion?: string, companyNameSuggestion?: string) {
  const text = (rawText || "").trim();
  const lower = text.toLowerCase();

  // 1. Phone extraction
  let detectedPhone = "(00) 00000-0000";
  const phonePattern = /(?:(?:zap|whats|whatsapp|fone|celular|tel|telefone)\s*[:=]?\s*)?(?:\+?55\s*)?(?:\(?([1-9]{2})\)?\s*)?(9?\d{4})[-.\s]?(\d{4})/i;
  const phoneMatch = text.match(phonePattern);
  if (phoneMatch) {
    const rawDigits = (phoneMatch[1] ? phoneMatch[1] : "") + phoneMatch[2] + phoneMatch[3];
    if (rawDigits.length >= 10) {
      detectedPhone = formatPhone(rawDigits);
    }
  }

  // Remove phone to avoid false matching as CPF/CNPJ or price
  const textNoPhone = text.replace(phonePattern, " ");

  // 2. CPF / CNPJ extraction
  let detectedDocument = "";
  const cpfMatch =
    textNoPhone.match(/(?:cpf)\s*[:=]?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11})/i) ||
    textNoPhone.match(/\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/);
  const cnpjMatch =
    textNoPhone.match(/(?:cnpj)\s*[:=]?\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{14})/i) ||
    textNoPhone.match(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/);

  if (cpfMatch) {
    detectedDocument = formatCpf(cpfMatch[1]);
  } else if (cnpjMatch) {
    detectedDocument = formatCnpj(cnpjMatch[1]);
  }

  // 3. Observations extraction (obs:, observação:, observacao:, etc.)
  let detectedObs = "";
  const obsMatch =
    text.match(/(?:(?:obs|observação|observacao|observações|observacoes|nota|aviso|detalhe)\s*[:=]\s*)(.+?)(?=\s*(?:cliente|telefone|tel|cpf|cnpj|serviço|servico|valor|r\$|prazo|\.|$))/i) ||
    text.match(/(?:(?:obs|observação|observacao)\s*[:=]\s*)(.+)$/i);
  if (obsMatch && obsMatch[1]) {
    detectedObs = obsMatch[1].trim().replace(/[-–,]+$/, "");
    detectedObs = detectedObs.charAt(0).toUpperCase() + detectedObs.slice(1);
  }

  // 4. Address extraction (support endereço, endreço, endereco, end, rua, av, cidade, local, etc.)
  let detectedAddress = "";
  const addrMatch = text.match(
    /(?:(?:endereço|endreço|endereco|end\.?|cidade(?:\s+de)?|local|localização|localizacao|reside\s+em|mora\s+em)\s*[:=]?\s*)([^,]+?)(?=\s*(?:,|cpf|cnpj|telefone|tel|celular|zap|whatsapp|serviço|servico|valor|r\$|\d+\s*(?:reais|r\$)|prazo|obs|observação|observacao|\.|$))/i
  );
  if (addrMatch && addrMatch[1]) {
    detectedAddress = addrMatch[1]
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .map((w) => {
        const lw = w.toLowerCase();
        if (["do", "da", "de", "e", "em", "no", "na"].includes(lw)) return lw;
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(" ");
  }

  // 5. Client Name extraction
  let detectedClient = clientNameSuggestion || "";
  const clientMatch = text.match(
    /(?:(?:cliente|nome(?:\s+do\s+cliente)?|em\s+nome\s+de|para\s+o|para\s+a)\s*[:=]?\s*)([A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]+?)(?=\s*(?:,|telefone|tel|celular|zap|whatsapp|cpf|cnpj|endereço|endreço|endereco|serviço|servico|valor|r\$|\d+\s*(?:reais|r\$)|prazo|obs|\.|$))/i
  );
  if (clientMatch && clientMatch[1]) {
    detectedClient = cleanClientName(clientMatch[1].trim());
  } else if (!detectedClient) {
    const words = text.trim().split(/\s+/);
    const stopWords = [
      "orçamento", "orcamento", "quero", "fazer", "criar", "serviço", "servico", "olá", "ola", "bom", "boa", "por", "favor"
    ];
    if (words.length > 0 && !stopWords.includes(words[0].toLowerCase()) && !/\d/.test(words[0])) {
      detectedClient = cleanClientName(words.slice(0, 3).join(" "));
    }
  }

  // 6. Service extraction
  let detectedService = "";
  const serviceMatch = text.match(
    /(?:(?:serviço|servico|projeto|trabalho|item|descrição|descricao)\s*[:=]?\s*)([^,]+?)(?=\s*(?:,|\d+\s*(?:reais|r\$)|valor|r\$|prazo|obs|observação|observacao|cpf|cnpj|telefone|\.|$))/i
  );
  if (serviceMatch && serviceMatch[1]) {
    detectedService = serviceMatch[1]
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .map((w) => {
        const lw = w.toLowerCase();
        if (lw === "ia" || lw === "ai") return "IA";
        if (["de", "da", "do", "para", "por", "com", "e", "em"].includes(lw)) return lw;
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(" ");

    // Fix common Portuguese unaccented words
    detectedService = detectedService
      .replace(/\bCriaçao\b/g, "Criação")
      .replace(/\bManutençao\b/g, "Manutenção")
      .replace(/\bInstalaçao\b/g, "Instalação")
      .replace(/\bHigienizaçao\b/g, "Higienização")
      .replace(/\bRevisao\b/g, "Revisão")
      .replace(/\bAutomocao\b/g, "Automação");
  }

  // 7. Price extraction
  let detectedPrice = 0;
  const priceMatch =
    text.match(/(?:r\$|valor\s*[:=]?\s*r\$?|por)?\s*([0-9]+(?:[\.,][0-9]{2})?)\s*(?:reais|r\$)/i) ||
    text.match(/(?:valor|preço|preco)\s*[:=]?\s*(?:r\$)?\s*([0-9]+(?:[\.,][0-9]{2})?)/i);
  if (priceMatch && priceMatch[1]) {
    detectedPrice = parseFloat(priceMatch[1].replace(",", "."));
  } else {
    // Look for standalone numbers that are not phone or CPF
    let textForPrice = textNoPhone;
    if (detectedDocument) {
      textForPrice = textForPrice.replace(new RegExp(detectedDocument.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "g"), " ");
    }
    const numRegex = /\b([1-9][0-9]*(?:[\.,][0-9]{2})?)\b(?!\s*(?:dias|horas|semanas|meses|anos|btus|x|vezes|unidades|peças|km))/gi;
    let nm: RegExpExecArray | null;
    const candidates: number[] = [];
    while ((nm = numRegex.exec(textForPrice)) !== null) {
      const val = parseFloat(nm[1].replace(",", "."));
      if (val >= 20 && val !== 2025 && val !== 2026 && val < 500000) {
        candidates.push(val);
      }
    }
    if (candidates.length > 0) {
      detectedPrice = candidates[candidates.length - 1];
    }
  }

  if (detectedPrice <= 0) {
    detectedPrice = 800; // sensible default
  }

  // 8. Prazo extraction
  let detectedPrazo = "7 dias";
  const prazoMatch = text.match(
    /(?:prazo(?:\s+de\s+entrega)?|entrega|conclusão)(?:\s+em|\s+de)?\s*[:=]?\s*(\d+\s*(?:dias\s*úteis|dias|horas|semanas|meses))/i
  );
  if (prazoMatch && prazoMatch[1]) {
    detectedPrazo = prazoMatch[1].trim();
  }

  // 9. Payment terms & notes
  let paymentTerms = "PIX à vista ou Cartão de Crédito";
  let notes = "";

  if (detectedObs) {
    notes = `Observação: ${detectedObs}. Prazo de conclusão estimado em ${detectedPrazo}. Início mediante aprovação.`;
    const obsLower = detectedObs.toLowerCase();
    if (
      obsLower.includes("pagar") ||
      obsLower.includes("venda") ||
      obsLower.includes("sítio") ||
      obsLower.includes("sitio") ||
      obsLower.includes("quando")
    ) {
      paymentTerms = `A combinar conforme condição: ${detectedObs}`;
    }
  } else {
    notes = `Validade da proposta de 15 dias corridos. Prazo de entrega: ${detectedPrazo}. Início dos serviços mediante aprovação.`;
  }

  // 10. Service classification & item generation
  let itemName = detectedService;
  let itemDesc = "Execução profissional com padrão de excelência, planejamento e acompanhamento dedicado.";
  let resolvedCategory = category || "Web & Tecnologia";
  let platformLabel = "Plataforma / Escopo";
  let platformValue = "Projeto Personalizado";

  if (!itemName) {
    if (lower.includes("landing") || lower.includes("site") || lower.includes("web") || lower.includes("ia")) {
      itemName = "Criação de Landing Page Personalizada por IA";
      itemDesc = "Desenvolvimento completo de landing page responsiva, personalizada com inteligência artificial, design moderno e otimizado para conversão.";
      resolvedCategory = "Web & Tecnologia";
      platformValue = "Landing Page Responsiva com IA";
    } else if (lower.includes("social") || lower.includes("instagram") || lower.includes("mídia") || lower.includes("midia")) {
      itemName = "Gestão de Mídias Sociais & Conteúdo";
      itemDesc = "Planejamento editorial, design de posts/stories e publicação com acompanhamento de engajamento.";
      resolvedCategory = "Social Media";
      platformValue = "Instagram & Redes Sociais";
    } else if (lower.includes("ar condicionado") || lower.includes("climatiz")) {
      itemName = "Instalação e Manutenção de Climatização";
      itemDesc = "Mão de obra técnica qualificada com vácuo, testes de pressão e garantia de estanqueidade.";
      resolvedCategory = "Climatização & Refrigeração";
      platformLabel = "Equipamento / Capacidade";
      platformValue = "Sistema Split / Climatização";
    } else {
      itemName = "Prestação de Serviços Especializados";
      itemDesc = "Execução de serviços com alto padrão técnico e garantia de satisfação.";
      resolvedCategory = category || "Serviços Gerais";
      platformValue = "Atendimento Personalizado";
    }
  } else {
    if (itemName.toLowerCase().includes("landing") || itemName.toLowerCase().includes("site") || itemName.toLowerCase().includes("ia")) {
      itemDesc = "Desenvolvimento completo com design moderno, responsividade mobile, integração de inteligência artificial e foco em conversão de leads.";
      resolvedCategory = "Web & Tecnologia";
      platformValue = itemName;
    } else {
      itemDesc = `Execução técnica especializada de ${itemName.toLowerCase()} com padrão de qualidade e garantia.`;
    }
  }

  const categorySpecificFields = [
    { key: "plataforma", label: platformLabel, value: platformValue },
    { key: "prazo", label: "Prazo de Entrega", value: detectedPrazo },
    { key: "suporte", label: "Garantia / Suporte", value: "30 dias de suporte e garantia técnica" },
  ];

  const items = [
    {
      id: `item-${Date.now()}-1`,
      name: itemName,
      description: itemDesc,
      quantity: 1,
      unitPrice: detectedPrice,
      totalPrice: detectedPrice,
    },
  ];

  return {
    title: `Orçamento de ${itemName}`,
    category: resolvedCategory,
    client: {
      name: detectedClient,
      phone: detectedPhone,
      email: "",
      document: detectedDocument,
      address: detectedAddress,
    },
    categorySpecificFields,
    items,
    subtotal: detectedPrice,
    discount: 0,
    total: detectedPrice,
    paymentTerms,
    validityDays: 15,
    notes,
  };
}

startServer();
