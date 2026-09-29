import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { fmtDateTime, currency, statusColor, statusLabel } from "@/lib/format";
import { toast } from "sonner";
import { CalendarX2, Phone } from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { useT, useI18n } from "@/lib/i18n";
import { friendlyError } from "@/lib/auth-errors";
import { notifyCompanyCancellation } from "@/lib/notifications.functions";

export const Route = createFileRoute("/_authenticated/my-bookings")({
  head: () => ({
    meta: [
      { title: "Meus agendamentos · BL Core Gestão" },
      { name: "description", content: "Acompanhe em tempo real o status das suas solicitações de agendamento." },
      { property: "og:title", content: "Meus agendamentos · BL Core Gestão" },
      { property: "og:description", content: "Acompanhe suas solicitações de agendamento em tempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyBookingsPage,
});

function MyBookingsPage() {
  const { userId } = Route.useRouteContext();
  const qc = useQueryClient();
  const t = useT();
  const { lang } = useI18n();

  const bookings = useQuery({
    queryKey: ["my-bookings", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, user_id, starts_at, ends_at, status, price, notes, decline_reason, services(name)")
        .eq("client_user_id", userId)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const ids = [...new Set(rows.map((r) => r.user_id))];
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, business_name, full_name, phone, whatsapp").in("id", ids)
        : {
            data: [] as {
              id: string;
              business_name: string | null;
              full_name: string | null;
              phone: string | null;
              whatsapp: string | null;
            }[],
          };
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      return rows.map((r) => {
        const p = map.get(r.user_id);
        return {
          ...r,
          company: p?.business_name || p?.full_name || "Empresa",
          companyWhatsapp: p?.whatsapp ?? p?.phone ?? null,
          companyPhone: p?.phone ?? p?.whatsapp ?? null,
        };
      });
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("my-bookings-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `client_user_id=eq.${userId}` }, () => {
        qc.invalidateQueries({ queryKey: ["my-bookings", userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, userId]);

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
      // Avisa a empresa dona do agendamento (não bloqueia o cancelamento).
      try {
        await notifyCompanyCancellation({ data: { appointmentId: id } });
      } catch (err) {
        console.error("[notifyCompanyCancellation]", err);
      }
    },
    onSuccess: () => {
      toast.success(t("Solicitação cancelada"));
      qc.invalidateQueries({ queryKey: ["my-bookings", userId] });
    },
    onError: (e: Error) => toast.error(t("Erro"), { description: friendlyError(e, lang) }),
  });

  return (
    <div className="space-y-5">
      <PageHeader title={t("Meus agendamentos")} description={t("Acompanhe o status das suas solicitações em tempo real.")} />

      {bookings.isLoading && <p className="text-sm text-muted-foreground">{t("Carregando...")}</p>}

      {!bookings.isLoading && (bookings.data?.length ?? 0) === 0 && (
        <Card className="bl-glass">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <CalendarX2 className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("Você ainda não solicitou nenhum agendamento.")}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {bookings.data?.map((b) => (
          <Card key={b.id} className="bl-glass">
            <CardContent className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="truncate font-semibold">{b.company}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {b.services?.name ?? t("Serviço")} · {fmtDateTime(b.starts_at)}
                </p>
                {b.price != null && <p className="text-xs text-muted-foreground">{currency(Number(b.price))}</p>}
                {b.decline_reason && (
                  <p className="mt-1 text-xs text-destructive">{t("Motivo")}: {b.decline_reason}</p>
                )}
              </div>
              <div className="flex items-center gap-2 justify-self-start sm:justify-self-end">
                <Badge variant="outline" className={`${statusColor[b.status]} shrink-0 whitespace-nowrap`}>{t(statusLabel[b.status] ?? b.status)}</Badge>
                {b.companyWhatsapp && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                    onClick={() => openWhatsApp(b.companyWhatsapp)}
                    aria-label={t("Falar com a empresa no WhatsApp")}
                    title={t("Falar com a empresa no WhatsApp")}
                  >
                    <WhatsAppIcon className="h-4 w-4" />
                  </Button>
                )}
                {b.companyPhone && (
                  <Button size="sm" variant="outline" asChild aria-label={t("Ligar para a empresa")} title={t("Ligar")}>
                    <a href={`tel:${b.companyPhone.replace(/\D/g, "")}`}>
                      <Phone className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                {(b.status === "pending" || b.status === "scheduled" || b.status === "confirmed") && (
                  <Button size="sm" variant="outline" onClick={() => cancel.mutate(b.id)} disabled={cancel.isPending}>
                    {t("Cancelar")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
