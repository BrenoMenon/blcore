export interface ParsedClient {
  name: string;
  phone: string;
  email: string;
  document: string;
  address: string;
}

export interface ParsedItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface CategorySpecificField {
  key: string;
  label: string;
  value: string;
}

export interface ParsedBudget {
  title: string;
  category: string;
  client: ParsedClient;
  categorySpecificFields: CategorySpecificField[];
  items: ParsedItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentTerms: string;
  validityDays: number | null;
  notes: string;
}

const MONEY_TOKEN = String.raw`(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)(?=\s|reais?\b|$)`;

function normalizeText(value: string): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function cleanValue(value: string): string {
  return normalizeText(value).replace(/^[\s,;:|.-]+|[\s,;|.-]+$/g, "").trim();
}

function sentenceCase(value: string): string {
  const clean = cleanValue(value);
  if (!clean) return "";
  return clean.charAt(0).toLocaleUpperCase("pt-BR") + clean.slice(1);
}

export function parseBrazilianMoney(raw: string): number {
  const normalized = normalizeText(raw).replace(/\s/g, "");
  if (!normalized) return 0;

  if (normalized.includes(",")) {
    return Number(normalized.replace(/\./g, "").replace(",", ".")) || 0;
  }

  const dots = normalized.split(".");
  if (dots.length > 1 && dots[dots.length - 1].length === 3) {
    return Number(normalized.replace(/\./g, "")) || 0;
  }

  return Number(normalized) || 0;
}

export function cleanClientName(raw: string): string {
  const cleaned = cleanValue(raw)
    .replace(/^(?:o|a)\s+/i, "")
    .replace(/^(?:sr\.?|sra\.?|senhor|senhora|dr\.?|dra\.?)\s+/i, "")
    .replace(/^(?:cliente|nome\s+do\s+cliente)\s*(?:é|e|:|=)?\s*/i, "")
    .replace(/[,;|].*$/, "")
    .trim();

  if (!cleaned) return "";

  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLocaleLowerCase("pt-BR");

      if (["de", "da", "do", "dos", "das", "e"].includes(lower)) {
        return lower;
      }

      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    })
    .join(" ");
}

export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 13 && digits.startsWith("55")) {
    return formatPhone(digits.slice(2));
  }

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return "";
}

export function formatCpf(raw: string): string {
  const digits = raw.replace(/\D/g, "");

  if (digits.length !== 11) return "";

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function formatCnpj(raw: string): string {
  const digits = raw.replace(/\D/g, "");

  if (digits.length !== 14) return "";

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function extractDocument(text: string): string {
  const labeledCnpj = text.match(
    /(?:cnpj)\s*(?:é|e|:|=)?\s*((?:\d[\s.-]*){14,18})/i,
  );

  if (labeledCnpj?.[1]) {
    const formatted = formatCnpj(labeledCnpj[1]);

    if (formatted) return formatted;
  }

  const labeledCpf = text.match(
    /(?:cpf|documento|doc)(?:\s+(?:dele|dela|do\s+cliente|da\s+cliente))?\s*(?:é|e|:|=)?\s*((?:\d[\s.-]*){11,14})/i,
  );

  if (labeledCpf?.[1]) {
    const formatted = formatCpf(labeledCpf[1]);

    if (formatted) return formatted;
  }

  const cnpj = text.match(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/);

  if (cnpj?.[1]) {
    return formatCnpj(cnpj[1]);
  }

  const cpf = text.match(/\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/);

  return cpf?.[1] ? formatCpf(cpf[1]) : "";
}

function extractPhone(text: string, document: string): string {
  const labeled = text.match(
    /(?:telefone|tel|celular|whats(?:app)?|zap|fone|contato)\s*(?:é|e|:|=)?\s*(?:\+?55\s*)?(\(?\d{2}\)?\s*9?\d{4}[-.\s]?\d{4})/i,
  );

  if (labeled?.[1]) {
    return formatPhone(labeled[1]);
  }

  const formatted = text.match(
    /(?:^|\s|\()([1-9]{2})\)?\s*(9\d{4}|\d{4})[-.\s](\d{4})(?=\s|$)/i,
  );

  if (formatted) {
    const candidate = `${formatted[1]}${formatted[2]}${formatted[3]}`;

    if (candidate !== document.replace(/\D/g, "")) {
      return formatPhone(candidate);
    }
  }

  return "";
}

function extractClient(text: string, suggestion?: string): string {
  if (suggestion) {
    const suggested = cleanClientName(suggestion);

    if (suggested) return suggested;
  }

  const patterns = [
    /(?:cliente|nome\s+do\s+cliente)\s*(?:é|e|:|=)?\s*([\p{L}][\p{L}'-]*(?:\s+[\p{L}][\p{L}'-]*){0,5})(?=\s*(?:telefone|tel|celular|whats|zap|cpf|cnpj|endereço|endereco|mora|reside|veículo|veiculo|carro|valor|orçamento|orcamento|[,.;]|$))/iu,

    /(?:é\s+o\s+cliente|o\s+cliente\s+é)\s+([\p{L}][\p{L}'-]*(?:\s+[\p{L}][\p{L}'-]*){0,5})(?=\s*(?:telefone|tel|cpf|cnpj|endereço|endereco|mora|reside|veículo|veiculo|carro|valor|orçamento|orcamento|$))/iu,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const name = cleanClientName(match?.[1] || "");

    if (name) return name;
  }

  const firstSegment = text
    .split("|")[0]
    .replace(/^orçamento\s*:?\s*/i, "")
    .trim();

  if (firstSegment && !/\d/.test(firstSegment)) {
    const name = cleanClientName(firstSegment);

    if (name && name.split(/\s+/).length <= 6) {
      return name;
    }
  }

  return "";
}

