import { supabase } from "@/integrations/supabase/client";
import { hashAnswer } from "./recovery.server";

export const saveRecoveryKey = async ({
  data,
}: {
  data: { email: string; question: string; answer: string };
}) => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) throw new Error("Usuário não autenticado");
  const { error } = await supabase.from("recovery_keys").upsert(
    {
      user_id: userData.user.id,
      email: data.email.toLowerCase(),
      question: data.question,
      answer_hash: hashAnswer(data.answer),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  return { ok: true };
};

export const getRecoveryQuestion = async ({
  data,
}: {
  data: { email: string };
}) => {
  const { data: question, error } = await (supabase as any).rpc("recovery_question", {
    p_email: data.email.toLowerCase(),
  });
  if (error) throw error;
  return { question: (question as string | null) ?? null };
};

export const resetWithRecovery = async ({
  data,
}: {
  data: { email: string; answer: string; password: string };
}) => {
  const { data: ok, error } = await (supabase as any).rpc("recovery_reset", {
    p_email: data.email.toLowerCase(),
    p_answer_hash: hashAnswer(data.answer),
    p_password: data.password,
  });
  if (error) throw new Error(error.message);
  if (!ok) throw new Error("Resposta incorreta. Tente novamente.");
  return { ok: true };
};
