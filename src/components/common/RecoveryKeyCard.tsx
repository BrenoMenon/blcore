import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DEFAULT_RECOVERY_QUESTION } from "@/lib/recovery-questions";
import { saveRecoveryKey } from "@/lib/recovery.functions";
import { toast } from "sonner";
import { KeyRound, Loader2, Save, ShieldCheck } from "lucide-react";
import { useT } from "@/lib/i18n";

export function RecoveryKeyCard({ email }: { email: string }) {
  const t = useT();
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);

  const question = DEFAULT_RECOVERY_QUESTION;

  async function submit() {
    if (answer.trim().length < 2) return toast.error(t("Informe a resposta"));
    setSaving(true);
    try {
      await saveRecoveryKey({ data: { email, question, answer } });
      toast.success(t("Chave de recuperação atualizada"));
      setAnswer("");
    } catch (e) {
      toast.error(t("Erro"), { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="bl-glass">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <KeyRound className="h-4 w-4" />
          </div>
          <span className="min-w-0">{t("Chave de recuperação")}</span>
        </CardTitle>
        <CardDescription className="text-xs">
          {t("Pergunta usada para recuperar o acesso se você esquecer a senha")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border/70 bg-muted/30 p-3 sm:p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>{t("Pergunta de segurança")}</span>
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">
            {t(question)}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t("Sua resposta")}</Label>
          <Input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={t("Digite a resposta...")}
            className="h-10 text-sm"
          />
        </div>

        <div className="flex justify-end pt-1">
          <Button
            type="button"
            size="sm"
            onClick={submit}
            disabled={saving}
            className="h-9 px-4 text-xs font-semibold shadow-xs"
          >
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            {t("Salvar chave")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
