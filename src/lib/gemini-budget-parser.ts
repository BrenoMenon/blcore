import {
  formatCnpj,
  formatCpf,
  formatPhone,
  parseBrazilianMoney,
  type CategorySpecificField,
  type ParsedBudget,
  type ParsedItem,
} from "./budget-parser";

/**
 * AI-powered budget parser. Uses Gemini with a strict JSON schema so the
 * model can't return free text — every field is typed and validated before
 * it ever reaches the UI. Falls back to the deterministic regex engine
 * (smartParseBudget) whenever this throws, so a missing/invalid API key or
 * a flaky network never breaks the flow for the user.
 */

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const BUDGET_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    category: { type: "STRING" },
    client: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING" },
        phone: { type: "STRING" },
        email: { type: "STRING" },
        document: { type: "STRING" },
        address: { type: "STRING" },
      },
      required: ["name", "phone", "email", "document", "address"],
    },
    categorySpecificFields: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          key: { type: "STRING" },
          label: { type: "STRING" },
          value: { type: "STRING" },
        },
        required: ["key", "label", "value"],
      },
    },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          description: { type: "STRING" },
          quantity: { type: "NUMBER" },
          unitPrice: { type: "NUMBER" },
          totalPrice: { type: "NUMBER" },
        },
        required: ["name", "description", "quantity", "unitPrice", "totalPrice"],
      },
    },
    subtotal: { type: "NUMBER" },
    discount: { type: "NUMBER" },
    total: { type: "NUMBER" },
    paymentTerms: { type: "STRING" },
    validityDays: { type: "NUMBER", nullable: true },
    notes: { type: "STRING" },
  },
  required: [
    "title",
    "category",
    "client",
    "categorySpecificFields",
    "items",
    "subtotal",
    "discount",
    "total",
    "paymentTerms",
    "validityDays",
    "notes",
  ],
} as const;

function buildPrompt(
  rawText: string,
  category?: string,
  clientNameSuggestion?: string,
  companyNameSuggestion?: string,
): string {
  return `Você é um assistente que organiza orçamentos ditados ou digitados livremente por um prestador de serviços brasileiro, e devolve APENAS um JSON estruturado com os dados extraídos. O texto pode vir de reconhecimento de voz (fala natural, sem pontuação, com hesitações) — nunca assuma que os campos vêm rotulados.

TEXTO DITADO/DIGITADO PELO USUÁRIO:
"""
${rawText}
"""

Contexto adicional (use apenas como referência, nunca invente por cima disso):
- Categoria/ramo da empresa que está emitindo o orçamento: ${category || "não informado"}
- Nome da empresa que está emitindo o orçamento (NÃO é o cliente): ${companyNameSuggestion || "não informado"}
${clientNameSuggestion ? `- Sugestão de nome do cliente já digitada em outro campo: "${clientNameSuggestion}"` : ""}

REGRAS OBRIGATÓRIAS (o erro mais comum é misturar esses campos — preste atenção redobrada):
1. "client.name": APENAS o nome completo da pessoa/cliente. NUNCA inclua telefone, CPF, valores ou qualquer outra informação junto do nome. Se o texto disser algo como "Breno Menon telefone tal e tal", o nome é só "Breno Menon" — pare no primeiro sinal de outro dado (telefone, CPF, endereço, valor etc), mesmo que não haja vírgula ou pontuação separando.
2. "client.phone": apenas o telefone/WhatsApp do cliente, no formato (DD) 90000-0000 ou (DD) 0000-0000. Nunca coloque o telefone em outro campo. Se não houver telefone mencionado, deixe "".
3. "client.document": CPF no formato 000.000.000-00 ou CNPJ no formato 00.000.000/0000-00, conforme o que for mencionado. Se não houver, deixe "".
4. "client.address": cidade/endereço do cliente, se mencionado. Senão "".
5. "client.email": e-mail do cliente, se mencionado. Senão "".
6. NUNCA invente, deduza ou complete dados que não foram ditos explicitamente. Campo não mencionado = string vazia "" (ou 0 para números, [] para listas, null para validityDays).
7. "items": cada serviço/produto citado vira um item, com "quantity" (padrão 1 se não citado), "unitPrice" e "totalPrice" (mesmo valor se não houver diferença entre eles). Se só um valor total for citado sem detalhar itens, crie um único item com o nome do serviço prestado.
8. "subtotal" é a soma dos itens antes do desconto; "total" é subtotal menos "discount". Se só um valor for citado, subtotal = total = esse valor e discount = 0.
9. Valores em reais: interprete corretamente o formato brasileiro (vírgula como separador decimal, ponto como separador de milhar). "mil e duzentos" ou "1200" deve virar 1200.
10. "paymentTerms": forma de pagamento citada (ex: "à vista no pix", "50% agora e 50% na entrega"). Se não citado, "".
11. "categorySpecificFields": só preencha se houver um prazo de ENTREGA/EXECUÇÃO explícito (use key "deadline", label "Prazo", value com o prazo descrito). Não invente outros campos além desse.
12. "validityDays": só preencha (número de dias) se o texto mencionar explicitamente por quantos dias a PROPOSTA (orçamento) é válida (ex: "proposta válida por 15 dias"). Isso é diferente do prazo de entrega do item 11. Se não mencionado, use null.
13. "notes": observações, pendências ou garantias citadas. Se não houver, "".
14. "title": um título curto para o orçamento baseado no serviço principal (ex: "Orçamento de Landing Page"). Se nenhum serviço específico for identificável, use "Orçamento de Serviços".
15. "category": use "${category || "Serviços"}" a menos que o texto contradiga isso explicitamente.

Responda apenas com o JSON, sem nenhum texto adicional.`;
}

