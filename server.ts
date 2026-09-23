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

      // Pre-compute high-intelligence deterministic parse immediately
      const instantParsed = smartParseBudget(text, category, clientName, companyName);

      // Attempt Gemini 3.6 Flash with a 3.5-second timeout to enrich if fast and available
      const apiKey = process.env.GEMINI_API_KEY || "AQ.Ab8RN6I694aSrVyB6l5glBLPIeA6_7jcAOQ7cI_WNnaoHydk1A";

      let enrichedBudget = instantParsed;
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
Transforme o texto em uma proposta comercial completa, profissional e detalhada em JSON estrito.
ATENÇÃO CRÍTICA:
1. client:
   - name: Nome do cliente (apenas nome próprio de pessoa ou empresa, NUNCA palavras como 'gestão', 'orçamento', 'serviço')
   - phone: Telefone ou WhatsApp formatado (XX) XXXXX-XXXX
   - document: CPF (XXX.XXX.XXX-XX) ou CNPJ (XX.XXX.XXX/XXXX-XX)
   - address: Apenas a cidade ou endereço (NUNCA inclua o serviço, escopo ou preço aqui)
   - email: E-mail se houver
2. items: Array de serviços/produtos.
   - NUNCA confunda o prazo em dias (ex: 15 dias) com o valor monetário em reais (ex: 300 reais)!
   - unitPrice: O valor monetário em reais do serviço (ex: 300).
   - quantity: Quantidade (padrão 1).
   - totalPrice: quantity * unitPrice.
3. categorySpecificFields: 3 ou mais tópicos adaptados ao ramo:
   - Plataforma / Escopo
   - Prazo de Entrega
   - Suporte Técnico
