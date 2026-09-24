import React from "react";
import {
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
} from "lucide-react";
import type { ParsedBudget } from "@/lib/budget-parser";

interface QuoteReviewSectionProps {
  quote: ParsedBudget;
  onChange: (quote: ParsedBudget) => void;
}

export function QuoteReviewSection({
  quote,
  onChange,
}: QuoteReviewSectionProps) {
  const updateClient = (
    field: keyof ParsedBudget["client"],
    value: string,
  ) => {
    onChange({
      ...quote,
      client: {
        ...quote.client,
        [field]: value,
      },
    });
  };

  const updateItem = (
    index: number,
    field: string,
    value: string | number,
  ) => {
    const items = [...quote.items];

    const item = {
      ...items[index],
      [field]: value,
    };

    if (
      field === "quantity" ||
      field === "unitPrice"
    ) {
      const quantity =
        Number(item.quantity) || 1;

      const unitPrice =
        Number(item.unitPrice) || 0;

      item.totalPrice =
        quantity * unitPrice;
    }

    items[index] = item;

    const subtotal = items.reduce(
      (sum, current) =>
        sum +
        (Number(current.totalPrice) || 0),
      0,
    );

    onChange({
      ...quote,
      items,
      subtotal,
      total:
        subtotal -
        (Number(quote.discount) || 0),
    });
  };

  const removeItem = (index: number) => {
    const items = quote.items.filter(
      (_, itemIndex) =>
        itemIndex !== index,
    );

    const subtotal = items.reduce(
      (sum, item) =>
        sum +
        (Number(item.totalPrice) || 0),
      0,
    );

    onChange({
      ...quote,
      items,
      subtotal,
      total:
        subtotal -
        (Number(quote.discount) || 0),
    });
  };

  const addItem = () => {
    const items = [
      ...quote.items,
      {
        id: `item-${Date.now()}`,
        name: "Novo item",
        description: "",
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
      },
    ];

    onChange({
      ...quote,
      items,
    });
  };

  const updateField = (
    index: number,
    value: string,
  ) => {
    const fields = [
      ...quote.categorySpecificFields,
    ];

    fields[index] = {
      ...fields[index],
      value,
    };

    onChange({
      ...quote,
      categorySpecificFields:
        fields,
    });
  };

  const removeField = (
    index: number,
  ) => {
    const fields =
      quote.categorySpecificFields.filter(
        (_, fieldIndex) =>
          fieldIndex !== index,
      );

    onChange({
      ...quote,
      categorySpecificFields:
        fields,
    });
  };

  const addField = () => {
    const fields = [
      ...quote.categorySpecificFields,
      {
        key: `informacao-${Date.now()}`,
        label: "Nova informação",
        value: "",
      },
    ];

    onChange({
      ...quote,
      categorySpecificFields:
        fields,
    });
  };

  return (
    <div className="space-y-6">
      {/* CLIENTE */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">
            Dados do cliente
          </h3>

          <p className="text-sm text-gray-500">
            Confira e edite os dados
            identificados pela IA.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Nome
            </label>

            <input
              value={quote.client.name}
              onChange={(event) =>
                updateClient(
                  "name",
                  event.target.value,
                )
              }
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Telefone
            </label>

            <input
              value={quote.client.phone}
              onChange={(event) =>
                updateClient(
                  "phone",
                  event.target.value,
                )
              }
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              E-mail
            </label>

            <input
              value={quote.client.email}
              onChange={(event) =>
                updateClient(
                  "email",
                  event.target.value,
                )
              }
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              CPF / CNPJ
            </label>

            <input
              value={quote.client.document}
              onChange={(event) =>
                updateClient(
                  "document",
                  event.target.value,
                )
              }
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">
              Endereço
            </label>

            <input
              value={quote.client.address}
              onChange={(event) =>
                updateClient(
                  "address",
                  event.target.value,
                )
              }
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>
        </div>
      </section>

      {/* INFORMAÇÕES DINÂMICAS */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">
              Informações identificadas pela IA
            </h3>

            <p className="text-sm text-gray-500">
              A IA cria automaticamente os
              campos relevantes encontrados
              no texto ou na voz. Você pode
              editar, adicionar ou remover
              qualquer informação.
            </p>
          </div>

          <button
            type="button"
            onClick={addField}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-gray-50"
          >
            <Plus size={16} />
            Adicionar
          </button>
        </div>

        {quote.categorySpecificFields.length ===
        0 ? (
          <div className="rounded-lg border border-dashed p-5 text-sm text-gray-500">
            Nenhuma informação adicional foi
            identificada. Você pode adicionar
            um campo manualmente.
          </div>
        ) : (
          <div className="space-y-3">
            {quote.categorySpecificFields.map(
              (field, index) => (
                <div
                  key={`${field.key}-${index}`}
                  className="flex items-end gap-3"
                >
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      {field.label}
                    </label>

                    <input
                      value={field.value}
                      onChange={(event) =>
                        updateField(
                          index,
                          event.target.value,
                        )
                      }
                      className="w-full rounded-lg border px-3 py-2"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      removeField(index)
                    }
                    className="rounded-lg border p-2 text-red-600 hover:bg-red-50"
                    aria-label="Remover campo"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ),
            )}
          </div>
        )}
      </section>

      {/* ITENS */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">
              Produtos e serviços
            </h3>

            <p className="text-sm text-gray-500">
              Cada produto ou serviço fica
              separado com seu respectivo
              valor.
            </p>
          </div>

          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-gray-50"
          >
            <Plus size={16} />
            Adicionar item
          </button>
        </div>

        <div className="space-y-4">
          {quote.items.map(
            (item, index) => (
              <div
                key={item.id}
                className="rounded-lg border p-4"
              >
                <div className="grid gap-4 md:grid-cols-12">
                  <div className="md:col-span-4">
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      Produto / serviço
                    </label>

                    <input
                      value={item.name}
                      onChange={(event) =>
                        updateItem(
                          index,
                          "name",
                          event.target.value,
                        )
                      }
                      className="w-full rounded-lg border px-3 py-2"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      Descrição
                    </label>

                    <input
                      value={item.description}
                      onChange={(event) =>
                        updateItem(
                          index,
                          "description",
                          event.target.value,
                        )
                      }
                      className="w-full rounded-lg border px-3 py-2"
                    />
                  </div>

                  <div className="md:col-span-1">
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      Qtd.
                    </label>

                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(
                          index,
                          "quantity",
                          Number(
                            event.target.value,
                          ),
                        )
                      }
                      className="w-full rounded-lg border px-3 py-2"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      Valor unitário
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(event) =>
                        updateItem(
                          index,
                          "unitPrice",
                          Number(
                            event.target.value,
                          ),
                        )
                      }
                      className="w-full rounded-lg border px-3 py-2"
                    />
                  </div>

                  <div className="md:col-span-1">
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      Total
                    </label>

                    <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm font-semibold">
                      {item.totalPrice.toLocaleString(
                        "pt-BR",
                        {
                          style: "currency",
                          currency: "BRL",
                        },
                      )}
                    </div>
                  </div>

                  <div className="flex items-end justify-end md:col-span-1">
                    <button
                      type="button"
                      onClick={() =>
                        removeItem(index)
                      }
                      className="rounded-lg border p-2 text-red-600 hover:bg-red-50"
                      aria-label="Remover item"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      </section>

      {/* PAGAMENTO E OBSERVAÇÕES */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Forma de pagamento
            </label>

            <input
              value={quote.paymentTerms}
              onChange={(event) =>
                onChange({
                  ...quote,
                  paymentTerms:
                    event.target.value,
                })
              }
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Validade da proposta
            </label>

            <input
              type="number"
              min="0"
              value={
                quote.validityDays ?? ""
              }
              onChange={(event) =>
                onChange({
                  ...quote,
                  validityDays:
                    event.target.value
                      ? Number(
                          event.target.value,
                        )
                      : null,
                })
              }
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Dias"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">
              Observações
            </label>

            <textarea
              value={quote.notes}
              onChange={(event) =>
                onChange({
                  ...quote,
                  notes:
                    event.target.value,
                })
              }
              rows={4}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>
        </div>
      </section>

      {/* RESUMO */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="ml-auto max-w-sm space-y-3">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>

            <span className="font-medium">
              {quote.subtotal.toLocaleString(
                "pt-BR",
                {
                  style: "currency",
                  currency: "BRL",
                },
              )}
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span>Desconto</span>

            <span className="font-medium">
              {quote.discount.toLocaleString(
                "pt-BR",
                {
                  style: "currency",
                  currency: "BRL",
                },
              )}
            </span>
          </div>

          <div className="flex justify-between border-t pt-3 text-lg font-bold">
            <span>Total</span>

            <span>
              {quote.total.toLocaleString(
                "pt-BR",
                {
                  style: "currency",
                  currency: "BRL",
                },
              )}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
