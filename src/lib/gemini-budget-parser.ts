import {
  formatCnpj,
  formatCpf,
  formatPhone,
  parseBrazilianMoney,
  type CategorySpecificField,
  type ParsedBudget,
  type ParsedItem,
  reconcileBudgetWithSource,
} from "./budget-parser";

// Try these models in order. If one is overloaded (503) or rate-limited
// (429), we immediately move to the next instead of waiting — different
// models get hit by traffic spikes at different times, so this keeps the
// feature working even when any single model is temporarily saturated.
const GEMINI_MODEL_CHAIN = [
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
];

function endpointFor(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

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
        required: [
          "name",
          "description",
          "quantity",
          "unitPrice",
          "totalPrice",
        ],
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
  return `Você é o motor de organização de orçamentos do BL CORE.

Sua tarefa é transformar o texto falado ou digitado pelo usuário em dados estruturados para um orçamento profissional.

IMPORTANTE:
- O BL CORE atende QUALQUER profissão: oficina, social media, manicure, barbearia, salão, eletricista, marceneiro, fotógrafo, construção, informática, estética automotiva e qualquer outro negócio.
- NÃO existe formulário específico de ramo.
- Você deve criar campos dinâmicos somente para as informações relevantes que aparecerem no texto.
- NÃO invente dados.
- NÃO reutilize dados de outro orçamento.
- O texto abaixo é a ÚNICA fonte de verdade.

TEXTO ORIGINAL:
"""
${rawText}
"""

CONTEXTO DA EMPRESA:
- Ramo/categoria: ${category || "não informado"}
- Nome da empresa emissora: ${companyNameSuggestion || "não informado"}
${clientNameSuggestion ? `- Sugestão de cliente já informada: ${clientNameSuggestion}` : ""}

REGRAS DE EXTRAÇÃO:

1. CLIENTE
"client.name" deve conter SOMENTE o nome do cliente. Pare antes de telefone, CPF, endereço, veículo ou qualquer outra informação.
"client.phone" deve conter SOMENTE telefone/WhatsApp.
"client.document" deve conter CPF ou CNPJ.
"client.email" deve conter e-mail.
"client.address" deve conter endereço/cidade.
Se um desses dados não estiver no texto original, deixe vazio.

2. CAMPOS DINÂMICOS
"categorySpecificFields" é um formulário CORINGA.
Crie um campo para cada informação importante que não pertence aos dados universais do cliente e que seja útil para entender o orçamento.
Exemplos:
- Oficina: Veículo, Placa, Problema, Ano, Quilometragem.
- Manicure: Procedimento, Formato, Tamanho, Cor.
- Barbearia: Corte, Barba, Acabamento.
- Social Media: Projeto, Plataforma, Quantidade de posts, Integração.
- Marcenaria: Móvel, Medidas, Material, Acabamento.
- Construção: Ambiente, Metragem, Material, Etapa.
Esses exemplos NÃO são uma lista fixa. Crie somente o que estiver efetivamente no texto.
Não crie campos vazios.
Não copie a categoria como se fosse um campo.
Prazo de entrega/execução deve ser um campo dinâmico com key "deadline" e label "Prazo".

3. ITENS
Cada produto ou serviço com preço próprio deve virar UMA LINHA separada em "items".
Exemplo:
"para-choque 850, capô 1200, farol direito 680"
deve gerar TRÊS itens:
- Para-choque: 850
- Capô: 1200
- Farol direito: 680

NUNCA transforme vários itens com preços individuais em um único item chamado "Serviço Prestado".
Se houver quantidade explícita, use-a. Caso contrário, quantidade = 1.
unitPrice é o preço unitário.
totalPrice = quantidade x preço unitário.

4. TOTAL
Se o texto disser explicitamente "total 5520", o campo "total" deve ser 5520.
Se houver itens com preços individuais, "subtotal" deve ser a soma deles.
Não crie item artificial para fazer a soma bater.
Se houver desconto explicitamente informado, coloque em "discount".

5. FORMATO LIVRE
O usuário pode falar naturalmente, sem vírgulas e sem rótulos:
"João da Silva Honda Civic 2018 placa ABC1D23 batida dianteira..."
Você deve separar semanticamente as informações.

Também pode usar:
"João da Silva | Honda Civic 2018 | ABC1D23 | batida dianteira | para-choque 850..."
Interprete os separadores como organização do texto, não como parte dos valores.

6. VALORES
Interprete reais no padrão brasileiro.
"850", "850 reais", "R$ 850,00" = 850.
"1.200" = 1200.
"1.200,50" = 1200.50.
"mil e duzentos" = 1200.

7. PRAZO
"prazo mais ou menos 10 dias" deve resultar em "Aproximadamente 10 dias".
"prazo de 15 dias úteis" deve resultar em "15 dias úteis".
Não confunda prazo de entrega com validade da proposta.

8. PAGAMENTO
Extraia exatamente a condição mencionada.
Exemplo: "50% agora e 50% na entrega".
Se "pagamento combinar", use "Combinar".
Se não foi informado, deixe vazio.

9. VALIDADE
"proposta válida por 10 dias" -> validityDays = 10.
Se não houver validade, use null.

10. OBSERVAÇÕES
Informações como:
"peças podem mudar de preço"
"pendente de enviar o logo"
"valor sujeito a alteração"
devem ir para "notes".
Não invente observações.

11. TÍTULO
Crie um título curto e profissional baseado no conteúdo.
Exemplo para oficina: "Orçamento de Reparação Automotiva".
Exemplo para social media: "Orçamento de Landing Page".
Não invente o serviço.

12. PROIBIDO
- Não usar dados do contexto da empresa como dados do cliente.
- Não preencher endereço com informação não dita.
- Não transformar o valor total em item quando já existem itens individuais.
- Não criar campos vazios.
- Não manter dados de um orçamento anterior.
- Não inventar telefone, CPF, e-mail, endereço, veículo, placa ou preços.

Responda SOMENTE com JSON válido seguindo o schema fornecido.`;
}

