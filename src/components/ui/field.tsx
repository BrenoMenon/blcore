import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/** Grid responsivo padrão para formulários (1 coluna no mobile). */
export function FormGrid({
  className,
  cols = 2,
  children,
}: {
  className?: string;
  cols?: 1 | 2 | 3;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3",
        cols === 2 && "sm:grid-cols-2",
        cols === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Campo de formulário com rótulo, espaçamento e erro padronizados.
 * Garante alinhamento consistente em todas as telas (mobile e desktop).
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  span,
  children,
}: {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  span?: 2 | 3 | "full";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-w-0 space-y-1.5",
        span === 2 && "sm:col-span-2",
        span === 3 && "lg:col-span-3 sm:col-span-2",
        span === "full" && "col-span-full",
        className,
      )}
    >
      {label && (
        <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
      )}
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}