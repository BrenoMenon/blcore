import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as common from "./dict/common";
import * as dashboard from "./dict/dashboard";
import * as auth from "./dict/auth";
import * as agenda from "./dict/agenda";
import * as clients from "./dict/clients";
import * as services from "./dict/services";
import * as explore from "./dict/explore";
import * as profile from "./dict/profile";
import * as settings from "./dict/settings";

export type Lang = "pt" | "en" | "es";

export const LANGUAGES: { value: Lang; label: string; flag: string }[] = [
  { value: "pt", label: "Português", flag: "🇧🇷" },
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "es", label: "Español", flag: "🇪🇸" },
];

const chunks = [common, dashboard, auth, agenda, clients, services, explore, profile, settings];

const merge = (key: "en" | "es"): Record<string, string> =>
  Object.assign({}, ...chunks.map((c) => c[key] ?? {}));

const DICTS: Record<Lang, Record<string, string>> = {
  pt: {},
  en: merge("en"),
  es: merge("es"),
};

const STORAGE_KEY = "bl-lang";
const HTML_LANG: Record<Lang, string> = { pt: "pt-BR", en: "en", es: "es" };

export function translate(lang: Lang, text: string, vars?: Record<string, string | number>) {
  let out = DICTS[lang]?.[text] ?? text;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (text: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<Ctx>({ lang: "pt", setLang: () => {}, t: (s) => s });

export function I18nProvider({ children }: { children: ReactNode }) {
  const lang: Lang = "pt";

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "pt");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = "pt-BR";
  }, []);

  const setLang = useCallback((_l: Lang) => {
    // Only Portuguese is allowed
  }, []);

  const t = useCallback(
    (text: string, vars?: Record<string, string | number>) => translate("pt", text, vars),
    [],
  );

  const value = useMemo(() => ({ lang: "pt" as Lang, setLang, t }), [setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

/** Atalho para traduzir apenas o texto. */
export function useT() {
  return useI18n().t;
}
