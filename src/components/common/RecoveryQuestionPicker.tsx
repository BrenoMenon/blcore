import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CUSTOM_QUESTION_VALUE,
  MAX_RECOVERY_QUESTION_LENGTH,
  RECOVERY_QUESTIONS,
} from "@/lib/recovery-questions";
import { useT } from "@/lib/i18n";

/**
 * Lista de perguntas de segurança + opção de escrever a própria pergunta.
 * `value` é sempre o texto final da pergunta (pronta ou personalizada).
 */
export function RecoveryQuestionPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (question: string) => void;
  label?: string;
}) {
  const t = useT();
  const isPreset = (RECOVERY_QUESTIONS as readonly string[]).includes(value);
  const [custom, setCustom] = useState(!isPreset && value !== "");
  const selectValue = custom ? CUSTOM_QUESTION_VALUE : isPreset ? value : undefined;

  return (
    <div className="space-y-2">
      {label && <Label className="text-xs font-medium">{label}</Label>}
      <Select
        value={selectValue}
        onValueChange={(v) => {
          if (v === CUSTOM_QUESTION_VALUE) {
            setCustom(true);
            onChange("");
          } else {
            setCustom(false);
            onChange(v);
          }
        }}
      >
        <SelectTrigger className="h-10 text-sm">
          <SelectValue placeholder={t("Escolha uma pergunta")} />
        </SelectTrigger>
        <SelectContent>
          {RECOVERY_QUESTIONS.map((q) => (
            <SelectItem key={q} value={q}>{t(q)}</SelectItem>
          ))}
          <SelectItem value={CUSTOM_QUESTION_VALUE}>{t("Escrever minha própria pergunta")}</SelectItem>
        </SelectContent>
      </Select>

      {custom && (
        <Input
          value={value}
          maxLength={MAX_RECOVERY_QUESTION_LENGTH}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("Digite sua pergunta")}
          className="h-10 text-sm"
          autoFocus
        />
      )}
    </div>
  );
}
