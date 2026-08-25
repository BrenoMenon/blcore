import { cn } from "@/lib/utils";

export function Logo({ className, showText = true, size = "md" }: {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const s = size === "sm" ? "h-9 w-9" : size === "lg" ? "h-14 w-14" : "h-10 w-10";
  const t = size === "sm" ? "text-sm" : size === "lg" ? "text-2xl" : "text-lg";
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "grid shrink-0 place-items-center rounded-2xl bg-primary text-white shadow-[var(--shadow-glow)]",
          s,
        )}
      >
        <BrandMark />
      </div>
      {showText && (
        <div className="flex min-w-0 flex-col leading-tight">
          <span className={cn("bl-gradient-text font-extrabold tracking-tight", t)}>BL CORE</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Gestão
          </span>
        </div>
      )}
    </div>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-[62%] w-[62%]", className)} fill="none" aria-hidden="true">
      {/* insígnia: estrela/asterisco geométrico de 8 pontas */}
      <g stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
        <path d="M20 5 V35" />
        <path d="M5 20 H35" />
        <path d="M9.4 9.4 L30.6 30.6" />
        <path d="M30.6 9.4 L9.4 30.6" />
      </g>
      <circle cx="20" cy="20" r="3.6" fill="currentColor" />
    </svg>
  );
}