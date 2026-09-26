import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QuoteInputSection } from "@/components/quotes/QuoteInputSection";
import { QuoteReviewSection } from "@/components/quotes/QuoteReviewSection";
import { QuotePdfPreview } from "@/components/quotes/QuotePdfPreview";
import { QuoteData, CompanyBranding } from "@/types/quotes";
import { extractPaletteFromImage } from "@/lib/colorExtractor";
import {
  FileText,
  Sparkles,
  History,
  FileCheck,
  Download,
  PlusCircle,
  Eye,
  Trash2,
  Calendar,
  DollarSign,
  User,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/quotes")({
  component: QuotesPage,
});

// IMPORTANT: the history key must be scoped per logged-in user. A bare
// "blcore_quotes_history" key is shared by EVERY account that ever opens
// this app in the same browser — that leaked one company's saved quotes
// (client names, prices, budgets) into every other account on the same
// device. Each user's history now lives under its own key, and a legacy
// unscoped blob (from before this fix) is never read again.
function historyStorageKey(userId: string): string {
  return `blcore_quotes_history_${userId}`;
}

function getStoredHistory(userId: string): QuoteData[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = localStorage.getItem(historyStorageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistoryToStorage(userId: string, history: QuoteData[]) {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(historyStorageKey(userId), JSON.stringify(history));
  } catch {
    // ignore
  }
}

function QuotesPage() {
  const context = Route.useRouteContext() as { userId?: string; email?: string } | undefined;
  const userId = context?.userId || "";
  const userEmailAuth = context?.email || "";
  const t = useT();

  const [activeTab, setActiveTab] = useState<"create" | "history">("create");
  const [currentStep, setCurrentStep] = useState<"input" | "review" | "preview">("input");
  const [currentQuote, setCurrentQuote] = useState<QuoteData | null>(null);
  const [history, setHistory] = useState<QuoteData[]>([]);

  // Load history whenever the logged-in user changes (covers switching
  // accounts without a full page reload too, not just initial mount).
  useEffect(() => {
    setHistory(getStoredHistory(userId));
  }, [userId]);

  // Fetch company profile & settings from Supabase
  const { data: companyData, isLoading: loadingCompany } = useQuery({
    queryKey: ["company-for-quotes", userId],
    queryFn: async () => {
      if (!userId) return null;
      try {
        const [{ data: profile }, { data: settings }] = await Promise.all([
          supabase
            .from("profiles")
            .select("business_name, category, avatar_url, phone, whatsapp, address, city, state")
            .eq("id", userId)
            .maybeSingle(),
          supabase
            .from("company_settings")
            .select("company_name, logo_url, primary_color, phone, whatsapp, address, whatsapp_config")
            .eq("user_id", userId)
            .maybeSingle(),
        ]);

        const cnpj =
          (settings?.whatsapp_config as any)?.cnpj ||
          (settings as any)?.cnpj ||
          (profile as any)?.cnpj ||
          localStorage.getItem(`blcore_cnpj_${userId}`) ||
          localStorage.getItem("blcore_company_cnpj") ||
          "";

        const companyName =
          settings?.company_name || profile?.business_name || "BL Core Gestão";
        const category = profile?.category || "Social Media";
        const logoUrl = settings?.logo_url || profile?.avatar_url || "";
        const phone = settings?.phone || profile?.phone || "";
        const whatsapp = settings?.whatsapp || profile?.whatsapp || "";
        const address = settings?.address || profile?.address || "";
        const primaryColor = settings?.primary_color || "#10b981";

        return {
          companyName,
          category,
          cnpj,
          logoUrl,
          phone: whatsapp || phone,
          whatsapp,
          address,
          primaryColor,
          email: userEmailAuth,
        };
      } catch (err) {
        console.error("Error loading company info for quotes:", err);
        const fallbackCnpj =
          localStorage.getItem(`blcore_cnpj_${userId}`) ||
          localStorage.getItem("blcore_company_cnpj") ||
          "";
        return {
          companyName: "BL Core Gestão",
          category: "Social Media",
          cnpj: fallbackCnpj,
          logoUrl: "",
          phone: "",
          whatsapp: "",
          address: "",
          primaryColor: "#10b981",
          email: userEmailAuth,
        };
      }
    },
    enabled: !!userId,
  });

  // Base branding state - defaults category to Social Media
  const [branding, setBranding] = useState<CompanyBranding>({
    companyName: "BL Core Gestão",
    category: "Social Media",
    cnpj:
      (typeof window !== "undefined" &&
        (localStorage.getItem(`blcore_cnpj_${userId}`) ||
          localStorage.getItem("blcore_company_cnpj"))) ||
      "",
    email: userEmailAuth,
    logoUrl: "",
    phone: "",
    whatsapp: "",
    address: "",
    primaryColor: "#10b981",
    secondaryColor: "#065f46",
    accentColor: "#d1fae5",
  });

  // When company data loads, populate branding & try color extraction on company logo
  useEffect(() => {
    if (companyData) {
      setBranding((prev) => ({
        ...prev,
        companyName: companyData.companyName,
        category: companyData.category,
        cnpj: companyData.cnpj || prev.cnpj || "",
        logoUrl: companyData.logoUrl || prev.logoUrl,
        phone: companyData.phone || prev.phone,
        whatsapp: companyData.whatsapp || prev.whatsapp,
        address: companyData.address || prev.address,
        email: companyData.email || prev.email,
        primaryColor: companyData.primaryColor || prev.primaryColor,
      }));

      if (companyData.logoUrl) {
        extractPaletteFromImage(companyData.logoUrl).then((palette) => {
          if (palette) {
            setBranding((prev) => ({
              ...prev,
              primaryColor: palette.primary,
              secondaryColor: palette.secondary,
              accentColor: palette.accent,
            }));
          }
        });
      }
    }
  }, [companyData]);

  // When AI organizes the budget, move to review step
  function handleQuoteOrganized(quote: QuoteData) {
    const activeCnpj =
      quote.branding?.cnpj ||
      branding.cnpj ||
      companyData?.cnpj ||
      (typeof window !== "undefined" &&
        (localStorage.getItem(`blcore_cnpj_${userId}`) ||
          localStorage.getItem("blcore_company_cnpj"))) ||
      "";

    const completeQuote: QuoteData = {
      ...quote,
      branding: {
        ...quote.branding,
        ...branding,
        cnpj: activeCnpj,
      },
    };
    setCurrentQuote(completeQuote);
    setCurrentStep("review");
  }

  // Save to history
  function handleSaveToHistory(savedQuote: QuoteData) {
    setHistory((prev) => {
      const existsIndex = prev.findIndex((q) => q.id === savedQuote.id);
      let updated: QuoteData[];
      if (existsIndex >= 0) {
        updated = [...prev];
        updated[existsIndex] = savedQuote;
      } else {
        updated = [savedQuote, ...prev];
      }
      saveHistoryToStorage(userId, updated);
      return updated;
    });
  }

  function handleDeleteFromHistory(id: string) {
    setHistory((prev) => {
      const updated = prev.filter((q) => q.id !== id);
      saveHistoryToStorage(userId, updated);
      return updated;
    });
    toast.success("Orçamento removido do histórico.");
  }

  function handleOpenFromHistory(item: QuoteData) {
    setCurrentQuote(item);
    setCurrentStep("preview");
    setActiveTab("create");
    toast.info(`Orçamento de ${item.client.name || "cliente"} carregado.`);
  }

  function handleStartNewQuote() {
    setCurrentQuote(null);
    setCurrentStep("input");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sistema de Orçamentos"
        description="Crie orçamentos profissionais com voz ou texto, organizados por IA e formatados em PDF com a identidade visual da sua empresa."
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <TabsList className="bg-muted/80 p-1 rounded-xl">
            <TabsTrigger value="create" className="gap-2 text-xs font-semibold rounded-lg">
              <Sparkles className="h-4 w-4 text-primary" />
              Novo Orçamento
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 text-xs font-semibold rounded-lg">
              <History className="h-4 w-4" />
              Histórico ({history.length})
            </TabsTrigger>
          </TabsList>

          {activeTab === "create" && (
            <div className="flex items-center gap-1 sm:gap-2 text-xs text-muted-foreground overflow-x-auto py-1">
              <span
                onClick={() => setCurrentStep("input")}
                className={`cursor-pointer px-2.5 py-1 rounded-lg text-xs transition ${
                  currentStep === "input" ? "bg-primary text-primary-foreground font-bold shadow-xs" : "hover:bg-muted"
                }`}
              >
                1. Entrada
              </span>
              <span className="text-muted-foreground/60">&rarr;</span>
              <span
                onClick={() => currentQuote && setCurrentStep("review")}
                className={`px-2.5 py-1 rounded-lg text-xs transition ${
                  currentStep === "review"
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : currentQuote
                    ? "cursor-pointer hover:bg-muted"
                    : "opacity-40 cursor-not-allowed"
                }`}
              >
                2. Revisão
              </span>
              <span className="text-muted-foreground/60">&rarr;</span>
              <span
                onClick={() => currentQuote && setCurrentStep("preview")}
                className={`px-2.5 py-1 rounded-lg text-xs transition ${
                  currentStep === "preview"
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : currentQuote
                    ? "cursor-pointer hover:bg-muted"
                    : "opacity-40 cursor-not-allowed"
                }`}
              >
                3. PDF
              </span>
            </div>
          )}
        </div>

        {/* Tab 1: Create Quote Flow */}
        <TabsContent value="create" className="mt-6">
          {currentStep === "input" && (
            <QuoteInputSection
              companyCategory={branding.category}
              companyName={branding.companyName}
              branding={branding}
              onOrganized={handleQuoteOrganized}
            />
          )}

          {currentStep === "review" && currentQuote && (
            <QuoteReviewSection
              quote={currentQuote}
              onChange={setCurrentQuote}
              onProceedToPdf={() => {
                handleSaveToHistory(currentQuote);
                setCurrentStep("preview");
              }}
              onBackToInput={() => setCurrentStep("input")}
            />
          )}

          {currentStep === "preview" && currentQuote && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStartNewQuote}
                  className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
                >
                  <PlusCircle className="h-4 w-4" /> Criar Outro Orçamento
                </Button>
              </div>

              <QuotePdfPreview
                quote={currentQuote}
                onEdit={() => setCurrentStep("review")}
                onSaveToHistory={handleSaveToHistory}
              />
            </div>
          )}
        </TabsContent>

        {/* Tab 2: History of Quotes */}
        <TabsContent value="history" className="mt-6">
          {history.length === 0 ? (
            <Card className="bl-glass border-dashed text-center p-12">
              <div className="max-w-md mx-auto space-y-3">
                <div className="h-12 w-12 rounded-full bg-primary/15 text-primary flex items-center justify-center mx-auto">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-foreground">Nenhum orçamento salvo ainda</h3>
                <p className="text-xs text-muted-foreground">
                  Quando você gerar orçamentos com a IA ou baixar PDFs, eles serão listados aqui para fácil consulta e reemissão.
                </p>
                <Button
                  onClick={() => {
                    setActiveTab("create");
                    setCurrentStep("input");
                  }}
                  className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                >
                  <Sparkles className="h-4 w-4" /> Criar Primeiro Orçamento
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  {history.length} {history.length === 1 ? "orçamento salvo" : "orçamentos salvos"} no dispositivo.
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    setActiveTab("create");
                    handleStartNewQuote();
                  }}
                  className="gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <PlusCircle className="h-4 w-4" /> Novo Orçamento
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {history.map((item) => (
                  <Card key={item.id} className="bl-glass border-border hover:border-primary/40 transition-all flex flex-col justify-between min-w-0 overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-sm font-bold text-foreground line-clamp-1">
                            {item.client.name}
                          </CardTitle>
                          <CardDescription className="text-xs text-muted-foreground line-clamp-1">
                            {item.title} · {item.category}
                          </CardDescription>
                        </div>

                        <span
                          className="h-3 w-3 rounded-full shrink-0 mt-1"
                          style={{ backgroundColor: item.branding?.primaryColor || "#10b981" }}
                          title="Cor da marca"
                        />
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3 pt-1">
                      <div className="flex items-center justify-between text-xs py-1 border-y border-border/60">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />{" "}
                          {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                        </span>
                        <span className="font-bold text-primary">
                          {item.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground min-w-0">
                        <span className="shrink-0">{item.items.length} {item.items.length === 1 ? "item" : "itens"}:</span>
                        <span className="truncate italic min-w-0">
                          {item.items.map((i) => i.name).join(", ")}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenFromHistory(item)}
                          className="h-8 text-xs gap-1.5 flex-1"
                        >
                          <Eye className="h-3.5 w-3.5 text-primary" /> Visualizar / PDF
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteFromHistory(item.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          title="Excluir do histórico"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
