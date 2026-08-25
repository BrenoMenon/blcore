import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/db";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, CheckCheck } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

export function NotificationsBell({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const t = useT();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const { data, error } = await db
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  useEffect(() => {
    const channel = db
      .channel(`notifications-rt-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as { title: string; body: string | null };
          toast(n.title, { description: n.body ?? undefined });
          qc.invalidateQueries({ queryKey: ["notifications", userId] });
          qc.invalidateQueries({ queryKey: ["my-bookings", userId] });
          qc.invalidateQueries({ queryKey: ["appointments"] });
          qc.invalidateQueries({ queryKey: ["pending-requests"] });
        },
      )
      .subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [qc, userId]);

  async function markAllRead() {
    if (unread === 0) return;
    await db
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    qc.invalidateQueries({ queryKey: ["notifications", userId] });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void markAllRead();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label={t("Notificações")}>
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">{t("Notificações")}</p>
          {items.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCheck className="h-3 w-3" /> {t("lidas")}
            </span>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("Nenhuma notificação por aqui.")}
            </p>
          )}
          {items.map((n) => (
            <div key={n.id} className="border-b border-border/60 px-3 py-2.5 last:border-0">
              <p className="text-sm font-medium">{t(n.title)}</p>
              {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
              <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                {fmtDateTime(n.created_at)}
              </p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}