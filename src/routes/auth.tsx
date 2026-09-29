import { createFileRoute, useNavigate, useSearch, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SiteFooter } from "@/components/common/SiteFooter";
import { Logo, BrandMark } from "@/components/brand/Logo";
import { toast } from "sonner";
import { KeyRound, Loader2, Moon, ShieldCheck, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { RECOVERY_QUESTIONS } from "@/lib/recovery-questions";
import { saveRecoveryKey, getRecoveryQuestion, resetWithRecovery } from "@/lib/recovery.functions";
import { useI18n, useT } from "@/lib/i18n";
import { friendlyError } from "@/lib/auth-errors";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});
const signupSchema = loginSchema.extend({
  full_name: z.string().min(2, "Informe seu nome"),
  user_type: z.enum(["client", "company"]),
  business_name: z.string().optional(),
  cnpj: z.string().optional(),
  question: z.string().min(3, "Escolha uma pergunta"),
  answer: z.string().min(2, "Informe a resposta"),
});

function AuthPage() {
  const navigate = useNavigate();
  const t = useT();
  const search = useSearch({ from: "/auth" });
  const [tab, setTab] = useState<"login" | "signup">(search.mode ?? "login");
  const [forgotOpen, setForgotOpen] = useState(false);

  useEffect(() => { if (search.mode) setTab(search.mode); }, [search.mode]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-2">
        <HeroPanel />

        <div className="relative flex items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
          <div className="absolute right-4 top-4 flex items-center gap-2 sm:right-6 sm:top-6">
            <ThemeToggle />
          </div>
          <div className="w-full max-w-md">
            <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
              <Logo size="lg" />
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)] sm:p-8">
              <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("Bem-vindo de volta")}</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {t("Entre na sua conta ou crie uma nova em segundos.")}
                </p>
              </div>
              <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">{t("Entrar")}</TabsTrigger>
                  <TabsTrigger value="signup">{t("Criar conta")}</TabsTrigger>
                </TabsList>
                <TabsContent value="login" className="mt-6">
                  <LoginForm
                    onDone={() => navigate({ to: "/dashboard" })}
                    onForgot={() => setForgotOpen(true)}
                  />
                </TabsContent>
                <TabsContent value="signup" className="mt-6">
                  <SignupForm
                    onDone={(type) => navigate({ to: type === "company" ? "/settings" : "/profile" })}
                  />
                </TabsContent>
              </Tabs>
            </div>

            <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              {t("Seus dados totalmente protegidos.")}
            </p>

            <SiteFooter className="mt-4 border-0" />
          </div>
        </div>
      </div>

      <ForgotDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const t = useT();
  const isDark = theme === "dark";
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      className="rounded-full"
      aria-label={t(isDark ? "Ativar tema claro" : "Ativar tema escuro")}
      title={t(isDark ? "Tema claro" : "Tema escuro")}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function HeroPanel() {
  const t = useT();
  return (
    <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 lg:text-white">
      <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
      <div
        className="pointer-events-none absolute -left-24 top-1/4 h-96 w-96 rounded-full opacity-50 blur-3xl"
        style={{ background: "oklch(0.82 0.13 163 / 0.45)" }}
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-0 h-[28rem] w-[28rem] rounded-full opacity-40 blur-3xl"
        style={{ background: "oklch(0.3 0.05 175 / 0.7)" }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      />
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="h-[520px] w-[520px] text-white/[0.09]">
          <BrandMark className="h-full w-full" />
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 text-white backdrop-blur">
          <BrandMark />
        </div>
        <div className="flex flex-col justify-center leading-none">
          <p className="text-lg font-extrabold tracking-tight leading-none">BL CORE</p>
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.26em] text-white/80 leading-none mt-0.5">Gestão</p>
        </div>
      </div>

      <div className="relative z-10 max-w-lg space-y-7">
        <div>
          <h2 className="text-4xl font-extrabold leading-[1.1] tracking-tight xl:text-5xl">
            {t("O controle do seu negócio na palma da mão.")}
          </h2>
          <p className="mt-4 text-base text-white/80">
            {t("Agenda, orçamentos com IA, clientes e serviços em um só lugar — rápido, profissional e completo.")}
          </p>
        </div>

        <ul className="space-y-3">
          <Perk text={t("Orçamentos profissionais com IA e exportação em PDF")} />
          <Perk text={t("Criação rápida de propostas por voz ou texto")} />
          <Perk text={t("Agendamentos com confirmação no WhatsApp")} />
          <Perk text={t("CRM de clientes com histórico de orçamentos e serviços")} />
          <Perk text={t("Bloqueio inteligente de horários em conflito")} />
          <Perk text={t("Dados protegidos e isolados por conta")} />
        </ul>
      </div>

      <div className="relative z-10" />
    </aside>
  );
}

