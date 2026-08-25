import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark";

type Ctx = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void };
const ThemeCtx = createContext<Ctx | null>(null);

const STORAGE_KEY = "bl-theme";

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    try {
      const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "dark";
      setThemeState(stored === "light" ? "light" : "dark");
      applyTheme(stored === "light" ? "light" : "dark");
    } catch {
      applyTheme("dark");
    }
  }, []);

  const value = useMemo<Ctx>(() => ({
    theme,
    setTheme: (t) => {
      setThemeState(t);
      try { localStorage.setItem(STORAGE_KEY, t); } catch { /* noop */ }
      applyTheme(t);
    },
    toggle: () => {
      const next: Theme = theme === "dark" ? "light" : "dark";
      setThemeState(next);
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* noop */ }
      applyTheme(next);
    },
  }), [theme]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export const themeBootScript = `try{var t=localStorage.getItem('${STORAGE_KEY}');if(t!=='light')t='dark';document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(t);document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}`;