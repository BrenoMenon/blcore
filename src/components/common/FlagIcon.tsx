import type { Lang } from "@/lib/i18n";

/**
 * Bandeiras em SVG (emojis de bandeira não renderizam no Windows/desktop).
 */
export function FlagIcon({ lang, className = "h-4 w-6" }: { lang: Lang; className?: string }) {
  const common = "shrink-0 rounded-[2px] ring-1 ring-black/10 " + className;
  if (lang === "pt")
    return (
      <svg viewBox="0 0 28 20" className={common} aria-hidden="true">
        <rect width="28" height="20" fill="#009B3A" />
        <path d="M14 2.2 26.2 10 14 17.8 1.8 10z" fill="#FEDF00" />
        <circle cx="14" cy="10" r="4.4" fill="#002776" />
        <path d="M9.9 8.5a9 9 0 0 1 8.2 2.2" stroke="#fff" strokeWidth="1.2" fill="none" />
      </svg>
    );
  if (lang === "en")
    return (
      <svg viewBox="0 0 28 20" className={common} aria-hidden="true">
        <rect width="28" height="20" fill="#fff" />
        {[0, 2, 4, 6, 8, 10, 12].map((i) => (
          <rect key={i} y={i * (20 / 13)} width="28" height={20 / 13} fill="#B22234" />
        ))}
        <rect width="12" height={(20 / 13) * 7} fill="#3C3B6E" />
        {[1, 3, 5].map((r) =>
          [1, 3, 5, 7, 9].map((c) => (
            <circle key={`${r}-${c}`} cx={c * 1.2} cy={r * 1.8} r="0.5" fill="#fff" />
          )),
        )}
      </svg>
    );
  return (
    <svg viewBox="0 0 28 20" className={common} aria-hidden="true">
      <rect width="28" height="20" fill="#AA151B" />
      <rect y="5" width="28" height="10" fill="#F1BF00" />
    </svg>
  );
}
