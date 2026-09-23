import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CalendarPlus, ChevronLeft, ChevronRight, Loader2, Phone, Search } from "lucide-react";
import { addDays, addMonths, addWeeks, endOfDay, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { statusColor, statusLabel, fmtTime } from "@/lib/format";
import type { Tables, Enums } from "@/integrations/supabase/types";
import { Skeleton } from "@/components/ui/skeleton";
import { openWhatsApp } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { useT } from "@/lib/i18n";
import { durationLabel } from "@/lib/duration";

export const Route = createFileRoute("/_authenticated/appointments")({
  component: AppointmentsPage,
});

type ViewMode = "day" | "week" | "month";
type ApptRow = Tables<"appointments"> & {
  clients?: { name: string; whatsapp: string | null; phone: string | null } | null;
  services?: { name: string; color: string | null; duration_min: number; price: number } | null;
};

function AppointmentsPage() {
  const t = useT();
  const { userId } = Route.useRouteContext();
  const [view, setView] = useState<ViewMode>("week");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; editing?: ApptRow | null; initial?: Date }>({ open: false });

  const range = useMemo(() => {
    if (view === "day") return { start: startOfDay(cursor), end: endOfDay(cursor) };
    if (view === "week") return { start: startOfWeek(cursor, { weekStartsOn: 1 }), end: endOfWeek(cursor, { weekStartsOn: 1 }) };
    return { start: startOfMonth(cursor), end: endOfMonth(cursor) };
  }, [view, cursor]);

  const { data, isLoading } = useQuery({
    queryKey: ["appointments", userId, range.start.toISOString(), range.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, clients(name, whatsapp, phone), services(name, color, duration_min, price)")
        .eq("user_id", userId)
        .gte("starts_at", range.start.toISOString())
        .lte("starts_at", range.end.toISOString())
        .order("starts_at");
      if (error) throw error;
      return data as unknown as ApptRow[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter((a) => {
      return (a.clients?.name ?? "").toLowerCase().includes(q) || (a.services?.name ?? "").toLowerCase().includes(q);
    });
  }, [data, search]);

  const label = view === "month"
    ? format(cursor, "MMMM 'de' yyyy", { locale: ptBR })
    : view === "week"
    ? `${format(range.start, "dd MMM", { locale: ptBR })} — ${format(range.end, "dd MMM", { locale: ptBR })}`
    : format(cursor, "EEEE, dd 'de' MMMM", { locale: ptBR });
  /** Mobile (iPhone): só o nome do mês, para não quebrar o layout. */
  const labelMobile = format(view === "week" ? range.start : cursor, "MMMM", { locale: ptBR });

  function shift(dir: -1 | 1) {
    if (view === "day") setCursor((c) => addDays(c, dir));
    else if (view === "week") setCursor((c) => addWeeks(c, dir));
    else setCursor((c) => addMonths(c, dir));
  }

  return (
    <div>
      <PageHeader
        title={t("Agenda")}
        description={t("Visualize e gerencie seus agendamentos")}
        action={
          <Button onClick={() => setDialog({ open: true })} className="shadow-[var(--shadow-glow)]">
            <CalendarPlus className="mr-2 h-4 w-4" /> {t("Novo agendamento")}
          </Button>
        }
      />

      <div className="mb-4 space-y-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:space-y-0">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => shift(-1)} aria-label={t("Anterior")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button
            type="button"
            onClick={() => setCursor(new Date())}
            className="min-w-0 truncate rounded-xl border border-border bg-card/60 px-3 py-2 text-center text-sm font-semibold capitalize sm:border-0 sm:bg-transparent sm:px-1 sm:text-base"
            title={t("Voltar para hoje")}
          >
            <span className="block truncate sm:hidden">{labelMobile}</span>
            <span className="hidden truncate sm:block">{label}</span>
          </button>
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => shift(1)} aria-label={t("Próximo")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Buscar…")} className="w-full pl-9 sm:w-48" />
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <TabsList className="h-9">
              <TabsTrigger value="day" className="px-2.5 text-xs sm:px-3 sm:text-sm">{t("Dia")}</TabsTrigger>
              <TabsTrigger value="week" className="px-2.5 text-xs sm:px-3 sm:text-sm">{t("Semana")}</TabsTrigger>
              <TabsTrigger value="month" className="px-2.5 text-xs sm:px-3 sm:text-sm">{t("Mês")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {isLoading && <Skeleton className="h-96 w-full rounded-2xl" />}

      {!isLoading && view === "month" && (
        <MonthGrid cursor={cursor} items={filtered} onPick={(d) => setDialog({ open: true, initial: d })} onOpen={(a) => setDialog({ open: true, editing: a })} />
      )}
      {!isLoading && view !== "month" && (
        <AgendaList items={filtered} onOpen={(a) => setDialog({ open: true, editing: a })} />
      )}

      <ApptDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog({ open: o })}
        editing={dialog.editing ?? null}
        initial={dialog.initial}
      />
    </div>
  );
}

function AgendaList({ items, onOpen }: { items: ApptRow[]; onOpen: (a: ApptRow) => void }) {
  const t = useT();
  if (items.length === 0)
    return <div className="bl-glass grid place-items-center rounded-3xl p-12 text-center text-muted-foreground">{t("Nenhum agendamento neste período.")}</div>;
  const grouped = items.reduce<Record<string, ApptRow[]>>((acc, a) => {
    const k = format(new Date(a.starts_at), "yyyy-MM-dd");
    (acc[k] ??= []).push(a);
    return acc;
  }, {});
  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([day, list]) => (
        <div key={day}>
          <p className="mb-2 truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="sm:hidden">{format(new Date(day), "MMMM", { locale: ptBR })}</span>
            <span className="hidden sm:inline">{format(new Date(day), "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
          </p>
          <div className="space-y-2">
            {list.map((a) => (
              <ApptCard key={a.id} appt={a} onOpen={() => onOpen(a)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ApptCard({ appt, onOpen }: { appt: ApptRow; onOpen: () => void }) {
  const t = useT();
  const snap = appt as ApptRow & { client_name?: string | null; client_phone?: string | null };
  const clientName = appt.clients?.name ?? snap.client_name ?? t("Cliente");
  const zap = appt.clients?.whatsapp ?? appt.clients?.phone ?? snap.client_phone ?? null;
  const tel = appt.clients?.phone ?? appt.clients?.whatsapp ?? snap.client_phone ?? null;
  const canZap = Boolean(zap);
  const [zapOpen, setZapOpen] = useState(false);
  return (
   <>
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className="bl-glass grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl p-3 text-left transition hover:border-primary/50 sm:gap-4 sm:p-4"
    >
      <div className="w-14 text-center sm:w-16">
        <p className="text-base font-bold sm:text-lg">{fmtTime(appt.starts_at)}</p>
        <p className="text-[10px] text-muted-foreground">{appt.services?.duration_min} min</p>
      </div>
      <div className="min-w-0 border-l-2 pl-3 sm:pl-4" style={{ borderColor: appt.services?.color ?? "var(--brand-green)" }}>
        <p className="truncate font-semibold">{clientName}</p>
        <p className="truncate text-xs text-muted-foreground sm:text-sm">{appt.services?.name}</p>
        <Badge variant="outline" className={`${statusColor[appt.status]} mt-1 sm:hidden`}>{t(statusLabel[appt.status])}</Badge>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Badge variant="outline" className={`${statusColor[appt.status]} hidden sm:inline-flex`}>{t(statusLabel[appt.status])}</Badge>
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={!tel}
          onClick={(e) => { e.stopPropagation(); if (tel) window.location.href = `tel:${tel.replace(/\D/g, "")}`; }}
          title={tel ? t("Ligar para o cliente") : t("Cliente sem telefone cadastrado")}
          className="h-9 w-9 disabled:opacity-40"
          aria-label={t("Ligar para o cliente")}
        >
          <Phone className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={!canZap}
          onClick={(e) => { e.stopPropagation(); setZapOpen(true); }}
          title={canZap ? t("Enviar mensagem no WhatsApp") : t("Cliente sem número cadastrado")}
          className="h-9 w-9 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-500 dark:text-emerald-400 disabled:opacity-40"
          aria-label={t("Enviar WhatsApp")}
        >
          <WhatsAppIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
    {canZap && <WhatsAppDialog open={zapOpen} onOpenChange={setZapOpen} appt={appt} number={zap!} />}
   </>
  );
}

function WhatsAppDialog({
  open, onOpenChange, appt, number,
}: { open: boolean; onOpenChange: (o: boolean) => void; appt: ApptRow; number: string }) {
  const settings = useQuery({
    queryKey: ["settings-template"],
    queryFn: async () =>
      (await supabase.from("company_settings").select("company_name, reminder_template").maybeSingle()).data,
    enabled: open,
  });
  const t = useT();
  const [msg, setMsg] = useState("");

  const filled = useMemo(() => {
    const d = new Date(appt.starts_at);
    const tpl =
      settings.data?.reminder_template?.trim() ||
      "Olá, {nome}! 👋\nPassando para confirmar seu agendamento de {servico}.\nData: {data} — Horário: {hora}\nLocal: {empresa}\n\nQualquer coisa é só responder por aqui. ✨";
    return tpl
      .replaceAll("{nome}", appt.clients?.name ?? "")
      .replaceAll("{servico}", appt.services?.name ?? "")
      .replaceAll("{data}", format(d, "dd/MM/yyyy", { locale: ptBR }))
      .replaceAll("{hora}", format(d, "HH:mm"))
      .replaceAll("{empresa}", settings.data?.company_name ?? "BL Core Gestão");
  }, [settings.data, appt]);

  useEffect(() => {
    if (open) setMsg(filled);
  }, [open, filled]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WhatsAppIcon className="h-5 w-5 text-emerald-500" /> {t("Enviar WhatsApp")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card/60 p-3 text-sm">
            <p className="font-semibold">{appt.clients?.name}</p>
            <p className="text-muted-foreground">
              {appt.services?.name} · {format(new Date(appt.starts_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
          <div>
            <Label>{t("Mensagem (edite antes de enviar)")}</Label>
            <Textarea rows={8} value={msg} onChange={(e) => setMsg(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("Cancelar")}</Button>
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-500"
            onClick={() => { openWhatsApp(number, msg); onOpenChange(false); }}
          >
            <WhatsAppIcon className="mr-2 h-4 w-4" /> {t("Abrir WhatsApp")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MonthGrid({ cursor, items, onPick, onOpen }: { cursor: Date; items: ApptRow[]; onPick: (d: Date) => void; onOpen: (a: ApptRow) => void }) {
  const t = useT();
  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const days = Array.from({ length: 42 }).map((_, i) => addDays(start, i));
  return (
    <div className="bl-glass overflow-hidden rounded-2xl">
      <div className="grid grid-cols-7 border-b border-border bg-card/60 text-center text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs">
        {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map((d) => (
          <div key={d} className="py-2">
            <span className="sm:hidden">{t(d).charAt(0)}</span>
            <span className="hidden sm:inline">{t(d)}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const today = isSameDay(d, new Date());
          const inMonth = isSameMonth(d, cursor);
          const dayItems = items.filter((a) => isSameDay(new Date(a.starts_at), d));
          return (
            <div key={d.toISOString()} className={`min-h-14 border-b border-r border-border/60 p-1 text-xs sm:min-h-24 sm:p-1.5 ${inMonth ? "" : "opacity-40"}`}>
              <button onClick={() => onPick(d)} className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${today ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                {format(d, "d")}
              </button>
              {/* Mobile: pontinhos coloridos */}
              <div className="flex flex-wrap gap-0.5 sm:hidden">
                {dayItems.slice(0, 4).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => onOpen(a)}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: a.services?.color ?? "var(--brand-green)" }}
                    aria-label={`${fmtTime(a.starts_at)} ${a.clients?.name ?? ""}`}
                  />
                ))}
                {dayItems.length > 4 && <span className="text-[9px] text-muted-foreground">+{dayItems.length - 4}</span>}
              </div>
              {/* Desktop: lista */}
              <div className="hidden space-y-0.5 sm:block">
                {dayItems.slice(0, 3).map((a) => (
                  <button key={a.id} onClick={() => onOpen(a)} className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium text-white" style={{ background: a.services?.color ?? "var(--brand-green)" }}>
                    {fmtTime(a.starts_at)} {a.clients?.name}
                  </button>
                ))}
                {dayItems.length > 3 && <p className="px-1 text-[10px] text-muted-foreground">+{dayItems.length - 3}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const apptSchema = z.object({
  client_id: z.string().uuid("Selecione um cliente"),
  service_id: z.string().uuid("Selecione um serviço"),
  date: z.string().min(1, "Obrigatório"),
  time: z.string().min(1, "Obrigatório"),
  status: z.enum(["pending","scheduled","confirmed","in_progress","completed","cancelled","declined"]),
  notes: z.string().max(500).optional().or(z.literal("")),
});
type ApptForm = z.infer<typeof apptSchema>;

function ApptDialog({ open, onOpenChange, editing, initial }: { open: boolean; onOpenChange: (o: boolean) => void; editing: ApptRow | null; initial?: Date }) {
  const t = useT();
  const { userId } = Route.useRouteContext();
  const qc = useQueryClient();

  const clients = useQuery({
    queryKey: ["clients-select", userId],
    queryFn: async () => (await supabase.from("clients").select("id, name").eq("user_id", userId).order("name")).data ?? [],
    enabled: open,
  });
  const services = useQuery({
    queryKey: ["services-select", userId],
    queryFn: async () => (await supabase.from("services").select("id, name, duration_min, price, color").eq("user_id", userId).eq("active", true).order("name")).data ?? [],
    enabled: open,
  });

  const startDate = editing ? new Date(editing.starts_at) : (initial ?? new Date());
  const form = useForm<ApptForm>({
    resolver: zodResolver(apptSchema),
    values: {
      client_id: editing?.client_id ?? "",
      service_id: editing?.service_id ?? "",
      date: format(startDate, "yyyy-MM-dd"),
      time: format(startDate, "HH:mm"),
      status: (editing?.status as Enums<"appointment_status">) ?? "scheduled",
      notes: editing?.notes ?? "",
    },
  });

  const save = useMutation({
    mutationFn: async (v: ApptForm) => {
      const svc = services.data?.find((s) => s.id === v.service_id);
      if (!svc) throw new Error(t("Serviço não encontrado"));
      const start = new Date(`${v.date}T${v.time}:00`);
      const end = new Date(start.getTime() + svc.duration_min * 60000);
      const payload = {
        user_id: userId,
        client_id: v.client_id,
        service_id: v.service_id,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: v.status,
        notes: v.notes || null,
        price: svc.price,
      };
      if (editing) {
        const { error } = await supabase.from("appointments").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("appointments").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? t("Agendamento atualizado") : t("Agendamento criado"));
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(t("Erro"), { description: e.message }),
  });

  const removeMut = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase.from("appointments").delete().eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("Agendamento excluído"));
      qc.invalidateQueries({ queryKey: ["appointments"] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? t("Editar agendamento") : t("Novo agendamento")}</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-3">
          <Controller
            name="client_id"
            control={form.control}
            render={({ field }) => (
              <div>
                <Label>{t("Cliente *")}</Label>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder={t("Selecione um cliente")} /></SelectTrigger>
                  <SelectContent>
                    {clients.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.formState.errors.client_id && <p className="mt-1 text-xs text-destructive">{form.formState.errors.client_id.message}</p>}
              </div>
            )}
          />
          <Controller
            name="service_id"
            control={form.control}
            render={({ field }) => (
              <div>
                <Label>{t("Serviço *")}</Label>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder={t("Selecione um serviço")} /></SelectTrigger>
                  <SelectContent>
                    {services.data?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color ?? "var(--brand-green)" }} /> {s.name}{durationLabel(s.duration_min) ? ` · ${durationLabel(s.duration_min)}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.service_id && <p className="mt-1 text-xs text-destructive">{form.formState.errors.service_id.message}</p>}
              </div>
            )}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>{t("Data")}</Label><Input type="date" {...form.register("date")} /></div>
            <div><Label>{t("Horário")}</Label><Input type="time" {...form.register("time")} /></div>
          </div>
          <Controller
            name="status"
            control={form.control}
            render={({ field }) => (
              <div>
                <Label>{t("Status")}</Label>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["scheduled","confirmed","in_progress","completed","cancelled"] as const).map((s) => (
                      <SelectItem key={s} value={s}>{t(statusLabel[s])}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
          <div><Label>{t("Observações")}</Label><Textarea rows={2} {...form.register("notes")} /></div>
          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            {editing ? (
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => removeMut.mutate()}>
                {t("Excluir")}
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("Cancelar")}</Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("Salvar")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}