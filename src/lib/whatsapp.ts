export function normalizeWhatsApp(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // Assume BR se veio sem DDI e for 10-11 dígitos
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

export function whatsappUrl(number: string, message?: string): string | null {
  const n = normalizeWhatsApp(number);
  if (!n) return null;
  const base = `https://wa.me/${n}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function openWhatsApp(number?: string | null, message?: string): boolean {
  if (!number) return false;
  const url = whatsappUrl(number, message);
  if (!url) return false;
  if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
