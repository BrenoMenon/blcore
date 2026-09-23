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
  validityDays: number;
  notes: string;
}

export function cleanClientName(raw: string): string {
  if (!raw) return "Cliente";
  let cleaned = raw
    .replace(/^(?:cliente|nome(?:\s+do\s+cliente)?|para\s+o|para\s+a)\s*[:=]?\s*/i, "")
    .replace(/[,\.:;].*$/, "")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ").filter(Boolean);
  const titleWords = words.map((w) => {
    const lw = w.toLowerCase();
    if (["de", "da", "do", "dos", "das", "e"].includes(lw)) return lw;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });

  return titleWords.join(" ") || "Cliente";
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
      "orçamento",
      "orcamento",
      "quero",
      "fazer",
      "criar",
      "serviço",
      "servico",
      "olá",
      "ola",
      "bom",
      "boa",
      "por",
      "favor",
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
      itemDesc =
        "Desenvolvimento completo de landing page responsiva, personalizada com inteligência artificial, design moderno e otimizado para conversão.";
      resolvedCategory = "Web & Tecnologia";
      platformValue = "Landing Page Responsiva com IA";
    } else if (
      lower.includes("social") ||
      lower.includes("instagram") ||
      lower.includes("mídia") ||
      lower.includes("midia")
    ) {
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
    if (
      itemName.toLowerCase().includes("landing") ||
      itemName.toLowerCase().includes("site") ||
      itemName.toLowerCase().includes("ia")
    ) {
      itemDesc =
        "Desenvolvimento completo com design moderno, responsividade mobile, integração de inteligência artificial e foco em conversão de leads.";
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
      name: detectedClient || "Cliente",
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
