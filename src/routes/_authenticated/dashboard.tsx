import { PendingRequests } from "@/components/company/PendingRequests";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, CalendarPlus, CheckCircle2, FileText, TrendingUp, Users, Wallet, Wrench } from "lucide-react";
import { addDays, endOfDay, format, startOfDay, startOfMonth, startOfWeek, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtTime, statusColor, statusLabel, currency } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { userId } = Route.useRouteContext();
  const { t, lang } = useI18n();
  const dfLocale = lang === "pt" ? ptBR : undefined;
  const now = new Date();
  const today0 = startOfDay(now).toISOString();
  const today1 = endOfDay(now).toISOString();
  const week0 = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const month0 = startOfMonth(now).toISOString();

  const stats = useQuery({
    queryKey: ["dashboard-stats", userId],
    queryFn: async () => {
      const [today, upcoming, clients, services, done, weekly, monthly, recent] = await Promise.all([
        supabase.from("appointments").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("starts_at", today0).lte("starts_at", today1),
        supabase.from("appointments").select("id, starts_at, status, clients(name), services(name, color)").eq("user_id", userId).gt("starts_at", now.toISOString()).neq("status","cancelled").order("starts_at").limit(5),
        supabase.from("clients").select("*", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("services").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("active", true),
        supabase.from("appointments").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("status","completed"),
        supabase.from("appointments").select("starts_at, status").eq("user_id", userId).gte("starts_at", subDays(now,6).toISOString()).lte("starts_at", today1),
        supabase.from("appointments").select("starts_at, status, price").eq("user_id", userId).gte("starts_at", month0),
        supabase.from("appointments").select("id, starts_at, status, clients(name), services(name, color, price)").eq("user_id", userId).order("created_at", { ascending: false }).limit(6),
      ]);
      return {
        todayCount: today.count ?? 0,
        upcoming: upcoming.data ?? [],
        clientsCount: clients.count ?? 0,
        servicesCount: services.count ?? 0,
        doneCount: done.count ?? 0,
        weekly: weekly.data ?? [],
        monthly: monthly.data ?? [],
        recent: recent.data ?? [],
      };
    },
  });

  const weeklyChart = Array.from({ length: 7 }).map((_, i) => {
    const d = subDays(now, 6 - i);
    const key = format(d, "yyyy-MM-dd");
    const count = (stats.data?.weekly ?? []).filter((a) => format(new Date(a.starts_at), "yyyy-MM-dd") === key).length;
    return { day: format(d, "EEE", { locale: dfLocale }), total: count };
  });

  const monthlyChart = Array.from({ length: 4 }).map((_, i) => {
    const start = addDays(startOfMonth(now), i * 7);
    const end = addDays(start, 7);
    const count = (stats.data?.monthly ?? []).filter((a) => {
      const d = new Date(a.starts_at);
      return d >= start && d < end;
    }).length;
    return { day: `${t("Sem")} ${i + 1}`, total: count };
  });

  const monthRows = (stats.data?.monthly ?? []).filter(
    (a) => a.status !== "cancelled" && a.status !== "declined",
  );
  const revenueEstimated = monthRows.reduce((sum, a) => sum + Number((a as { price?: number | null }).price ?? 0), 0);
  const revenueDone = monthRows
    .filter((a) => a.status === "completed")
    .reduce((sum, a) => sum + Number((a as { price?: number | null }).price ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs sm:text-sm text-muted-foreground">{format(now, "EEEE, dd 'de' MMMM", { locale: dfLocale })}</p>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("Dashboard")}</h1>
        </div>
        <div className="flex flex-col gap-2 w-full sm:w-auto sm:items-end">
          <Button asChild size="default" className="shadow-[var(--shadow-glow)] w-full sm:w-auto h-10 px-5">
            <Link to="/appointments"><CalendarPlus className="mr-2 h-4 w-4" /> {t("Novo agendamento")}</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto h-9 px-4 border-primary/40 bg-card/70 hover:bg-primary/15 text-foreground hover:text-primary transition-all">
            <Link to="/quotes"><FileText className="mr-2 h-3.5 w-3.5 text-primary" /> {t("Novo orçamento")}</Link>
          </Button>
        </div>
      </div>

      <PendingRequests userId={userId} />

      {/* Faturamento em destaque, antes dos demais indicadores */}
      <Card className="bl-glass relative overflow-hidden border-[color-mix(in_oklab,var(--brand-green)_45%,transparent)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(120% 120% at 100% 0%, color-mix(in oklab, var(--brand-green) 22%, transparent) 0%, transparent 60%)",
          }}
        />
        <CardContent className="relative p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" style={{ color: "var(--brand-green)" }} />
                {t("Faturamento do mês")}
              </p>
              {stats.isLoading ? (
                <Skeleton className="mt-3 h-12 w-52" />
              ) : (
                <p
                  className="mt-2 text-4xl font-extrabold leading-none tracking-tight sm:text-5xl"
                  style={{ color: "var(--brand-green)" }}
                >
                  {currency(revenueEstimated)}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {format(now, "MMMM 'de' yyyy", { locale: dfLocale })} ·{" "}
                {monthRows.length} {monthRows.length === 1 ? t("atendimento") : t("atendimentos")}
              </p>
            </div>
            <div
              className="hidden h-16 w-16 shrink-0 place-items-center rounded-3xl sm:grid"
              style={{
                background: "color-mix(in oklab, var(--brand-green) 18%, transparent)",
                color: "var(--brand-green)",
              }}
            >
              <TrendingUp className="h-8 w-8" />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-card/50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("Já finalizado")}</p>
              {stats.isLoading ? (
                <Skeleton className="mt-1.5 h-6 w-24" />
              ) : (
                <p className="mt-0.5 text-xl font-bold" style={{ color: "var(--brand-green)" }}>
                  {currency(revenueDone)}
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("A receber (previsto)")}</p>
              {stats.isLoading ? (
                <Skeleton className="mt-1.5 h-6 w-24" />
              ) : (
                <p className="mt-0.5 text-xl font-bold">
                  {currency(Math.max(revenueEstimated - revenueDone, 0))}
                </p>
              )}
            </div>
          </div>

          {!stats.isLoading && revenueEstimated > 0 && (
            <div className="mt-4">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.round((revenueDone / revenueEstimated) * 100))}%`,
                    background: "var(--brand-green)",
                  }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {Math.min(100, Math.round((revenueDone / revenueEstimated) * 100))}% {t("do previsto já finalizado")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t("Agendamentos hoje")} value={stats.data?.todayCount} icon={CalendarClock} tone="primary" loading={stats.isLoading} />
        <StatCard label={t("Clientes")} value={stats.data?.clientsCount} icon={Users} tone="accent" loading={stats.isLoading} />
        <StatCard label={t("Serviços ativos")} value={stats.data?.servicesCount} icon={Wrench} tone="cyan" loading={stats.isLoading} />
        <StatCard label={t("Finalizados")} value={stats.data?.doneCount} icon={CheckCircle2} tone="green" loading={stats.isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bl-glass">
          <CardHeader><CardTitle>{t("Últimos 7 dias")}</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Bar dataKey="total" fill="var(--brand-green)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="bl-glass">
          <CardHeader><CardTitle>{t("Este mês por semana")}</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Bar dataKey="total" fill="var(--brand-blue)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bl-glass">
          <CardHeader><CardTitle>{t("Próximos atendimentos")}</CardTitle></CardHeader>
          <CardContent className="space-y-2.5 px-3 sm:px-6">
            {stats.isLoading && <Skeleton className="h-16 w-full" />}
            {stats.data?.upcoming.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("Nenhum agendamento futuro.")}</p>
            )}
            {stats.data?.upcoming.map((a) => (
              <div
                key={a.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/60 bg-card/40 px-3 py-3 sm:px-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium sm:text-base">{a.clients?.name}</p>
                  <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: a.services?.color ?? "var(--brand-green)" }}
                    />
                    <span className="truncate">{a.services?.name}</span>
                  </p>
                </div>
                <div className="shrink-0 text-right leading-tight">
                  <p className="text-sm font-semibold tabular-nums">{format(new Date(a.starts_at), "dd/MM")}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">{fmtTime(a.starts_at)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bl-glass">
          <CardHeader><CardTitle>{t("Últimos agendamentos")}</CardTitle></CardHeader>
          <CardContent className="space-y-2.5 px-3 sm:px-6">
            {stats.data?.recent.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("Sem agendamentos.")}</p>
            )}
            {stats.data?.recent.map((a) => (
              <div
                key={a.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/60 bg-card/40 px-3 py-3 sm:px-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium sm:text-base">{a.clients?.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{a.services?.name}</p>
                </div>
                <Badge variant="outline" className={`${statusColor[a.status]} shrink-0 whitespace-nowrap text-[11px]`}>{t(statusLabel[a.status] ?? a.status)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone, loading }: {
  label: string;
  value?: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "accent" | "cyan" | "green";
  loading?: boolean;
}) {
  const bg = {
    primary: "var(--brand-green)",
    accent: "#38bdf8", // Ícone azul claro e luminoso para clientes
    cyan: "var(--brand-cyan)",
    green: "var(--brand-green)",
  }[tone];
  return (
    <Card className="bl-glass overflow-hidden h-full">
      <CardContent className="flex flex-col justify-between h-full p-3 sm:p-4.5">
        <div className="flex items-start justify-between gap-1.5 sm:gap-2.5">
          <div className="h-8 sm:h-9 flex items-center pr-0.5 min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground leading-tight line-clamp-2">
              {label}
            </p>
          </div>
          <div
            className="grid h-7 w-7 sm:h-8 sm:w-8 shrink-0 place-items-center rounded-full mt-0.5"
            style={{
              background: `color-mix(in oklab, ${bg} 22%, transparent)`,
              color: bg,
              boxShadow: `0 0 12px -1px color-mix(in oklab, ${bg} 35%, transparent)`,
            }}
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        </div>
        <div className="mt-2 sm:mt-2.5">
          {loading
            ? <Skeleton className="h-7 w-12 sm:h-8 sm:w-16" />
            : <p className="text-xl sm:text-3xl font-extrabold tabular-nums tracking-tight">{value ?? 0}</p>}
        </div>
      </CardContent>
    </Card>
  );
}