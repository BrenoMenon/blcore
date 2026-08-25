import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COMPANY_CATEGORIES, CUSTOM_CATEGORY, fullAddress } from "@/lib/marketplace";
import { formatCep, lookupCep, geocodeAddress } from "@/lib/geo";
import { toast } from "sonner";
import { Loader2, MapPin, Save, Search } from "lucide-react";
import { useT } from "@/lib/i18n";

type Draft = {
  business_name: string;
  category: string;
  custom_category: string;
  bio: string;
  cep: string;
  city: string;
  state: string;
  address: string;
  address_number: string;
  address_complement: string;
  neighborhood: string;
  is_public: boolean;
};

const empty: Draft = {
  business_name: "", category: "", custom_category: "", bio: "", cep: "", city: "", state: "",
  address: "", address_number: "", address_complement: "", neighborhood: "", is_public: true,
};

export function StorefrontCard({ userId }: { userId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(empty);
  const [hasPin, setHasPin] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const profile = useQuery({
    queryKey: ["storefront", userId],
    queryFn: async () => {
      const { data, error } = await db
        .from("profiles")
        .select(
          "business_name, category, custom_category, bio, city, state, address, address_number, address_complement, neighborhood, lat, lng, is_public",
        )
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    setHasPin(p.lat != null && p.lng != null);
    setDraft((d) => ({
      ...d,
      business_name: p.business_name ?? "",
      category: p.custom_category ? CUSTOM_CATEGORY : (p.category ?? ""),
      custom_category: p.custom_category ?? "",
      bio: p.bio ?? "",
      city: p.city ?? "",
      state: p.state ?? "",
      address: p.address ?? "",
      address_number: p.address_number ?? "",
      address_complement: p.address_complement ?? "",
      neighborhood: p.neighborhood ?? "",
      is_public: p.is_public ?? true,
    }));
  }, [profile.data]);

  async function searchCep(value?: string) {
    const cep = (value ?? draft.cep).replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await lookupCep(cep);
      setDraft((d) => ({
        ...d,
        address: r.address ?? d.address,
        neighborhood: r.neighborhood ?? d.neighborhood,
        city: r.city ?? d.city,
        state: r.state ?? d.state,
      }));
      toast.success(t("Endereço preenchido pelo CEP"));
    } catch (e) {
      toast.error(t("CEP"), { description: (e as Error).message });
    } finally {
      setCepLoading(false);
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      const isCustom = draft.category === CUSTOM_CATEGORY;
      const custom = draft.custom_category.trim();
      if (isCustom && !custom) throw new Error(t("Escreva o nome da sua categoria"));
      const coords = await geocodeAddress({
        address: [draft.address, draft.address_number].filter(Boolean).join(", "),
        neighborhood: draft.neighborhood,
        city: draft.city,
        state: draft.state,
        cep: draft.cep,
      });
      const { error } = await db
        .from("profiles")
        .update({
          business_name: draft.business_name || null,
          category: isCustom ? custom : draft.category || null,
          custom_category: isCustom ? custom : null,
          bio: draft.bio || null,
          city: draft.city || null,
          state: draft.state || null,
          address: draft.address || null,
          address_number: draft.address_number || null,
          address_complement: draft.address_complement || null,
          neighborhood: draft.neighborhood || null,
          ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
          is_public: draft.is_public,
        })
        .eq("id", userId);
      if (error) throw error;

      // Mantém o endereço dos "Dados da empresa" preenchido automaticamente
      const composed = fullAddress({
        address: draft.address,
        address_number: draft.address_number,
        address_complement: draft.address_complement,
        neighborhood: draft.neighborhood,
        city: draft.city,
        state: draft.state,
      });
      if (composed) {
        await db.from("company_settings").update({ address: composed }).eq("user_id", userId);
      }
      return Boolean(coords);
    },
    onSuccess: (located) => {
      setHasPin((v) => v || located);
      toast.success(t("Vitrine atualizada"), {
        description: located
          ? t("Sua empresa já aparece no mapa para os clientes.")
          : t("Salvo! Informe CEP e endereço para aparecer no mapa."),
      });
      qc.invalidateQueries({ queryKey: ["storefront", userId] });
      qc.invalidateQueries({ queryKey: ["explore-companies"] });
      qc.invalidateQueries({ queryKey: ["settings", userId] });
    },
    onError: (e: Error) => toast.error(t("Erro"), { description: e.message }),
  });

  return (
    <Card className="bl-glass">
      <CardHeader>
        <CardTitle>{t("Vitrine e localização")}</CardTitle>
        <CardDescription>{t("Como sua empresa aparece no mapa para os clientes")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>{t("Nome público do negócio")}</Label>
          <Input value={draft.business_name} onChange={(e) => setDraft({ ...draft, business_name: e.target.value })} />
        </div>

        <div>
          <Label>{t("Categoria")}</Label>
          <Select value={draft.category || undefined} onValueChange={(v) => setDraft({ ...draft, category: v })}>
            <SelectTrigger><SelectValue placeholder={t("Selecione a categoria")} /></SelectTrigger>
            <SelectContent>
              {COMPANY_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              <SelectItem value={CUSTOM_CATEGORY}>{t("Escrever minha categoria…")}</SelectItem>
            </SelectContent>
          </Select>
          {draft.category === CUSTOM_CATEGORY && (
            <>
              <Input
                className="mt-2"
                maxLength={16}
                placeholder={t("Ex: Tatuagem")}
                value={draft.custom_category}
                onChange={(e) =>
                  setDraft({ ...draft, custom_category: e.target.value.replace(/\s+/g, " ").trimStart() })
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t("Use apenas uma palavra-chave (máx. 16 caracteres).")}
              </p>
            </>
          )}
        </div>

        <div>
          <Label>{t("CEP")}</Label>
          <div className="flex gap-2">
            <Input
              inputMode="numeric"
              placeholder="01310-100"
              value={draft.cep}
              onChange={(e) => {
                const cep = formatCep(e.target.value);
                setDraft((d) => ({ ...d, cep }));
                if (cep.replace(/\D/g, "").length === 8) void searchCep(cep);
              }}
            />
            <Button type="button" variant="outline" size="icon" onClick={() => void searchCep()} disabled={cepLoading} aria-label={t("Buscar CEP")}>
              {cepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div>
          <Label>{t("Cidade")}</Label>
          <Input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
        </div>
        <div>
          <Label>{t("Estado")}</Label>
          <Input value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })} placeholder={t("SP")} />
        </div>
        <div className="sm:col-span-2">
          <Label>{t("Endereço")}</Label>
          <Input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} placeholder={t("Rua / Avenida")} />
        </div>
        <div>
          <Label>{t("Número")}</Label>
          <Input
            inputMode="numeric"
            value={draft.address_number}
            onChange={(e) => setDraft({ ...draft, address_number: e.target.value })}
            placeholder="123"
          />
        </div>
        <div>
          <Label>{t("Complemento")}</Label>
          <Input
            value={draft.address_complement}
            onChange={(e) => setDraft({ ...draft, address_complement: e.target.value })}
            placeholder={t("Sala 2, Bloco B")}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>{t("Bairro")}</Label>
          <Input
            value={draft.neighborhood}
            onChange={(e) => setDraft({ ...draft, neighborhood: e.target.value })}
            placeholder={t("Centro")}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>{t("Descrição")}</Label>
          <Textarea rows={3} value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} />
        </div>

        {hasPin && (
          <p className="text-xs text-muted-foreground sm:col-span-2">
            <MapPin className="mr-1 inline h-3 w-3 text-primary" />
            {t("Ponto no mapa definido — sua empresa já aparece para os clientes.")}
          </p>
        )}

        <div className="flex items-center gap-3 sm:col-span-2">
          <Switch checked={draft.is_public} onCheckedChange={(v) => setDraft({ ...draft, is_public: v })} />
          <span className="text-sm text-muted-foreground">{t("Aparecer na busca pública de empresas")}</span>
        </div>

        <div className="sm:col-span-2">
          <Button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="w-full sm:w-auto">
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {t("Salvar vitrine")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
