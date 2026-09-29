import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime, currency } from "@/lib/format";
import { toast } from "sonner";
import { Check, X, BellRing } from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { useT } from "@/lib/i18n";

export function PendingRequests({ userId }: { userId: string }) {
  const t = useT();
  const qc = useQueryClient();

  const pending = useQuery({
    queryKey: ["pending-requests", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, starts_at, price, notes, client_user_id, services(name)")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("starts_at");
      if (error) throw error;
      const rows = data ?? [];
      const ids = [...new Set(rows.map((r) => r.client_user_id).filter(Boolean) as string[])];
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name, phone").in("id", ids)
        : { data: [] as { id: string; full_name: string | null; phone: string | null }[] };
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      return rows.map((r) => {
        const p = r.client_user_id ? map.get(r.client_user_id) : undefined;
        return {
          ...r,
          clientName: p?.full_name ?? t("Cliente"),
          clientPhone: p?.phone ?? null,
        };
      });
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("company-requests-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `user_id=eq.${userId}` }, () => {
        qc.invalidateQueries({ queryKey: ["pending-requests", userId] });
        qc.invalidateQueries({ queryKey: ["appointments"] });
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, userId]);

  const companyName = useQuery({
    queryKey: ["company-name", userId],
    queryFn: async () =>
      (await supabase.from("company_settings").select("company_name").eq("user_id", userId).maybeSingle()).data
        ?.company_name ?? "BL Core Gestão",
  });

  const decide = useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      const { error } = await supabase
        .from("appointments")
        .update(accept ? { status: "confirmed" } : { status: "declined", decline_reason: "Horário indisponível" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      const row = (pending.data ?? []).find((r) => r.id === v.id);
      toast.success(v.accept ? t("Agendamento confirmado") : t("Solicitação recusada"));
      if (v.accept && row?.clientPhone) {
        const d = new Date(row.starts_at);
        const msg =
          `Olá, ${row.clientName}! Seu agendamento de ${row.services?.name ?? "serviço"} foi confirmado.\n` +
          `Data: ${format(d, "dd/MM/yyyy", { locale: ptBR })} — Horário: ${format(d, "HH:mm")}\n` +
          `Local: ${companyName.data ?? "BL Core Gestão"}\n\nAté breve!`;
        openWhatsApp(row.clientPhone, msg);
      }
      qc.invalidateQueries({ queryKey: ["pending-requests", userId] });
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(t("Erro"), { description: e.message }),
  });

  const rows = pending.data ?? [];
  if (rows.length === 0) return null;

  return (
    <Card className="bl-glass border-primary/40">
      <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="h-4 w-4 text-primary" /> {t("Solicitações pendentes")}
          </CardTitle>
          <CardDescription>{t("Novos pedidos chegam aqui em tempo real.")}</CardDescription>
        </div>
        <Badge className="shrink-0">{rows.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="grid gap-3 rounded-xl border border-border/70 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <p className="truncate font-semibold">{r.clientName}</p>
              <p className="truncate text-sm text-muted-foreground">
                {r.services?.name ?? t("Serviço")} · {fmtDateTime(r.starts_at)}
                {r.price != null ? ` · ${currency(Number(r.price))}` : ""}
              </p>
              {r.notes && <p className="truncate text-xs text-muted-foreground">{r.notes}</p>}
            </div>
            <div className="flex shrink-0 gap-2 justify-self-start sm:justify-self-end">
              {r.clientPhone && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                  onClick={() => openWhatsApp(r.clientPhone)}
                  aria-label={t("Falar no WhatsApp")}
                >
                  <WhatsAppIcon className="h-4 w-4" />
                </Button>
              )}
              <Button size="sm" onClick={() => decide.mutate({ id: r.id, accept: true })}>
                <Check className="mr-1 h-4 w-4" /> {t("Aceitar")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: r.id, accept: false })}>
                <X className="mr-1 h-4 w-4" /> {t("Recusar")}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
