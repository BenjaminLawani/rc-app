import type { ComponentType, SVGProps } from "react";
import {
  IconDashboard,
  IconCount,
  IconSessions,
  IconInventory,
  IconSettings,
} from "./icons";

export type NavItem = {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  adminOnly?: boolean;
};

// Bottom nav (mobile) — primary destinations. Sessions is admin-only.
export const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", Icon: IconDashboard },
  { href: "/", label: "Count", Icon: IconCount },
  { href: "/sessions", label: "Sessions", Icon: IconSessions, adminOnly: true },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];

// Sidebar (desktop) — primary plus admin-only destinations.
export const SIDEBAR_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", Icon: IconDashboard },
  { href: "/", label: "Count", Icon: IconCount },
  { href: "/sessions", label: "Sessions", Icon: IconSessions, adminOnly: true },
  { href: "/items", label: "Inventory", Icon: IconInventory, adminOnly: true },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];