function extractAddress(text: string): string {
  const match = text.match(
    /(?:endereço|endereco|cidade|localização|localizacao|reside\s+em|mora\s+em)\s*(?:é|e|:|=)?\s*(.+?)(?=\s+(?:é\s+o\s+orçamento|e\s+o\s+orçamento|é\s+orçamento|e\s+orçamento|orçamento\s+de|orcamento\s+de|criação\s+de|criacao\s+de|desenvolvimento\s+de|valor\s+total|total\b|pagamento|prazo\b|proposta\s+válida|proposta\s+valida|pendente|observação|observacao|$))/i,
  );

  return match?.[1] ? sentenceCase(match[1]) : "";
}

function extractEmail(text: string): string {
  return (
    text.match(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/)?.[0] || ""
  );
}

function extractTotal(text: string): number {
  const patterns = [
    new RegExp(
      `valor\\s+total\\s*(?:é|e|de|:|=)?\\s*${MONEY_TOKEN}`,
      "i",
    ),

    new RegExp(
      `total\\s*(?:é|e|de|:|=)?\\s*${MONEY_TOKEN}`,
      "i",
    ),

    new RegExp(
      `\\br\\$\\s*([\\d.]+(?:,\\d{1,2})?)`,
      "i",
    ),

    new RegExp(
      `(?:valor|por)\\s*(?:é|e|:|=)?\\s*${MONEY_TOKEN}\\s*reais?`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return parseBrazilianMoney(match[1]);
    }
  }

  return 0;
}

function extractPayment(text: string): string {
  const match = text.match(
    /(?:forma\s+de\s+pagamento|pagamento|condição\s+de\s+pagamento|condicao\s+de\s+pagamento)\s*(?:é|e|:|=)?\s*(.+?)(?=\s+(?:prazo\b|proposta\s+válida|proposta\s+valida|validade\b|observação\b|observacao\b|pendente\b)|\s*[.;|]|$)/i,
  );

  return match?.[1] ? sentenceCase(match[1]) : "";
}

function extractDeadline(text: string): string {
  const match = text.match(
    /(?:prazo\s+(?:de\s+entrega|de\s+execução|de\s+execucao)?|entrega|execução|execucao)\s*(?:é|e|:|=)?\s*(?:de|para)?\s*(.+?)(?=\s+(?:proposta\s+válida|proposta\s+valida|validade\b|observação\b|observacao\b|pendente\b|peças?\s+podem|pecas?\s+podem)|\s*[.;|]|$)/i,
  );

  return match?.[1] ? sentenceCase(match[1]) : "";
}

function extractValidityDays(text: string): number | null {
  const match =
    text.match(
      /(?:proposta|orçamento|orcamento)\s+(?:é\s+)?válid[ao]\s+(?:por\s+)?(\d+)\s*dias?/i,
    ) ||
    text.match(
      /validade\s+(?:da\s+proposta|do\s+orçamento|do\s+orcamento)\s*(?:é|de|:)?\s*(\d+)\s*dias?/i,
    );

  return match?.[1] ? Number(match[1]) : null;
}

