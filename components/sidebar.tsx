"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommandPaletteTrigger } from "./command-palette";
import { type ModuleKey } from "@/lib/modules";
import {
  NEW_ACTIONS, PINNED, visibleItems, visibleSections, sectionForPath,
  type NavItem, type NavSection,
} from "@/lib/nav";

const OPEN_KEY = "tajir:nav-section";

export type SidebarBaseProps = {
  role: string;
  userEmail: string;
  tenantName: string;
  supportCount?: number;
  enabledModules: ModuleKey[];
};

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(href + "/");
}

/* ── Rows ─────────────────────────────────────────────────────── */

function ItemRow({
  item, active, onNavigate, badge, indent = false,
}: {
  item: NavItem
  active: boolean
  onNavigate?: () => void
  badge?: number
  indent?: boolean
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg text-[13px] transition-colors min-h-[34px]",
        indent ? "pl-8 pr-2.5 py-1.5" : "px-2.5 py-1.5",
        active
          ? "bg-accent text-accent-foreground font-semibold"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary glow-rail" />}
      {item.icon && <item.icon className={cn("h-4 w-4 shrink-0", active ? "opacity-100" : "opacity-70")} />}
      <span className="truncate flex-1">{item.label}</span>
      {!!badge && badge > 0 && (
        <span className="shrink-0 min-w-[17px] h-[17px] rounded-full bg-destructive text-destructive-foreground text-[9.5px] font-bold flex items-center justify-center px-1 leading-none">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

/* ── Collapsible group ────────────────────────────────────────── */

function Section({
  section, open, onToggle, onNavigate, supportCount,
}: {
  section: NavSection
  open: boolean
  onToggle: () => void
  onNavigate?: () => void
  supportCount: number
}) {
  const isActive = useIsActive();
  const items = section.groups ? section.groups.flatMap((g) => g.items) : (section.items ?? []);
  // A closed group still has to show that the page you are on lives inside it,
  // otherwise the menu looks like nothing is selected.
  const holdsCurrent = items.some((i) => isActive(i.href));

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] font-semibold transition-colors min-h-[38px]",
          holdsCurrent && !open
            ? "text-foreground"
            : open
              ? "text-foreground bg-secondary/60"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )}
      >
        <section.icon className={cn("h-[17px] w-[17px] shrink-0", holdsCurrent ? "text-primary" : "opacity-75")} />
        <span className="flex-1 text-left truncate">{section.label}</span>
        {holdsCurrent && !open && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
        <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 opacity-60 transition-transform", open && "rotate-90")} />
      </button>

      {open && (
        <div className="mt-0.5 mb-2">
          {section.groups
            ? section.groups.map((g) => (
                <div key={g.title} className="mb-2">
                  <p className="px-2.5 pl-8 mb-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50">
                    {g.title}
                  </p>
                  {g.items.map((i) => (
                    <ItemRow key={i.href} item={i} active={isActive(i.href)} onNavigate={onNavigate} indent />
                  ))}
                </div>
              ))
            : (section.items ?? []).map((i) => (
                <ItemRow
                  key={i.href}
                  item={i}
                  active={isActive(i.href)}
                  onNavigate={onNavigate}
                  badge={i.href === "/support" ? supportCount : undefined}
                  indent
                />
              ))}
        </div>
      )}
    </div>
  );
}

/* ── Drawer body ──────────────────────────────────────────────── */

/**
 * The nav drawer.
 *
 * Two ideas carry it. Creating a document is pinned to the top as its own block,
 * because "record a sale" is a different intent from "look at sales" and the old
 * menu made them look identical. Everything else lives in one collapsible group
 * at a time, so the list is never longer than a screen — the previous flat menu
 * ran to thirty-seven rows.
 *
 * The open group is remembered, and navigating opens whichever group holds the
 * current page, so the menu is always showing where you actually are.
 */
export function SidebarContent({
  role,
  tenantName,
  supportCount = 0,
  enabledModules,
  onNavigate,
}: SidebarBaseProps & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = useIsActive();
  const isOwner = role === "owner";
  const enabled = new Set(enabledModules);

  const sections = visibleSections(enabled, isOwner);
  const newActions = visibleItems(NEW_ACTIONS, enabled, isOwner);
  const current = sectionForPath(pathname, sections);

  const [open, setOpen] = useState<string | null>(null);

  // Restore the remembered group after mount (localStorage during render would
  // differ between server and client), then let the current route win — the
  // group you are inside is more useful than the one you last opened.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(OPEN_KEY);
    } catch {
      /* blocked storage — fall back to the route */
    }
    setOpen(current ?? stored);
    // Only on mount; route changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (current) setOpen(current);
  }, [current]);

  const toggle = (key: string) => {
    setOpen((prev) => {
      const next = prev === key ? null : key;
      try {
        if (next) window.localStorage.setItem(OPEN_KEY, next);
        else window.localStorage.removeItem(OPEN_KEY);
      } catch {
        /* nothing to persist to */
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full bg-card/95 backdrop-blur-xl">
      {/* Brand */}
      <div className="px-4 pt-4 pb-3 shrink-0">
        <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-primary to-brand2 glow-primary">
            <span className="text-primary-foreground text-sm font-black">T</span>
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-[15px] leading-tight tracking-tight truncate text-foreground">
              {tenantName}<span className="text-success">.</span>
            </p>
            <p className="text-[11px] text-muted-foreground capitalize">{role}</p>
          </div>
        </Link>
      </div>

      <div className="px-3 pb-3 shrink-0">
        <CommandPaletteTrigger />
      </div>

      {/* New — the forms people raise every day, one click from anywhere */}
      {newActions.length > 0 && (
        <div className="px-3 pb-3 shrink-0">
          <p className="px-1 mb-1.5 text-[9.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground/60 flex items-center gap-1">
            <Plus className="h-3 w-3" /> New
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {newActions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                onClick={onNavigate}
                className="group flex flex-col items-center gap-1 px-1 py-2 rounded-lg border border-border/70 bg-tile/60 hover:border-primary/45 hover:bg-secondary transition-all"
              >
                {a.icon && <a.icon className="h-4 w-4 text-primary shrink-0" />}
                <span className="text-[10px] font-semibold text-muted-foreground group-hover:text-foreground leading-none text-center truncate w-full">
                  {a.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mx-4 rule-glow shrink-0" />

      <nav className="flex-1 overflow-y-auto py-2 px-3">
        {PINNED.map((i) => (
          <ItemRow key={i.href} item={i} active={isActive(i.href)} onNavigate={onNavigate} />
        ))}

        <div className="h-2" />

        {sections.map((s) => (
          <Section
            key={s.key}
            section={s}
            open={open === s.key}
            onToggle={() => toggle(s.key)}
            onNavigate={onNavigate}
            supportCount={supportCount}
          />
        ))}
      </nav>
    </div>
  );
}
