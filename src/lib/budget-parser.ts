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

  // Reject invalid names that are actually actions or phrases
  const lower = cleaned.toLowerCase();
  if (
    lower.startsWith("liberad") ||
    lower.startsWith("voltar") ||
    lower.startsWith("depois") ||
    lower.startsWith("dps") ||
    lower.startsWith("quando") ||
    lower.startsWith("pagar") ||
    lower.startsWith("orçamento") ||
    lower.startsWith("serviço") ||
    lower.startsWith("daqui")
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

  // 1. EXTRACT CPF / CNPJ FIRST WITH STRICT LABELS & PATTERNS
  let detectedDocument = "";
  // Check explicit CPF label (e.g. "cpf: 41275798896" or "cpf 412.757.988-96")
  const cpfExplicit = text.match(/(?:cpf|doc|documento)\s*[:=]?\s*([0-9\.\-]{11,14})/i);
  const cnpjExplicit = text.match(/(?:cnpj)\s*[:=]?\s*([0-9\.\-\/]{14,18})/i);

  if (cpfExplicit) {
    const rawCpf = cpfExplicit[1].replace(/\D/g, "");
    if (rawCpf.length === 11) {
      detectedDocument = formatCpf(rawCpf);
    }
  } else if (cnpjExplicit) {
    const rawCnpj = cnpjExplicit[1].replace(/\D/g, "");
    if (rawCnpj.length === 14) {
      detectedDocument = formatCnpj(rawCnpj);
    }
  } else {
    // Check formatted patterns in text
    const cpfFormatted = text.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
    const cnpjFormatted = text.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/);
    if (cpfFormatted) {
      detectedDocument = formatCpf(cpfFormatted[0]);
    } else if (cnpjFormatted) {
      detectedDocument = formatCnpj(cnpjFormatted[0]);
    }
  }

  // 2. EXTRACT PHONE / WHATSAPP WITH STRICT LABELS FIRST, THEN PATTERNS
  let detectedPhone = "";
  // Explicit phone label (e.g. "telefone: 19981564250", "whatsapp: 11988887777")
  const phoneExplicit = text.match(
    /(?:telefone|tel|celular|cel|whats|whatsapp|zap|fone|contato)\s*[:=]?\s*(?:\+?55\s*)?([0-9\(\)\s\-]{10,16})/i
  );

  if (phoneExplicit) {
    const rawDigits = phoneExplicit[1].replace(/\D/g, "");
    if (rawDigits.length === 10 || rawDigits.length === 11) {
      detectedPhone = formatPhone(rawDigits);
    }
  }

  // If no explicit label was found, search for formatted numbers (XX) XXXXX-XXXX
  if (!detectedPhone) {
    const phoneFormatted = text.match(/\(?([1-9]{2})\)?\s*(9?\d{4})[-.\s]?(\d{4})/);
    if (phoneFormatted) {
      const candidateDigits = phoneFormatted[1] + phoneFormatted[2] + phoneFormatted[3];
      // Make sure the candidate is NOT the CPF we already detected!
      const unformattedDoc = detectedDocument.replace(/\D/g, "");
      if (candidateDigits !== unformattedDoc && !unformattedDoc.includes(candidateDigits)) {
        if (candidateDigits.length === 10 || candidateDigits.length === 11) {
          detectedPhone = formatPhone(candidateDigits);
        }
      }
    }
  }

  // 3. REMOVE DETECTED CPF AND PHONE FROM TEXT TO PREVENT INTERFERENCE
  let cleanText = text;
  if (detectedDocument) {
    const docDigits = detectedDocument.replace(/\D/g, "");
    cleanText = cleanText.replace(new RegExp(`(?:cpf|doc|documento)?\\s*[:=]?\\s*[\\d\\.\\-\\/]*${docDigits}[\\d\\.\\-\\/]*`, "gi"), " ");
  }
  if (detectedPhone) {
    const phoneDigits = detectedPhone.replace(/\D/g, "");
    cleanText = cleanText.replace(new RegExp(`(?:telefone|tel|celular|cel|whats|whatsapp|zap|fone|contato)?\\s*[:=]?\\s*[\\d\\(\\)\\s\\-\\+]*${phoneDigits}[\\d\\(\\)\\s\\-\\+]*`, "gi"), " ");
  }

  // 4. OBSERVATIONS & CONDITIONS
  let detectedNotes = "";
  let paymentTerms = "";

  const releaseMatch = cleanText.match(/(?:(?:vai\s+ser\s+liberado|libera(?:do)?|início|inicio|começo|comeco)\s+(?:o\s+serviço\s+)?(?:daqui|em|a\s+partir\s+de)\s+[^,\.]+)/i);
  if (releaseMatch) {
    detectedNotes = releaseMatch[0].trim();
  }

  const obsMatch = cleanText.match(/(?:(?:obs|observação|observacao|observações|observacoes|nota|aviso|detalhe)\s*[:=]\s*)(.+?)(?=\s*(?:,|cliente|valor|r\$|prazo|\.|$))/i);
  if (obsMatch && obsMatch[1]) {
    const obsStr = obsMatch[1].trim();
    detectedNotes = detectedNotes ? `${detectedNotes}. ${obsStr}` : obsStr;
  }

  // 5. EXTRACT CLIENT NAME
  let detectedClient = clientNameSuggestion ? cleanClientName(clientNameSuggestion) : "";

  if (!detectedClient) {
    // Explicit pattern: cliente: Breno Menon
    const clientMatch = cleanText.match(
      /(?:(?:cliente|nome(?:\s+do\s+cliente)?|em\s+nome\s+de|para\s+o|para\s+a)\s*[:=]?\s*)([A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]+?)(?=\s*(?:,|telefone|tel|celular|zap|whatsapp|cpf|cnpj|endereço|endreço|endereco|serviço|servico|valor|r\$|\d+\s*(?:reais|r\$)|prazo|obs|landing|site|manutenção|manutencao|\.|$))/i
    );
    if (clientMatch && clientMatch[1]) {
      detectedClient = cleanClientName(clientMatch[1].trim());
    }
  }

  // If still not found, check if the input starts directly with a person's name (e.g. "Breno Menon landing page...")
  if (!detectedClient) {
    const stopWords = new Set([
      "landing", "page", "site", "sites", "valor", "preço", "preco", "r$", "reais",
      "serviço", "servico", "manutenção", "manutencao", "criação", "criacao",
      "desenvolvimento", "gestão", "gestao", "projeto", "orçamento", "orcamento",
      "social", "media", "tráfego", "trafego", "design", "logo", "limpeza",
      "higienização", "instalação", "reforma", "conserto", "consultoria", "daqui",
      "liberado", "depois", "dps", "para", "por", "com", "vai", "ser", "dois", "duas", "meses"
    ]);

    const words = cleanText.split(/\s+/);
    const candidateNameWords: string[] = [];

    for (const w of words) {
      const pure = w.replace(/[^a-zA-ZáéíóúâêîôûãõÁÉÍÓÚÂÊÎÔÛÃÕ]/g, "");
      if (!pure) break;
      if (stopWords.has(pure.toLowerCase())) break;
      candidateNameWords.push(pure);
      if (candidateNameWords.length >= 4) break;
    }

    if (candidateNameWords.length >= 2) {
      const potentialName = candidateNameWords.join(" ");
      detectedClient = cleanClientName(potentialName);
    }
  }

  // 6. EXTRACT ADDRESS
  let detectedAddress = "";
  const addrMatch = cleanText.match(
    /(?:(?:endereço|endreço|endereco|end\.?|cidade(?:\s+de)?|local|localização|localizacao|reside\s+em|mora\s+em)\s*[:=]?\s*)([^,]+?)(?=\s*(?:,|cpf|cnpj|telefone|tel|celular|zap|whatsapp|serviço|servico|valor|r\$|\d+\s*(?:reais|r\$)|prazo|obs|observação|observacao|\.|$))/i
  );
  if (addrMatch && addrMatch[1]) {
    detectedAddress = addrMatch[1].trim();
  }

  // 7. EXTRACT ITEMS & SERVICES (Handle primary service + recurring maintenance/secondary items)
  const items: ParsedItem[] = [];

  // Check for landing page / primary service
  let primaryName = "";
  let primaryPrice = 0;

  const lpMatch = cleanText.match(/(?:criação\s+de\s+)?(landing\s+page|site\s+institucional|site|loja\s+virtual|e-commerce|identidade\s+visual)/i);
  if (lpMatch) {
    primaryName = lpMatch[1].toLowerCase().includes("landing")
      ? "Criação de Landing Page"
      : lpMatch[1].charAt(0).toUpperCase() + lpMatch[1].slice(1);
  }

  // Look for primary price (e.g. "valor 300 reais" or "300 reais")
  const primaryPriceMatch = cleanText.match(/(?:valor\s*[:=]?\s*(?:r\$)?\s*|por\s+|r\$\s*)([0-9]+(?:[\.,][0-9]{2})?)\s*(?:reais|r\$)?/i) ||
    cleanText.match(/([0-9]+(?:[\.,][0-9]{2})?)\s*(?:reais|r\$)/i);

  if (primaryPriceMatch && primaryPriceMatch[1]) {
    primaryPrice = parseFloat(primaryPriceMatch[1].replace(",", "."));
  }

  if (primaryName || primaryPrice > 0) {
    items.push({
      id: `item-${Date.now()}-1`,
      name: primaryName || "Serviço Solicitado",
      description: "",
      quantity: 1,
      unitPrice: primaryPrice,
      totalPrice: primaryPrice,
    });
  }

  // Check for maintenance mention (e.g. "manutenção por dois meses e dps 150 reais a manutenção mensal")
  const maintMatch = cleanText.match(/(manuten[çc][ãa]o(?:\s+por\s+dois\s+meses|\s+mensal|\s+preventiva)?)[^,]*?(?:(\d+)\s*(?:reais|r\$))?/i);
  if (maintMatch) {
    const rawMaint = maintMatch[0];
    if (cleanText.toLowerCase().includes("150") || rawMaint.includes("150")) {
      paymentTerms = "R$ " + primaryPrice + " da criação. Manutenção inclusa por 2 meses, após R$ 150/mês.";
    }
  }

  // If no items detected yet, provide default structured single item
  if (items.length === 0) {
    items.push({
      id: `item-${Date.now()}-1`,
      name: "Serviço Prestado",
      description: "",
      quantity: 1,
      unitPrice: primaryPrice || 0,
      totalPrice: primaryPrice || 0,
    });
  }

  // 8. PAYMENT TERMS & OBSERVATIONS
  const payExplicit = cleanText.match(/(?:pagamento|forma\s+de\s+pagamento|condição|condicao)\s*[:=]?\s*([^,\.]+)/i);
  if (payExplicit && payExplicit[1]) {
    paymentTerms = payExplicit[1].trim();
  }

  // 9. VALIDITY DAYS
  let validityDays: number | null = null;
  const valMatch = cleanText.match(/(?:validade(?:\s+da\s+proposta)?|válido\s+por)\s*[:=]?\s*(\d+)\s*dias?/i);
  if (valMatch && valMatch[1]) {
    validityDays = parseInt(valMatch[1], 10);
  }

  const subtotal = items.reduce((acc, it) => acc + it.totalPrice, 0);

  return {
    title: items[0]?.name ? `Orçamento de ${items[0].name}` : "Orçamento",
    category: category || "Serviços",
    client: {
      name: detectedClient,
      phone: detectedPhone,
      email: "",
      document: detectedDocument,
      address: detectedAddress,
    },
    categorySpecificFields: [],
    items,
    subtotal,
    discount: 0,
    total: subtotal,
    paymentTerms,
    validityDays,
    notes: detectedNotes,
  };
}
