/**
 * Duração padrão: serviços não têm tempo obrigatório.
 * Vazio ou 0 = sem duração fixa / a combinar / projeto / mais de um dia.
 */
export const DEFAULT_DURATION_MIN = 0;

/**
 * Retorna rótulo amigável para serviços que possuem tempo definido.
 * Retorna null se não houver duração ou se for 0/a combinar.
 */
export function durationLabel(min?: number | null): string | null {
  if (!min || min <= 0) return null;
  if (min < 60) return `${min}min`;
  if (min === 60) return "1h";
  if (min % 60 === 0 && min < 1440) return `${min / 60}h`;
  if (min < 1440) return `${Math.floor(min / 60)}h ${min % 60}min`;
  const days = Math.round(min / 1440);
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

/**
 * Detecta se o serviço é flexível (sem horário/duração fixa, projeto ou vários dias),
 * protegendo também serviços previamente gravados com 30min devido ao antigo comportamento padrão.
 */
export function isFlexibleService(serviceName?: string | null, min?: number | null): boolean {
  if (!min || min <= 0) return true;
  if (min === 30 && serviceName) {
    const s = serviceName.toLowerCase();
    if (
      s.includes("marketing") ||
      s.includes("rede") ||
      s.includes("landing") ||
      s.includes("software") ||
      s.includes("site") ||
      s.includes("social media") ||
      s.includes("consultoria") ||
      s.includes("gestão") ||
      s.includes("projeto") ||
      s.includes("design") ||
      s.includes("artes") ||
      s.includes("campanha")
    ) {
      return true;
    }
  }
  return false;
}

export function displayDurationLabel(min?: number | null, serviceName?: string | null): string | null {
  if (isFlexibleService(serviceName, min)) return null;
  return durationLabel(min);
}

