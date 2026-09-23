export type CompanyPin = {
  id: string;
  name: string;
  category: string | null;
  custom_category: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  address_number: string | null;
  address_complement: string | null;
  neighborhood: string | null;
  bio: string | null;
  avatar_url: string | null;
  whatsapp: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
};

export const COMPANY_CATEGORIES = [
  "Barbearia",
  "Salão de beleza",
  "Estética",
  "Saúde",
  "Consultoria",
  "Fitness",
  "Pet",
  "Outros",
] as const;

/** Valor sentinela do select quando a empresa quer escrever a própria categoria. */
export const CUSTOM_CATEGORY = "__custom__";

/** Categoria exibida ao cliente (usa a personalizada quando existir). */
export function displayCategory(
  c: { category: string | null; custom_category?: string | null } | null | undefined,
): string | null {
  if (!c) return null;
  return c.custom_category?.trim() || c.category || null;
}

/** Endereço completo: rua, número - complemento, bairro, cidade - UF */
export function fullAddress(c: {
  address?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}): string {
  const street = [c.address, c.address_number].map((v) => v?.trim()).filter(Boolean).join(", ");
  const line1 = [street, c.address_complement?.trim()].filter(Boolean).join(" - ");
  const city = [c.city?.trim(), c.state?.trim()].filter(Boolean).join(" - ");
  return [line1, c.neighborhood?.trim(), city].filter(Boolean).join(", ");
}

/** Categoria curta (1 palavra-chave) para badges — evita quebra de layout no mobile. */
export function shortCategory(
  c: { category: string | null; custom_category?: string | null } | null | undefined,
): string | null {
  const full = displayCategory(c);
  if (!full) return null;
  const word = full.trim().split(/[\s,/|-]+/)[0] ?? full;
  return word.length > 14 ? `${word.slice(0, 13)}…` : word;
}
