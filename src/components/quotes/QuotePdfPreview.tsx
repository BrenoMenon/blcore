import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { QuoteData } from "@/types/quotes";
import {
  Download,
  Printer,
  Edit,
  CheckCircle,
  Building2,
  Phone,
  MapPin,
  Mail,
  Loader2,
  Sparkles,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

interface QuotePdfPreviewProps {
  quote: QuoteData;
  onEdit: () => void;
  onSaveToHistory: (savedQuote: QuoteData) => void;
}

// Authentic WhatsApp Vector Icon
function WhatsAppIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.05 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export function QuotePdfPreview({ quote, onEdit, onSaveToHistory }: QuotePdfPreviewProps) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [sharingWhatsApp, setSharingWhatsApp] = useState(false);
  const [mobileScale, setMobileScale] = useState(1);
  const [fitToScreen, setFitToScreen] = useState(true);

  // Responsive scale calculation for mobile viewport
  useEffect(() => {
    function updateScale() {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      if (containerWidth < 794) {
        // Leave margins
        const targetScale = Math.min(1, Math.max(0.35, (containerWidth - 8) / 794));
        setMobileScale(targetScale);
      } else {
        setMobileScale(1);
      }
    }

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  // Format dates
  const emissionDate = new Date(quote.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const validityDateObj = new Date(quote.createdAt);
  validityDateObj.setDate(validityDateObj.getDate() + (quote.validityDays || 15));
  const validityDate = validityDateObj.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const primaryColor = quote.branding.primaryColor || "#10b981";
  const secondaryColor = quote.branding.secondaryColor || "#065f46";

  // Convert the logo to a data URL so html2canvas never taints the canvas
  async function prepareImagesForCanvas() {
    if (!quote.branding.logoUrl) return;
    if (quote.branding.logoUrl.startsWith("data:")) return;

    try {
      const response = await fetch(quote.branding.logoUrl, { mode: "cors" });
      const blob = await response.blob();
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const imgEl = pdfRef.current?.querySelector<HTMLImageElement>("#quote-logo-img");
      if (imgEl && dataUrl) {
        imgEl.removeAttribute("crossorigin");
        imgEl.src = dataUrl;
      }
    } catch {
      // ignore - falls back to the original URL
    }
  }

  // Force every image inside the render clone to a safe, bounded size and make
  // sure it is fully decoded before html2canvas measures the layout.
  async function normalizeCloneImages(root: HTMLElement) {
    const images = Array.from(root.querySelectorAll("img"));

    images.forEach((img) => {
      const isLogo = img.id === "quote-logo-img";
      img.style.maxHeight = isLogo ? "80px" : "80px";
      img.style.maxWidth = isLogo ? "220px" : "220px";
      img.style.height = "auto";
      img.style.width = "auto";
      img.style.objectFit = "contain";
      img.style.display = "block";
      img.removeAttribute("width");
      img.removeAttribute("height");
    });

    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve();
              return;
            }
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            // Never block the export for more than 4s
            setTimeout(done, 4000);
          }),
      ),
    );

    // Give the browser one frame to apply the layout with the loaded images
    await new Promise((resolve) => requestAnimationFrame(() => resolve(true)));
  }

  // Core PDF generator returning jsPDF object
  async function generatePdf(): Promise<{ pdf: jsPDF; fileName: string }> {
    if (!pdfRef.current) {
      throw new Error("Elemento do orçamento não encontrado.");
    }

    await prepareImagesForCanvas();

    const element = pdfRef.current;

    // Clone element to a standalone, unscaled, white container offscreen
    // This eliminates any dark-mode, backdrop-filter, or mobile-scale clipping issues
    const clone = element.cloneNode(true) as HTMLElement;
    clone.id = "quote-pdf-render-clone";
    clone.style.transform = "none";
    clone.style.margin = "0";
    clone.style.position = "fixed";
    clone.style.top = "0";
    clone.style.left = "0";
    clone.style.opacity = "0";
    clone.style.pointerEvents = "none";
    clone.style.width = "794px";
    clone.style.minHeight = "1123px";
    clone.style.backgroundColor = "#ffffff";
    clone.style.color = "#0f172a";
    clone.style.zIndex = "-9999";
    clone.style.display = "flex";
    clone.style.flexDirection = "column";
    clone.style.justifyContent = "space-between";
    clone.classList.remove("dark");

    document.body.appendChild(clone);

    let canvas: HTMLCanvasElement;
    try {
      await normalizeCloneImages(clone);

      canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
        width: 794,
        height: clone.scrollHeight,
        windowWidth: 794,
        windowHeight: clone.scrollHeight,
        imageTimeout: 8000,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById("quote-pdf-render-clone");
          if (el) {
            el.style.transform = "none";
            el.style.opacity = "1";
            el.style.backgroundColor = "#ffffff";
            el.style.color = "#0f172a";
            el.querySelectorAll("img").forEach((img) => {
              const image = img as HTMLImageElement;
              image.style.maxHeight = "80px";
              image.style.maxWidth = "220px";
              image.style.width = "auto";
              image.style.height = "auto";
              image.style.objectFit = "contain";
            });
          }
          // Ensure root does not leak dark theme variables
          clonedDoc.documentElement.classList.remove("dark");
          clonedDoc.body.classList.remove("dark");
          clonedDoc.body.style.backgroundColor = "#ffffff";
        },
      });
    } finally {
      if (document.body.contains(clone)) {
        document.body.removeChild(clone);
      }
    }

    if (!canvas.width || !canvas.height) {
      throw new Error("Não foi possível renderizar o orçamento.");
    }

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Slice the tall canvas into A4 pages so nothing is cropped or blown up
    const pxPerMm = canvas.width / pageWidth;
    const pageHeightPx = Math.floor(pageHeight * pxPerMm);
    const totalPages = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

    for (let page = 0; page < totalPages; page++) {
      const sliceTop = page * pageHeightPx;
      const sliceHeight = Math.min(pageHeightPx, canvas.height - sliceTop);

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;

      const ctx = pageCanvas.getContext("2d");
      if (!ctx) throw new Error("Não foi possível preparar o PDF.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        sliceTop,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight,
      );

      const imgData = pageCanvas.toDataURL("image/jpeg", 0.92);
      if (page > 0) pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, sliceHeight / pxPerMm, undefined, "FAST");
    }

    const safeClient = (quote.client.name || "Cliente").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
    const fileName = `Orcamento_${safeClient}.pdf`;

    return { pdf, fileName };
  }

  async function handleDownloadPdf() {
    setDownloading(true);
    const toastId = toast.loading("Gerando arquivo PDF...", { id: "generating-pdf" });

    try {
      const { pdf, fileName } = await generatePdf();
      pdf.save(fileName);
      onSaveToHistory(quote);

      toast.dismiss(toastId);
      toast.success("PDF baixado com sucesso!", {
        description: `Arquivo: ${fileName}`,
      });
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error("Erro ao gerar PDF", {
        description: err.message || "Tente a opção Imprimir/Salvar como PDF.",
      });
    } finally {
      setDownloading(false);
    }
  }

  function handlePrint() {
    if (!pdfRef.current) {
      window.print();
      return;
    }

    try {
      // Cria um frame dedicado isolado para impressão direta em alta definição
      const printContent = pdfRef.current.cloneNode(true) as HTMLElement;
      printContent.style.transform = "none";
      printContent.style.margin = "0 auto";
      printContent.style.boxShadow = "none";
      printContent.style.border = "none";

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        return;
      }

      let styles = "";
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
        styles += node.outerHTML;
      });

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Orçamento - ${quote.client.name || "Cliente"}</title>
            ${styles}
            <style>
              @page { size: A4 portrait; margin: 10mm; }
              body { margin: 0; padding: 0; background: #ffffff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              #quote-printable-document { margin: 0 auto !important; transform: none !important; width: 794px !important; box-shadow: none !important; border: none !important; }
            </style>
          </head>
          <body>
            ${printContent.outerHTML}
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 3000);
      }, 500);
    } catch {
      window.print();
    }
  }

  // Share via WhatsApp with official share sheet / contact picker & direct message
  async function handleWhatsAppShare() {
    setSharingWhatsApp(true);
    const toastId = toast.loading("Preparando PDF para o WhatsApp...", { id: "whatsapp-share" });

    try {
      const { pdf, fileName } = await generatePdf();
      const pdfBlob = pdf.output("blob");
      const pdfFile = new File([pdfBlob], fileName, { type: "application/pdf" });

      const clientName = quote.client.name || "Cliente";

      // 1. Native Web Share with file attachment (Mobile devices: opens WhatsApp contact list!)
      if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        toast.dismiss(toastId);
        try {
          // iOS/WhatsApp drops the attachment when text is sent together,
          // so the file is shared on its own.
          await navigator.share({
            files: [pdfFile],
            title: fileName,
          });
          onSaveToHistory(quote);
          toast.success("Orçamento compartilhado com sucesso!");
          return;
        } catch (shareErr: any) {
          if (shareErr.name === "AbortError") return;
          // If native file share failed in this webview, continue to direct download + WhatsApp message
        }
      }

      // 2. Direct action: download the crisp PDF and open WhatsApp chat
      pdf.save(fileName);
      onSaveToHistory(quote);

      const phone = (quote.client.phone || "").replace(/\D/g, "");
      const formattedTotal = quote.total.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

      const lines = [
        `Olá *${clientName}*!`,
        `Aqui está o seu *${quote.title}* emitido por *${quote.branding.companyName}*.`,
        ``,
        `📄 *Arquivo do Orçamento:* ${fileName}`,
        `💰 *Valor Total:* ${formattedTotal}`,
        quote.paymentTerms ? `💳 *Condições:* ${quote.paymentTerms}` : "",
        quote.validityDays ? `📅 *Validade:* Até ${validityDate}` : "",
        quote.notes ? `📝 *Observação:* ${quote.notes}` : "",
        ``,
        `_O arquivo PDF oficial foi baixado no seu aparelho e pode ser anexado aqui nesta conversa._`,
      ].filter(Boolean);

      const message = encodeURIComponent(lines.join("\n"));
      const url = phone ? `https://wa.me/55${phone}?text=${message}` : `https://wa.me/?text=${message}`;

      window.open(url, "_blank");
      toast.dismiss(toastId);
      toast.success("PDF pronto e WhatsApp aberto para envio!");
    } catch (err: any) {
      toast.dismiss(toastId);
      // If user cancelled share sheet, do not show error
      if (err.name === "AbortError") return;

      // Fallback to plain WhatsApp link
      const phone = (quote.client.phone || "").replace(/\D/g, "");
      const message = encodeURIComponent(`Olá ${quote.client.name}! Aqui está o seu orçamento da ${quote.branding.companyName}.`);
      const url = phone ? `https://wa.me/55${phone}?text=${message}` : `https://wa.me/?text=${message}`;
      window.open(url, "_blank");
      toast.info("WhatsApp aberto com a proposta.");
    } finally {
      setSharingWhatsApp(false);
    }
  }

  const effectiveScale = fitToScreen ? mobileScale : 1;
  const scaledHeight = 1123 * effectiveScale;

  return (
    <div className="space-y-4 pb-12">
      {/* Top Action Bar - Mobile-first responsive controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-foreground">
            <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
            PDF Pronto para Emissão
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Baixe o PDF oficial ou compartilhe diretamente no WhatsApp com seus clientes.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="flex-1 sm:flex-initial gap-1.5 text-xs h-9"
          >
            <Edit className="h-3.5 w-3.5" /> Editar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="hidden sm:inline-flex gap-1.5 text-xs h-9"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimir
          </Button>

          {/* Official WhatsApp Share Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleWhatsAppShare}
            disabled={sharingWhatsApp}
            className="flex-1 sm:flex-initial gap-1.5 text-xs h-9 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 border-[#25D366]/40 font-semibold transition-all"
          >
            {sharingWhatsApp ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#25D366]" />
            ) : (
              <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
            )}
            <span>Enviar no Zap</span>
          </Button>

          {/* Official PDF Download */}
          <Button
            size="sm"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="flex-1 sm:flex-initial gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-sm px-4 text-xs h-9"
          >
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Baixando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" /> Baixar PDF
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Fit-to-screen indicator and toggle */}
      {mobileScale < 1 && (
        <div className="flex items-center justify-between px-2 text-xs text-muted-foreground">
          <span>Pré-visualização adaptada para a tela do celular</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFitToScreen(!fitToScreen)}
            className="h-7 text-[11px] gap-1 px-2"
          >
            {fitToScreen ? (
              <>
                <Maximize2 className="h-3 w-3" /> Ver 100%
              </>
            ) : (
              <>
                <Minimize2 className="h-3 w-3" /> Ajustar à tela
              </>
            )}
          </Button>
        </div>
      )}

      {/* PDF Document Scaled Container - Zero Horizontal Cutoff on Mobile */}
      <div
        ref={containerRef}
        className="w-full flex justify-center overflow-x-auto py-2"
      >
        <div
          style={{
            width: fitToScreen ? `${794 * effectiveScale}px` : "794px",
            height: fitToScreen ? `${scaledHeight}px` : "auto",
            position: "relative",
            overflow: fitToScreen ? "hidden" : "visible",
            transition: "all 0.2s ease-in-out",
          }}
          className="rounded-lg shadow-xl"
        >
          <div
            ref={pdfRef}
            id="quote-printable-document"
            className="w-[794px] min-h-[1123px] bg-white text-slate-900 p-10 relative flex flex-col justify-between"
            style={{
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              transform: fitToScreen && mobileScale < 1 ? `scale(${mobileScale})` : "none",
              transformOrigin: "top left",
            }}
          >
            {/* Top Brand Color Stripe */}
            <div
              className="absolute top-0 left-0 right-0 h-3"
              style={{ backgroundColor: primaryColor }}
            />

            <div>
              {/* Header: Company, Logo & Document ID */}
              <div className="flex items-start justify-between border-b border-slate-200 pb-6 mb-6">
                <div className="flex items-center gap-4">
                  {/* Photo/Logo - Supports rectangular and square without white background border */}
                  {quote.branding.logoUrl ? (
                    <img
                      id="quote-logo-img"
                      src={quote.branding.logoUrl}
                      alt={quote.branding.companyName}
                      className="max-h-20 max-w-[220px] w-auto h-auto object-contain rounded-md"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div
                      className="h-16 w-16 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-xs"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Building2 className="h-8 w-8" />
                    </div>
                  )}

                  <div>
                    <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                      {quote.branding.companyName || "Minha Empresa"}
                    </h1>
                    <p
                      className="text-xs font-semibold uppercase tracking-wider mt-0.5"
                      style={{ color: primaryColor }}
                    >
                      {quote.branding.category || quote.category}
                    </p>
                    <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                      {quote.branding.cnpj && (
                        <p className="flex items-center gap-1 font-medium text-slate-800">
                          <span className="font-bold text-slate-900">CNPJ:</span> {quote.branding.cnpj}
                        </p>
                      )}
                      {(quote.branding.phone || quote.branding.whatsapp) && (
                        <p className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-slate-500 shrink-0" />
                          <span>{quote.branding.phone || quote.branding.whatsapp}</span>
                        </p>
                      )}
                      {quote.branding.email && (
                        <p className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3 text-slate-500 shrink-0" />
                          <span>{quote.branding.email}</span>
                        </p>
                      )}
                      {quote.branding.address && (
                        <p className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 text-slate-500 shrink-0" />
                          <span>{quote.branding.address}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Document Meta Box */}
                <div className="text-right">
                  <div
                    className="inline-block px-3 py-1 rounded-md text-xs font-bold text-white mb-2 shadow-xs"
                    style={{ backgroundColor: primaryColor }}
                  >
                    ORÇAMENTO
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1 space-y-0.5">
                    <p>
                      <span className="font-semibold text-slate-800">Emissão:</span> {emissionDate}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-800">Validade:</span> {validityDate}
                    </p>
                  </div>
                </div>
              </div>

              {/* Client & Category Specifics Grid */}
              <div className="grid grid-cols-12 gap-4 mb-6">
                {/* Client Information */}
                <div
                  className={`p-4 rounded-xl border border-slate-200 bg-slate-50/70 ${
                    quote.categorySpecificFields.length > 0 ? "col-span-7" : "col-span-12"
                  }`}
                >
                  <h3
                    className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"
                    style={{ color: secondaryColor }}
                  >
                    <Building2 className="h-3.5 w-3.5" /> Dados do Cliente
                  </h3>
                  <div className="space-y-1 text-xs text-slate-700">
                    <p>
                      <span className="font-semibold text-slate-900">Nome:</span>{" "}
                      {quote.client.name || "A Definir"}
                    </p>
                    {quote.client.phone && (
                      <p>
                        <span className="font-semibold text-slate-900">Telefone:</span>{" "}
                        {quote.client.phone}
                      </p>
                    )}
                    {quote.client.document && (
                      <p>
                        <span className="font-semibold text-slate-900">CPF/CNPJ:</span>{" "}
                        {quote.client.document}
                      </p>
                    )}
                    {quote.client.address && (
                      <p>
                        <span className="font-semibold text-slate-900">Endereço:</span>{" "}
                        {quote.client.address}
                      </p>
                    )}
                  </div>
                </div>

                {/* Category-Specific Fields Box (if available) */}
                {quote.categorySpecificFields.length > 0 && (
                  <div
                    className="col-span-5 p-4 rounded-xl border border-slate-200 bg-slate-50/70"
                    style={{ borderLeft: `3px solid ${primaryColor}` }}
                  >
                    <h3
                      className="text-xs font-bold uppercase tracking-wider mb-2"
                      style={{ color: secondaryColor }}
                    >
                      Detalhes do Atendimento ({quote.category})
                    </h3>
                    <div className="space-y-1.5 text-xs">
                      {quote.categorySpecificFields.map((field, idx) => (
                        <div key={idx} className="flex justify-between items-center text-slate-700">
                          <span className="font-semibold text-slate-900">{field.label}:</span>
                          <span className="font-medium text-slate-800 text-right">{field.value || "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Items & Services Table */}
              <div className="mb-6">
                <table className="w-full text-xs">
                  <thead>
                    <tr
                      className="text-white font-semibold text-[11px] uppercase tracking-wider"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <th className="py-2.5 px-3 text-left rounded-l-md w-7/12">Descrição do Serviço / Item</th>
                      <th className="py-2.5 px-3 text-center w-1/12">Qtd</th>
                      <th className="py-2.5 px-3 text-right w-2/12">Valor Unit.</th>
                      <th className="py-2.5 px-3 text-right rounded-r-md w-2/12">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {quote.items.map((item, idx) => (
                      <tr
                        key={item.id || idx}
                        className={idx % 2 === 1 ? "bg-slate-50/50" : "bg-white"}
                      >
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          {item.description && (
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-medium text-slate-700">
                          {item.quantity}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-700">
                          {item.unitPrice.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">
                          {(item.quantity * item.unitPrice).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Summary */}
              <div className="flex justify-end mb-6">
                <div className="w-72 space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-slate-800">
                      {quote.subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>

                  {quote.discount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Desconto concedido:</span>
                      <span>
                        - {quote.discount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                  )}

                  <div
                    className="flex justify-between pt-2 border-t border-slate-200 text-sm font-extrabold"
                    style={{ color: secondaryColor }}
                  >
                    <span>TOTAL:</span>
                    <span style={{ color: primaryColor }}>
                      {quote.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Terms, Conditions and Notes */}
              {(quote.paymentTerms || quote.validityDays || quote.notes) && (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 mb-6 space-y-2 text-xs">
                  <h4 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider">
                    Condições & Prazos
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-700">
                    {quote.paymentTerms && (
                      <div>
                        <span className="font-semibold text-slate-900">Forma de Pagamento:</span>{" "}
                        {quote.paymentTerms}
                      </div>
                    )}
                    {Boolean(quote.validityDays) && (
                      <div>
                        <span className="font-semibold text-slate-900">Validade da Proposta:</span>{" "}
                        {quote.validityDays} dias (até {validityDate})
                      </div>
                    )}
                  </div>

                  {quote.notes && (
                    <div className="pt-2 border-t border-slate-200 text-slate-600 leading-relaxed text-[11px]">
                      <span className="font-semibold text-slate-900">Observações:</span>{" "}
                      {quote.notes}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Document Footer with Signatures */}
            <div className="pt-6 border-t border-slate-200">
              <div className="grid grid-cols-2 gap-12 text-center text-xs text-slate-600 mb-6">
                <div>
                  <div className="border-b border-slate-400 w-4/5 mx-auto mb-1.5" />
                  <p className="font-semibold text-slate-800">{quote.branding.companyName}</p>
                  {quote.branding.cnpj && (
                    <p className="text-[10px] text-slate-500">CNPJ: {quote.branding.cnpj}</p>
                  )}
                  <p className="text-[10px] text-slate-400">Responsável pelo Orçamento</p>
                </div>

                <div>
                  <div className="border-b border-slate-400 w-4/5 mx-auto mb-1.5" />
                  <p className="font-semibold text-slate-800">{quote.client.name}</p>
                  <p className="text-[10px] text-slate-400">Assinatura de Aprovação do Cliente</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2">
                <span>BL Core Gestão · Documento gerado eletronicamente</span>
                <span>Página 1 de 1</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
