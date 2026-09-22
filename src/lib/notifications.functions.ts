import { supabase } from "@/integrations/supabase/client";

export const notifyCompanyCancellation = async ({
  data,
}: {
  data: { appointmentId: string };
}) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return { ok: false as const, reason: "unauthorized" };

    const { data: appt, error } = await supabase
      .from("appointments")
      .select("id, user_id, client_user_id, starts_at, status, service_id")
      .eq("id", data.appointmentId)
      .maybeSingle();

    if (error || !appt) return { ok: false as const, reason: "not_found" };
    if (appt.client_user_id !== userData.user.id) return { ok: false as const, reason: "forbidden" };

    const type = "appointment_cancelled_by_client";
    const [{ data: profile }, { data: service }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", userData.user.id).maybeSingle(),
      appt.service_id
        ? supabase.from("services").select("name").eq("id", appt.service_id).maybeSingle()
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

    await (supabase as any).from("notifications").insert({
      user_id: appt.user_id,
      appointment_id: appt.id,
      type,
      title: "Agendamento cancelado",
      body: `${who} cancelou o agendamento de ${svc}${when.replace(",", " às")}.`,
    });

    return { ok: true as const };
  } catch {
    return { ok: false as const };
  }
};
