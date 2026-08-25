import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cria a notificação da EMPRESA quando o CLIENTE cancela um agendamento.
 * O cancelamento em si continua sendo feito pelo cliente (RLS), aqui apenas
 * registramos o aviso para a empresa dona do agendamento.
 */
export const notifyCompanyCancellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { appointmentId: string }) => {
    if (!input?.appointmentId) throw new Error("appointmentId obrigatório");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Cliente admin sem tipagem estrita (a tabela `notifications` existe no banco,
    // mas ainda não está nos tipos gerados).
    const admin = supabaseAdmin as unknown as SupabaseClient;

    const { data: appt, error } = await supabaseAdmin
      .from("appointments")
      .select("id, user_id, client_user_id, client_id, starts_at, status, service_id")
      .eq("id", data.appointmentId)
      .maybeSingle();
    if (error) throw error;
    if (!appt) return { ok: false as const, reason: "not_found" };

    // Só o próprio cliente do agendamento pode disparar o aviso.
    if (appt.client_user_id !== context.userId) return { ok: false as const, reason: "forbidden" };
    if (appt.status !== "cancelled") return { ok: false as const, reason: "not_cancelled" };

    const type = "appointment_cancelled_by_client";

    // Evita duplicidade
    const { data: existing } = await admin
      .from("notifications")
      .select("id")
      .eq("appointment_id", appt.id)
      .eq("user_id", appt.user_id)
      .eq("type", type)
      .maybeSingle();
    if (existing) return { ok: true as const, duplicated: true };

    const [{ data: profile }, { data: service }] = await Promise.all([
      admin.from("profiles").select("full_name").eq("id", context.userId).maybeSingle(),
      appt.service_id
        ? admin.from("services").select("name").eq("id", appt.service_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const when = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(appt.starts_at));

    const who = profile?.full_name?.trim() || "O cliente";
    const svc = service?.name ? `${service.name} · ` : "";

    const { error: insertError } = await admin.from("notifications").insert({
      user_id: appt.user_id,
      appointment_id: appt.id,
      type,
      title: "Agendamento cancelado",
      body: `${who} cancelou o agendamento de ${svc}${when.replace(",", " às")}.`,
    });
    if (insertError) throw insertError;

    return { ok: true as const };
  });
