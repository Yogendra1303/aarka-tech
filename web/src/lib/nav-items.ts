import { UserRound, LayoutDashboard, Compass, ListChecks, Send, Radar, BarChart3, Files, Settings, CalendarClock } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

// Single source of truth for the app's primary destinations — shared by the
// desktop sidebar and the mobile nav so they can never drift.
export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  chip?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/profile", label: "My Career Hub", icon: UserRound },
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/explore", label: "Explore Jobs", icon: Compass },
  { href: "/pipeline", label: "Applications", icon: ListChecks },
  { href: "/followups", label: "Follow-ups", icon: Send },
  { href: "/documents", label: "Documents", icon: Files },
  { href: "/scheduled-scans", label: "Automation", icon: CalendarClock },
  { href: "/portals", label: "Job Sources", icon: Radar },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/config", label: "Integrations & Settings", icon: Settings },
];

export function visibleNavItems(followupsEnabled: boolean): NavItem[] {
  return followupsEnabled ? NAV_ITEMS : NAV_ITEMS.filter((item) => item.href !== "/followups");
}

export function isActivePath(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
