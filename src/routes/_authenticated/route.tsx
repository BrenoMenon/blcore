import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CalendarDays, CalendarHeart, Compass, FileText, LayoutDashboard, LogOut, Moon, Settings, Sun, User, Users, Wrench } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { NotificationsBell } from "@/components/common/NotificationsBell";
import { SiteFooter } from "@/components/common/SiteFooter";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { redirect: location.href } });
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", data.user.id)
      .maybeSingle();
    const userType: "client" | "company" = profile?.user_type === "client" ? "client" : "company";
    const companyOnly = ["/dashboard", "/appointments", "/clients", "/services", "/quotes"];
    if (userType === "client" && companyOnly.some((p) => location.pathname.startsWith(p))) {
      throw redirect({ to: "/explore" });
    }
    if (userType === "company" && ["/explore", "/my-bookings"].some((p) => location.pathname.startsWith(p))) {
      throw redirect({ to: "/dashboard" });
    }
    return { userId: data.user.id, email: data.user.email, userType };
  },
  component: ProtectedLayout,
});

const companyNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/appointments", label: "Agenda", icon: CalendarDays },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/services", label: "Serviços", icon: Wrench },
  { to: "/quotes", label: "Orçamentos", icon: FileText },
  { to: "/settings", label: "Ajustes", icon: Settings },
] as const;

const clientNav = [
  { to: "/explore", label: "Buscar", icon: Compass },
  { to: "/my-bookings", label: "Agendamentos", icon: CalendarHeart },
  { to: "/profile", label: "Perfil", icon: User },
] as const;

function useNav() {
  const { userType } = Route.useRouteContext();
  return userType === "client" ? clientNav : companyNav;
}

function ProtectedLayout() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <DesktopSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 pb-24 md:pb-0">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
          <SiteFooter className="mt-6 pb-24 md:pb-6" />
        </main>
        <MobileBottomNav />
      </div>
    </div>
  );
}

function useCurrentPath() {
  return useRouterState({ select: (s) => s.location.pathname });
}

function DesktopSidebar() {
  const path = useCurrentPath();
  const nav = useNav();
  const t = useT();
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
      <div className="p-6">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const active = path.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_var(--border)]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {t(item.label)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function MobileBottomNav() {
  const path = useCurrentPath();
  const nav = useNav();
  const t = useT();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom,6px)] pt-1 px-3 shadow-[0_-4px_20px_rgba(0,0,0,0.15)] md:hidden">
      <div className={cn("flex w-full items-center justify-between gap-1 max-w-lg mx-auto")}>
        {nav.map((item, idx) => {
          const active = path.startsWith(item.to);
          const isFirst = idx === 0;
          const isLast = idx === nav.length - 1;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group relative flex flex-1 flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-150 select-none",
                "active:scale-90 active:opacity-80",
                // Nudge first button (Dashboard) away from the left screen edge/rounded corner
                isFirst && "pl-2 sm:pl-3",
                // Nudge last button (Ajustes) away from the right screen edge/rounded corner
                isLast && "pr-2 sm:pr-3",
                active
                  ? "text-primary font-semibold"
                  : "text-muted-foreground/80 hover:text-foreground font-medium"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center p-1.5 rounded-xl transition-all duration-200",
                  active
                    ? "bg-primary/15 text-primary scale-105 shadow-xs"
                    : "group-hover:bg-muted/50"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0 stroke-[2.2]" />
              </div>
              <span
                className={cn(
                  "truncate max-w-full text-[10px] leading-tight tracking-tight mt-0.5",
                  active ? "text-primary font-bold" : "text-muted-foreground"
                )}
              >
                {t(item.label)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function TopBar() {
  const { userId, email, userType } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const t = useT();

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", userId).maybeSingle();
      return data;
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-3 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="flex items-center gap-3 md:hidden">
        <Logo size="sm" />
      </div>
      <div className="hidden md:block" />
      <div className="flex items-center gap-1.5 sm:gap-3">
        <NotificationsBell userId={userId} />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 pl-1 pr-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/20 text-xs font-bold text-primary">
                  {initials(profile?.full_name ?? email)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[140px] truncate text-sm sm:inline">
                {profile?.full_name ?? email}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
              <User className="mr-2 h-4 w-4" /> {t("Meu perfil")}
            </DropdownMenuItem>
            {userType === "company" && (
              <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                <Settings className="mr-2 h-4 w-4" /> {t("Configurações")}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> {t("Sair")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const t = useT();
  const isDark = theme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={t(isDark ? "Ativar tema claro" : "Ativar tema escuro")}
      title={t(isDark ? "Tema claro" : "Tema escuro")}
      className="rounded-full"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
