import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/db";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Search, Upload } from "lucide-react";
import { initials } from "@/lib/format";
import { useEffect, useRef } from "react";
import { RecoveryKeyCard } from "@/components/common/RecoveryKeyCard";
import { DeleteAccountCard } from "@/components/common/DeleteAccountCard";
import { formatPhoneBR, PHONE_PLACEHOLDER } from "@/lib/phone";
import { formatCep, lookupCep } from "@/lib/geo";
import { useState } from "react";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

const profileSchema = z.object({
  full_name: z.string().min(2, "Nome obrigatório").max(120),
  phone: z.string().max(30).optional().or(z.literal("")),
  whatsapp: z.string().max(30).optional().or(z.literal("")),
  address: z.string().max(200).optional().or(z.literal("")),
  address_number: z.string().max(20).optional().or(z.literal("")),
  address_complement: z.string().max(80).optional().or(z.literal("")),
  neighborhood: z.string().max(120).optional().or(z.literal("")),
  city: z.string().max(120).optional().or(z.literal("")),
  state: z.string().max(2).optional().or(z.literal("")),
});
const passwordSchema = z.object({
  password: z.string().min(6, "Mínimo 6 caracteres"),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { path: ["confirm"], message: "As senhas não conferem" });

function ProfilePage() {
  const t = useT();
  const { userId, email } = Route.useRouteContext();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [cep, setCep] = useState("");
  const [cepLoading, setCepLoading] = useState(false);

  const { data } = useQuery({
    queryKey: ["profile-full", userId],
    queryFn: async () => (await db.from("profiles").select("*").eq("id", userId).maybeSingle()).data,
  });

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: "", phone: "", whatsapp: "", address: "", address_number: "",
      address_complement: "", neighborhood: "", city: "", state: "",
    },
  });
  useEffect(() => {
    if (data) {
      form.reset({
        full_name: data.full_name ?? "",
        phone: data.phone ? formatPhoneBR(data.phone) : "",
        whatsapp: data.whatsapp ? formatPhoneBR(data.whatsapp) : "",
        address: data.address ?? "",
        address_number: data.address_number ?? "",
        address_complement: data.address_complement ?? "",
        neighborhood: data.neighborhood ?? "",
        city: data.city ?? "",
        state: data.state ?? "",
      });
    }
  }, [data, form]);

  async function searchCep(value: string) {
    const digits = value.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await lookupCep(digits);
      if (r.address) form.setValue("address", r.address);
      if (r.neighborhood) form.setValue("neighborhood", r.neighborhood);
      if (r.city) form.setValue("city", r.city);
      if (r.state) form.setValue("state", r.state);
      toast.success(t("Endereço preenchido pelo CEP"));
    } catch (e) {
      toast.error(t("CEP"), { description: (e as Error).message });
    } finally {
      setCepLoading(false);
    }
  }

  const save = useMutation({
    mutationFn: async (v: z.infer<typeof profileSchema>) => {
      const { error } = await db.from("profiles").update({
        full_name: v.full_name,
        phone: v.phone || null,
        whatsapp: v.whatsapp || null,
        address: v.address || null,
        address_number: v.address_number || null,
        address_complement: v.address_complement || null,
        neighborhood: v.neighborhood || null,
        city: v.city || null,
        state: v.state ? v.state.toUpperCase() : null,
      }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("Perfil atualizado"));
      qc.invalidateQueries({ queryKey: ["profile-full", userId] });
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: (e: Error) => toast.error(t("Erro"), { description: e.message }),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split(".").pop();
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = signed?.signedUrl;
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
    },
    onSuccess: () => {
      toast.success(t("Foto atualizada"));
      qc.invalidateQueries({ queryKey: ["profile-full", userId] });
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: (e: Error) => toast.error("Erro no upload", { description: e.message }),
  });

  const pwForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirm: "" },
  });
  const changePw = useMutation({
    mutationFn: async (v: z.infer<typeof passwordSchema>) => {
      const { error } = await supabase.auth.updateUser({ password: v.password });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("Senha alterada")); pwForm.reset(); },
    onError: (e: Error) => toast.error(t("Erro"), { description: e.message }),
  });

  return (
    <div>
      <PageHeader title={t("Meu perfil")} description={t("Gerencie seus dados pessoais e senha")} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="bl-glass lg:col-span-1">
          <CardHeader><CardTitle>{t("Foto")}</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Avatar className="h-40 w-40 ring-2 ring-primary/30 ring-offset-2 ring-offset-background sm:h-48 sm:w-48">
              <AvatarImage
                src={data?.avatar_url ?? undefined}
                alt={data?.full_name ?? t("Foto de perfil")}
                className="h-full w-full object-cover object-center"
              />
              <AvatarFallback className="bg-primary/20 text-4xl font-bold text-primary">
                {initials(data?.full_name ?? email)}
              </AvatarFallback>
            </Avatar>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
              {upload.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {t("Trocar foto")}
            </Button>
          </CardContent>
        </Card>

        <Card className="bl-glass lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("Dados pessoais")}</CardTitle>
            <CardDescription>{email}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
              <div>
                <Label>{t("Nome completo")}</Label>
                <Input {...form.register("full_name")} />
                {form.formState.errors.full_name && <p className="mt-1 text-xs text-destructive">{form.formState.errors.full_name.message}</p>}
              </div>
              <Controller
                name="phone"
                control={form.control}
                render={({ field }) => (
                  <div>
                    <Label>{t("Telefone (opcional)")}</Label>
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
                name="whatsapp"
                control={form.control}
                render={({ field }) => (
                  <div>
                    <Label>{t("WhatsApp")}</Label>
                    <Input
                      inputMode="tel"
                      placeholder={PHONE_PLACEHOLDER}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(formatPhoneBR(e.target.value))}
                    />
                  </div>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("Salvar")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="bl-glass lg:col-span-3">
          <CardHeader>
            <CardTitle>{t("Endereço")}</CardTitle>
            <CardDescription>{t("Usado para facilitar o atendimento das empresas")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>{t("CEP")}</Label>
                <div className="flex gap-2">
                  <Input
                    inputMode="numeric"
                    placeholder="01310-100"
                    value={cep}
                    onChange={(e) => {
                      const next = formatCep(e.target.value);
                      setCep(next);
                      if (next.replace(/\D/g, "").length === 8) void searchCep(next);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={t("Buscar CEP")}
                    disabled={cepLoading}
                    onClick={() => void searchCep(cep)}
                  >
                    {cepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label>{t("Rua / Avenida")}</Label>
                <Input {...form.register("address")} placeholder="Av. Paulista" />
              </div>
              <div>
                <Label>{t("Número")}</Label>
                <Input inputMode="numeric" {...form.register("address_number")} placeholder="123" />
              </div>
              <div>
                <Label>{t("Complemento")}</Label>
                <Input {...form.register("address_complement")} placeholder="Apto 42" />
              </div>
              <div>
                <Label>{t("Bairro")}</Label>
                <Input {...form.register("neighborhood")} placeholder="Centro" />
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-3">
                <div>
                  <Label>{t("Cidade")}</Label>
                  <Input {...form.register("city")} placeholder="São Paulo" />
                </div>
                <div>
                  <Label>{t("UF")}</Label>
                  <Input maxLength={2} {...form.register("state")} placeholder="SP" />
                </div>
              </div>
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("Salvar endereço")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="bl-glass lg:col-span-3">
          <CardHeader><CardTitle>{t("Alterar senha")}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={pwForm.handleSubmit((v) => changePw.mutate(v))} className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>{t("Nova senha")}</Label>
                <Input type="password" {...pwForm.register("password")} />
                {pwForm.formState.errors.password && <p className="mt-1 text-xs text-destructive">{pwForm.formState.errors.password.message}</p>}
              </div>
              <div>
                <Label>{t("Confirmar senha")}</Label>
                <Input type="password" {...pwForm.register("confirm")} />
                {pwForm.formState.errors.confirm && <p className="mt-1 text-xs text-destructive">{pwForm.formState.errors.confirm.message}</p>}
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" disabled={changePw.isPending}>
                  {changePw.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("Alterar senha")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="lg:col-span-3">
          <RecoveryKeyCard email={email ?? ""} />
        </div>

        <div className="lg:col-span-3">
          <DeleteAccountCard />
        </div>
      </div>
    </div>
  );
}