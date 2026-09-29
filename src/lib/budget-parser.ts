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

const STOP_AFTER_VALUE = /(?=\s*(?:;|\.|,\s*(?:com|sem|valor|pagamento|prazo|pendente|obs|observa)|$))/i;

function sentenceCase(value: string): string {
  const clean = value.replace(/\s+/g, " ").replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, "").trim();
  if (!clean) return "";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function parseBrazilianMoney(raw: string): number {
  const normalized = raw.trim().replace(/\s/g, "");
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
  const cnpj = text.match(/(?:cnpj)\s*[:=]?\s*([0-9.\/-]{14,18})/i) ?? text.match(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/);
  if (cnpj?.[1]) return formatCnpj(cnpj[1]);
  const cpf = text.match(/(?:cpf|documento|doc)\s*[:=]?\s*([0-9.-]{11,14})/i) ?? text.match(/\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/);
  return cpf?.[1] ? formatCpf(cpf[1]) : "";
}

function extractPhone(text: string, document: string): string {
  const labeled = text.match(/(?:telefone|tel|celular|whats(?:app)?|zap|fone|contato)\s*[:=]?\s*(?:\+?55\s*)?(\(?\d{2}\)?\s*9?\d{4}[-.\s]?\d{4})/i);
  const formatted = text.match(/\(?([1-9]{2})\)?\s*(9?\d{4})[-.\s](\d{4})/);
  const candidate = labeled?.[1] ?? (formatted ? `${formatted[1]}${formatted[2]}${formatted[3]}` : "");
  const digits = candidate.replace(/\D/g, "");
  return digits && digits !== document.replace(/\D/g, "") ? formatPhone(digits) : "";
}

function extractClient(text: string, suggestion?: string): string {
  if (suggestion) {
    const suggested = cleanClientName(suggestion);
    if (suggested) return suggested;
  }
  const patterns = [
    /(?:para\s+(?:o|a)\s+cliente|cliente|nome\s+do\s+cliente|em\s+nome\s+de)\s*[:=]?\s*([\p{L}][\p{L}'-]*(?:\s+(?:de|da|do|dos|das|e|[\p{L}][\p{L}'-]*)){0,4})(?=\s*(?:\(|,|;|\.|cpf|cnpj|telefone|valor|pagamento|prazo|pendente|$))/iu,
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
  const match = text.match(new RegExp(`(?:endereço|endereco|cidade|localização|localizacao|reside em|mora em)\\s*[:=]?\\s*([^,;]+?)${STOP_AFTER_VALUE.source}`, "i"));
  return sentenceCase(match?.[1] ?? "");
}

function extractService(text: string): string {
  const explicit = text.match(/((?:cria[cç][aã]o|desenvolvimento|produ[cç][aã]o|instala[cç][aã]o|manuten[cç][aã]o|reforma|consultoria|gest[aã]o|design|servi[cç]o)\s+de\s+.+?)(?=\s+para\s+(?:o|a)\s+cliente|\s+cliente\s|\s*\(|\s*;|\s*,\s*(?:valor|pagamento|prazo|pendente)|\s+valor\s+total|$)/i);
  if (explicit?.[1]) return sentenceCase(explicit[1]);
  const known = text.match(/(?:landing\s+page|site\s+institucional|loja\s+virtual|e-commerce|identidade\s+visual|social\s+media|tr[aá]fego\s+pago)/i);
  return known?.[0] ? sentenceCase(known[0]) : "Serviço Prestado";
}

function extractTotal(text: string): number {
  const prioritized = [
    /valor\s+total\s+(?:de\s+)?r\$\s*([\d.]+(?:,\d{1,2})?)/i,
    /total\s+(?:de\s+)?r\$\s*([\d.]+(?:,\d{1,2})?)/i,
    /(?:valor|por)\s*[:=]?\s*r\$\s*([\d.]+(?:,\d{1,2})?)/i,
    /r\$\s*([\d.]+(?:,\d{1,2})?)/i,
  ];
  for (const pattern of prioritized) {
    const match = text.match(pattern);
    if (match?.[1]) return parseBrazilianMoney(match[1]);
  }
  return 0;
}

function extractPayment(text: string): string {
  const payment = text.match(/(?:pagamento|forma\s+de\s+pagamento|condi[cç][aã]o(?:\s+de\s+pagamento)?)\s*[:=]?\s*(.+?)(?=\s*(?:;|\.(?:\s|$)|,\s*(?:prazo|pendente|obs|observa)|$))/i);
  if (payment?.[1]) return sentenceCase(payment[1]);
  const methods = text.match(/(?:pix|boleto|cart[aã]o|dinheiro)(?:\s*(?:,|ou|e)\s*(?:pix|boleto|cart[aã]o|dinheiro))+/i);
  return methods?.[0] ? sentenceCase(methods[0]) : "";
}

function extractDeadline(text: string): string {
  const deadline = text.match(/(?:prazo(?:\s+cr[ií]tico)?|entrega|conclus[aã]o)\s*[:=]?\s*(?:para\s+)?(.+?)(?=\s*(?:;|\.|,\s*(?:pendente|obs|observa)|$))/i);
  return sentenceCase(deadline?.[1] ?? "");
}

function extractNotes(text: string): string {
  const notes: string[] = [];
  const pending = text.match(/(?:pendente(?:s)?\s+de?|faltando|aguardando)\s+(.+?)(?=\s*(?:;|\.|$))/i);
  if (pending?.[1]) notes.push(`Pendente de ${pending[1].trim()}`);
  const observation = text.match(/(?:obs(?:erva[cç][aã]o|erva[cç][oõ]es)?|nota|aviso)\s*[:=]\s*(.+?)(?=\s*(?:;|\.|$))/i);
  if (observation?.[1]) notes.push(observation[1].trim());
  return notes.map(sentenceCase).filter(Boolean).join(". ");
}

function extractItemDescription(text: string): string {
  const details: string[] = [];
  const includes = text.match(/\(([^)]*(?:m[aã]o\s+de\s+obra|design|taxa|material|desconto)[^)]*)\)/i);
  if (includes?.[1]) details.push(includes[1].trim());
  if (/desconto\s+inclu[ií]do/i.test(text) && !details.some((value) => /desconto\s+inclu[ií]do/i.test(value))) {
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
  const text = (rawText || "").replace(/\s+/g, " ").trim();
  const document = extractDocument(text);
  const phone = extractPhone(text, document);
  const clientName = extractClient(text, clientNameSuggestion);
  const serviceName = extractService(text);
  const total = extractTotal(text);
  const deadline = extractDeadline(text);
  const notes = extractNotes(text);
  const item: ParsedItem = {
    id: `item-${Date.now()}-1`,
    name: serviceName,
    description: extractItemDescription(text),
    quantity: 1,
    unitPrice: total,
    totalPrice: total,
  };

  return {
    title: serviceName === "Serviço Prestado" ? "Orçamento de Serviços" : `Orçamento de ${serviceName}`,
    category: category || "Serviços",
    client: {
      name: clientName,
      phone,
      email: text.match(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/)?.[0] ?? "",
      document,
      address: extractAddress(text),
    },
    categorySpecificFields: deadline ? [{ key: "deadline", label: "Prazo", value: deadline }] : [],
    items: [item],
    subtotal: total,
    discount: 0,
    total,
    paymentTerms: extractPayment(text),
    validityDays: null,
    notes,
  };
}
