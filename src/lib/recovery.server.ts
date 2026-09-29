import { sha256 } from "js-sha256";

/** Normaliza a resposta (sem acento, minúscula, sem espaços extras) e gera hash */
export function hashAnswer(answer: string): string {
  const norm = answer
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
  return sha256(norm);
}
