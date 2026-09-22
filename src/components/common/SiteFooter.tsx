import { useT } from "@/lib/i18n";

export function SiteFooter({ className = "" }: { className?: string }) {
  const t = useT();
  return (
    <footer
      className={`border-t border-border/60 px-4 py-6 text-center text-xs text-muted-foreground sm:px-6 lg:px-8 ${className}`}
    >
      <p className="mx-auto max-w-2xl leading-relaxed">
        © {new Date().getFullYear()} BL Core Gestão · {t("Desenvolvido por")}{" "}
        <span className="font-semibold text-foreground">Breno Menon</span>
        <span className="mx-1 text-muted-foreground/60">|</span>
        <span className="bl-gradient-text font-semibold">BM Digital</span>
        {" " + t("e") + " "}
        <span className="font-semibold text-foreground">Lorenzo Fadeli</span>
        <span className="mx-1 text-muted-foreground/60">|</span>
        <span className="bl-gradient-text font-semibold">LF Studio DEV</span>
      </p>
    </footer>
  );
}