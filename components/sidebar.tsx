"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Menu,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Undo2,
  ShoppingBag,
  RefreshCcw,
  ClipboardList,
  Users,
  ArrowDownLeft,
  Truck,
  ArrowUpRight,
  Tag,
  Receipt,
  BookOpen,
  PenLine,
  BarChart2,
  UsersRound,
  Wallet,
  Search,
  Landmark,
  LogOut,
  X,
  MapPin,
  ArrowLeftRight,
  Layers,
  LifeBuoy,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "./logout-button";
import { CommandPaletteTrigger } from "./command-palette";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type NavLink = { href: string; label: string; icon: React.ElementType };
type NavGroup = { title: string; links: NavLink[] };

const ownerGroups: NavGroup[] = [
  {
    title: "Overview",
    links: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Trading",
    links: [
      { href: "/inventory", label: "Inventory", icon: Package },
      { href: "/purchases", label: "Purchases", icon: ShoppingCart },
      { href: "/purchase-returns", label: "Purchase Returns", icon: Undo2 },
      { href: "/sales", label: "Sales", icon: ShoppingBag },
      { href: "/sale-returns", label: "Sale Returns", icon: RefreshCcw },
      { href: "/gatepasses", label: "Gatepasses", icon: ClipboardList },
      { href: "/locations", label: "Locations", icon: MapPin },
      { href: "/stock-transfers", label: "Stock Transfers", icon: ArrowLeftRight },
    ],
  },
  {
    title: "Finance",
    links: [
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/receipts", label: "Receipts", icon: ArrowDownLeft },
      { href: "/suppliers", label: "Suppliers", icon: Truck },
      { href: "/payments", label: "Payments", icon: ArrowUpRight },
      { href: "/pricing", label: "Pricing", icon: Tag },
      { href: "/expenses", label: "Expenses", icon: Receipt },
    ],
  },
  {
    title: "Accounting",
    links: [
      { href: "/accounts", label: "Accounts", icon: BookOpen },
      { href: "/vouchers", label: "Vouchers", icon: PenLine },
      { href: "/reports", label: "Reports", icon: BarChart2 },
    ],
  },
  {
    title: "Settings",
    links: [
      { href: "/item-types", label: "Item Types", icon: Layers },
      { href: "/settings/team", label: "Team", icon: UsersRound },
      { href: "/settings/opening-balances", label: "Opening Balances", icon: Wallet },
      { href: "/banks", label: "Banks", icon: Landmark },
      { href: "/audit", label: "Audit Log", icon: Search },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/support", label: "Support", icon: LifeBuoy },
    ],
  },
];

const assistantGroups: NavGroup[] = [
  {
    title: "Overview",
    links: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Trading",
    links: [
      { href: "/inventory", label: "Inventory", icon: Package },
      { href: "/purchases", label: "Purchases", icon: ShoppingCart },
      { href: "/purchase-returns", label: "Purchase Returns", icon: Undo2 },
      { href: "/sales", label: "Sales", icon: ShoppingBag },
      { href: "/sale-returns", label: "Sale Returns", icon: RefreshCcw },
      { href: "/gatepasses", label: "Gatepasses", icon: ClipboardList },
      { href: "/stock-transfers", label: "Stock Transfers", icon: ArrowLeftRight },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/support", label: "Support", icon: LifeBuoy },
    ],
  },
];

type SidebarBaseProps = {
  role: string;
  userEmail: string;
  tenantName: string;
  supportCount?: number;
};

function initials(name: string) {
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function NavItems({ groups, onNavigate, supportCount = 0 }: { groups: NavGroup[]; onNavigate?: () => void; supportCount?: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto py-2 px-3">
      {groups.map((group) => (
        <div key={group.title} className="mb-4">
          <p className="px-2 mb-1 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground/70">
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
                  "relative flex items-center gap-3 px-2.5 py-2 rounded-xl text-[13.5px] font-medium transition-colors mb-0.5 min-h-[40px]",
                  active
                    ? "bg-accent text-primary font-semibold"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary" />
                )}
                <link.icon className={cn("h-[18px] w-[18px] shrink-0", active ? "opacity-100" : "opacity-75")} />
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

function SidebarContent({
  role,
  userEmail,
  tenantName,
  supportCount = 0,
  onNavigate,
}: SidebarBaseProps & { onNavigate?: () => void }) {
  const groups = role === "owner" ? ownerGroups : assistantGroups;
  const ini = initials(tenantName);

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Brand */}
      <div className="px-4 py-5 shrink-0">
        <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center shadow-sm shrink-0">
            <span className="text-primary-foreground text-sm font-bold">T</span>
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-[15px] leading-tight tracking-tight truncate text-foreground">
              {tenantName}<span className="text-primary">.</span>
            </p>
            <p className="text-[11px] text-muted-foreground capitalize">{role}</p>
          </div>
        </Link>
      </div>

      {/* Search trigger */}
      <div className="px-3 pb-2 shrink-0">
        <CommandPaletteTrigger />
      </div>

      {/* Nav */}
      <NavItems groups={groups} onNavigate={onNavigate} supportCount={supportCount} />

      {/* Footer */}
      <div className="border-t border-border p-3 shrink-0">
        <div className="flex items-center gap-2.5 px-1">
          <div className="h-8 w-8 rounded-full bg-accent text-primary flex items-center justify-center text-xs font-bold shrink-0">
            {ini}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-foreground truncate">{tenantName}</p>
            <p className="text-[11px] text-muted-foreground truncate">{userEmail}</p>
          </div>
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}

export function DesktopSidebar(props: SidebarBaseProps) {
  return (
    <aside className="hidden lg:flex lg:flex-col w-[260px] shrink-0 border-r border-border h-screen sticky top-0 print:hidden">
      <SidebarContent {...props} />
    </aside>
  );
}

export function MobileHeader(props: SidebarBaseProps) {
  const [open, setOpen] = useState(false);
  const supportCount = props.supportCount ?? 0;

  return (
    <header className="lg:hidden sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-card/95 backdrop-blur-sm px-4">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button className="p-2 rounded-lg hover:bg-secondary transition-colors" aria-label="Open navigation">
            <Menu className="h-5 w-5 text-muted-foreground" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-[260px] border-r border-border" showCloseButton={false}>
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <SidebarContent {...props} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <Link href="/dashboard" className="font-extrabold text-sm tracking-tight">
        {props.tenantName}<span className="text-primary">.</span>
      </Link>
      <div className="ml-auto flex items-center gap-1">
        <Link
          href="/support"
          className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
          aria-label={supportCount > 0 ? `${supportCount} support notification${supportCount !== 1 ? 's' : ''}` : 'Support'}
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {supportCount > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-1 leading-none">
              {supportCount > 99 ? '99+' : supportCount}
            </span>
          )}
        </Link>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
          className="p-2 rounded-lg hover:bg-secondary transition-colors"
          aria-label="Quick search"
        >
          <Search className="h-5 w-5 text-muted-foreground" />
        </button>
        <LogoutButton />
      </div>
    </header>
  );
}
