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

const MONEY_TOKEN = String.raw`(?:r\$\s*)?([\d.]+(?:,\d{1,2})?|\d+)`;

function normalizeText(value: string): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function sentenceCase(value: string): string {
  const clean = normalizeText(value).replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, "").trim();
  if (!clean) return "";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
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
  if (!raw) return "";
  const cleaned = raw
    .replace(/^(?:(?:para\s+o|para\s+a|ao|à|do|da)?\s*(?:cliente|comprador|contratante|solicitante|paciente|aluno))\s*[:=–-]?\s*/i, "")
    .replace(/^(?:nome(?:\s+do\s+cliente)?|em\s+nome\s+de)\s*[:=–-]?\s*/i, "")
    .replace(/^(?:sr\.?|sra\.?|senhor|senhora|dr\.?|dra\.?)\s+/i, "")
    .replace(/^(?:o|a)\s+/i, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/[,;:.].*$/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || /^(?:cria[cç][aã]o|servi[cç]o|valor|pagamento|prazo|pendente|liberad|depois|quando|or[cç]amento)\b/i.test(cleaned)) {
    return "";
  }

  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLocaleLowerCase("pt-BR");
      return ["de", "da", "do", "dos", "das", "e"].includes(lower)
        ? lower
        : lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    })
    .join(" ");
}

export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
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
  const labeled = text.match(/(?:cnpj)\s*(?:é|e|:|=)?\s*((?:\d[\s.-]*){14,18})/i);

  if (labeled?.[1]) {
    const formatted = formatCnpj(labeled[1]);
    if (formatted) return formatted;
  }

  const labeledCpf = text.match(
    /(?:cpf|documento|doc)(?:\s+(?:dele|dela|do\s+cliente|da\s+cliente))?\s*(?:é|e|:|=)?\s*((?:\d[\s.-]*){11,14})/i
  );

  if (labeledCpf?.[1]) {
    const formatted = formatCpf(labeledCpf[1]);
    if (formatted) return formatted;
  }

  const cnpj = text.match(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/);

  if (cnpj?.[1]) return formatCnpj(cnpj[1]);

  const cpf = text.match(/\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/);

  return cpf?.[1] ? formatCpf(cpf[1]) : "";
}

function extractPhone(text: string, document: string): string {
  const labeled = text.match(
    /(?:telefone|tel|celular|whats(?:app)?|zap|fone|contato)\s*(?:é|e|:|=)?\s*(?:\+?55\s*)?(\(?\d{2}\)?\s*9?\d{4}[-.\s]?\d{4})/i
  );

  const formatted = text.match(
    /(?:^|\s|\()([1-9]{2})\)?\s*(9\d{4}|\d{4})[-.\s](\d{4})(?=\s|$)/i
  );

  const candidate =
    labeled?.[1] ??
    (formatted ? `${formatted[1]}${formatted[2]}${formatted[3]}` : "");

  const digits = candidate.replace(/\D/g, "");

  return digits && digits !== document.replace(/\D/g, "")
    ? formatPhone(digits)
    : "";
}

function extractClient(text: string, suggestion?: string): string {
  if (suggestion) {
    const suggested = cleanClientName(suggestion);
    if (suggested) return suggested;
  }

  const patterns = [
    /(?:é\s+o\s+cliente|cliente|nome\s+do\s+cliente|em\s+nome\s+de)\s*(?:é|e|:|=)?\s*([\p{L}][\p{L}'-]*(?:\s+(?:de|da|do|dos|das|e|[\p{L}][\p{L}'-]*)){0,4})(?=\s*(?:\(|,|;|\.|cpf|cnpj|telefone|tel|celular|whats(?:app)?|valor|pagamento|prazo|mora|reside|e-mail|email|$))/iu,

    /(?:para\s+(?:o|a))\s+([\p{L}][\p{L}'-]*(?:\s+[\p{L}][\p{L}'-]*){0,3})(?=\s*(?:\(|,|;|\.|cpf|cnpj|telefone|valor|pagamento|prazo|pendente|$))/iu,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const name = cleanClientName(match?.[1] ?? "");

    if (name) return name;
  }

  return "";
}

