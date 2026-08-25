import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/integrations/supabase/db";
import { toast } from "sonner";
import { Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";

/** Evita exibir páginas HTML de erro dentro do toast. */
function cleanMessage(message: string, t: (s: string) => string) {
  const trimmed = (message ?? "").trim();
  if (/^<(!doctype|html)/i.test(trimmed) || trimmed.includes("<html")) {
    return t("Falha de comunicação com o servidor. Tente novamente.");
  }
  return trimmed || t("Erro inesperado.");
}

export function DeleteAccountCard() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();



  async function confirm() {
    if (password.length < 6) {
      toast.error(t("Digite sua senha para confirmar"));
      return;
    }
    setLoading(true);
    try {
      // Reautentica com a senha atual antes de apagar (confirmação de identidade)
      const { data: sessionData } = await supabase.auth.getUser();
      const email = sessionData.user?.email;
      if (!email) throw new Error(t("Sessão expirada. Entre novamente."));

      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) throw new Error(t("Senha incorreta. A conta não foi excluída."));

      // Apaga todos os dados do usuário (perfil, clientes, serviços,
      //    agendamentos, notificações) respeitando as foreign keys.
      const { error: rpcErr } = await db.rpc("delete_my_account");
      if (rpcErr) throw new Error(cleanMessage(rpcErr.message, t));

      // A RPC (security definer) também remove o usuário de auth.users,
      // encerrando o acesso definitivamente.

      toast.success(t("Conta excluída"), { description: t("Sentiremos sua falta.") });
      qc.clear();
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    } catch (e) {
      toast.error(t("Não foi possível excluir"), { description: cleanMessage((e as Error).message, t) });
    } finally {
      setLoading(false);
      setPassword("");
    }
  }


  return (
    <Card className="border-destructive/40 bg-destructive/[0.04]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <ShieldAlert className="h-5 w-5 shrink-0" /> <span className="min-w-0">{t("Excluir minha conta")}</span>
        </CardTitle>
        <CardDescription>
          {t("Todos os seus dados (agendamentos, clientes, serviços e configurações) serão apagados permanentemente. Esta ação não pode ser desfeita.")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" /> {t("Excluir conta")}
        </Button>
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setPassword("");
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Confirmar exclusão da conta")}</DialogTitle>
            <DialogDescription>
              {t("Para confirmar, digite a senha da sua conta. Depois disso, tudo será apagado definitivamente.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>{t("Sua senha")}</Label>
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) void confirm();
              }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("Cancelar")}
            </Button>
            <Button type="button" variant="destructive" onClick={confirm} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {t("Excluir definitivamente")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
