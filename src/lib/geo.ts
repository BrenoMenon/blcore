export type ReverseGeo = {
  address: string | null;
  city: string | null;
  state: string | null;
};

const UF: Record<string, string> = {
  Acre: "AC", Alagoas: "AL", Amapá: "AP", Amazonas: "AM", Bahia: "BA", Ceará: "CE",
  "Distrito Federal": "DF", "Espírito Santo": "ES", Goiás: "GO", Maranhão: "MA",
  "Mato Grosso": "MT", "Mato Grosso do Sul": "MS", "Minas Gerais": "MG", Pará: "PA",
  Paraíba: "PB", Paraná: "PR", Pernambuco: "PE", Piauí: "PI", "Rio de Janeiro": "RJ",
  "Rio Grande do Norte": "RN", "Rio Grande do Sul": "RS", Rondônia: "RO", Roraima: "RR",
  "Santa Catarina": "SC", "São Paulo": "SP", Sergipe: "SE", Tocantins: "TO",
};

/** Geocodificação reversa gratuita via OpenStreetMap Nominatim */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeo> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=pt-BR`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Não foi possível localizar o endereço");
  const json = (await res.json()) as {
    address?: Record<string, string>;
  };
  const a = json.address ?? {};
  const street = a["road"] ?? a["pedestrian"] ?? a["neighbourhood"] ?? null;
  const number = a["house_number"] ?? null;
  const address = street ? [street, number].filter(Boolean).join(", ") : null;
  const city = a["city"] ?? a["town"] ?? a["village"] ?? a["municipality"] ?? a["suburb"] ?? null;
  const stateName = a["state"] ?? null;
  const state = stateName ? (UF[stateName] ?? stateName.slice(0, 2).toUpperCase()) : null;
  return { address, city, state };
}
export type CepResult = {
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
};

/** Busca endereço pelo CEP (ViaCEP, gratuito) */
export async function lookupCep(rawCep: string): Promise<CepResult> {
  const cep = rawCep.replace(/\D/g, "");
  if (cep.length !== 8) throw new Error("CEP inválido");
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!res.ok) throw new Error("Não foi possível consultar o CEP");
  const json = (await res.json()) as {
    erro?: boolean | string;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
  };
  if (json.erro) throw new Error("CEP não encontrado");
  return {
    address: json.logradouro || null,
    neighborhood: json.bairro || null,
    city: json.localidade || null,
    state: json.uf || null,
  };
}

/** Converte um endereço em coordenadas (Nominatim, gratuito) */
export async function geocodeAddress(parts: {
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
}): Promise<{ lat: number; lng: number } | null> {
  const q = [parts.address, parts.neighborhood, parts.city, parts.state, parts.cep, "Brasil"]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(", ");
  if (!q) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=pt-BR&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const json = (await res.json()) as { lat: string; lon: string }[];
  const hit = json[0];
  if (!hit) return null;
  return { lat: Number(hit.lat), lng: Number(hit.lon) };
}

/** Máscara de CEP: 01310-100 */
export function formatCep(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