function extractAddress(text: string): string {
  const match = text.match(
    /(?:endereço|endereco|cidade|localização|localizacao|reside\s+em|mora\s+em)\s*(?:é|e|:|=)?\s*(.+?)(?=\s+(?:é\s+o\s+orçamento|e\s+o\s+orçamento|é\s+orçamento|e\s+orçamento|orçamento\s+de|or[cç]amento\s+de|cria[cç][aã]o\s+de|desenvolvimento\s+de|produ[cç][aã]o\s+de|valor\s+total|total\s+(?:de|r\$)|pagamento|forma\s+de\s+pagamento|prazo\b|proposta\s+v[aá]lida|pendente|observa[cç][aã]o|obs\b|$))/i
  );

  if (!match?.[1]) return "";

  return sentenceCase(match[1].replace(/[.,;]+$/, ""));
}

function extractService(text: string): {
  name: string;
  description: string;
} {
  const normalized = normalizeText(text);

  const explicit = normalized.match(
    /(?:é\s+o\s+orçamento|e\s+o\s+orçamento|é\s+orçamento|e\s+orçamento|orçamento)\s+(?:de\s+)?(.+?)(?=\s+valor\s+total|\s+total\s+(?:de|r\$)|\s+valor\b|\s+forma\s+de\s+pagamento|\s+pagamento\b|\s+prazo\b|\s+proposta\s+v[aá]lida|\s+pendente\b|\s+observa[cç][aã]o\b|$)/i
  );

  const source =
    explicit?.[1] ||
    normalized.match(
      /((?:cria[cç][aã]o|desenvolvimento|produ[cç][aã]o|instala[cç][aã]o|manuten[cç][aã]o|reforma|consultoria|gest[aã]o|design|servi[cç]o)\s+de\s+.+?)(?=\s+valor\s+total|\s+valor\b|\s+forma\s+de\s+pagamento|\s+pagamento\b|\s+prazo\b|\s+proposta\s+v[aá]lida|\s+pendente\b|$)/i
    )?.[1] ||
    normalized.match(
      /(?:landing\s+page|site\s+institucional|loja\s+virtual|e-commerce|identidade\s+visual|social\s+media|tr[aá]fego\s+pago)/i
    )?.[0] ||
    "";

  if (!source) {
    return {
      name: "Serviço Prestado",
      description: "",
    };
  }

  const clean = sentenceCase(source);

  const descriptionMatch = clean.match(
    /^(cria[cç][aã]o\s+de\s+landing\s+page|desenvolvimento\s+de\s+landing\s+page|landing\s+page)(?:\s+com\s+(.+))?$/i
  );

  if (descriptionMatch) {
    return {
      name: sentenceCase(descriptionMatch[1]),
      description: descriptionMatch[2]
        ? sentenceCase(descriptionMatch[2])
        : "",
    };
  }

  return {
    name: clean,
    description: "",
  };
}

function extractTotal(text: string): number {
  const prioritized = [
    new RegExp(
      `valor\\s+total\\s+(?:é|e|de|:|=)?\\s*${MONEY_TOKEN}`,
      "i"
    ),

    new RegExp(
      `total\\s+(?:é|e|de|:|=)?\\s*${MONEY_TOKEN}`,
      "i"
    ),

    new RegExp(
      `(?:valor|por)\\s*(?:é|e|:|=)?\\s*${MONEY_TOKEN}`,
      "i"
    ),

    new RegExp(
      `\\br\\$\\s*([\\d.]+(?:,\\d{1,2})?)`,
      "i"
    ),
  ];

  for (const pattern of prioritized) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return parseBrazilianMoney(match[1]);
    }
  }

  const reais = text.match(
    /(?:valor\s+total|total|valor|por)\s*(?:é|e|de|:|=)?\s*([\d.]+(?:,\d{1,2})?)\s*reais\b/i
  );

  if (reais?.[1]) {
    return parseBrazilianMoney(reais[1]);
  }

  return 0;
}

