export const currency = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));

export const fmtDate = (d: Date | string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));

export const fmtTime = (d: Date | string) =>
  new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(d));

export const fmtDateTime = (d: Date | string) => `${fmtDate(d)} ${fmtTime(d)}`;

export const initials = (name?: string | null) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
};

export const statusLabel: Record<string, string> = {
  pending: "Pendente",
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_progress: "Em atendimento",
  completed: "Finalizado",
  cancelled: "Cancelado",
  declined: "Recusado",
};

export const statusColor: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-200 border-amber-500/40",
  scheduled: "bg-slate-500/15 text-slate-700 dark:text-slate-200 border-slate-500/40",
  confirmed: "bg-sky-500/15 text-sky-700 dark:text-sky-200 border-sky-500/40",
  in_progress: "bg-amber-500/20 text-amber-700 dark:text-amber-200 border-amber-500/40",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-500/40",
  cancelled: "bg-rose-500/15 text-rose-700 dark:text-rose-200 border-rose-500/40",
  declined: "bg-rose-500/15 text-rose-700 dark:text-rose-200 border-rose-500/40",
};