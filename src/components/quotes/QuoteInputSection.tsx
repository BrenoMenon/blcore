import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import {
  Mic,
  MicOff,
  Sparkles,
  Wand2,
  Volume2,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { QuoteData, CompanyBranding } from "@/types/quotes";
import { smartParseBudget } from "@/lib/budget-parser";

interface QuoteInputSectionProps {
  companyCategory: string;
  companyName: string;
  branding: CompanyBranding;
  onOrganized: (budget: QuoteData) => void;
}

export function QuoteInputSection({
  companyCategory,
  companyName,
  branding,
  onOrganized,
}: QuoteInputSectionProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    isListening,
    interimTranscript,
    isSupported,
    error: speechError,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechToText({
    onResult: (newTranscript) => {
      setText((prev) => {
        const trimmed = prev.trim();
        if (!trimmed) return newTranscript;
        if (trimmed.includes(newTranscript)) return trimmed;
        return trimmed + " " + newTranscript;
      });
    },
  });

  async function handleOrganizeWithAI() {
    const rawInput = text.trim();
    if (!rawInput) {
      toast.error("Por favor, digite ou dite os detalhes do orçamento.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Organizando orçamento com IA...");

    try {
      let budget: any = null;
      let usedAI = false;
      let fallbackReason = "";

      // 1. Attempt server-side Gemini route if running full-stack
      try {
        const res = await fetch("/api/gemini/organize-budget", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: rawInput,
            category: companyCategory,
            companyName,
          }),
        });

        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await res.json();
            if (data?.budget) {
              budget = data.budget;
              usedAI = data.source === "gemini";
              if (!usedAI && data.debug) {
                fallbackReason = data.debug;
              }
            }
          } else {
            fallbackReason = `Resposta do servidor não era JSON (status ${res.status}).`;
          }
        } else {
          fallbackReason = `Servidor respondeu com erro (status ${res.status}).`;
        }
      } catch (networkErr: any) {
        fallbackReason = `Falha de rede ao chamar o servidor: ${networkErr?.message || networkErr}`;
        console.error("Erro ao chamar /api/gemini/organize-budget:", networkErr);
      }

      // 2. If API didn't return a budget (e.g. 404 on Netlify static host or API offline), use instant client-side smart parser
      if (!budget) {
        if (!fallbackReason) fallbackReason = "Servidor não retornou orçamento.";
        budget = smartParseBudget(rawInput, companyCategory, undefined, companyName);
      }

      if (fallbackReason) {
        console.warn("[BL Core] IA não foi usada, motivo:", fallbackReason);
      }

      // Ensure full quote structure with unique ID and current date
      const completeQuote: QuoteData = {
        id: `quote-${Date.now()}`,
        number: "",
        createdAt: new Date().toISOString(),
        title: budget.title || "Orçamento de Serviços",
        category: budget.category || companyCategory || "Serviços Gerais",
        client: {
          name: budget.client?.name || "",
          phone: budget.client?.phone || "",
          email: budget.client?.email || "",
          document: budget.client?.document || "",
          address: budget.client?.address || "",
        },
        categorySpecificFields: Array.isArray(budget.categorySpecificFields)
          ? budget.categorySpecificFields
          : [],
        items:
          Array.isArray(budget.items) && budget.items.length > 0
            ? budget.items
            : [
                {
                  id: `item-${Date.now()}-1`,
                  name: "Serviço Prestado",
                  description: "",
                  quantity: 1,
                  unitPrice: budget.subtotal || 0,
                  totalPrice: budget.subtotal || 0,
                },
              ],
        subtotal: budget.subtotal || 0,
        discount: budget.discount || 0,
        total: budget.total || budget.subtotal || 0,
        paymentTerms: budget.paymentTerms || "",
        validityDays: budget.validityDays ?? null,
        notes: budget.notes || "",
        branding: {
          ...branding,
          companyName: companyName || branding.companyName || "Minha Empresa",
          category: budget.category || companyCategory || branding.category,
        },
      };

      toast.dismiss(toastId);
      if (usedAI) {
        toast.success("Orçamento organizado com IA (Gemini)!", {
          description: completeQuote.client.name
            ? `Cliente identificado: ${completeQuote.client.name}`
            : "Revise os campos e complete os dados desejados.",
        });
      } else {
        toast.warning("Organizado com o mecanismo local (sem IA)", {
          description: fallbackReason || "Configure a GEMINI_API_KEY para usar a IA. Revise os campos com atenção.",
          duration: 8000,
        });
      }

      onOrganized(completeQuote);
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error("Erro ao organizar com IA", {
        description: err.message || "Tente novamente ou revise o texto.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="bl-glass border-primary/20 shadow-md">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                Criar Orçamento Inteligente
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">
                Fale pelo microfone ou digite livremente. A IA extrai automaticamente o cliente, os serviços, valores e organiza tudo por tópicos.
              </CardDescription>
            </div>
            <Badge variant="outline" className="self-start sm:self-center border-primary/40 bg-primary/10 text-primary px-3 py-1 font-semibold text-xs shrink-0">
              Categoria ativa: {companyCategory || "Social Media"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ONE UNIFIED INPUT CONTAINER: Microfone (apenas ícone) + campo de escrita integrado */}
          <div className="rounded-2xl border-2 border-border focus-within:border-primary/60 bg-card/70 transition-all p-3 sm:p-4 shadow-xs">
            {/* Barra interna integrada: apenas ícone do microfone e botão de limpar */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                {/* Botão de microfone: APENAS o ícone, sem texto escrito depois */}
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  title={isListening ? "Parar gravação" : "Gravar áudio"}
                  aria-label="Gravar áudio"
                  className={`h-10 w-10 sm:h-11 sm:w-11 rounded-full flex items-center justify-center transition-all shadow-sm cursor-pointer ${
                    isListening
                      ? "bg-destructive text-white animate-pulse ring-4 ring-destructive/30"
                      : "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 active:scale-95"
                  }`}
                >
                  {isListening ? (
                    <MicOff className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </button>

                {isListening && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-destructive animate-pulse">
                    <span className="h-2 w-2 rounded-full bg-destructive" />
                    Ouvindo...
                  </span>
                )}
              </div>

              {text && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setText("");
                    resetTranscript();
                  }}
                  className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                  title="Limpar texto"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Limpar
                </Button>
              )}
            </div>

            {/* Interim live text feedback while speaking */}
            {isListening && interimTranscript && (
              <div className="mb-2 p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs italic text-primary">
                <Volume2 className="h-3.5 w-3.5 inline mr-1 animate-bounce" />
                {interimTranscript}
              </div>
            )}

            {speechError && (
              <div className="mb-2 flex items-center gap-2 text-xs text-amber-500">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{speechError}</span>
              </div>
            )}

            {/* Textarea perfeitamente integrada no mesmo bloco */}
            <Textarea
              placeholder="Fale no microfone ou escreva aqui..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="w-full border-0 p-1 text-base font-normal leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent resize-y placeholder:text-muted-foreground/60 shadow-none"
            />
          </div>

          {/* Action Trigger */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>A IA identifica cliente, telefone, CPF, endereço, serviço, prazos e observações.</span>
            </div>

            <Button
              type="button"
              size="lg"
              onClick={handleOrganizeWithAI}
              disabled={loading || !text.trim()}
              className="w-full sm:w-auto gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-md px-7 text-sm sm:text-base h-11 cursor-pointer"
            >
              {loading ? (
                <>
                  <Wand2 className="h-5 w-5 animate-spin" />
                  Estruturando Orçamento...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Organizar com IA
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
