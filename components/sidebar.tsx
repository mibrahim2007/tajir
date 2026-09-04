"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UsersRound,
  Wallet,
  Search,
  Lock,
  Landmark,
  BookOpen,
  Video,
  Layers,
  LifeBuoy,
  Settings,
  Building2,
  UserCog,
  Sparkles,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CommandPaletteTrigger } from "./command-palette";
import { MODULE_META, type ModuleKey } from "@/lib/modules";

type NavLink = { href: string; label: string; icon: React.ElementType };
type NavGroup = { title: string; links: NavLink[] };

function buildNavGroups(role: string, enabledModules: ModuleKey[]): NavGroup[] {
  const enabled = new Set(enabledModules);
  const groups: NavGroup[] = [];

  groups.push({
    title: "Overview",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/ask", label: "Ask", icon: Sparkles },
    ],
  });

  const sections = ["Sales", "Procurement", "Inventory", "Accounts"] as const;
  for (const section of sections) {
    const links = (Object.entries(MODULE_META) as [ModuleKey, typeof MODULE_META[ModuleKey]][])
      .filter(([key, m]) => m.section === section && enabled.has(key))
      .map(([, m]) => ({ href: m.href, label: m.label, icon: m.icon }));
    if (links.length > 0) groups.push({ title: section, links });
  }

  if (role === "owner") {
    groups.push({
      title: "Admin",
      links: [
        { href: "/settings/business",         label: "Business",          icon: Building2 },
        { href: "/playground",                label: "Demo Playground",   icon: FlaskConical },
        { href: "/owners",                    label: "Owners",            icon: UserCog },
        { href: "/item-types",                label: "Item Types",        icon: Layers },
        { href: "/settings/team",             label: "Team",              icon: UsersRound },
        { href: "/settings/modules",          label: "Modules",           icon: Settings },
        { href: "/settings/opening-balances", label: "Opening Balances",  icon: Wallet },
        { href: "/banks",                     label: "Banks",             icon: Landmark },
        { href: "/settings/period-lock",      label: "Close the Books",   icon: Lock },
        { href: "/audit",                     label: "Audit Log",         icon: Search },
      ],
    });
  }

  groups.push({
    title: "Help",
    links: [
      { href: "/support",    label: "Support",     icon: LifeBuoy },
      { href: "/help",       label: "Help Videos", icon: Video },
      { href: "/user-guide", label: "User Guide",  icon: BookOpen },
    ],
  });

  return groups;
}

export type SidebarBaseProps = {
  role: string;
  userEmail: string;
  tenantName: string;
  supportCount?: number;
  enabledModules: ModuleKey[];
};

function NavItems({ groups, onNavigate, supportCount = 0 }: { groups: NavGroup[]; onNavigate?: () => void; supportCount?: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto py-2 px-3">
      {groups.map((group) => (
        <div key={group.title} className="mb-4">
          <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/60">
            {group.title}
          </p>
          {group.links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(link.href + "/");
            const showBadge = link.href === '/support' && supportCount > 0;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onNavigate}
                className={cn(
                  "relative flex items-center gap-3 px-2.5 py-2 rounded-xl text-[13.5px] font-medium transition-all mb-0.5 min-h-[40px]",
                  active
                    ? "bg-accent text-accent-foreground font-semibold shadow-[0_0_0_1px_hsl(214_95%_60%/0.25)]"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary shadow-[0_0_10px_hsl(214_95%_60%/0.9)]" />
                )}
                <link.icon className={cn("h-[18px] w-[18px] shrink-0", active ? "opacity-100" : "opacity-70")} />
                <span className="truncate flex-1">{link.label}</span>
                {showBadge && (
                  <span className="shrink-0 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1 leading-none">
                    {supportCount > 99 ? '99+' : supportCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/**
 * The drawer body. It no longer carries the user/logout footer — that region
 * moved to the top bar, where it stays reachable while the menu is closed.
 */
export function SidebarContent({
  role,
  tenantName,
  supportCount = 0,
  enabledModules,
  onNavigate,
}: SidebarBaseProps & { onNavigate?: () => void }) {
  const groups = buildNavGroups(role, enabledModules);

  return (
    <div className="flex flex-col h-full bg-card/95 backdrop-blur-xl">
      {/* Brand */}
      <div className="px-4 py-5 shrink-0">
        <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-primary to-[hsl(187_92%_52%)] shadow-[0_0_20px_hsl(214_95%_60%/0.45)]">
            <span className="text-primary-foreground text-sm font-black">T</span>
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-[15px] leading-tight tracking-tight truncate text-foreground">
              {tenantName}<span className="text-[hsl(84_74%_55%)]">.</span>
            </p>
            <p className="text-[11px] text-muted-foreground capitalize">{role}</p>
          </div>
        </Link>
      </div>

      <div className="mx-4 rule-glow shrink-0" />

      {/* Search trigger */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <CommandPaletteTrigger />
      </div>

      <NavItems groups={groups} onNavigate={onNavigate} supportCount={supportCount} />
    </div>
  );
}
