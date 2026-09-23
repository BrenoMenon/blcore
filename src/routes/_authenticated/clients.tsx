import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Mail, Pencil, Phone, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate, initials } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";
import { openWhatsApp } from "@/lib/whatsapp";
import { formatPhoneBR, PHONE_PLACEHOLDER } from "@/lib/phone";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/clients")({
  component: ClientsPage,
});

type Client = Tables<"clients">;

const clientSchema = z.object({
  name: z.string().min(2, "Nome obrigatório").max(120),
  whatsapp: z
    .string()
    .min(10, "Informe o WhatsApp")
    .max(30),
  phone: z.string().max(30).optional().or(z.literal("")),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  birth_date: z.string().optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});
type ClientForm = z.infer<typeof clientSchema>;

function ClientsPage() {
  const t = useT();
  const { userId } = Route.useRouteContext();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["clients", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("user_id", userId).order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter((c) =>
      [c.name, c.phone, c.email, c.whatsapp].filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  }, [data, search]);

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("Cliente excluído"));
      qc.invalidateQueries({ queryKey: ["clients", userId] });
    },
    onError: (e: Error) => toast.error(t("Erro ao excluir"), { description: e.message }),
  });

  return (
    <div>
      <PageHeader
        title={t("Clientes")}
        description={t("Cadastre e gerencie seus clientes")}
        action={
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="shadow-[var(--shadow-glow)]">
            <UserPlus className="mr-2 h-4 w-4" /> {t("Novo cliente")}
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Buscar por nome, telefone ou e-mail…")} className="pl-9" />
        </div>
      </div>

      {isLoading && <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>}

      {!isLoading && filtered.length === 0 && (
        <div className="bl-glass grid place-items-center rounded-3xl p-12 text-center">
          <p className="text-muted-foreground">{t("Nenhum cliente encontrado.")}</p>
          <Button variant="outline" className="mt-4" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> {t("Cadastrar cliente")}
          </Button>
        </div>
      )}

      <div className="grid gap-3">
        {filtered.map((c) => (
          <div key={c.id} className="bl-glass rounded-2xl p-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="h-11 w-11 shrink-0">
                <AvatarFallback className="bg-primary/20 font-bold text-primary">{initials(c.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.name}</p>
                <div className="mt-0.5 space-y-0.5 text-xs text-muted-foreground sm:flex sm:flex-wrap sm:gap-x-3 sm:space-y-0">
                  {c.whatsapp && <span className="flex min-w-0 items-center gap-1"><WhatsAppIcon className="h-3 w-3 shrink-0" /> <span className="truncate">{c.whatsapp}</span></span>}
                  {c.phone && c.phone !== c.whatsapp && <span className="flex min-w-0 items-center gap-1"><Phone className="h-3 w-3 shrink-0" /> <span className="truncate">{c.phone}</span></span>}
                  {c.email && <span className="flex min-w-0 items-center gap-1"><Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{c.email}</span></span>}
                  {c.birth_date && <span className="block truncate">🎂 {fmtDate(c.birth_date)}</span>}
                </div>
              </div>
            </div>
            <div className="mt-3 flex shrink-0 items-center justify-end gap-1 border-t border-border/50 pt-2 sm:mt-0 sm:border-0 sm:pt-0">
              {c.whatsapp && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${t("Abrir WhatsApp de")} ${c.name}`}
                  title={t("Conversar no WhatsApp")}
                  className="text-[var(--brand-green)] hover:text-[var(--brand-green)]"
                  onClick={() => openWhatsApp(c.whatsapp)}
                >
                  <WhatsAppIcon className="h-4 w-4" />
                </Button>
              )}
              {(c.phone || c.whatsapp) && (
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  aria-label={`${t("Ligar para")} ${c.name}`}
                  title={t("Ligar")}
                >
                  <a href={`tel:${(c.phone || c.whatsapp)!.replace(/\D/g, "")}`}>
                    <Phone className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpen(true); }}>
                <Pencil className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("Excluir cliente?")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("Esta ação não pode ser desfeita. Também serão removidos todos os agendamentos deste cliente.")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => removeMut.mutate(c.id)} className="bg-destructive hover:bg-destructive/90">{t("Excluir")}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>

      <ClientDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

function ClientDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (o: boolean) => void; editing: Client | null }) {
  const t = useT();
  const { userId } = Route.useRouteContext();
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["welcome-tpl", userId],
    queryFn: async () =>
      (await supabase.from("company_settings").select("company_name").eq("user_id", userId).maybeSingle())
        .data,
    enabled: open,
  });
  const form = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    values: {
      name: editing?.name ?? "",
      phone: editing?.phone ?? "",
      whatsapp: editing?.whatsapp ?? "",
      email: editing?.email ?? "",
      birth_date: editing?.birth_date ?? "",
      notes: editing?.notes ?? "",
    },
  });

  const save = useMutation({
    mutationFn: async (v: ClientForm) => {
      const payload = {
        name: v.name,
        phone: v.phone || null,
        whatsapp: v.whatsapp || null,
        email: v.email || null,
        birth_date: v.birth_date || null,
        notes: v.notes || null,
        user_id: userId,
      };
      if (editing) {
        const { error } = await supabase.from("clients").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert(payload);
        if (error) throw error;
      }
      return { ...v };
    },
    onSuccess: (result) => {
      toast.success(editing ? t("Cliente atualizado") : t("Cliente cadastrado"));
      qc.invalidateQueries({ queryKey: ["clients", userId] });
      onOpenChange(false);
      // Novo cliente com WhatsApp → abre conversa com boas-vindas
      const wa = result?.whatsapp?.trim();
      if (!editing && wa) {
        const company = settings.data?.company_name ?? t("nossa empresa");
        const msg =
          `Olá ${result.name}! 👋\n\n` +
          `Você foi cadastrado(a) na plataforma BL Core como cliente da ${company}.\n\n` +
          `Na plataforma você pode ver seus horários, acompanhar seus atendimentos e também marcar consultas ou horários direto por lá, quando quiser.\n\n` +
          `Acesse agora: https://blcore.netlify.app\n\n` +
          `Basta criar seu acesso com este mesmo contato e pronto. Seja muito bem-vindo(a)! ✨`;
        const opened = openWhatsApp(wa, msg);
        if (opened) toast.info(t("Abrindo WhatsApp…"), { description: t("Uma mensagem de boas-vindas foi preparada.") });
      }
    },
    onError: (e: Error) => toast.error(t("Erro"), { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? t("Editar cliente") : t("Novo cliente")}</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-3">
          <div>
            <Label>{t("Nome *")}</Label>
            <Input {...form.register("name")} />
            {form.formState.errors.name && <p className="mt-1 text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Controller
              name="whatsapp"
              control={form.control}
              render={({ field }) => (
                <div>
                  <Label>{t("WhatsApp *")}</Label>
                  <Input inputMode="tel" placeholder={PHONE_PLACEHOLDER} value={field.value ?? ""} onChange={(e) => field.onChange(formatPhoneBR(e.target.value))} />
                  {form.formState.errors.whatsapp && <p className="mt-1 text-xs text-destructive">{form.formState.errors.whatsapp.message}</p>}
                </div>
              )}
            />
            <Controller
              name="phone"
              control={form.control}
              render={({ field }) => (
                <div>
                  <Label>{t("Telefone (opcional)")}</Label>
                  <Input inputMode="tel" placeholder={PHONE_PLACEHOLDER} value={field.value ?? ""} onChange={(e) => field.onChange(formatPhoneBR(e.target.value))} />
                </div>
              )}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>{t("E-mail (opcional)")}</Label><Input type="email" {...form.register("email")} /></div>
            <div><Label>{t("Data de nascimento (opcional)")}</Label><Input type="date" {...form.register("birth_date")} /></div>
          </div>
          <div><Label>{t("Observações")}</Label><Textarea rows={3} {...form.register("notes")} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("Cancelar")}</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("Salvar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}