function Perk({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-3 text-[15px] text-white/90">
      <span className="h-2 w-2 shrink-0 rounded-full bg-white" />
      {text}
    </li>
  );
}

function LoginForm({ onDone, onForgot }: { onDone: () => void; onForgot: () => void }) {
  const { t, lang } = useI18n();
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const submit = form.handleSubmit(async (v) => {
    const { error } = await supabase.auth.signInWithPassword(v);
    if (error) return toast.error(t("Não foi possível entrar"), { description: friendlyError(error, lang) });
    toast.success(t("Bem-vindo!"));
    onDone();
  });
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t("E-mail")} error={form.formState.errors.email?.message && t(form.formState.errors.email.message)}>
        <Input type="email" placeholder={t("voce@exemplo.com")} autoComplete="email" {...form.register("email")} />
      </Field>
      <Field label={t("Senha")} error={form.formState.errors.password?.message && t(form.formState.errors.password.message)}>
        <Input type="password" placeholder="••••••••" autoComplete="current-password" {...form.register("password")} />
      </Field>
      <Button className="w-full" size="lg" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t("Entrar")}
      </Button>
      <div className="pt-1 text-center">
        <button
          type="button"
          onClick={onForgot}
          className="text-xs font-medium text-muted-foreground underline-offset-4 transition hover:text-primary hover:underline"
        >
          {t("Esqueceu a senha?")}
        </button>
      </div>
    </form>
  );
}