function extractPayment(text: string): string {
  const payment = text.match(
    /(?:pagamento|forma\s+de\s+pagamento|condi[cç][aã]o(?:\s+de\s+pagamento)?)\s*(?:é|e|:|=)?\s*(.+?)(?=\s+(?:prazo\b|proposta\s+v[aá]lida|pendente\b|observa[cç][aã]o\b|obs\b)|\s*[.;]|$)/i
  );

  if (payment?.[1]) {
    return sentenceCase(payment[1]);
  }

  const percentage = text.match(
    /\b\d{1,3}%\s+(?:agora|na\s+entrega|na\s+aprova[cç][aã]o|na\s+assinatura).+?(?=\s+(?:prazo\b|proposta\s+v[aá]lida|pendente\b)|\s*[.;]|$)/i
  );

  if (percentage?.[0]) {
    return sentenceCase(percentage[0]);
  }

  const methods = text.match(
    /(?:pix|boleto|cart[aã]o|dinheiro)(?:\s*(?:,|ou|e)\s*(?:pix|boleto|cart[aã]o|dinheiro))+/i
  );

  return methods?.[0] ? sentenceCase(methods[0]) : "";
}

function extractDeadline(text: string): string {
  const patterns = [
    /prazo\s+de\s+entrega\s*(?:é|e|:|=)?\s*(?:de|para)?\s*(.+?)(?=\s+(?:proposta\s+v[aá]lida|validade\s+da\s+proposta|pendente\b|observa[cç][aã]o\b|obs\b)|\s*[.;]|$)/i,

    /(?:prazo|entrega|conclus[aã]o)\s*(?:é|e|:|=)?\s*(?:de|para)?\s*(.+?)(?=\s+(?:proposta\s+v[aá]lida|validade\s+da\s+proposta|pendente\b|observa[cç][aã]o\b|obs\b)|\s*[.;]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return sentenceCase(match[1]);
    }
  }

  return "";
}

function extractValidityDays(text: string): number | null {
  const match =
    text.match(
      /(?:proposta|orçamento|orcamento)\s+(?:é\s+)?v[aá]lid[ao]\s+(?:por\s+)?(\d+)\s*dias?/i
    ) ??
    text.match(
      /validade\s+(?:da\s+proposta|do\s+orçamento|do\s+orcamento)\s*(?:é|de|:)?\s*(\d+)\s*dias?/i
    );

  return match?.[1] ? Number(match[1]) : null;
}

function extractNotes(text: string): string {
  const notes: string[] = [];

  const pending = text.match(
    /(?:pendente(?:s)?(?:\s+(?:de|que|ele|ela|o|a))?|faltando|aguardando)\s+(.+?)(?=\s*(?:;|\.|$))/i
  );

  if (pending?.[1]) {
    notes.push(`Pendente de ${pending[1].trim()}`);
  }

  const observation = text.match(
    /(?:obs(?:erva[cç][aã]o|erva[cç][oõ]es)?|nota|aviso)\s*[:=]?\s*(.+?)(?=\s*(?:;|\.|$))/i
  );

  if (observation?.[1]) {
    notes.push(observation[1].trim());
  }

  return notes
    .map(sentenceCase)
    .filter(Boolean)
    .join(". ");
}

function extractEmail(text: string): string {
  return (
    text.match(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/)?.[0] ?? ""
  );
}

