import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { currency } from "@/lib/format";
import { DEFAULT_DURATION_MIN, durationLabel } from "@/lib/duration";
import type { Tables } from "@/integrations/supabase/types";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/services")({
  component: ServicesPage,
});

type Service = Tables<"services">;

const colors = ["#22C55E", "#2563EB", "#38BDF8", "#F59E0B", "#EF4444", "#A855F7", "#EC4899", "#14B8A6"];

const schema = z.object({
  name: z.string().min(2, "Obrigatório").max(120),
  price: z.coerce.number().min(0),
  // Duração é opcional: vazio = 30 min (padrão).
  duration_min: z.union([z.literal(""), z.coerce.number().int().min(5).max(600)]),
  color: z.string(),
  description: z.string().max(500).optional().or(z.literal("")),
  active: z.boolean(),
});
type Form = z.infer<typeof schema>;

function ServicesPage() {
  const t = useT();
  const { userId } = Route.useRouteContext();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Service | null>(null);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["services", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").eq("user_id", userId).order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter((s) => s.name.toLowerCase().includes(q));
  }, [data, search]);

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("Serviço excluído"));
      qc.invalidateQueries({ queryKey: ["services", userId] });
    },
    onError: (e: Error) => toast.error(t("Erro"), { description: e.message }),
  });

  return (
    <div>
      <PageHeader
        title={t("Serviços")}
        description={t("Cadastre os serviços que você oferece")}
        action={
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="shadow-[var(--shadow-glow)]">
            <Plus className="mr-2 h-4 w-4" /> {t("Novo serviço")}
          </Button>
        }
      />

      <div className="mb-4 relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Buscar serviços…")} className="pl-9" />
      </div>

      {isLoading && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-32 rounded-2xl" />)}</div>}

      {!isLoading && filtered.length === 0 && (
        <div className="bl-glass grid place-items-center rounded-3xl p-12 text-center">
          <p className="text-muted-foreground">{t("Nenhum serviço cadastrado.")}</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((s) => (
          <div key={s.id} className="bl-glass group relative overflow-hidden rounded-2xl p-5">
            <div className="absolute inset-x-0 top-0 h-1" style={{ background: s.color ?? "var(--brand-green)" }} />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold">{s.name}</h3>
                {durationLabel(s.duration_min) && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{durationLabel(s.duration_min)}</p>
                )}
              </div>
              {!s.active && <Badge variant="outline" className="shrink-0 border-slate-500/40 text-slate-300">{t("Inativo")}</Badge>}
            </div>
            {s.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>}
            <div className="mt-4 flex items-end justify-between">
              <p className="text-xl font-extrabold text-primary">{currency(s.price)}</p>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("Excluir serviço?")}</AlertDialogTitle>
                      <AlertDialogDescription>{t("Agendamentos que usam este serviço não poderão ser excluídos.")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => removeMut.mutate(s.id)} className="bg-destructive hover:bg-destructive/90">{t("Excluir")}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ServiceDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

function ServiceDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (o: boolean) => void; editing: Service | null }) {
  const t = useT();
  const { userId } = Route.useRouteContext();
  const qc = useQueryClient();
  const form = useForm<Form>({
    resolver: zodResolver(schema) as any,
    values: {
      name: editing?.name ?? "",
      price: Number(editing?.price ?? 0),
      duration_min: editing?.duration_min ?? "",
      color: editing?.color ?? colors[0],
      description: editing?.description ?? "",
      active: editing?.active ?? true,
    },
  });

  const save = useMutation({
    mutationFn: async (v: Form) => {
      const payload = {
        ...v,
        duration_min: v.duration_min === "" ? DEFAULT_DURATION_MIN : Number(v.duration_min),
        description: v.description || null,
        user_id: userId,
      };
      if (editing) {
        const { error } = await supabase.from("services").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("services").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? t("Serviço atualizado") : t("Serviço criado"));
      qc.invalidateQueries({ queryKey: ["services", userId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(t("Erro"), { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? t("Editar serviço") : t("Novo serviço")}</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit((v: any) => save.mutate(v))} className="space-y-3">
          <div>
            <Label>{t("Nome *")}</Label>
            <Input {...form.register("name")} />
            {form.formState.errors.name && <p className="mt-1 text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{t("Preço (R$)")}</Label>
              <Input type="number" step="0.01" {...form.register("price")} />
            </div>
            <div>
              <Label>{t("Duração (min) (opcional)")}</Label>
              <Input type="number" inputMode="numeric" placeholder="30" {...form.register("duration_min")} />
            </div>
          </div>
          <div>
            <Label>{t("Cor")}</Label>
            <Controller
              name="color"
              control={form.control}
              render={({ field }) => (
                <div className="mt-2 flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => field.onChange(c)}
                      className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-background transition ${field.value === c ? "ring-2 ring-primary" : ""}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              )}
            />
          </div>
          <div>
            <Label>{t("Descrição")}</Label>
            <Textarea rows={2} {...form.register("description")} />
          </div>
          <Controller
            name="active"
            control={form.control}
            render={({ field }) => (
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/40 p-3">
                <div>
                  <Label className="cursor-pointer">{t("Ativo")}</Label>
                  <p className="text-xs text-muted-foreground">{t("Serviços inativos não aparecem na agenda")}</p>
                </div>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
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