function normalizeDocument(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11) return formatCpf(digits) || raw.trim();
  if (digits.length === 14) return formatCnpj(digits) || raw.trim();
  return raw.trim();
}

function normalizePhone(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  return formatPhone(digits) || raw.trim();
}

function toParsedItem(item: any, index: number): ParsedItem {
  const quantity = Number(item?.quantity) || 1;
  const unitPrice =
    typeof item?.unitPrice === "number" ? item.unitPrice : parseBrazilianMoney(String(item?.unitPrice ?? "0"));
  const totalPrice =
    typeof item?.totalPrice === "number"
      ? item.totalPrice
      : parseBrazilianMoney(String(item?.totalPrice ?? "0")) || unitPrice * quantity;

  return {
    id: `item-${Date.now()}-${index + 1}`,
    name: String(item?.name || "Serviço Prestado").trim(),
    description: String(item?.description || "").trim(),
    quantity,
    unitPrice,
    totalPrice,
  };
}

/**
 * Calls Gemini with a strict JSON schema and normalizes the result into the
 * same ParsedBudget shape the regex engine produces. Throws on any failure
 * (missing key, network error, bad response) — the caller is expected to
 * catch this and fall back to smartParseBudget.
 */
export async function parseBudgetWithGemini(
  rawText: string,
  category: string | undefined,
  clientNameSuggestion: string | undefined,
  companyNameSuggestion: string | undefined,
  apiKey: string,
): Promise<ParsedBudget> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada");
  }

  const prompt = buildPrompt(rawText, category, clientNameSuggestion, companyNameSuggestion);

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: BUDGET_RESPONSE_SCHEMA,
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Gemini API respondeu ${response.status}: ${errorBody.slice(0, 200)}`);
  }

  const data = await response.json();
  const outputText: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!outputText) {
    throw new Error("Gemini não retornou conteúdo");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new Error("Gemini retornou um JSON inválido");
  }

  const items: ParsedItem[] = Array.isArray(parsed.items) && parsed.items.length > 0
    ? parsed.items.map(toParsedItem)
    : [];

  const subtotal =
    typeof parsed.subtotal === "number"
      ? parsed.subtotal
      : items.reduce((sum, item) => sum + item.totalPrice, 0);
  const discount = typeof parsed.discount === "number" ? parsed.discount : 0;
  const total = typeof parsed.total === "number" ? parsed.total : Math.max(subtotal - discount, 0);

  const categorySpecificFields: CategorySpecificField[] = Array.isArray(parsed.categorySpecificFields)
    ? parsed.categorySpecificFields
        .filter((field: any) => field?.value)
        .map((field: any) => ({
          key: String(field.key || "field"),
          label: String(field.label || "Campo"),
          value: String(field.value),
        }))
    : [];

  const clientName = String(parsed.client?.name || clientNameSuggestion || "").trim();
  const serviceName = items[0]?.name || "Serviço Prestado";

  return {
    title: String(parsed.title || (serviceName === "Serviço Prestado" ? "Orçamento de Serviços" : `Orçamento de ${serviceName}`)),
    category: String(parsed.category || category || "Serviços"),
    client: {
      name: clientName,
      phone: normalizePhone(String(parsed.client?.phone || "")),
      email: String(parsed.client?.email || "").trim(),
      document: normalizeDocument(String(parsed.client?.document || "")),
      address: String(parsed.client?.address || "").trim(),
    },
    categorySpecificFields,
    items:
      items.length > 0
        ? items
        : [
            {
              id: `item-${Date.now()}-1`,
              name: "Serviço Prestado",
              description: "",
              quantity: 1,
              unitPrice: total,
              totalPrice: total,
            },
          ],
    subtotal,
    discount,
    total,
    paymentTerms: String(parsed.paymentTerms || "").trim(),
    validityDays: typeof parsed.validityDays === "number" ? parsed.validityDays : null,
    notes: String(parsed.notes || "").trim(),
  };
}