function normalizeDocument(raw: string): string {
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");

  if (digits.length === 11) {
    return formatCpf(digits) || raw.trim();
  }

  if (digits.length === 14) {
    return formatCnpj(digits) || raw.trim();
  }

  return raw.trim();
}

function normalizePhone(raw: string): string {
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");

  return formatPhone(digits) || raw.trim();
}

function toParsedItem(
  item: any,
  index: number,
): ParsedItem {
  const quantity =
    Number(item?.quantity) > 0
      ? Number(item.quantity)
      : 1;

  const unitPrice =
    typeof item?.unitPrice === "number"
      ? item.unitPrice
      : parseBrazilianMoney(
          String(item?.unitPrice ?? "0"),
        );

  const totalPrice =
    typeof item?.totalPrice === "number"
      ? item.totalPrice
      : unitPrice * quantity;

  return {
    id: `item-${Date.now()}-${index + 1}`,
    name: String(
      item?.name || "Serviço Prestado",
    ).trim(),
    description: String(
      item?.description || "",
    ).trim(),
    quantity,
    unitPrice,
    totalPrice,
  };
}

const RETRYABLE_STATUS = new Set([429, 500, 503, 504]);

async function callGeminiWithFallback(
  prompt: string,
  apiKey: string,
): Promise<{ response: Response; modelUsed: string }> {
  let lastError: Error | null = null;
  let lastResponse: Response | null = null;
  let lastModel = GEMINI_MODEL_CHAIN[0];

  // Netlify's default function timeout is 10s on most plans, so we move
  // straight to the next model on failure instead of adding backoff
  // delays — trying 4 models back-to-back is faster than retrying one
  // model 4 times, and it survives a single model being overloaded.
  for (const model of GEMINI_MODEL_CHAIN) {
    lastModel = model;

    let response: Response;

    try {
      response = await fetch(
        `${endpointFor(model)}?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema:
                BUDGET_RESPONSE_SCHEMA,
              temperature: 0,
            },
          }),
        },
      );
    } catch (networkError) {
      lastError =
        networkError instanceof Error
          ? networkError
          : new Error(String(networkError));
      continue;
    }

    if (response.ok) {
      return { response, modelUsed: model };
    }

    lastResponse = response;

    // Overloaded / rate limited / transient server error: try the next
    // model in the chain immediately.
    if (RETRYABLE_STATUS.has(response.status)) {
      continue;
    }

    // Non-retryable error (bad request, invalid key, etc) — no point
    // trying other models, they'll fail the same way.
    return { response, modelUsed: model };
  }

  if (lastResponse) {
    return { response: lastResponse, modelUsed: lastModel };
  }

  throw (
    lastError ||
    new Error("Falha desconhecida ao chamar o Gemini")
  );
}

export async function parseBudgetWithGemini(
  rawText: string,
  category: string | undefined,
  clientNameSuggestion: string | undefined,
  companyNameSuggestion: string | undefined,
  apiKey: string,
): Promise<ParsedBudget> {
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY não configurada",
    );
  }

  const prompt = buildPrompt(
    rawText,
    category,
    clientNameSuggestion,
    companyNameSuggestion,
  );

  const { response, modelUsed } = await callGeminiWithFallback(
    prompt,
    apiKey,
  );

  if (!response.ok) {
    const errorBody =
      await response
        .text()
        .catch(() => "");

    throw new Error(
      `Gemini API respondeu ${response.status} em todos os ${GEMINI_MODEL_CHAIN.length} modelos testados (último: ${modelUsed}): ${errorBody.slice(
        0,
        200,
      )}`,
    );
  }

  const data =
    await response.json();

  const outputText: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]
      ?.text;

  if (!outputText) {
    throw new Error(
      "Gemini não retornou conteúdo",
    );
  }

  let parsed: any;

  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new Error(
      "Gemini retornou um JSON inválido",
    );
  }

  const items: ParsedItem[] =
    Array.isArray(parsed.items) &&
    parsed.items.length > 0
      ? parsed.items.map(toParsedItem)
      : [];

  const subtotal =
    typeof parsed.subtotal === "number"
      ? parsed.subtotal
      : items.reduce(
          (sum, item) =>
            sum + item.totalPrice,
          0,
        );

  const discount =
    typeof parsed.discount === "number"
      ? parsed.discount
      : 0;

  const total =
    typeof parsed.total === "number"
      ? parsed.total
      : Math.max(
          subtotal - discount,
          0,
        );

  const categorySpecificFields: CategorySpecificField[] =
    Array.isArray(
      parsed.categorySpecificFields,
    )
      ? parsed.categorySpecificFields
          .filter(
            (field: any) =>
              field?.value,
          )
          .map(
            (field: any) => ({
              key: String(
                field.key ||
                  "field",
              ),
              label: String(
                field.label ||
                  "Informação",
              ),
              value: String(
                field.value,
              ),
            }),
          )
      : [];

  const serviceName =
    items[0]?.name ||
    "Serviço Prestado";

  const normalizedBudget: ParsedBudget = {
    title: String(
      parsed.title ||
        (items.length > 1
          ? "Orçamento de Serviços"
          : `Orçamento de ${serviceName}`),
    ),

    category: String(
      parsed.category ||
        category ||
        "Serviços",
    ),

    client: {
      name: String(
        parsed.client?.name ||
          "",
      ).trim(),

      phone: normalizePhone(
        String(
          parsed.client?.phone ||
            "",
        ),
      ),

      email: String(
        parsed.client?.email ||
          "",
      ).trim(),

      document:
        normalizeDocument(
          String(
            parsed.client
              ?.document || "",
          ),
        ),

      address: String(
        parsed.client?.address ||
          "",
      ).trim(),
    },

    categorySpecificFields,

    items,

    subtotal,

    discount,

    total,

    paymentTerms: String(
      parsed.paymentTerms ||
        "",
    ).trim(),

    validityDays:
      typeof parsed.validityDays ===
      "number"
        ? parsed.validityDays
        : null,

    notes: String(
      parsed.notes || "",
    ).trim(),
  };

  return reconcileBudgetWithSource(
    rawText,
    normalizedBudget,
    category,
    clientNameSuggestion,
    companyNameSuggestion,
  );
}
