import type { ComponentType, SVGProps } from "react";
import {
  IconDashboard,
  IconCount,
  IconSessions,
  IconInventory,
  IconSettings,
  IconExpense,
  IconMaterials,
} from "./icons";

export type NavItem = {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  adminOnly?: boolean;
};

// Bottom nav (mobile) — primary destinations. Settings lives in the top-right
// user menu, so it is kept out of the bar to leave room for daily actions.
// Materials is the staff's daily log; Sessions & Expenses are admin-only.
export const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", Icon: IconDashboard },
  { href: "/", label: "Count", Icon: IconCount },
  { href: "/materials", label: "Materials", Icon: IconMaterials },
  { href: "/sessions", label: "Sessions", Icon: IconSessions, adminOnly: true },
  { href: "/expenses", label: "Expenses", Icon: IconExpense, adminOnly: true },
];

// Sidebar (desktop) — primary plus admin-only destinations.
export const SIDEBAR_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", Icon: IconDashboard },
  { href: "/", label: "Count", Icon: IconCount },
  { href: "/materials", label: "Materials", Icon: IconMaterials },
  { href: "/sessions", label: "Sessions", Icon: IconSessions, adminOnly: true },
  { href: "/expenses", label: "Expenses", Icon: IconExpense, adminOnly: true },
  { href: "/items", label: "Inventory", Icon: IconInventory, adminOnly: true },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];
