"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, MoreVertical, Search, LogOut, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { SidebarContent, type SidebarBaseProps } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "tajir:nav-open";

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

/**
 * App chrome: a slim top bar plus a nav drawer that stays out of the way.
 *
 * The nav is closed by default and opened from the ⋮ button at top-left. It
 * overlays the page rather than pushing it, so opening the menu never reflows
 * the report or table underneath — on a wide screen you can read a table and
 * flick the menu open without the columns jumping.
 *
 * The open/closed choice is remembered per browser, because someone who works
 * with the menu pinned open should not have to re-open it on every visit.
 */
export function AppShell({
  children,
  ...nav
}: SidebarBaseProps & { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supportCount = nav.supportCount ?? 0;

  // Read the remembered state after mount — reading localStorage during render
  // would differ between server and client and break hydration.
  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* private mode / blocked storage — the default (closed) is fine */
    }
    setReady(true);
  }, []);

  const toggle = useCallback(() => {
    setOpen((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* nothing to persist to; the session still works */
      }
      return next;
    });
  }, []);

  // Escape closes it, matching every other overlay in the app.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // On a narrow screen the drawer covers the content, so navigating away must
  // close it or the destination page is hidden behind it.
  useEffect(() => {
    if (window.innerWidth < 1024) setOpen(false);
  }, [pathname]);

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut({ scope: "local" });
    router.push("/auth/login");
  };

  const ini = initials(nav.tenantName);

  return (
    <div className="min-h-screen">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 h-14 flex items-center gap-2 px-3 sm:px-4 border-b border-border bg-card/85 backdrop-blur-xl print:hidden">
        <button
          onClick={toggle}
          aria-label={open ? "Hide menu" : "Show menu"}
          aria-expanded={open}
          className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border transition-all",
            open
              ? "border-primary/50 bg-accent text-accent-foreground glow-primary-sm"
              : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-secondary"
          )}
        >
          <MoreVertical className="h-[18px] w-[18px]" />
        </button>

        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <span className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-primary to-brand2 glow-primary">
            <span className="text-primary-foreground text-[13px] font-black">T</span>
          </span>
          <span className="font-extrabold text-[14px] tracking-tight truncate hidden sm:block">
            {nav.tenantName}
            <span className="text-success">.</span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
            className="h-9 w-9 rounded-xl flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-secondary transition-all"
            aria-label="Quick search"
          >
            <Search className="h-[17px] w-[17px]" />
          </button>

          <ThemeToggle />

          <Link
            href="/support"
            className="relative h-9 w-9 rounded-xl flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-secondary transition-all"
            aria-label={supportCount > 0 ? `${supportCount} support notification${supportCount !== 1 ? "s" : ""}` : "Support"}
          >
            <Bell className="h-[17px] w-[17px]" />
            {supportCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-1 leading-none glow-danger">
                {supportCount > 99 ? "99+" : supportCount}
              </span>
            )}
          </Link>

          {/* User region — name, email, sign out */}
          <div className="flex items-center gap-2.5 pl-1.5 sm:pl-2.5 sm:ml-1 sm:border-l border-border">
            <span className="h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 bg-gradient-to-br from-primary/25 to-success/20 border border-primary/40 text-accent-foreground">
              {ini}
            </span>
            <div className="min-w-0 hidden md:block leading-tight">
              <p className="text-[12.5px] font-bold text-foreground truncate max-w-[150px]">{nav.tenantName}</p>
              <p className="text-[10.5px] text-muted-foreground truncate max-w-[150px]">{nav.userEmail}</p>
            </div>
            <button
              onClick={logout}
              className="h-9 px-2.5 sm:px-3 rounded-xl flex items-center gap-1.5 border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 hover:bg-destructive/10 transition-all text-[12.5px] font-semibold"
              aria-label="Logout"
            >
              <LogOut className="h-[15px] w-[15px]" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Nav drawer ──────────────────────────────────────────── */}
      {/* Suppressed until the remembered state is read, so a pinned-open menu
          does not visibly slide in on every page load. */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={cn(
          "fixed inset-0 top-14 z-30 bg-foreground/25 backdrop-blur-[2px] print:hidden",
          ready && open ? "opacity-100" : "pointer-events-none opacity-0",
          ready && "transition-opacity duration-200"
        )}
      />
      <aside
        className={cn(
          "fixed left-0 top-14 bottom-0 z-30 w-[264px] border-r border-border print:hidden",
          "shadow-[8px_0_24px_-12px_hsl(var(--foreground)/0.25)]",
          ready && open ? "translate-x-0" : "-translate-x-full",
          ready && "transition-transform duration-200 ease-out"
        )}
      >
        <button
          onClick={() => setOpen(false)}
          aria-label="Hide menu"
          className="lg:hidden absolute right-2 top-3 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors z-10"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent {...nav} onNavigate={() => { if (window.innerWidth < 1024) setOpen(false) }} />
      </aside>

      <main className="min-w-0">{children}</main>
    </div>
  );
}