function extractNotes(text: string): string {
  const notes: string[] = [];

  const pending = text.match(
    /(?:pendente(?:s)?(?:\s+(?:de|que|ele|ela|o|a))?|faltando|aguardando)\s+(.+?)(?=\s*(?:;|\.|$))/i,
  );

  if (pending?.[1]) {
    notes.push(`Pendente de ${cleanValue(pending[1])}`);
  }

  const priceChange = text.match(
    /((?:peças?|pecas?|materiais?)\s+(?:podem|pode)\s+(?:mudar|sofrer\s+alteração|sofrer\s+alteracao)\s+(?:de\s+)?preço|(?:peças?|pecas?|materiais?)\s+podem\s+ter\s+preço\s+alterado)/i,
  );

  if (priceChange?.[1]) {
    notes.push(sentenceCase(priceChange[1]));
  }

  const observation = text.match(
    /(?:obs(?:ervação|ervacoes|erva[cç][aã]o|erva[cç][oõ]es)?|nota|aviso)\s*[:=]?\s*(.+?)(?=\s*(?:;|\.|$))/i,
  );

  if (observation?.[1]) {
    notes.push(cleanValue(observation[1]));
  }

  return notes.map(sentenceCase).filter(Boolean).join(". ");
}

function makeField(
  key: string,
  label: string,
  value: string,
): CategorySpecificField {
  return {
    key,
    label,
    value: cleanValue(value),
  };
}

function extractContextFields(
  text: string,
): CategorySpecificField[] {
  const fields: CategorySpecificField[] = [];
  const normalized = normalizeText(text);

  const vehicle = normalized.match(
    /(?:veículo|veiculo|carro|moto|automóvel|automovel)\s*(?:é|e|:|=)?\s*(.+?)(?=\s+(?:placa|problema|defeito|batida|serviço|servico|valor|total|prazo|pagamento)|\s*[|.;]|$)/i,
  );

  const plate = normalized.match(
    /(?:placa)\s*(?:é|e|:|=)?\s*([A-Z0-9-]{6,8})/i,
  );

  const problem = normalized.match(
    /(?:problema|defeito|queixa|motivo|avaria)\s*(?:é|e|:|=)?\s*(.+?)(?=\s+(?:para-choque|parachoque|capô|capo|farol|paralama|pintura|funilaria|mão de obra|mao de obra|valor|total|prazo|pagamento)|\s*[|.;]|$)/i,
  );

  const impact = normalized.match(
    /(?:batida|colisão|colisao)\s+(?:dianteira|traseira|lateral|frontal|leve|forte|.+?)(?=\s+(?:para-choque|parachoque|capô|capo|farol|paralama|pintura|funilaria|mão de obra|mao de obra|valor|total|prazo|pagamento)|\s*[|.;]|$)/i,
  );

  if (
    normalized.includes("|") &&
    /^orçamento\s*:/i.test(normalized)
  ) {
    const parts = normalized
      .split("|")
      .map(cleanValue)
      .filter(Boolean);

    const pipePlate =
      parts[2] &&
      /^[A-Z0-9-]{6,8}$/i.test(parts[2])
        ? parts[2]
        : "";

    if (parts[1] && pipePlate) {
      fields.push(
        makeField(
          "vehicle",
          "Veículo",
          parts[1],
        ),
      );
    }

    if (pipePlate) {
      fields.push(
        makeField(
          "plate",
          "Placa",
          pipePlate.toUpperCase(),
        ),
      );
    }

    if (
      parts[3] &&
      pipePlate &&
      !/\d/.test(parts[3])
    ) {
      fields.push(
        makeField(
          "problem",
          "Problema",
          parts[3],
        ),
      );
    }
  } else {
    if (vehicle?.[1]) {
      fields.push(
        makeField(
          "vehicle",
          "Veículo",
          vehicle[1],
        ),
      );
    }

    if (plate?.[1]) {
      fields.push(
        makeField(
          "plate",
          "Placa",
          plate[1].toUpperCase(),
        ),
      );
    }

    if (problem?.[1]) {
      fields.push(
        makeField(
          "problem",
          "Problema",
          problem[1],
        ),
      );
    } else if (impact?.[0]) {
      fields.push(
        makeField(
          "problem",
          "Problema",
          impact[0],
        ),
      );
    }
  }

  const deadline = extractDeadline(normalized);

  if (deadline) {
    fields.push(
      makeField(
        "deadline",
        "Prazo",
        deadline,
      ),
    );
  }

  return fields;
}

