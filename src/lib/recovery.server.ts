import { createHash } from "crypto";

/** Normaliza a resposta (sem acento, minúscula, sem espaços extras) e gera hash */
export function hashAnswer(answer: string): string {
  const norm = answer
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
  return createHash("sha256").update(norm).digest("hex");
}
