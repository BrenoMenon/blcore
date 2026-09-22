import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
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

  // Organize budget with Gemini AI
  app.post("/api/gemini/organize-budget", async (req, res) => {
    try {
      const { text, category, companyName, clientName } = req.body;

      if (!text || typeof text !== "string" || !text.trim()) {
        res.status(400).json({ error: "Texto ou áudio para o orçamento é obrigatório" });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        // Fallback intelligent parser when API key is not yet set
        const fallback = fallbackParseBudget(text, category, clientName);
        res.json({ budget: fallback, source: "fallback" });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const systemInstruction = `Você é o assistente de orçamentos ultra inteligente do sistema BL Core Gestão.
Sua missão é transformar um texto informal (ditado por voz ou digitado pelo empresário/prestador) em um orçamento formal, profissional e perfeitamente estruturado.

A empresa atua na categoria: "${category || "Serviços Gerais"}" e se chama "${companyName || "Empresa"}".

REGRAS CRÍTICAS DE EXTRAÇÃO:
1. IDENTIFICAÇÃO DO NOME DO CLIENTE (MÁXIMA PRIORIDADE):
   - O usuário frequentemente dita o nome do cliente no início ou no decorrer da frase de forma natural, sem necessariamente usar a palavra "cliente" (por exemplo: "breno menon site mao de obra 300" -> o cliente é "Breno Menon"; "orçamento amanda alongamento 160" -> o cliente é "Amanda"; "roberto souza troca pastilha 320" -> o cliente é "Roberto Souza").
   - Identifique SEMPRE o nome e sobrenome da pessoa citada e coloque em client.name com as primeiras letras maiúsculas.
   - NUNCA retorne "Cliente" genérico se houver qualquer nome próprio mencionado no texto!

2. CATEGORIAS DE NEGÓCIO E CAMPOS ESPECÍFICOS:
   - Se for Social Media / Marketing / Web Design / Tráfego / Agência:
     * Campos específicos: Escopo / Plataforma (ex: Website Responsivo, Instagram, Landing Page), Prazo de Execução (ex: 7 a 15 dias úteis), Entregáveis (ex: Layout, Código, Otimização SEO), Suporte Técnico (ex: 30 dias).
     * Nomes dos itens: se o usuário disse "site", coloque "Criação de Site Responsivo" ou "Desenvolvimento Web"; se disse "gestão", coloque "Gestão de Redes Sociais"; se disse "tráfego", coloque "Gestão de Tráfego Pago".
   - Se for Oficina Mecânica / Automotivo:
     * Campos específicos: Modelo do Veículo, Placa, Ano, KM, Cor. Separe peças e mão de obra de forma clara.
   - Se for Manicure / Beleza / Nail Designer:
     * Campos específicos: Estilo/Técnica (Alongamento em Gel, Esmaltação), Cor do Esmalte/Decoração, Formato da Unha, Manutenção.
   - Se for Barbearia / Salão:
     * Campos específicos: Tipo de Corte, Barba, Tratamento/Química, Produtos.
   - Se for Marcenaria / Reformas / Construção:
     * Campos específicos: Ambiente, Material principal (MDF, ferragens), Metragem/Medidas, Prazo de entrega.
   - Outras categorias: identifique os dados chave do cliente e do serviço.

3. ESTRUTURAÇÃO DOS ITENS E VALORES:
   - Cada item deve ter: name (nome claro e profissional), quantity (padrão 1), unitPrice (número positivo) e totalPrice (quantity * unitPrice).
   - Normalize todos os números (apenas números, nunca strings nos campos numéricos).
   - Extraia ou deduza a forma de pagamento (ex: "PIX ou Cartão em até 3x"), validade da proposta (padrão 15 dias) e garantia/observações.`;

      const prompt = `Analise e estruture este orçamento:
"""
${text}
"""
${clientName ? `Nome do cliente sugerido: ${clientName}` : ""}`;

      let responseText: string | undefined;
      const modelsToTry = ["gemini-3.8-flash", "gemini-3.1-flash-lite"];

      const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Gemini timeout")), ms)),
        ]);
      };

      for (const modelName of modelsToTry) {
        try {
          const response = await withTimeout(
            ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: "Título do orçamento (ex: Orçamento de Serviços, Orçamento Automotivo)" },
                    client: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        phone: { type: Type.STRING },
                        email: { type: Type.STRING },
                        document: { type: Type.STRING, description: "CPF ou CNPJ se mencionado" },
                        address: { type: Type.STRING },
                      },
                      required: ["name"],
                    },
                    categorySpecificFields: {
                      type: Type.ARRAY,
                      description: "Campos específicos da categoria (ex: Placa, Veículo, Cor do Esmalte, Ambiente, etc)",
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          key: { type: Type.STRING },
                          label: { type: Type.STRING },
                          value: { type: Type.STRING },
                        },
                        required: ["key", "label", "value"],
                      },
                    },
                    items: {
                      type: Type.ARRAY,
                      description: "Lista de itens ou serviços do orçamento",
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          description: { type: Type.STRING },
                          quantity: { type: Type.NUMBER },
                          unitPrice: { type: Type.NUMBER },
                          totalPrice: { type: Type.NUMBER },
                        },
                        required: ["name", "quantity", "unitPrice", "totalPrice"],
                      },
                    },
                    discount: { type: Type.NUMBER, description: "Valor do desconto em reais" },
                    paymentTerms: { type: Type.STRING, description: "Forma de pagamento (PIX, Cartão, Dinheiro, etc)" },
                    validityDays: { type: Type.INTEGER, description: "Validade da proposta em dias (ex: 15)" },
                    notes: { type: Type.STRING, description: "Observações, garantia ou instruções para o cliente" },
                  },
                  required: ["title", "client", "items", "paymentTerms", "validityDays"],
                },
              },
            }),
            8000
          );
          if (response.text) {
            responseText = response.text;
            break;
          }
        } catch (modelErr: any) {
          console.warn(`[Gemini try ${modelName} failed]:`, modelErr?.message || modelErr);
        }
      }
      if (!responseText) {
        throw new Error("A IA não retornou resposta estruturada.");
      }

      const parsed = JSON.parse(responseText);

      // Post-calculate totals consistently
      let subtotal = 0;
      const itemsWithIds = (parsed.items || []).map((item: any, idx: number) => {
        const qty = Number(item.quantity) || 1;
        const price = Number(item.unitPrice) || 0;
        const itemTotal = Number(item.totalPrice) || qty * price;
        subtotal += itemTotal;
        return {
          id: `item-${Date.now()}-${idx}`,
          name: String(item.name || "Serviço"),
          description: String(item.description || ""),
          quantity: qty,
          unitPrice: price,
          totalPrice: itemTotal,
        };
      });

      const discount = Number(parsed.discount) || 0;
      const total = Math.max(0, subtotal - discount);

      const structuredBudget = {
        title: parsed.title || "Orçamento",
        category: category || "Serviços",
        client: {
          name: parsed.client?.name || clientName || "Cliente",
          phone: parsed.client?.phone || "",
          email: parsed.client?.email || "",
          document: parsed.client?.document || "",
          address: parsed.client?.address || "",
        },
        categorySpecificFields: parsed.categorySpecificFields || [],
        items: itemsWithIds,
        subtotal,
        discount,
        total,
        paymentTerms: parsed.paymentTerms || "PIX ou Cartão em até 3x",
        validityDays: Number(parsed.validityDays) || 15,
        notes: parsed.notes || "Orçamento sujeito a confirmação prévia de disponibilidade.",
      };

      res.json({ budget: structuredBudget, source: "gemini" });
    } catch (err: any) {
      console.error("[Gemini Organize Budget Error]", err);
      // Fallback parser so request never crashes the user experience
      try {
        const fallback = fallbackParseBudget(req.body.text, req.body.category, req.body.clientName);
        res.json({ budget: fallback, source: "fallback-on-error", error: err.message });
      } catch {
        res.status(500).json({ error: err.message || "Erro ao processar orçamento com IA" });
      }
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

function fallbackParseBudget(rawText: string, category?: string, clientNameSuggestion?: string) {
  const cat = (category || "").toLowerCase();
  let detectedClient = clientNameSuggestion || "";

  // Try extracting client name from raw text if not provided
  if (!detectedClient) {
    // Pattern 1: "cliente [Nome Sobrenome]" or "para [Nome Sobrenome]"
    const explicitClientMatch = rawText.match(/(?:cliente|para(?:\s+o|\s+a)?)\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ]+(?:\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ]+)?)/i);
    if (explicitClientMatch && explicitClientMatch[1]) {
      detectedClient = explicitClientMatch[1].trim();
    } else {
      // Pattern 2: First 2 capitalized or human words if sentence starts with a name (e.g., "breno menon site mao de obra 300")
      const words = rawText.trim().split(/\s+/);
      const serviceKeywords = ["orcamento", "orçamento", "troca", "servico", "serviço", "mao", "mão", "site", "alongamento", "corte", "pintura", "reparo"];
      if (words.length >= 2 && !serviceKeywords.includes(words[0].toLowerCase())) {
        // If first word or two words look like a name
        const candidate1 = words[0];
        const candidate2 = words[1];
        if (!/\d/.test(candidate1) && !/\d/.test(candidate2) && !serviceKeywords.includes(candidate2.toLowerCase())) {
          detectedClient = `${candidate1} ${candidate2}`;
        } else if (!/\d/.test(candidate1)) {
          detectedClient = candidate1;
        }
      }
    }
  }

  // Capitalize detected client name
  if (detectedClient) {
    detectedClient = detectedClient
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  } else {
    detectedClient = "Cliente";
  }

  // Extract items
  const items: Array<{
    id: string;
    name: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }> = [];

  // Match currency patterns like R$ 150, 150 reais, 300, 300,00
  const priceRegex = /(?:r\$|reais)?\s*([0-9]+(?:[\.,][0-9]{2})?)/gi;
  const numbersFound: number[] = [];
  let numMatch: RegExpExecArray | null;
  while ((numMatch = priceRegex.exec(rawText)) !== null) {
    const val = parseFloat(numMatch[1].replace(",", "."));
    if (val > 0) numbersFound.push(val);
  }

  const primaryValue = numbersFound.length > 0 ? numbersFound[numbersFound.length - 1] : 300;

  // Clean rawText for service description
  let cleanedServiceText = rawText;
  if (detectedClient !== "Cliente") {
    cleanedServiceText = cleanedServiceText.replace(new RegExp(detectedClient, "gi"), "");
  }
  cleanedServiceText = cleanedServiceText.replace(/cliente|para\s+o|para\s+a|orçamento|orcamento/gi, "").trim();

  // Determine item name based on category & input
  let itemName = "Serviços Especializados";
  let itemDesc = "Execução conforme especificações combinadas";

  const lowerCleaned = cleanedServiceText.toLowerCase();
  if (lowerCleaned.includes("site") || lowerCleaned.includes("landing") || cat.includes("social") || cat.includes("web") || cat.includes("marketing")) {
    itemName = lowerCleaned.includes("site") ? "Criação de Site Institucional Responsivo" : "Gestão de Mídias Sociais & Conteúdo";
    itemDesc = lowerCleaned.includes("mao de obra")
      ? "Desenvolvimento, estruturação técnica e mão de obra de implantação"
      : "Planejamento, design de layout e publicação";
  } else if (cat.includes("oficina") || cat.includes("mec") || lowerCleaned.includes("freio") || lowerCleaned.includes("oleo")) {
    itemName = "Manutenção Mecânica e Mão de Obra";
    itemDesc = "Revisão e substituição de componentes mecânicos";
  } else if (cat.includes("manicure") || lowerCleaned.includes("unha") || lowerCleaned.includes("gel")) {
    itemName = "Alongamento e Esmaltação em Gel";
    itemDesc = "Procedimento estético de embelezamento e blindagem";
  } else if (cleanedServiceText.replace(/\d+/g, "").trim().length > 3) {
    itemName = cleanedServiceText.replace(/\d+/g, "").replace(/[-–—:,]/g, " ").trim();
    // Capitalize
    itemName = itemName.charAt(0).toUpperCase() + itemName.slice(1);
  }

  items.push({
    id: `item-${Date.now()}-1`,
    name: itemName,
    description: itemDesc,
    quantity: 1,
    unitPrice: primaryValue,
    totalPrice: primaryValue,
  });

  const subtotal = primaryValue;

  // Category specific fields
  const categorySpecificFields: Array<{ key: string; label: string; value: string }> = [];

  if (cat.includes("social") || cat.includes("media") || cat.includes("web") || cat.includes("marketing") || lowerCleaned.includes("site")) {
    categorySpecificFields.push(
      { key: "plataforma", label: "Plataforma / Escopo", value: lowerCleaned.includes("site") ? "Website Responsivo & Mobile" : "Instagram & Redes Sociais" },
      { key: "prazo", label: "Prazo de Entrega", value: "7 a 15 dias úteis" },
      { key: "garantia", label: "Suporte Técnico", value: "30 dias de suporte pós-lançamento" }
    );
  } else if (cat.includes("oficina") || cat.includes("mec") || cat.includes("auto")) {
    categorySpecificFields.push(
      { key: "veiculo", label: "Veículo / Modelo", value: "" },
      { key: "placa", label: "Placa", value: "" },
      { key: "km", label: "KM Atual", value: "" },
      { key: "garantia", label: "Garantia", value: "90 dias para peças e mão de obra" }
    );
  } else if (cat.includes("manicure") || cat.includes("unha") || cat.includes("nail")) {
    categorySpecificFields.push(
      { key: "estilo", label: "Técnica / Estilo", value: "Alongamento em Gel" },
      { key: "cor_esmalte", label: "Cor do Esmalte / Decoração", value: "" },
      { key: "manutencao", label: "Recomendação de Manutenção", value: "21 a 28 dias" }
    );
  } else {
    categorySpecificFields.push(
      { key: "prazo", label: "Prazo de Execução", value: "7 a 15 dias úteis" },
      { key: "garantia", label: "Garantia dos Serviços", value: "30 dias" }
    );
  }

  return {
    title: cat.includes("social") || lowerCleaned.includes("site") ? "Orçamento de Serviços Digitais" : "Orçamento de Serviços",
    category: category || "Serviços Gerais",
    client: {
      name: detectedClient,
      phone: "",
      email: "",
      document: "",
      address: "",
    },
    categorySpecificFields,
    items,
    subtotal,
    discount: 0,
    total: subtotal,
    paymentTerms: "PIX à vista ou Cartão de Crédito",
    validityDays: 15,
    notes: "Validade da proposta de 15 dias corridos. Início dos serviços mediante aprovação.",
  };
}

startServer();
