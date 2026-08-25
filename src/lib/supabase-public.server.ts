import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_PROJECT_URL,
  SUPABASE_PUBLISHABLE_API_KEY,
} from "@/integrations/supabase/project-config";

/** Cliente Supabase com a chave publicável, usado apenas no servidor. */
export function createPublicClient() {
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? SUPABASE_PROJECT_URL;
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
    SUPABASE_PUBLISHABLE_API_KEY;
  if (!url || !key) throw new Error("Supabase não configurado (SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY)");
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input as RequestInfo, { ...init, headers });
      },
    },
  });
}
