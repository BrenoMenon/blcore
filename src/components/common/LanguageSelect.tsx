import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGUAGES, useI18n } from "@/lib/i18n";
import { FlagIcon } from "@/components/common/FlagIcon";
import { Check } from "lucide-react";

export function LanguageSelect({ variant = "ghost" }: { variant?: "ghost" | "outline" }) {
  const { lang, setLang, t } = useI18n();
  const current = LANGUAGES.find((l) => l.value === lang) ?? LANGUAGES[0]!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size="icon"
          className="rounded-full"
          aria-label={t("Idioma")}
          title={`${t("Idioma")}: ${current.label}`}
        >
          <FlagIcon lang={current.value} className="h-3.5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{t("Idioma")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGUAGES.map((l) => (
          <DropdownMenuItem key={l.value} onClick={() => setLang(l.value)} className="gap-2">
            <FlagIcon lang={l.value} className="h-3.5 w-5" />
            <span className="flex-1 truncate">{l.label}</span>
            {l.value === lang && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