function createItem(
  name: string,
  price: number,
  index: number,
  description = "",
): ParsedItem {
  return {
    id: `item-${Date.now()}-${index + 1}`,
    name: sentenceCase(name),
    description: cleanValue(description),
    quantity: 1,
    unitPrice: price,
    totalPrice: price,
  };
}

function extractPipeItems(
  text: string,
): ParsedItem[] {
  if (!text.includes("|")) return [];

  const parts = text
    .split("|")
    .map(cleanValue)
    .filter(Boolean);

  if (parts.length < 5) return [];

  const items: ParsedItem[] = [];
  let index = 0;

  for (const part of parts.slice(1)) {
    if (
      /^(?:total|prazo|pagamento|forma de pagamento|observação|observacao)\b/i.test(
        part,
      )
    ) {
      break;
    }

    const match = part.match(
      /^(.+?)\s+(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:reais?)?$/i,
    );

    if (!match) continue;

    const price = parseBrazilianMoney(match[2]);

    if (
      price <= 0 ||
      (
        price >= 1900 &&
        price <= 2100 &&
        /^\d{4}$/.test(match[2])
      )
    ) {
      continue;
    }

    items.push(
      createItem(
        match[1],
        price,
        index++,
      ),
    );
  }

  return items;
}

function extractNaturalItems(
  text: string,
): ParsedItem[] {
  const startMatch = text.match(
    /(?:inclui|contém|contem|serviços?\s*:|servicos?\s*:)\s*(.+?)(?=\s+(?:total\s*(?:é|e|de|:|=)|valor\s+total|prazo\b))/i,
  );

  if (!startMatch?.[1]) return [];

  const segment = startMatch[1]
    .replace(
      /\s+e\s+(?=[^\d]{1,60}(?:no\s+valor\s+de\s+|por\s+|r\$\s*)\d)/iu,
      ", ",
    )
    .replace(/\.\s+.*$/, "")
    .replace(/\.$/, "");

  const items: ParsedItem[] = [];

  const pieces = segment
    .split(/,\s*|\s+;\s*/)
    .map(cleanValue)
    .filter(Boolean);

  for (const piece of pieces) {
    const match = piece.match(
      /^(.+?)\s+(?:no\s+valor\s+de\s+|por\s+|r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:reais?)?$/i,
    );

    if (!match) continue;

    const price = parseBrazilianMoney(match[2]);

    if (price > 0) {
      items.push(
        createItem(
          match[1],
          price,
          items.length,
        ),
      );
    }
  }

  return items;
}

function extractItems(
  text: string,
  total: number,
): ParsedItem[] {
  const pipeItems = extractPipeItems(text);

  if (pipeItems.length) {
    return pipeItems;
  }

  const naturalItems = extractNaturalItems(text);

  if (naturalItems.length) {
    return naturalItems;
  }

  return [];
}

function reconcileItems(
  items: ParsedItem[],
  total: number,
): ParsedItem[] {
  if (!items.length) return [];

  const sum = items.reduce(
    (acc, item) => acc + item.totalPrice,
    0,
  );

  if (
    total > 0 &&
    Math.abs(sum - total) > 0.01
  ) {
    return items;
  }

  return items;
}

export function smartParseBudget(
  rawText: string,
  category?: string,
  clientNameSuggestion?: string,
  _companyNameSuggestion?: string,
): ParsedBudget {
  const text = normalizeText(rawText);

  const document = extractDocument(text);
  const total = extractTotal(text);
  const deadline = extractDeadline(text);

  const items = reconcileItems(
    extractItems(text, total),
    total,
  );

  const explicitFields = extractContextFields(text).filter(
    (field, index, arr) =>
      arr.findIndex(
        (x) => x.key === field.key,
      ) === index,
  );

  const serviceName =
    items.length > 1
      ? "Serviços e Produtos"
      : items[0]?.name || "Serviço Prestado";

  const subtotal =
    items.length > 0
      ? items.reduce(
          (sum, item) =>
            sum + item.totalPrice,
          0,
        )
      : total;

  return {
    title:
      items.length > 1
        ? "Orçamento de Serviços"
        : `Orçamento de ${serviceName}`,

    category:
      category || "Serviços",

    client: {
      name: extractClient(
        text,
        clientNameSuggestion,
      ),
      phone: extractPhone(
        text,
        document,
      ),
      email: extractEmail(text),
      document,
      address: extractAddress(text),
    },

    categorySpecificFields:
      explicitFields,

    items:
      items.length > 0
        ? items
        : [
            {
              id: `item-${Date.now()}-1`,
              name: serviceName,
              description: "",
              quantity: 1,
              unitPrice: total,
              totalPrice: total,
            },
          ],

    subtotal,

    discount: 0,

    total:
      total || subtotal,

    paymentTerms:
      extractPayment(text),

    validityDays:
      extractValidityDays(text),

    notes:
      extractNotes(text),
  };
}

