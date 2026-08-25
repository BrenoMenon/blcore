import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { hashAnswer } from "./recovery.server";
import { createPublicClient } from "./supabase-public.server";

const saveInput = z.object({
  email: z.string().email(),
  question: z.string().min(3).max(120),
  answer: z.string().min(2).max(120),
});

const emailInput = z.object({ email: z.string().email() });

const resetInput = z.object({
  email: z.string().email(),
  answer: z.string().min(1).max(120),
  password: z.string().min(6).max(72),
});

export const saveRecoveryKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("recovery_keys").upsert(
      {
        user_id: context.userId,
        email: data.email.toLowerCase(),
        question: data.question,
        answer_hash: hashAnswer(data.answer),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getRecoveryQuestion = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => emailInput.parse(d))
  .handler(async ({ data }) => {
    const client = createPublicClient();
    const { data: question } = await client.rpc("recovery_question", {
      p_email: data.email.toLowerCase(),
    });
    return { question: (question as string | null) ?? null };
  });

export const resetWithRecovery = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => resetInput.parse(d))
  .handler(async ({ data }) => {
    const client = createPublicClient();
    const { data: ok, error } = await client.rpc("recovery_reset", {
      p_email: data.email.toLowerCase(),
      p_answer_hash: hashAnswer(data.answer),
      p_password: data.password,
    });
    if (error) throw new Error(error.message);
    if (!ok) throw new Error("Resposta incorreta. Tente novamente.");
    return { ok: true };
  });
