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

export function cleanClientName(raw: string): string {
  if (!raw) return "";
  let cleaned = raw
    // Remove prefixes like cliente:, cliente -, o cliente, para o cliente, cliente, nome do cliente, etc.
    .replace(/^(?:(?:para\s+o|para\s+a|ao|à|do|da)?\s*(?:cliente|comprador|contratante|solicitante|paciente|aluno))\s*[:=–-]?\s*/i, "")
    .replace(/^(?:nome(?:\s+do\s+cliente)?|em\s+nome\s+de)\s*[:=–-]?\s*/i, "")
    .replace(/^(?:sr\.?|sra\.?|senhor|senhora|dr\.?|dra\.?)\s+/i, "")
    .replace(/[,\.:;].*$/, "")
    .replace(/\s+/g, " ")
    .trim();

  // If after cleaning it still starts with "cliente ", remove it
  cleaned = cleaned.replace(/^cliente\s+/i, "").trim();

  // Reject invalid names that are actually actions or phrases (e.g. "Liberado Dps...", "Voltar de Viagem")
  const lower = cleaned.toLowerCase();
  if (
    lower.startsWith("liberad") ||
    lower.startsWith("voltar") ||
    lower.startsWith("depois") ||
    lower.startsWith("dps") ||
    lower.startsWith("quando") ||
    lower.startsWith("pagar") ||
    lower.startsWith("orçamento") ||
    lower.startsWith("serviço")
  ) {
    return "";
  }

  if (!cleaned) return "";

  const words = cleaned.split(" ").filter(Boolean);
  const titleWords = words.map((w) => {
    const lw = w.toLowerCase();
    if (["de", "da", "do", "dos", "das", "e"].includes(lw)) return lw;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });

  return titleWords.join(" ");
}

export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return raw;
}

export function formatCpf(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return raw;
}

export function formatCnpj(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return raw;
}

