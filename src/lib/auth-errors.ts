import type { Lang } from "@/lib/i18n";

type Msg = Record<Lang, string>;

const MESSAGES: { match: RegExp; msg: Msg }[] = [
  {
    match: /invalid login credentials|invalid credentials|invalid email or password/i,
    msg: {
      pt: "Email ou senha incorretos.",
      en: "Incorrect email or password.",
      es: "Correo o contraseña incorrectos.",
    },
  },
  {
    match: /email not confirmed/i,
    msg: {
      pt: "Seu e-mail ainda não foi confirmado.",
      en: "Your email has not been confirmed yet.",
      es: "Tu correo aún no fue confirmado.",
    },
  },
  {
    match: /user already registered|already been registered|duplicate key.*email/i,
    msg: {
      pt: "Já existe uma conta com este e-mail.",
      en: "An account with this email already exists.",
      es: "Ya existe una cuenta con este correo.",
    },
  },
  {
    match: /password should be at least|password.*6 characters|weak password/i,
    msg: {
      pt: "A senha precisa ter ao menos 6 caracteres.",
      en: "Password must be at least 6 characters.",
      es: "La contraseña debe tener al menos 6 caracteres.",
    },
  },
  {
    match: /unable to validate email address|invalid email/i,
    msg: {
      pt: "E-mail inválido.",
      en: "Invalid email.",
      es: "Correo inválido.",
    },
  },
  {
    match: /user not found|no user found/i,
    msg: {
      pt: "Não encontramos uma conta com este e-mail.",
      en: "We couldn't find an account with this email.",
      es: "No encontramos una cuenta con este correo.",
    },
  },
  {
    match: /jwt|session (from session_id claim in jwt )?(does not exist|expired)|refresh token|token has expired|not authenticated|unauthorized|401/i,
    msg: {
      pt: "Sua sessão expirou. Entre novamente.",
      en: "Your session has expired. Please sign in again.",
      es: "Tu sesión expiró. Inicia sesión de nuevo.",
    },
  },
  {
    match: /email rate limit|too many requests|rate limit/i,
    msg: {
      pt: "Muitas tentativas. Aguarde alguns instantes e tente novamente.",
      en: "Too many attempts. Please wait a moment and try again.",
      es: "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
    },
  },
  {
    match: /failed to fetch|network|fetch failed/i,
    msg: {
      pt: "Falha de conexão. Verifique sua internet.",
      en: "Connection failed. Check your internet.",
      es: "Falla de conexión. Revisa tu internet.",
    },
  },
  {
    match: /row-level security|permission denied|not allowed/i,
    msg: {
      pt: "Você não tem permissão para esta ação.",
      en: "You don't have permission for this action.",
      es: "No tienes permiso para esta acción.",
    },
  },
];

const FALLBACK: Msg = {
  pt: "Não foi possível concluir. Tente novamente.",
  en: "We couldn't complete the request. Please try again.",
  es: "No se pudo completar. Inténtalo de nuevo.",
};

const hasLatinAccentsOrPt = (s: string) => /[ãõáéíóúçâêô]|não|senha|conta|agend/i.test(s);

/** Traduz mensagens de erro (Supabase/rede) para o idioma atual do usuário. */
export function friendlyError(error: unknown, lang: Lang = "pt"): string {
  const raw =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : ((error as { message?: string } | null)?.message ?? "");
  const text = raw.trim();
  if (!text) return FALLBACK[lang];
  for (const entry of MESSAGES) {
    if (entry.match.test(text)) return entry.msg[lang];
  }
  // Mensagens já escritas em português (nossas) são mantidas; textos técnicos
  // em inglês viram uma mensagem amigável.
  if (hasLatinAccentsOrPt(text)) return text;
  if (/^[\x20-\x7E]+$/.test(text) && /[a-z]/i.test(text)) return FALLBACK[lang];
  return text;
}
