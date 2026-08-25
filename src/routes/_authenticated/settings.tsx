import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { useEffect } from "react";
import { StorefrontCard } from "@/components/company/StorefrontCard";
import { RecoveryKeyCard } from "@/components/common/RecoveryKeyCard";
import { DeleteAccountCard } from "@/components/common/DeleteAccountCard";
import { ChangePasswordCard } from "@/components/common/ChangePasswordCard";

import { formatPhoneBR, PHONE_PLACEHOLDER } from "@/lib/phone";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

const schema = z.object({
  company_name: z.string().min(1, "Obrigatório").max(120),
  whatsapp: z.string().max(30).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
});
type Form = z.infer<typeof schema>;

function SettingsPage() {
  const { userId, email } = Route.useRouteContext();
  const qc = useQueryClient();
  const t = useT();

  const { data, isLoading } = useQuery({
    queryKey: ["settings", userId],
    queryFn: async () => (await supabase.from("company_settings").select("*").eq("user_id", userId).maybeSingle()).data,
  });

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { company_name: "BL Core Gestão", whatsapp: "", phone: "", address: "" },
  });

  useEffect(() => {
    if (data) {
      form.reset({
        company_name: data.company_name ?? "",
        whatsapp: data.whatsapp ? formatPhoneBR(data.whatsapp) : "",
        phone: data.phone ? formatPhoneBR(data.phone) : "",
        address: data.address ?? "",
      });
    }
  }, [data, form]);

  const save = useMutation({
    mutationFn: async (v: Form) => {
      const { error } = await supabase.from("company_settings").update({
        company_name: v.company_name,
        whatsapp: v.whatsapp || null,
        phone: v.phone || null,
        address: v.address || null,
      }).eq("user_id", userId);
      if (error) throw error;

      // Mantém o contato público da empresa em sincronia (usado pelos clientes)
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ whatsapp: v.whatsapp || null, phone: v.phone || null })
        .eq("id", userId);
      if (pErr) throw pErr;
    },
    onSuccess: () => {
      toast.success(t("Configurações salvas"));
      qc.invalidateQueries({ queryKey: ["settings", userId] });
      qc.invalidateQueries({ queryKey: ["profile", userId] });
      qc.invalidateQueries({ queryKey: ["profile-full", userId] });
    },
    onError: (e: Error) => toast.error(t("Erro"), { description: e.message }),
  });

  return (
    <div>
      <PageHeader title={t("Configurações")} description={t("Personalize sua empresa e sua vitrine no mapa")} />

      <div className="mb-6">
        <StorefrontCard userId={userId} />
      </div>

      {isLoading ? <p className="text-muted-foreground">{t("Carregando…")}</p> : (
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-6">
          <Card className="bl-glass">
            <CardHeader>
              <CardTitle>{t("Empresa")}</CardTitle>
              <CardDescription>{t("Dados que aparecem nas mensagens e no sistema")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>{t("Nome da empresa")}</Label>
                <Input {...form.register("company_name")} />
              </div>
              <Controller
                name="whatsapp"
                control={form.control}
                render={({ field }) => (
                  <div>
                    <Label>{t("WhatsApp da empresa")}</Label>
                    <Input
                      inputMode="tel"
                      placeholder={PHONE_PLACEHOLDER}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(formatPhoneBR(e.target.value))}
                    />
                  </div>
                )}
              />
              <Controller
                name="phone"
                control={form.control}
                render={({ field }) => (
                  <div>
                    <Label>{t("Telefone fixo / comercial")}</Label>
                    <Input
                      inputMode="tel"
                      placeholder={PHONE_PLACEHOLDER}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(formatPhoneBR(e.target.value))}
                    />
                  </div>
                )}
              />
              <div>
                <Label>{t("Endereço")}</Label>
                <Input {...form.register("address")} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {t("Salvar configurações")}
            </Button>
          </div>
        </form>
      )}

      <div className="mt-6">
        <ChangePasswordCard />
      </div>

      <div className="mt-6">
        <RecoveryKeyCard email={email ?? ""} />
      </div>


      <div className="mt-6">
        <DeleteAccountCard />
      </div>
    </div>
  );
}