function SignupForm({ onDone }: { onDone: (type: "client" | "company") => void }) {
  const { t, lang } = useI18n();
  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      user_type: "client",
      business_name: "",
      question: RECOVERY_QUESTIONS[0],
      answer: "",
    },
  });
  const userType = form.watch("user_type");
  const question = form.watch("question");

  const submit = form.handleSubmit(async (v) => {
    const { data, error } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: {
          full_name: v.full_name,
          user_type: v.user_type,
          business_name: v.user_type === "company" ? (v.business_name || v.full_name) : null,
        },
      },
    });
    if (error) return toast.error(t("Não foi possível cadastrar"), { description: friendlyError(error, lang) });

    if (!data.session) {
      const signIn = await supabase.auth.signInWithPassword({ email: v.email, password: v.password });
      if (signIn.error) {
        return toast.error(t("Conta criada, mas não foi possível entrar"), { description: friendlyError(signIn.error, lang) });
      }
    }

    try {
      await saveRecoveryKey({ data: { email: v.email, question: v.question, answer: v.answer } });
    } catch {
      toast.warning(t("Conta criada"), { description: t("Não conseguimos salvar a chave de recuperação agora. Configure em Ajustes.") });
    }

    if (v.user_type === "company" && v.cnpj?.trim()) {
      try {
        const cleanCnpj = v.cnpj.trim();
        localStorage.setItem("blcore_company_cnpj", cleanCnpj);
        const userRes = await supabase.auth.getUser();
        const uid = userRes.data.user?.id || data.user?.id;
        if (uid) {
          localStorage.setItem(`blcore_cnpj_${uid}`, cleanCnpj);
          await supabase.from("company_settings").upsert({
            user_id: uid,
            company_name: v.business_name || v.full_name,
            whatsapp_config: { cnpj: cleanCnpj },
          });
        }
      } catch (err) {
        console.warn("Could not save company CNPJ during registration:", err);
      }
    }

    toast.success(t("Conta criada!"), {
      description: t(
        v.user_type === "company"
          ? "Agora cadastre os dados da sua empresa."
          : "Complete seus dados de cliente.",
      ),
    });
    onDone(v.user_type);
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/40 p-1">
        {([
          { v: "client", label: "Sou cliente" },
          { v: "company", label: "Sou empresa" },
        ] as const).map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => form.setValue("user_type", o.v)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
              userType === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(o.label)}
          </button>
        ))}
      </div>
      <Field label={t("Nome completo")} error={form.formState.errors.full_name?.message && t(form.formState.errors.full_name.message)}>
        <Input placeholder={t("Seu nome")} autoComplete="name" {...form.register("full_name")} />
      </Field>
      {userType === "company" && (
        <>
          <Field label={t("Nome do negócio")}>
            <Input placeholder="Ex: BL Core Barbearia" {...form.register("business_name")} />
          </Field>
          <Field label={t("CNPJ (opcional)")}>
            <Input placeholder="00.000.000/0000-00" {...form.register("cnpj")} />
          </Field>
        </>
      )}
      <Field label={t("E-mail")} error={form.formState.errors.email?.message && t(form.formState.errors.email.message)}>
        <Input type="email" placeholder={t("voce@exemplo.com")} autoComplete="email" {...form.register("email")} />
      </Field>
      <Field label={t("Senha")} error={form.formState.errors.password?.message && t(form.formState.errors.password.message)}>
        <Input type="password" placeholder={t("Mínimo 6 caracteres")} autoComplete="new-password" {...form.register("password")} />
      </Field>

      <div className="rounded-2xl border border-border bg-muted/30 p-3">
        <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <KeyRound className="h-3.5 w-3.5 text-primary" />
          {t("Chave de recuperação")}
        </p>
        <div className="space-y-3">
          <Select value={question} onValueChange={(v) => form.setValue("question", v)}>
            <SelectTrigger><SelectValue placeholder={t("Escolha a pergunta")} /></SelectTrigger>
            <SelectContent>
              {RECOVERY_QUESTIONS.map((q) => <SelectItem key={q} value={q}>{t(q)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder={t("Sua resposta")} {...form.register("answer")} />
          {form.formState.errors.answer && (
            <p className="text-xs text-destructive">{t(form.formState.errors.answer.message ?? "")}</p>
          )}
          <p className="text-[11px] text-muted-foreground">
            {t("Usada para recuperar o acesso caso esqueça a senha.")}
          </p>
        </div>
      </div>

      <Button className="w-full" size="lg" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t("Criar conta")}
      </Button>
    </form>
  );
}

function ForgotDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t, lang } = useI18n();

  useEffect(() => {
    if (!open) {
      setStep(1); setQuestion(null); setAnswer(""); setPassword(""); setLoading(false);
    }
  }, [open]);

  async function findQuestion() {
    if (!email.includes("@")) return toast.error(t("Informe um e-mail válido"));
    setLoading(true);
    try {
      const res = await getRecoveryQuestion({ data: { email } });
      if (!res.question) {
        toast.error(t("Nenhuma chave de recuperação"), { description: t("Esta conta não cadastrou uma pergunta de segurança.") });
        return;
      }
      setQuestion(res.question);
      setStep(2);
    } catch (e) {
      toast.error(t("Erro"), { description: friendlyError(e, lang) });
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (password.length < 6) return toast.error(t("A nova senha precisa ter ao menos 6 caracteres"));
    setLoading(true);
    try {
      await resetWithRecovery({ data: { email, answer, password } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success(t("Acesso recuperado!"));
      onOpenChange(false);
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error(t("Não foi possível recuperar"), { description: friendlyError(e, lang) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Recuperar acesso")}</DialogTitle>
        </DialogHeader>
        {step === 1 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("Informe seu e-mail para exibirmos sua pergunta de segurança.")}
            </p>
            <Field label={t("E-mail")}>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("voce@exemplo.com")} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("Cancelar")}</Button>
              <Button type="button" onClick={findQuestion} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("Continuar")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("Pergunta")}</p>
              <p className="text-sm font-medium">{question ? t(question) : null}</p>
            </div>
            <Field label={t("Sua resposta")}>
              <Input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={t("Resposta")} />
            </Field>
            <Field label={t("Nova senha")}>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("Mínimo 6 caracteres")} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep(1)}>{t("Voltar")}</Button>
              <Button type="button" onClick={confirm} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("Entrar")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
