import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);

    // Chamadas de server function / API esperam JSON. Devolver a página HTML de
    // erro aqui faz o cliente exibir "<!doctype html> ..." dentro do toast.
    const url = new URL(request.url);
    const accepts = request.headers.get("accept") ?? "";
    const wantsJson =
      accepts.includes("application/json") ||
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/_serverFn/") ||
      url.searchParams.has("createServerFn");

    const message =
      error instanceof Error && error.message ? error.message : "Erro inesperado no servidor.";

    if (wantsJson) {
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});


export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
