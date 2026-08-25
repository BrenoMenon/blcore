import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { useT } from "@/lib/i18n";

const schema = z
  .object({
    password: z.string().min(6, "Mínimo 6 caracteres"),
    confirm: z.string().min(6, "Mínimo 6 caracteres"),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "As senhas não conferem" });

type Form = z.infer<typeof schema>;

export function ChangePasswordCard() {
  const t = useT();
  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" } });

  const changePw = useMutation({
    mutationFn: async (v: Form) => {
      const { error } = await supabase.auth.updateUser({ password: v.password });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("Senha alterada"));
      form.reset();
    },
    onError: (e: Error) => toast.error(t("Erro"), { description: e.message }),
  });

  return (
    <Card className="bl-glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5 shrink-0 text-primary" />
          <span className="min-w-0">{t("Alterar senha")}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit((v) => changePw.mutate(v))} className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <Label>{t("Nova senha")}</Label>
            <Input type="password" autoComplete="new-password" {...form.register("password")} />
            {form.formState.errors.password && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
          <div className="min-w-0">
            <Label>{t("Confirmar senha")}</Label>
            <Input type="password" autoComplete="new-password" {...form.register("confirm")} />
            {form.formState.errors.confirm && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.confirm.message}</p>
            )}
          </div>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" disabled={changePw.isPending}>
              {changePw.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("Alterar senha")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