4. Condições comerciais:
   - paymentTerms: Ex: "PIX à vista ou Cartão de Crédito"
   - validityDays: 15
   - notes: "Validade da proposta de 15 dias corridos. Início dos serviços mediante aprovação."`;

        const prompt = `Estruture este orçamento:\n"""\n${text}\n"""\nEmpresa: ${companyName || "BL Core Gestão"}\nCategoria: ${category || "Social Media"}\nCliente sugerido: ${clientName || instantParsed.client.name}`;

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout Gemini")), 3500)
        );

        const geminiPromise = ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
          },
        });

        const response: any = await Promise.race([geminiPromise, timeoutPromise]);
        if (response && response.text) {
          const cleanJson = response.text.replace(/```json\s*|```\s*$/gi, "").trim();
          const parsed = JSON.parse(cleanJson);
          if (parsed && typeof parsed === "object") {
            const rawGeminiAddr = parsed.client?.address ? cleanAddress(parsed.client.address) : "";
            const mergedClient = {
              name: parsed.client?.name && parsed.client.name !== "Cliente"
                ? cleanClientName(parsed.client.name)
                : instantParsed.client.name,
              phone: parsed.client?.phone && parsed.client.phone !== "(00) 00000-0000"
                ? parsed.client.phone
                : instantParsed.client.phone,
              document: parsed.client?.document || instantParsed.client.document,
              address: rawGeminiAddr || instantParsed.client.address,
              email: parsed.client?.email || instantParsed.client.email || "",
            };

            const mergedItems = Array.isArray(parsed.items) && parsed.items.length > 0
              ? parsed.items.map((it: any, idx: number) => {
                  let itPrice = Number(it.unitPrice) || 0;
                  // If Gemini confused deadline in days (e.g. 15 or 7) with currency when explicit price was parsed
                  if (itPrice <= 0 || (instantParsed.items[0]?.unitPrice > 0 && Math.abs(itPrice - instantParsed.items[0].unitPrice) > 50 && (itPrice === 15 || itPrice === 7 || itPrice === 10 || itPrice === 30 || itPrice === 1))) {
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

            let subtotal = mergedItems.reduce((acc: number, it: any) => acc + (it.totalPrice || 0), 0);
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
          }
        }
      } catch (geminiErr: any) {
        // Fallback gracefully to instantParsed
        console.log("[Gemini skipped/timeout, using instant high-accuracy parser]:", geminiErr?.message || geminiErr);
      }

      res.json({ budget: enrichedBudget, source: "bl-ai-smart-engine" });
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

function cleanAddress(addr: string): string {
  if (!addr) return "";
  const cutPattern = /\s+(?:quero|preciso|colocar|criar|fazer|gestão|gestao|mídias|midias|social|redes|tráfego|trafego|site|website|serviço|servico|valor|r\$|reais|prazo|dias|pagamento|pix|cartão|cartao|boleto|para|cliente|com|por|tel|zap|whatsapp|cpf|cnpj|escopo|obs|garantia|suporte)[\s\b].*$/i;
  let cleaned = addr.replace(cutPattern, "").trim();
  cleaned = cleaned.replace(/^na\s+cidade\s+de\s+|^em\s+|^na\s+|^no\s+/i, "");
  cleaned = cleaned.replace(/[-–—:,\s]+$/, "").trim();
  return cleaned;
}

function isValidAddress(str: string): boolean {
  if (!str || str.length < 3) return false;
  if (/^\d+/i.test(str)) return false;
  if (/\b(?:dias|horas|semanas|meses|anos|vezes|x|reais|pix|cartão|cartao|dinheiro|boleto|entrada|sinal|entrega|serviço|servico|site|gestão|gestao|mídias|midias)\b/i.test(str)) return false;
  return true;
}

function extractAddress(text: string): string {
  // 1. Explicit location anchors (mora em, reside em, cidade de, rua, av, avenida, bairro)
  const explicitAnchor = text.match(/(?:mora\s+em|reside\s+em|cidade(?:\s+de)?|endereço(?:\s+em)?|rua|av\.?|avenida|bairro)\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ0-9\s,\-]+?)(?=\s+(?:quero|preciso|colocar|criar|fazer|para|com|por|valor|r\$|\d+\s*(?:reais|r\$)|telefone|zap|whatsapp|cpf|cnpj|escopo|prazo|pagamento)|\.|$)/i);
  if (explicitAnchor && explicitAnchor[1]) {
    const cleaned = cleanAddress(explicitAnchor[1]);
    if (isValidAddress(cleaned)) return cleaned;
  }

  // 2. General "em [Cidade/Estado]" (must not match numbers or stop words)
  const generalEm = text.match(/(?:^|\s)em\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ]+(?:\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ]+)?)(?=\s+(?:quero|preciso|colocar|criar|fazer|gestão|gestao|mídia|midia|social|para|com|por|valor|r\$|\d+\s*(?:reais|r\$)|telefone|zap|whatsapp|cpf|cnpj|escopo|prazo|pagamento)|\.|$)/i);
  if (generalEm && generalEm[1]) {
    const cleaned = cleanAddress(generalEm[1]);
    if (isValidAddress(cleaned)) {
      return cleaned.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
    }
  }

  return "";
}

function cleanClientName(name: string): string {
  if (!name) return "Cliente";
  const forbidden = ["orçamento", "orcamento", "serviço", "servico", "gestão", "gestao", "troca", "cliente", "para", "com", "de", "do", "da"];
  const words = name.split(/\s+/).filter(w => !forbidden.includes(w.toLowerCase()));
  if (words.length === 0) return "Cliente";
  return words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function smartParseBudget(rawText: string, category?: string, clientNameSuggestion?: string, companyNameSuggestion?: string) {
  const text = (rawText || "").trim();
  const lower = text.toLowerCase();
  const cat = (category || "").toLowerCase();

  // 1. WhatsApp / Phone extraction (formats to (XX) XXXXX-XXXX)
  let detectedPhone = "(00) 00000-0000";
  const phonePattern = /(?:(?:zap|whats|whatsapp|fone|celular|tel|telefone)\s*[:=]?\s*)?(?:\+?55\s*)?(?:\(?([1-9]{2})\)?\s*)?(9?\d{4})[-.\s]?(\d{4})/i;
  const pMatch = text.match(phonePattern);
  if (pMatch) {
    const ddd = pMatch[1] || "11";
    const part1 = pMatch[2];
    const part2 = pMatch[3];
    detectedPhone = `(${ddd}) ${part1}-${part2}`;
  }

  // Remove phone from text to avoid false-matching phone as CPF
  const textNoPhone = text.replace(phonePattern, " ");

  // 2. CPF / CNPJ extraction
  let detectedDocument = "";
  const explicitCpf = textNoPhone.match(/(?:cpf)\s*[:=]?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11})/i);
  const formattedCpf = textNoPhone.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
  const explicitCnpj = textNoPhone.match(/(?:cnpj)\s*[:=]?\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{14})/i);
  const formattedCnpj = textNoPhone.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/);

  if (explicitCpf) {
    const digits = explicitCpf[1].replace(/\D/g, "");
    detectedDocument = digits.length === 11 ? digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : explicitCpf[1];
  } else if (formattedCpf) {
    detectedDocument = formattedCpf[0];
  } else if (explicitCnpj) {
    const digits = explicitCnpj[1].replace(/\D/g, "");
    detectedDocument = digits.length === 14 ? digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : explicitCnpj[1];
  } else if (formattedCnpj) {
    detectedDocument = formattedCnpj[0];
  }

  // 3. Address / City extraction
  const detectedAddress = extractAddress(text);

  // 4. Client Name extraction
  let detectedClient = clientNameSuggestion || "";
  if (!detectedClient) {
    const explicitClientMatch = text.match(/(?:cliente|para(?:\s+o|\s+a)?|em\s+nome\s+de|sr\.?|sra\.?)\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ]+(?:\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ]+)?)/i);
    if (explicitClientMatch && explicitClientMatch[1]) {
      detectedClient = explicitClientMatch[1].trim();
    } else {
      const words = text.trim().split(/\s+/);
      const stopWords = [
        "orçamento", "orcamento", "quero", "fazer", "criar", "troca", "serviço", "servico",
        "olá", "ola", "bom", "boa", "por", "favor", "instalação", "instalacao", "manutenção",
        "manutencao", "pintura", "gestão", "gestao", "site", "aplicação", "aplicacao", "revisão",
        "revisao", "consultoria", "alongamento", "limpeza", "conserto", "reparo", "preciso", "gostaria"
      ];
      if (words.length > 0 && !stopWords.includes(words[0].toLowerCase()) && !/\d/.test(words[0])) {
        if (words[1] && !stopWords.includes(words[1].toLowerCase()) && !/\d/.test(words[1]) && words[1].length > 2) {
          detectedClient = `${words[0]} ${words[1]}`;
        } else {
          detectedClient = words[0];
        }
      }
    }
  }

  // Clean trailing punctuation and common artifacts from client name
  if (detectedClient) {
    const filterArtifacts = ["fone", "tel", "zap", "whatsapp", "celular", "cpf", "cnpj", "rua", "av", "avenida", "em", "prazo", "valor", "reais", "com", "para", "no", "na"];
    const parts = detectedClient.split(/\s+/).filter((w) => !filterArtifacts.includes(w.toLowerCase()));
    if (parts.length > 0) {
      detectedClient = parts.slice(0, 2).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
    } else {
      detectedClient = "Cliente";
    }
  } else {
    detectedClient = "Cliente";
  }

  // 5. Price extraction
  let detectedPrice = 300;
  const explicitPrices: number[] = [];
  const currRegex = /(?:r\$|valor\s*[:=]?\s*r\$?|por)?\s*([0-9]+(?:[\.,][0-9]{2})?)\s*(?:reais|r\$)/gi;
  let cm: RegExpExecArray | null;
  while ((cm = currRegex.exec(text)) !== null) {
    const p = parseFloat(cm[1].replace(",", "."));
    if (p > 0) explicitPrices.push(p);
  }
  if (explicitPrices.length > 0) {
    detectedPrice = explicitPrices[explicitPrices.length - 1];
  } else {
    // Look for standalone numbers that are not deadlines or years
    let textForPrice = textNoPhone;
    if (detectedDocument) {
      textForPrice = textForPrice.replace(new RegExp(detectedDocument.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "g"), " ");
    }
    const numRegex = /\b([1-9][0-9]*(?:[\.,][0-9]{2})?)\b(?!\s*(?:dias|horas|semanas|meses|anos|btus|x|vezes|unidades|peças|km))/gi;
    const generalNumbers: number[] = [];
    let nm: RegExpExecArray | null;
    while ((nm = numRegex.exec(textForPrice)) !== null) {
      const val = parseFloat(nm[1].replace(",", "."));
      if (val >= 10 && val !== 2025 && val !== 2026 && val < 500000) {
        generalNumbers.push(val);
      }
    }
    if (generalNumbers.length > 0) {
      detectedPrice = generalNumbers[generalNumbers.length - 1];
    }
  }

  // 6. Deadline (Prazo)
  let detectedPrazo = "7 a 15 dias úteis";
  const prazoMatch = text.match(/(?:prazo(?:\s+de\s+entrega)?|entrega|conclusão)(?:\s+em|\s+de)?\s+(\d+\s*(?:dias\s*úteis|dias|horas|semanas|meses))/i);
  if (prazoMatch) {
    detectedPrazo = prazoMatch[1].trim();
  }

  // 7. Payment Terms
  let paymentTerms = "PIX à vista ou Cartão de Crédito";
  if (lower.includes("cartão") || lower.includes("cartao") || lower.includes("12x") || lower.includes("vezes")) {
    paymentTerms = "Cartão de Crédito em até 12x ou PIX à vista";
  } else if (lower.includes("entrada") || lower.includes("sinal")) {
    paymentTerms = "50% de entrada + 50% na entrega/conclusão";
  } else if (lower.includes("boleto")) {
    paymentTerms = "Boleto Bancário ou PIX";
  } else if (lower.includes("pix")) {
    paymentTerms = "PIX com desconto à vista";
  }

  // 8. Service & Domain Classification
  let title = "Orçamento de Serviços";
  let resolvedCategory = category || "Social Media";
  let itemName = "Gestão de Mídias Sociais & Conteúdo";
  let itemDesc = "Planejamento editorial, design de posts/stories e publicação semanal";
  let categorySpecificFields: Array<{ key: string; label: string; value: string }> = [];

  const textHasSite = lower.includes("site") || lower.includes("landing") || lower.includes("web") || lower.includes("loja");
  const textHasSocial = lower.includes("social") || lower.includes("mídia") || lower.includes("midia") || lower.includes("instagram") || lower.includes("feed") || lower.includes("post");

  if (textHasSite && !textHasSocial) {
    title = "Orçamento de Desenvolvimento Web";
    resolvedCategory = "Web & Tecnologia";
    itemName = lower.includes("landing")
      ? "Criação de Landing Page de Alta Conversão"
      : "Criação de Website Institucional & Landing Page";
    itemDesc = "Desenvolvimento responsivo, otimização mobile, botão WhatsApp integrado e SEO básico";
    categorySpecificFields = [
      { key: "plataforma", label: "Plataforma / Escopo", value: "Website Responsivo & Mobile" },
      { key: "prazo", label: "Prazo de Entrega", value: detectedPrazo },
      { key: "suporte", label: "Suporte Técnico", value: "30 dias de suporte pós-lançamento" },
    ];
  } else if (textHasSocial || cat.includes("social")) {
    title = "Orçamento de Gestão de Mídias Sociais";
    resolvedCategory = "Social Media";
    itemName = "Gestão de Mídias Sociais & Conteúdo";
    itemDesc = "Planejamento, design de layout e publicação com acompanhamento de engajamento";
    categorySpecificFields = [
      { key: "plataforma", label: "Plataforma / Escopo", value: "Instagram & Redes Sociais" },
      { key: "prazo", label: "Prazo de Entrega", value: detectedPrazo },
      { key: "suporte", label: "Suporte Técnico", value: "30 dias de suporte pós-lançamento" },
    ];
  } else if (textHasSite) {
    title = "Orçamento de Desenvolvimento Web";
    resolvedCategory = "Web & Tecnologia";
    itemName = "Criação de Website Institucional";
    itemDesc = "Desenvolvimento responsivo, otimização mobile e formulário de contato";
    categorySpecificFields = [
      { key: "plataforma", label: "Plataforma / Escopo", value: "Website Responsivo & Mobile" },
      { key: "prazo", label: "Prazo de Entrega", value: detectedPrazo },
      { key: "suporte", label: "Suporte Técnico", value: "30 dias de suporte pós-lançamento" },
    ];
  } else if (
    lower.includes("ar condicionado") ||
    lower.includes("split") ||
    lower.includes("climatiz") ||
    cat.includes("climat")
  ) {
    title = "Orçamento de Climatização & Refrigeração";
    resolvedCategory = "Climatização & Refrigeração";
    itemName = lower.includes("instala")
      ? "Instalação de Ar Condicionado Split"
      : "Manutenção e Higienização de Ar Condicionado";
    itemDesc = "Mão de obra técnica qualificada com vácuo, testes de pressão e garantia de estanqueidade";
    categorySpecificFields = [
      { key: "equipamento", label: "Equipamento / Capacidade", value: "Sistema Split / Climatização" },
      { key: "prazo", label: "Prazo de Execução", value: detectedPrazo },
      { key: "garantia", label: "Garantia do Serviço", value: "90 dias de garantia técnica" },
    ];
  } else if (
    lower.includes("óleo") ||
    lower.includes("oleo") ||
    lower.includes("freio") ||
    lower.includes("pastilha") ||
    lower.includes("mecânic") ||
    lower.includes("mecanic") ||
    cat.includes("auto") ||
    cat.includes("oficina")
  ) {
    title = "Orçamento de Serviços Automotivos";
    resolvedCategory = "Mecânica & Manutenção";
    itemName = lower.includes("óleo") || lower.includes("oleo")
      ? "Troca de Óleo e Filtros"
      : "Revisão e Troca de Pastilhas de Freio";
    itemDesc = "Substituição com peças de qualidade e checagem de itens de segurança";
    categorySpecificFields = [
      { key: "veiculo", label: "Veículo / Aplicação", value: "Linha Leve ou Utilitários" },
      { key: "prazo", label: "Prazo de Execução", value: detectedPrazo },
      { key: "garantia", label: "Garantia de Peças e Mão de Obra", value: "90 dias conforme CDC" },
    ];
  } else if (
    lower.includes("envelop") ||
    lower.includes("película") ||
    lower.includes("pelicula") ||
    lower.includes("insulfilm") ||
    cat.includes("pelicula") ||
    cat.includes("insulfilm")
  ) {
    title = "Orçamento de Envelopamento & Películas";
    resolvedCategory = "Envelopamento & Películas";
    itemName = lower.includes("insulfilm") || lower.includes("película")
      ? "Aplicação de Película e Insulfilm Térmico"
      : "Envelopamento e Personalização Vinil";
    itemDesc = "Mão de obra especializada com material de alta durabilidade e proteção solar";
    categorySpecificFields = [
      { key: "veiculo", label: "Veículo / Superfície", value: "Linha Automotiva ou Residencial" },
      { key: "material", label: "Material / Película", value: "Película Térmica / Vinil Premium" },
      { key: "prazo", label: "Prazo de Execução", value: detectedPrazo },
      { key: "garantia", label: "Garantia do Serviço", value: "3 a 5 anos de garantia de fábrica" },
    ];
  } else if (
    lower.includes("unha") ||
    lower.includes("gel") ||
    lower.includes("fibra") ||
    lower.includes("manicure") ||
    lower.includes("corte") ||
    lower.includes("barba") ||
    cat.includes("beleza") ||
    cat.includes("estetica")
  ) {
    title = "Orçamento de Procedimentos Estéticos";
    resolvedCategory = "Estética & Beleza";
    itemName = lower.includes("barba") || lower.includes("corte")
      ? "Corte Masculino & Design de Barba"
      : "Alongamento e Esmaltação em Gel";
    itemDesc = "Procedimento estético profissional com produtos hipoalergênicos e de alta durabilidade";
    categorySpecificFields = [
      { key: "procedimento", label: "Procedimento / Técnica", value: "Aplicação / Design Especializado" },
      { key: "produtos", label: "Produtos Utilizados", value: "Linha Profissional de Alta Qualidade" },
      { key: "prazo", label: "Prazo de Atendimento", value: detectedPrazo },
      { key: "manutencao", label: "Recomendação de Manutenção", value: "21 a 28 dias corridos" },
    ];
  } else if (
    lower.includes("pintura") ||
    lower.includes("reforma") ||
    lower.includes("obra") ||
    lower.includes("elétrica") ||
    lower.includes("eletrica") ||
    cat.includes("obra")
  ) {
    title = "Orçamento de Obras & Reformas";
    resolvedCategory = "Reformas & Construção";
    itemName = lower.includes("pintura")
      ? "Pintura Residencial e Preparação de Paredes"
      : "Instalação e Manutenção Elétrica Especializada";
    itemDesc = "Mão de obra qualificada com isolamento do espaço, aplicação de materiais e acabamento fino";
    categorySpecificFields = [
      { key: "escopo", label: "Escopo da Obra", value: "Área Residencial ou Comercial" },
      { key: "prazo", label: "Prazo de Execução", value: detectedPrazo },
      { key: "garantia", label: "Garantia de Mão de Obra", value: "Garantia de acabamento e durabilidade" },
    ];
  } else {
    // Dynamic clean service phrase extraction
    const dynamicName = text
      .replace(/(?:(?:zap|whats|whatsapp|fone|celular|tel|telefone)\s*[:=]?\s*)?(?:\+?55\s*)?(?:\(?([1-9]{2})\)?\s*)?(9?\d{4})[-.\s]?(\d{4})/gi, "")
      .replace(/(?:cpf|cnpj)\s*[:=]?\s*[\d\.\-\/]+/gi, "")
      .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "")
      .replace(/(?:r\$|reais)?\s*([0-9]+(?:[\.,][0-9]{2})?)\s*(?:reais|r\$)?/gi, "")
      .replace(/(?:cliente|para(?:\s+o|\s+a)?|em\s+nome\s+de|sr\.?|sra\.?)\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ]+/gi, "")
      .replace(/(?:em|cidade(?:\s+de)?|endereço(?:\s+em)?|rua|av\.?|avenida|bairro)\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ0-9\s,\-]+(?=\.|$)/gi, "")
      .replace(/\b(?:orçamento|orcamento|quero|fazer|criar|preciso|gostaria|de|um|uma|por|favor|olá|ola|bom|dia|tarde)\b/gi, "")
      .trim();

    itemName = dynamicName.length > 3
      ? dynamicName.slice(0, 45).split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")
      : "Gestão de Mídias Sociais & Conteúdo";

    itemDesc = "Execução profissional com padrão de excelência, planejamento e acompanhamento dedicado";
    resolvedCategory = category || "Social Media";
    categorySpecificFields = [
      { key: "plataforma", label: "Plataforma / Escopo", value: "Instagram & Redes Sociais" },
      { key: "prazo", label: "Prazo de Entrega", value: detectedPrazo },
      { key: "suporte", label: "Suporte Técnico", value: "30 dias de suporte pós-lançamento" },
    ];
  }

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
    title,
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
    notes: "Validade da proposta de 15 dias corridos. Início dos serviços mediante aprovação.",
  };
}

startServer();
