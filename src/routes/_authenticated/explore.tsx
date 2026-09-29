import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useMemo, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/db";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/PageHeader";
import { initials, currency } from "@/lib/format";
import { displayCategory, shortCategory, fullAddress, type CompanyPin } from "@/lib/marketplace";
import { MapPin, Search, Loader2, CalendarPlus, Phone } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { openWhatsApp } from "@/lib/whatsapp";
import { toast } from "sonner";
import { format } from "date-fns";
import { useT } from "@/lib/i18n";
import { durationLabel } from "@/lib/duration";

const CompaniesMap = lazy(() => import("@/components/map/CompaniesMap"));

export const Route = createFileRoute("/_authenticated/explore")({
  head: () => ({
    meta: [
      { title: "Buscar empresas · BL Core Gestão" },
      { name: "description", content: "Encontre empresas próximas no mapa e solicite seu agendamento em segundos." },
      { property: "og:title", content: "Buscar empresas · BL Core Gestão" },
      { property: "og:description", content: "Encontre empresas próximas no mapa e agende em segundos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExplorePage,
});

function MapSkeleton() {
  return <div className="h-full w-full animate-pulse rounded-2xl bg-muted" />;
}

const norm = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function ExplorePage() {
  const t = useT();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<CompanyPin | null>(null);

  const companies = useQuery({
    queryKey: ["explore-companies"],
    queryFn: async (): Promise<CompanyPin[]> => {
      const { data, error } = await db
        .from("profiles")
        .select(
          "id, business_name, full_name, category, custom_category, city, state, address, address_number, address_complement, neighborhood, bio, avatar_url, whatsapp, phone, lat, lng",
        )
        .eq("user_type", "company")
        .eq("is_public", true);
      if (error) throw error;
      return (data ?? []).map((p) => ({
        id: p.id,
        name: p.business_name || p.full_name || t("Empresa"),
        category: p.category,
        custom_category: p.custom_category,
        city: p.city,
        state: p.state,
        address: p.address,
        address_number: p.address_number,
        address_complement: p.address_complement,
        neighborhood: p.neighborhood,
        bio: p.bio,
        avatar_url: p.avatar_url,
        whatsapp: p.whatsapp,
        phone: p.phone,
        lat: p.lat,
        lng: p.lng,
      }));
    },
  });

  const list = useMemo(() => {
    const term = norm(q);
    const all = companies.data ?? [];
    if (!term) return all;
    return all.filter((c) =>
      norm(
        [c.name, c.city, c.state, displayCategory(c), c.neighborhood, c.address]
          .filter(Boolean)
          .join(" "),
      ).includes(term),
    );
  }, [companies.data, q]);

  const cities = useMemo(() => {
    const set = new Map<string, string>();
    (companies.data ?? []).forEach((c) => {
      if (c.city) set.set(norm(c.city), [c.city, c.state].filter(Boolean).join(" - "));
    });
    return [...set.values()].sort().slice(0, 8);
  }, [companies.data]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("Encontre e agende")}
        description={t("Busque por cidade, categoria ou nome da empresa e solicite seu horário.")}
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("Ex: barbearia, São Paulo, BL Core")}
          className="pl-9"
        />
      </div>

      {cities.length > 0 && (
        <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
          <Badge
            onClick={() => setQ("")}
            className={`shrink-0 cursor-pointer ${q ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"}`}
          >
            {t("Todas")}
          </Badge>
          {cities.map((c) => (
            <Badge
              key={c}
              onClick={() => setQ(c.split(" - ")[0] ?? c)}
              variant="outline"
              className="shrink-0 cursor-pointer whitespace-nowrap"
            >
              <MapPin className="mr-1 h-3 w-3" /> {c}
            </Badge>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="order-2 space-y-3 lg:order-1">
          {companies.isLoading && <p className="text-sm text-muted-foreground">{t("Carregando empresas...")}</p>}
          {!companies.isLoading && list.length === 0 && (
            <Card className="bl-glass">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                {t("Nenhuma empresa encontrada para esta busca.")}
              </CardContent>
            </Card>
          )}
          {list.map((c) => (
            <button key={c.id} type="button" onClick={() => setSelected(c)} className="w-full text-left">
              <Card className={`bl-glass transition hover:border-primary/60 ${selected?.id === c.id ? "border-primary" : ""}`}>
                <CardContent className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 p-4">
                  <Avatar className="h-11 w-11 shrink-0">
                    <AvatarImage src={c.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary/20 text-xs font-bold text-primary">
                      {initials(c.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      <MapPin className="mr-1 inline h-3 w-3" />
                      {[c.city, c.state].filter(Boolean).join(" - ") || t("Local não informado")}
                    </p>
                    {shortCategory(c) && (
                      <Badge
                        variant="outline"
                        className="mt-1.5 max-w-full whitespace-nowrap"
                        title={displayCategory(c) ?? undefined}
                      >
                        <span className="block truncate">{shortCategory(c)}</span>
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>

        <div
          className={`order-1 h-[280px] overflow-hidden rounded-2xl border border-border sm:h-[380px] lg:order-2 lg:sticky lg:top-20 lg:h-[560px] ${
            selected ? "hidden lg:block" : ""
          }`}
        >
          <ClientOnly fallback={<MapSkeleton />}>
            <Suspense fallback={<MapSkeleton />}>
              <CompaniesMap
                companies={list}
                selectedId={selected?.id ?? null}
                onSelect={(id) => setSelected(list.find((c) => c.id === id) ?? null)}
              />
            </Suspense>
          </ClientOnly>
        </div>
      </div>

      <BookingSheet company={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}

function BookingSheet({ company, onOpenChange }: { company: CompanyPin | null; onOpenChange: (o: boolean) => void }) {
  const t = useT();
  const qc = useQueryClient();
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState("");

  const services = useQuery({
    queryKey: ["explore-services", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, price, duration_min")
        .eq("user_id", company!.id)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const request = useMutation({
    mutationFn: async () => {
      const svc = services.data?.find((s) => s.id === serviceId);
      if (!company || !svc) throw new Error(t("Selecione um serviço"));
      const start = new Date(`${date}T${time}:00`);
      if (Number.isNaN(start.getTime())) throw new Error(t("Informe data e horário válidos"));
      const { error } = await db.rpc("request_appointment", {
        p_company_id: company.id,
        p_service_id: svc.id,
        p_starts_at: start.toISOString(),
        p_notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("Solicitação enviada!"), { description: t("A empresa vai confirmar em instantes.") });
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      setNotes("");
      setServiceId("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(t("Não foi possível solicitar"), { description: e.message }),
  });

  const address = company ? fullAddress(company) : "";
  const contact = company?.whatsapp ?? company?.phone ?? null;
  const phone = company?.phone ?? company?.whatsapp ?? null;

  return (
    <Sheet open={!!company} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl sm:max-w-lg sm:rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle>{company?.name}</SheetTitle>
          <SheetDescription>
            {displayCategory(company) ?? t("Solicite seu horário")}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          {company?.bio && <p className="text-sm text-muted-foreground">{company.bio}</p>}

          {address && (
            <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{address}</span>
            </p>
          )}

          {(contact || phone) && (
            <div className="flex flex-wrap gap-2">
              {contact && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                  onClick={() => openWhatsApp(contact, t("Olá! Vim pelo BL Core Gestão."))}
                >
                  <WhatsAppIcon className="mr-2 h-4 w-4" /> {t("WhatsApp")}
                </Button>
              )}
              {phone && (
                <Button type="button" variant="outline" asChild>
                  <a href={`tel:${phone.replace(/\D/g, "")}`}>
                    <Phone className="mr-2 h-4 w-4" /> {t("Ligar")}
                  </a>
                </Button>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t("Serviço")}</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger><SelectValue placeholder={t("Escolha o serviço")} /></SelectTrigger>
              <SelectContent>
                {services.data?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {currency(Number(s.price))}{durationLabel(s.duration_min) ? ` · ${durationLabel(s.duration_min)}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {services.data?.length === 0 && (
              <p className="text-xs text-muted-foreground">{t("Esta empresa ainda não publicou serviços.")}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("Data")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Horário")}</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("Observações")}</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("Opcional")} />
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={!serviceId || request.isPending}
            onClick={() => request.mutate()}
          >
            {request.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarPlus className="mr-2 h-4 w-4" />}
            {t("Solicitar agendamento")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