export function reconcileBudgetWithSource(
  rawText: string,
  budget: ParsedBudget,
  category?: string,
  clientNameSuggestion?: string,
  companyNameSuggestion?: string,
): ParsedBudget {
  const explicit = smartParseBudget(
    rawText,
    category,
    clientNameSuggestion,
    companyNameSuggestion,
  );

  const hasText = (
    value: unknown,
  ): value is string =>
    typeof value === "string" &&
    value.trim().length > 0;

  const sourceItems =
    explicit.items.filter(
      (item) =>
        item.name !==
          "Serviço Prestado" ||
        item.unitPrice > 0,
    );

  const geminiItems =
    Array.isArray(
      budget.items,
    )
      ? budget.items.filter(
          (item) =>
            item.name &&
            item.name !==
              "Serviço Prestado",
        )
      : [];

  const sourceSum =
    sourceItems.reduce(
      (sum, item) =>
        sum + item.totalPrice,
      0,
    );

  const geminiSum =
    geminiItems.reduce(
      (sum, item) =>
        sum + item.totalPrice,
      0,
    );

  const finalItems =
    explicit.total > 0 &&
    sourceItems.length > 0 &&
    Math.abs(
      sourceSum -
        explicit.total,
    ) < 0.01
      ? sourceItems
      : explicit.total > 0 &&
          geminiItems.length > 0 &&
          Math.abs(
            geminiSum -
              explicit.total,
          ) < 0.01
        ? geminiItems
        : sourceItems.length > 0
          ? sourceItems
          : geminiItems.length > 0
            ? geminiItems
            : explicit.items;

  const dynamicFields = [
    ...(Array.isArray(
      budget.categorySpecificFields,
    )
      ? budget.categorySpecificFields
      : []),

    ...explicit.categorySpecificFields,
  ].filter(
    (field, index, arr) => {
      const key =
        `${field.key}:${field.value}`;

      return (
        arr.findIndex(
          (x) =>
            `${x.key}:${x.value}` ===
            key,
        ) === index
      );
    },
  );

  const explicitTotal =
    explicit.total > 0
      ? explicit.total
      : null;

  const subtotal =
    explicitTotal !== null
      ? sourceItems.length > 0
        ? sourceItems.reduce(
            (sum, item) =>
              sum +
              item.totalPrice,
            0,
          )
        : explicitTotal
      : budget.subtotal || 0;

  const total =
    explicitTotal !== null
      ? explicitTotal
      : budget.total ||
        subtotal;

  return {
    ...budget,

    title:
      budget.title &&
      budget.title !==
        "Orçamento de Serviços"
        ? budget.title
        : explicit.title,

    category:
      budget.category ||
      category ||
      explicit.category,

    client: {
      name:
        explicit.client.name ||
        clientNameSuggestion ||
        "",

      phone:
        explicit.client.phone ||
        "",

      email:
        explicit.client.email ||
        "",

      document:
        explicit.client.document ||
        "",

      address:
        explicit.client.address ||
        "",
    },

    categorySpecificFields:
      dynamicFields,

    items:
      finalItems,

    subtotal,

    discount:
      explicitTotal !== null
        ? 0
        : budget.discount || 0,

    total,

    paymentTerms:
      hasText(
        explicit.paymentTerms,
      )
        ? explicit.paymentTerms
        : hasText(
              budget.paymentTerms,
            )
          ? budget.paymentTerms
          : "",

    validityDays:
      explicit.validityDays !==
      null
        ? explicit.validityDays
        : budget.validityDays ??
          null,

    notes:
      hasText(explicit.notes)
        ? explicit.notes
        : hasText(
              budget.notes,
            )
          ? budget.notes
          : "",
  };
}
