/** Duração padrão aplicada quando a empresa não informa o tempo do serviço. */
export const DEFAULT_DURATION_MIN = 30;

/**
 * Rótulo de duração. Quando o serviço usa o padrão (não informado),
 * retorna null para não exibir nada na interface.
 */
export function durationLabel(min?: number | null): string | null {
  if (!min || min === DEFAULT_DURATION_MIN) return null;
  return `${min}min`;
}
