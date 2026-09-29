import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RECOVERY_QUESTIONS } from "@/lib/recovery-questions";
import { saveRecoveryKey } from "@/lib/recovery.functions";
import { toast } from "sonner";
import { KeyRound, Loader2, Save } from "lucide-react";
import { useT } from "@/lib/i18n";

export function RecoveryKeyCard({ email }: { email: string }) {
  const t = useT();
  const [question, setQuestion] = useState<string>(RECOVERY_QUESTIONS[0]);
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);

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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 shrink-0 text-primary" /> <span className="min-w-0">{t("Chave de recuperação")}</span>
        </CardTitle>
        <CardDescription>{t("Pergunta usada para recuperar o acesso se você esquecer a senha")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>{t("Pergunta")}</Label>
          <Select value={question} onValueChange={setQuestion}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RECOVERY_QUESTIONS.map((q) => <SelectItem key={q} value={q}>{t(q)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t("Resposta")}</Label>
          <Input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={t("Sua resposta")} />
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <Button type="button" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {t("Salvar chave")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
