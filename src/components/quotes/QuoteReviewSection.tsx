import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { QuoteData, QuoteItem, CategoryField } from "@/types/quotes";
import { extractPaletteFromImage } from "@/lib/colorExtractor";
import {
  Palette,
  Upload,
  Plus,
  Trash2,
  Building2,
  User,
  Tags,
  FileCheck,
  Calculator,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Info,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface QuoteReviewSectionProps {
  quote: QuoteData;
  onChange: (updated: QuoteData) => void;
  onProceedToPdf: () => void;
  onBackToInput: () => void;
}

export function QuoteReviewSection({
  quote,
  onChange,
  onProceedToPdf,
  onBackToInput,
}: QuoteReviewSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extractingPalette, setExtractingPalette] = useState(false);

  // Recalculate totals whenever items or discount changes
  function updateItemsAndTotals(newItems: QuoteItem[], newDiscount = quote.discount) {
    const subtotal = newItems.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
    const total = Math.max(0, subtotal - newDiscount);
    onChange({
      ...quote,
      items: newItems,
      subtotal,
      discount: newDiscount,
      total,
    });
  }

  function handleItemChange(index: number, field: keyof QuoteItem, value: any) {
    const updated = [...quote.items];
    const target = { ...updated[index], [field]: value };
    if (field === "quantity" || field === "unitPrice") {
      const q = field === "quantity" ? Number(value) || 0 : target.quantity;
      const p = field === "unitPrice" ? Number(value) || 0 : target.unitPrice;
      target.totalPrice = q * p;
    }
    updated[index] = target;
    updateItemsAndTotals(updated);
  }

  function handleAddItem() {
    const newItem: QuoteItem = {
      id: `item-${Date.now()}`,
      name: "Novo serviço ou produto",
      description: "",
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
    };
    updateItemsAndTotals([...quote.items, newItem]);
    toast.success("Novo item adicionado ao orçamento");
  }

  function handleRemoveItem(index: number) {
    if (quote.items.length <= 1) {
      toast.error("O orçamento precisa de pelo menos 1 item.");
      return;
    }
    const updated = quote.items.filter((_, idx) => idx !== index);
    updateItemsAndTotals(updated);
  }

  function handleCategoryFieldChange(index: number, key: keyof CategoryField, value: string) {
    const fields = [...quote.categorySpecificFields];
    fields[index] = { ...fields[index], [key]: value };
    onChange({ ...quote, categorySpecificFields: fields });
  }

  function handleAddCategoryField() {
    const newField: CategoryField = {
      key: `campo_${Date.now()}`,
      label: "Novo Campo",
      value: "",
    };
    onChange({
      ...quote,
      categorySpecificFields: [...quote.categorySpecificFields, newField],
    });
  }

  function handleRemoveCategoryField(index: number) {
    const fields = quote.categorySpecificFields.filter((_, idx) => idx !== index);
    onChange({ ...quote, categorySpecificFields: fields });
  }

  // Handle logo file upload & color palette extraction (supports rectangular logos & photos)
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem válido (PNG, JPG, WebP)");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      setExtractingPalette(true);
      toast.loading("Carregando imagem...", { id: "palette-extract" });

      try {
        const palette = await extractPaletteFromImage(dataUrl);
        toast.dismiss("palette-extract");

        if (palette) {
          onChange({
            ...quote,
            branding: {
              ...quote.branding,
              logoUrl: dataUrl,
              primaryColor: palette.primary,
              secondaryColor: palette.secondary,
              accentColor: palette.accent,
            },
          });
          toast.success("Foto/Logo atualizada! Cores sugeridas a partir da imagem aplicadas.", {
            description: `Cor detectada: ${palette.primary}`,
          });
        } else {
          onChange({
            ...quote,
            branding: {
              ...quote.branding,
              logoUrl: dataUrl,
            },
          });
          toast.success("Foto/Logo atualizada com sucesso!");
        }
      } catch {
        toast.dismiss("palette-extract");
        onChange({
          ...quote,
          branding: {
            ...quote.branding,
            logoUrl: dataUrl,
          },
        });
        toast.success("Foto carregada com sucesso!");
      } finally {
        setExtractingPalette(false);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Top Banner Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-foreground">
            <FileCheck className="h-5 w-5 text-emerald-500 shrink-0" />
            Revisão & Personalização do Orçamento
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ajuste os dados do cliente, itens e escolha a cor exata da sua marca para o PDF.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={onBackToInput}
            className="flex-1 sm:flex-initial gap-1.5 text-xs h-9"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Voltar
          </Button>
          <Button
            size="sm"
            onClick={onProceedToPdf}
            className="flex-1 sm:flex-initial gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-sm h-9"
          >
            Ver PDF <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 1. Identity & Free Brand Color Selection (No pre-defined palettes) */}
      <Card className="bl-glass border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Identidade Visual & Cores da Sua Marca
          </CardTitle>
          <CardDescription className="text-xs">
            Escolha livremente a cor da sua empresa para o cabeçalho e tabelas do PDF, e envie seu logo ou foto (aceita retangular e quadrado).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 md:grid-cols-12">
            {/* Logo / Photo Upload Box - Supports rectangular & square without white border */}
            <div className="md:col-span-5 flex flex-col items-center justify-center p-4 rounded-xl border border-dashed border-border bg-card/40 text-center">
              {quote.branding.logoUrl ? (
                <div className="relative mb-3 flex items-center justify-center max-w-full">
                  <img
                    src={quote.branding.logoUrl}
                    alt="Logo da empresa"
                    className="max-h-24 max-w-[240px] w-auto h-auto object-contain rounded-lg shadow-xs"
                  />
                  <span
                    className="absolute -top-1.5 -right-1.5 flex h-4 w-4 rounded-full bg-emerald-500 border-2 border-background"
                    title="Foto ativa"
                  />
                </div>
              ) : (
                <div className="h-20 w-28 rounded-xl border border-border bg-muted flex items-center justify-center mb-3 text-muted-foreground">
                  <Building2 className="h-8 w-8" />
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs w-full max-w-xs h-9"
                onClick={() => fileInputRef.current?.click()}
                disabled={extractingPalette}
              >
                <Upload className="h-3.5 w-3.5" />
                {quote.branding.logoUrl ? "Trocar Imagem / Logo" : "Enviar Foto ou Logo"}
              </Button>
              <span className="text-[11px] text-muted-foreground mt-1.5">
                Aceita formato retangular, quadrado ou redondo (PNG, JPG, WebP).
              </span>
            </div>

            {/* Custom Brand Colors - Free selection */}
            <div className="md:col-span-7 space-y-4">
              <div>
                <Label className="text-xs font-semibold flex items-center gap-1.5 mb-2 text-foreground">
                  <Palette className="h-3.5 w-3.5 text-primary" /> Cor da Sua Marca no PDF
                </Label>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Defina a cor exata da sua identidade visual para o cabeçalho, bordas e destaques do PDF.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Primary Color */}
                  <div className="p-3 rounded-xl border border-border bg-card/60">
                    <span className="text-xs font-medium text-foreground block mb-1.5">
                      Cor Principal (Títulos e Destaques)
                    </span>
                    <div className="flex items-center gap-2.5">
                      <input
                        type="color"
                        value={quote.branding.primaryColor || "#10b981"}
                        onChange={(e) =>
                          onChange({
                            ...quote,
                            branding: {
                              ...quote.branding,
                              primaryColor: e.target.value,
                            },
                          })
                        }
                        className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent p-0.5 shrink-0"
                      />
                      <Input
                        type="text"
                        value={quote.branding.primaryColor || "#10b981"}
                        onChange={(e) =>
                          onChange({
                            ...quote,
                            branding: {
                              ...quote.branding,
                              primaryColor: e.target.value,
                            },
                          })
                        }
                        placeholder="#10b981"
                        className="h-9 font-mono text-xs uppercase"
                      />
                    </div>
                  </div>

                  {/* Secondary Color */}
                  <div className="p-3 rounded-xl border border-border bg-card/60">
                    <span className="text-xs font-medium text-foreground block mb-1.5">
                      Cor Secundária (Subtítulos e Linhas)
                    </span>
                    <div className="flex items-center gap-2.5">
                      <input
                        type="color"
                        value={quote.branding.secondaryColor || "#065f46"}
                        onChange={(e) =>
                          onChange({
                            ...quote,
                            branding: {
                              ...quote.branding,
                              secondaryColor: e.target.value,
                            },
                          })
                        }
                        className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent p-0.5 shrink-0"
                      />
                      <Input
                        type="text"
                        value={quote.branding.secondaryColor || "#065f46"}
                        onChange={(e) =>
                          onChange({
                            ...quote,
                            branding: {
                              ...quote.branding,
                              secondaryColor: e.target.value,
                            },
                          })
                        }
                        placeholder="#065f46"
                        className="h-9 font-mono text-xs uppercase"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Company Info Row */}
              <div className="space-y-3 pt-2 border-t border-border/50">
                <p className="text-xs font-semibold text-foreground">
                  Informações da Sua Empresa (Exibidas no PDF):
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Nome da Empresa</Label>
                    <Input
                      value={quote.branding.companyName}
                      onChange={(e) =>
                        onChange({
                          ...quote,
                          branding: { ...quote.branding, companyName: e.target.value },
                        })
                      }
                      placeholder="Ex: BL Core Gestão"
                      className="h-9 text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">CNPJ da Empresa</Label>
                    <Input
                      value={quote.branding.cnpj || ""}
                      onChange={(e) =>
                        onChange({
                          ...quote,
                          branding: { ...quote.branding, cnpj: e.target.value },
                        })
                      }
                      placeholder="Ex: 00.000.000/0001-00"
                      className="h-9 text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Telefone / WhatsApp</Label>
                    <Input
                      value={quote.branding.phone || quote.branding.whatsapp || ""}
                      onChange={(e) =>
                        onChange({
                          ...quote,
                          branding: {
                            ...quote.branding,
                            phone: e.target.value,
                            whatsapp: e.target.value,
                          },
                        })
                      }
                      placeholder="Ex: (11) 99999-9999"
                      className="h-9 text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">E-mail da Empresa</Label>
                    <Input
                      value={quote.branding.email || ""}
                      onChange={(e) =>
                        onChange({
                          ...quote,
                          branding: { ...quote.branding, email: e.target.value },
                        })
                      }
                      placeholder="Ex: contato@empresa.com"
                      className="h-9 text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Endereço / Cidade</Label>
                    <Input
                      value={quote.branding.address || ""}
                      onChange={(e) =>
                        onChange({
                          ...quote,
                          branding: { ...quote.branding, address: e.target.value },
                        })
                      }
                      placeholder="Ex: Av. Paulista, 1000 - São Paulo, SP"
                      className="h-9 text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Categoria Exibida</Label>
                    <Input
                      value={quote.branding.category}
                      onChange={(e) =>
                        onChange({
                          ...quote,
                          category: e.target.value,
                          branding: { ...quote.branding, category: e.target.value },
                        })
                      }
                      placeholder="Ex: Social Media"
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Client Details */}
      <Card className="bl-glass border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Dados do Cliente
          </CardTitle>
          <CardDescription className="text-xs">
            Informações do destinatário da proposta (identificadas pela IA).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="text-xs font-semibold">Nome do Cliente *</Label>
            <Input
              value={quote.client.name}
              onChange={(e) =>
                onChange({
                  ...quote,
                  client: { ...quote.client, name: e.target.value },
                })
              }
              placeholder="Nome do cliente"
              className="h-9 text-xs mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">WhatsApp / Telefone</Label>
            <Input
              placeholder="(00) 00000-0000"
              value={quote.client.phone || ""}
              onChange={(e) =>
                onChange({
                  ...quote,
                  client: { ...quote.client, phone: e.target.value },
                })
              }
              className="h-9 text-xs mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">CPF / CNPJ (opcional)</Label>
            <Input
              placeholder="000.000.000-00"
              value={quote.client.document || ""}
              onChange={(e) =>
                onChange({
                  ...quote,
                  client: { ...quote.client, document: e.target.value },
                })
              }
              className="h-9 text-xs mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">Endereço / Cidade</Label>
            <Input
              placeholder="Cidade ou endereço"
              value={quote.client.address || ""}
              onChange={(e) =>
                onChange({
                  ...quote,
                  client: { ...quote.client, address: e.target.value },
                })
              }
              className="h-9 text-xs mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* 3. Category Specific Fields (Adapted for mobile) */}
      <Card className="bl-glass border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                <Tags className="h-4 w-4 text-primary" />
                Dados Específicos do Ramo ({quote.category})
              </CardTitle>
              <CardDescription className="text-xs">
                Campos adaptados para {quote.category} e organizados por tópicos.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddCategoryField}
              className="h-8 text-xs gap-1 self-start sm:self-center"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar Campo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {quote.categorySpecificFields.length === 0 ? (
            <div className="text-xs text-muted-foreground italic p-3 rounded-lg border border-dashed border-border text-center">
              Nenhum campo específico adicionado. Clique no botão acima caso deseje incluir detalhes extras.
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {quote.categorySpecificFields.map((field, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-border bg-card/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => handleCategoryFieldChange(idx, "label", e.target.value)}
                      className="text-xs font-bold bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 w-3/4 text-foreground"
                      placeholder="Nome do Tópico"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveCategoryField(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Input
                    value={field.value}
                    onChange={(e) => handleCategoryFieldChange(idx, "value", e.target.value)}
                    placeholder="Valor do tópico..."
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Items & Services Section - Dual Layout: Cards on Mobile, Table on Desktop */}
      <Card className="bl-glass border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                Serviços, Produtos & Mão de Obra
              </CardTitle>
              <CardDescription className="text-xs">
                Detalhamento dos tópicos de serviços, quantidades e valores.
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleAddItem}
              className="h-8 text-xs gap-1 bg-primary/15 text-primary hover:bg-primary/25 border border-primary/20 self-start sm:self-center"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar Serviço
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* MOBILE VIEW: Finger-friendly, responsive Item Cards (NO HORIZONTAL SCROLL) */}
          <div className="block sm:hidden space-y-3">
            {quote.items.map((item, idx) => (
              <div
                key={item.id || idx}
                className="p-3.5 rounded-xl border border-border bg-card/60 space-y-3 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Item #{idx + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive gap-1"
                    onClick={() => handleRemoveItem(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remover
                  </Button>
                </div>

                <div>
                  <Label className="text-[11px] text-muted-foreground">Nome do Serviço / Produto</Label>
                  <Input
                    value={item.name}
                    onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                    placeholder="Ex: Criação de Sites"
                    className="h-9 text-xs font-semibold mt-1"
                  />
                </div>

                <div>
                  <Label className="text-[11px] text-muted-foreground">Descrição / Detalhes</Label>
                  <Input
                    value={item.description || ""}
                    onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                    placeholder="Ex: Mão de obra e desenvolvimento..."
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/60">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Qtd</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value))}
                      className="h-8 text-xs text-center mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Valor Unit. (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={item.unitPrice}
                      onChange={(e) => handleItemChange(idx, "unitPrice", Number(e.target.value))}
                      className="h-8 text-xs text-right mt-1"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <Label className="text-[10px] text-muted-foreground">Total (R$)</Label>
                    <div className="h-8 flex items-center justify-end font-bold text-primary text-xs mt-1">
                      {(item.quantity * item.unitPrice).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* DESKTOP / TABLET VIEW: Sleek responsive table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left font-medium py-2 px-2 w-1/2">Item / Descrição</th>
                  <th className="text-center font-medium py-2 px-2 w-20">Qtd</th>
                  <th className="text-right font-medium py-2 px-2 w-28">Valor Unit. (R$)</th>
                  <th className="text-right font-medium py-2 px-2 w-28">Total (R$)</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {quote.items.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-2">
                      <Input
                        value={item.name}
                        onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                        placeholder="Nome do serviço..."
                        className="h-8 text-xs font-semibold mb-1"
                      />
                      <Input
                        value={item.description || ""}
                        onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                        placeholder="Detalhes adicionais..."
                        className="h-7 text-[11px] text-muted-foreground"
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value))}
                        className="h-8 text-xs text-center"
                      />
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(idx, "unitPrice", Number(e.target.value))}
                        className="h-8 text-xs text-right"
                      />
                    </td>
                    <td className="py-2.5 px-2 text-right font-semibold text-foreground">
                      {(item.quantity * item.unitPrice).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveItem(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Totals */}
          <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3 pt-4 border-t border-border">
            <div className="flex justify-between sm:justify-start items-center gap-2 text-xs">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-semibold text-foreground">
                {quote.subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>

            <div className="flex justify-between sm:justify-start items-center gap-2 text-xs">
              <span className="text-muted-foreground">Desconto (R$):</span>
              <Input
                type="number"
                min="0"
                step="5"
                value={quote.discount}
                onChange={(e) => updateItemsAndTotals(quote.items, Number(e.target.value) || 0)}
                className="h-8 w-24 text-xs text-right"
              />
            </div>

            <div className="flex justify-between sm:justify-start items-center gap-3 p-2.5 px-4 rounded-xl bg-primary/10 border border-primary/20 text-sm">
              <span className="font-semibold text-foreground">Total Final:</span>
              <span className="font-extrabold text-primary text-base">
                {quote.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Payment, Validity and Notes */}
      <Card className="bl-glass border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            Condições Comerciais & Observações
          </CardTitle>
          <CardDescription className="text-xs">
            Prazos, formas de pagamento e garantia inclusos no rodapé do PDF.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <div>
            <Label className="text-xs font-semibold">Forma de Pagamento</Label>
            <Input
              value={quote.paymentTerms}
              onChange={(e) => onChange({ ...quote, paymentTerms: e.target.value })}
              placeholder="Ex: À vista no PIX com 5% de desconto ou em até 3x no cartão"
              className="h-9 text-xs mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">Validade da Proposta (em dias)</Label>
            <Input
              type="number"
              min="1"
              max="90"
              value={quote.validityDays ?? ""}
              onChange={(e) => {
                const val = e.target.value.trim();
                onChange({
                  ...quote,
                  validityDays: val === "" ? null : Number(val),
                });
              }}
              placeholder="Ex: 15 (opcional)"
              className="h-9 text-xs mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs font-semibold">Observações, Garantia & Instruções</Label>
            <Textarea
              rows={3}
              value={quote.notes}
              onChange={(e) => onChange({ ...quote, notes: e.target.value })}
              placeholder="Ex: Peças com garantia de 90 dias. Prazo de execução de 7 a 15 dias após aprovação..."
              className="text-xs resize-y mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Footer (Mobile Stacked & High Visibility) */}
      <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
        <Button
          variant="outline"
          size="default"
          onClick={onBackToInput}
          className="w-full sm:w-auto text-xs h-11"
        >
          <RotateCcw className="mr-2 h-4 w-4" /> Voltar para Entrada
        </Button>

        <Button
          size="lg"
          onClick={onProceedToPdf}
          className="w-full sm:w-auto gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-md px-8 text-sm h-11"
        >
          Visualizar & Baixar PDF
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