function extractItemDescription(text: string): string {
  const details: string[] = [];

  const includes = text.match(
    /\(([^)]*(?:m[aã]o\s+de\s+obra|design|taxa|material|desconto)[^)]*)\)/i
  );

  if (includes?.[1]) {
    details.push(includes[1].trim());
  }

  if (
    /desconto\s+inclu[ií]do/i.test(text) &&
    !details.some((value) => /desconto\s+inclu[ií]do/i.test(value))
  ) {
    details.push("Desconto incluído");
  }

  return details.map(sentenceCase).join("; ");
}

export function smartParseBudget(
  rawText: string,
  category?: string,
  clientNameSuggestion?: string,
  _companyNameSuggestion?: string,
): ParsedBudget {
  const text = normalizeText(rawText);

  const document = extractDocument(text);
  const phone = extractPhone(text, document);
  const clientName = extractClient(text, clientNameSuggestion);
  const service = extractService(text);
  const total = extractTotal(text);
  const deadline = extractDeadline(text);
  const validityDays = extractValidityDays(text);
  const notes = extractNotes(text);
  const description =
    service.description || extractItemDescription(text);

  const item: ParsedItem = {
    id: `item-${Date.now()}-1`,
    name: service.name,
    description,
    quantity: 1,
    unitPrice: total,
    totalPrice: total,
  };

  return {
    title:
      service.name === "Serviço Prestado"
        ? "Orçamento de Serviços"
        : `Orçamento de ${service.name}`,

    category: category || "Serviços",

    client: {
      name: clientName,
      phone,
      email: extractEmail(text),
      document,
      address: extractAddress(text),
    },

    categorySpecificFields: deadline
      ? [
          {
            key: "deadline",
            label: "Prazo",
            value: deadline,
          },
        ]
      : [],

    items: [item],
    subtotal: total,
    discount: 0,
    total,
    paymentTerms: extractPayment(text),
    validityDays,
    notes,
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

  const has = (value: unknown) =>
    typeof value === "string"
      ? value.trim().length > 0
      : value !== null && value !== undefined;

  const client = {
    ...budget.client,

    ...(has(explicit.client.name)
      ? { name: explicit.client.name }
      : {}),

    ...(has(explicit.client.phone)
      ? { phone: explicit.client.phone }
      : {}),

    ...(has(explicit.client.email)
      ? { email: explicit.client.email }
      : {}),

    ...(has(explicit.client.document)
      ? { document: explicit.client.document }
      : {}),

    ...(has(explicit.client.address)
      ? { address: explicit.client.address }
      : {}),
  };

  const explicitItem = explicit.items[0];

  const items =
    explicitItem &&
    explicitItem.name !== "Serviço Prestado" &&
    (explicit.total > 0 || explicitItem.description)
      ? [
          {
            ...explicitItem,
            id: budget.items?.[0]?.id || explicitItem.id,
            description:
              explicitItem.description ||
              budget.items?.[0]?.description ||
              "",
          },
        ]
      : budget.items;

  const subtotal =
    explicit.total > 0
      ? explicit.total
      : budget.subtotal;

  const total =
    explicit.total > 0
      ? explicit.total
      : budget.total;

  return {
    ...budget,

    title:
      explicit.title !== "Orçamento de Serviços"
        ? explicit.title
        : budget.title,

    category:
      budget.category ||
      category ||
      explicit.category,

    client,

    items: items?.length
      ? items
      : [explicitItem],

    subtotal,
    total,

    discount:
      explicit.total > 0
        ? 0
        : budget.discount,

    paymentTerms:
      has(explicit.paymentTerms)
        ? explicit.paymentTerms
        : budget.paymentTerms,

    validityDays:
      explicit.validityDays !== null
        ? explicit.validityDays
        : budget.validityDays ?? null,

    categorySpecificFields:
      explicit.categorySpecificFields.length
        ? explicit.categorySpecificFields
        : budget.categorySpecificFields,

    notes:
      has(explicit.notes)
        ? explicit.notes
        : budget.notes,
  };
}