export function smartParseBudget(
  rawText: string,
  category?: string,
  clientNameSuggestion?: string,
  _companyNameSuggestion?: string
): ParsedBudget {
  const text = (rawText || "").trim();

  // 1. Phone extraction - ONLY if clearly present
  let detectedPhone = "";
  const phonePattern = /(?:(?:zap|whats|whatsapp|fone|celular|tel|telefone)\s*[:=]?\s*)?(?:\+?55\s*)?(?:\(?([1-9]{2})\)?\s*)?(9?\d{4})[-.\s]?(\d{4})/i;
  const phoneMatch = text.match(phonePattern);
  if (phoneMatch) {
    const rawDigits = (phoneMatch[1] ? phoneMatch[1] : "") + phoneMatch[2] + phoneMatch[3];
    // Check that it's genuinely a phone number (10 or 11 digits)
    if (rawDigits.length === 10 || rawDigits.length === 11) {
      detectedPhone = formatPhone(rawDigits);
    }
  }

  // Remove phone to avoid false matching as CPF/CNPJ or price
  const textNoPhone = detectedPhone ? text.replace(phonePattern, " ") : text;

  // 2. CPF / CNPJ extraction - ONLY if explicitly mentioned or matches format
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

  // 3. Observations extraction (obs:, observação:, observacao:, nota:, etc.)
  let detectedObs = "";
  const obsMatch =
    text.match(/(?:(?:obs|observação|observacao|observações|observacoes|nota|aviso|detalhe)\s*[:=]\s*)(.+?)(?=\s*(?:cliente|telefone|tel|cpf|cnpj|serviço|servico|valor|r\$|prazo|\.|$))/i) ||
    text.match(/(?:(?:obs|observação|observacao)\s*[:=]\s*)(.+)$/i);
  if (obsMatch && obsMatch[1]) {
    detectedObs = obsMatch[1].trim().replace(/[-–,]+$/, "");
    detectedObs = detectedObs.charAt(0).toUpperCase() + detectedObs.slice(1);
  }

  // 4. Address extraction - ONLY if explicitly stated
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

  // 5. Client Name extraction - ONLY if explicitly marked with "cliente", "nome", etc.
  let detectedClient = clientNameSuggestion ? cleanClientName(clientNameSuggestion) : "";
  if (!detectedClient) {
    const clientMatch = text.match(
      /(?:(?:cliente|nome(?:\s+do\s+cliente)?|em\s+nome\s+de|para\s+o|para\s+a)\s*[:=]?\s*)([A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]+?)(?=\s*(?:,|telefone|tel|celular|zap|whatsapp|cpf|cnpj|endereço|endreço|endereco|serviço|servico|valor|r\$|\d+\s*(?:reais|r\$)|prazo|obs|\.|$))/i
    );
    if (clientMatch && clientMatch[1]) {
      detectedClient = cleanClientName(clientMatch[1].trim());
    }
  }

  // 6. Service extraction - ONLY if explicitly marked or typed
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

  // 7. Price extraction - ONLY if a real monetary amount is found
  let detectedPrice = 0;
  const priceMatch =
    text.match(/(?:r\$|valor\s*[:=]?\s*r\$?|por)?\s*([0-9]+(?:[\.,][0-9]{2})?)\s*(?:reais|r\$)/i) ||
    text.match(/(?:valor|preço|preco)\s*[:=]?\s*(?:r\$)?\s*([0-9]+(?:[\.,][0-9]{2})?)/i);
  if (priceMatch && priceMatch[1]) {
    detectedPrice = parseFloat(priceMatch[1].replace(",", "."));
  } else {
    // Look for standalone numbers that are not phone, CPF, or year
    let textForPrice = textNoPhone;
    if (detectedDocument) {
      textForPrice = textForPrice.replace(
        new RegExp(detectedDocument.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "g"),
        " "
      );
    }
    const numRegex = /\b([1-9][0-9]*(?:[\.,][0-9]{2})?)\b(?!\s*(?:dias|horas|semanas|meses|anos|btus|x|vezes|unidades|peças|km))/gi;
    let nm: RegExpExecArray | null;
    const candidates: number[] = [];
    while ((nm = numRegex.exec(textForPrice)) !== null) {
      const val = parseFloat(nm[1].replace(",", "."));
      if (val >= 10 && val !== 2025 && val !== 2026 && val < 500000) {
        candidates.push(val);
      }
    }
    if (candidates.length > 0) {
      detectedPrice = candidates[candidates.length - 1];
    }
  }

  // 8. Prazo extraction - ONLY if explicitly in text
  let detectedPrazo = "";
  const prazoMatch = text.match(
    /(?:prazo(?:\s+de\s+entrega)?|entrega|conclusão)(?:\s+em|\s+de)?\s*[:=]?\s*(\d+\s*(?:dias\s*úteis|dias|horas|semanas|meses))/i
  );
  if (prazoMatch && prazoMatch[1]) {
    detectedPrazo = prazoMatch[1].trim();
  }

  // 9. Payment terms & notes - ONLY from what was said
  let paymentTerms = "";
  let notes = "";

  if (detectedObs) {
    notes = detectedObs;
    const obsLower = detectedObs.toLowerCase();
    if (
      obsLower.includes("pagar") ||
      obsLower.includes("venda") ||
      obsLower.includes("quando") ||
      obsLower.includes("após") ||
      obsLower.includes("depois")
    ) {
      paymentTerms = detectedObs;
    }
  }

  // Check for explicit payment method mentions
  const payMatch = text.match(/(?:pagamento|forma\s+de\s+pagamento|condição)\s*[:=]?\s*([^,\.]+)/i);
  if (payMatch && payMatch[1]) {
    paymentTerms = payMatch[1].trim();
  }

  // 10. Validity days - ONLY if explicitly specified
  let validityDays: number | null = null;
  const valMatch = text.match(/(?:validade(?:\s+da\s+proposta)?|válido\s+por)\s*[:=]?\s*(\d+)\s*dias?/i);
  if (valMatch && valMatch[1]) {
    validityDays = parseInt(valMatch[1], 10);
  }

  // 11. Specific fields: only add fields if values actually exist
  const categorySpecificFields: CategorySpecificField[] = [];
  if (detectedPrazo) {
    categorySpecificFields.push({
      key: "prazo",
      label: "Prazo de Entrega",
      value: detectedPrazo,
    });
  }

  const resolvedCategory = category || "Serviços";
  const itemName = detectedService || (text.length > 0 && text.length < 60 ? text : "Serviço Prestado");

  const items: ParsedItem[] = [
    {
      id: `item-${Date.now()}-1`,
      name: itemName,
      description: "", // Do NOT invent fake descriptions
      quantity: 1,
      unitPrice: detectedPrice,
      totalPrice: detectedPrice,
    },
  ];

  return {
    title: itemName ? `Orçamento de ${itemName}` : "Orçamento",
    category: resolvedCategory,
    client: {
      name: detectedClient, // Leave completely empty if not mentioned!
      phone: detectedPhone, // Leave completely empty if not mentioned!
      email: "",
      document: detectedDocument, // Leave completely empty if not mentioned!
      address: detectedAddress, // Leave completely empty if not mentioned!
    },
    categorySpecificFields,
    items,
    subtotal: detectedPrice,
    discount: 0,
    total: detectedPrice,
    paymentTerms, // Empty if not spoken
    validityDays, // Empty / null if not spoken
    notes, // Empty if no obs spoken
  };
}
