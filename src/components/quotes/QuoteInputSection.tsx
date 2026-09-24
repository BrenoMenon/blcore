import React, { useState } from "react";
import { Mic, Send, Loader2 } from "lucide-react";

interface QuoteInputSectionProps {
  onQuoteGenerated: (quote: any) => void;
  category?: string;
  companyName?: string;
}

export function QuoteInputSection({
  onQuoteGenerated,
  category,
  companyName,
}: QuoteInputSectionProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] =
    useState(false);

  const generateQuote = async () => {
    if (!text.trim() || loading) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/gemini/organize-budget",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            text: text.trim(),
            category:
              category || "",
            companyName:
              companyName || "",
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          "Não foi possível organizar o orçamento.",
        );
      }

      const data =
        await response.json();

      if (!data?.quote) {
        throw new Error(
          "A IA não retornou um orçamento válido.",
        );
      }

      onQuoteGenerated(data.quote);
    } catch (error) {
      console.error(
        "Erro ao gerar orçamento:",
        error,
      );

      alert(
        error instanceof Error
          ? error.message
          : "Erro ao gerar orçamento.",
      );
    } finally {
      setLoading(false);
    }
  };

  const startListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "O reconhecimento de voz não está disponível neste navegador.",
      );
      return;
    }

    const recognition =
      new SpeechRecognition();

    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = true;

    setIsListening(true);

    recognition.onresult = (
      event: any,
    ) => {
      let transcript = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        transcript +=
          event.results[i][0]
            .transcript;
      }

      setText((current) => {
        const trimmedCurrent =
          current.trim();

        if (!trimmedCurrent) {
          return transcript.trim();
        }

        return `${trimmedCurrent} ${transcript.trim()}`;
      });
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">
          Criar orçamento com IA
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Digite ou fale o orçamento do jeito
          que você normalmente explicaria para
          outra pessoa. A IA identifica os dados
          do cliente, produtos, serviços,
          valores, prazos, pagamento e outras
          informações relevantes
          automaticamente.
        </p>
      </div>

      <div className="relative">
        <textarea
          value={text}
          onChange={(event) =>
            setText(event.target.value)
          }
          placeholder="Ex.: O cliente João pediu um orçamento para troca do para-choque por R$ 850, capô por R$ 1.200 e pintura por R$ 900. Prazo de 10 dias. Pagamento 50% na entrada e 50% na entrega..."
          rows={8}
          className="w-full resize-none rounded-xl border px-4 py-3 pr-14 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
        />

        <button
          type="button"
          onClick={startListening}
          disabled={
            loading || isListening
          }
          className={`absolute bottom-3 right-3 rounded-full p-3 transition ${
            isListening
              ? "bg-red-100 text-red-600"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
          aria-label={
            isListening
              ? "Parar gravação"
              : "Falar orçamento"
          }
        >
          <Mic size={20} />
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-500">
          A IA não deve inventar informações.
          Tudo que não estiver no texto será
          deixado em branco para você revisar.
        </p>

        <button
          type="button"
          onClick={generateQuote}
          disabled={
            !text.trim() || loading
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2
                size={18}
                className="animate-spin"
              />
              Organizando...
            </>
          ) : (
            <>
              <Send size={18} />
              Gerar orçamento
            </>
          )}
        </button>
      </div>
    </section>
  );
}
