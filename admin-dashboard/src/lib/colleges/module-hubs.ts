import definitions from "./module-hubs.json";
import {
  BookOpen,
  GraduationCap,
  Wallet,
  Users,
  Briefcase,
  Package,
  Bus,
  FileCheck,
  Building2,
  Bell,
  BarChart3,
  Shield,
  Library,
  Handshake,
  type LucideIcon,
} from "lucide-react";
export type ModuleHub = {
  key: string;
  title: string;
  description: string;
  screens: string[];
};
export const MODULE_HUBS: ModuleHub[] = definitions;
export const hubIcons: Record<string, LucideIcon> = {
  academics: GraduationCap,
  finance: Wallet,
  admissions: BookOpen,
  students: Users,
  hr: Briefcase,
  procurement: Package,
  transport: Bus,
  certificates: FileCheck,
  hostel: Building2,
  communication: Bell,
  reports: BarChart3,
  administration: Shield,
  library: Library,
  placements: Handshake,
};
export const hubRoute = (hub: ModuleHub) => `hub-${hub.key}`;
/** Screens merged into another one: their old address opens the screen that replaced them. */
export const RETIRED_SCREENS: Record<string, string> = {
  "module-admissions": "admissions",
  "module-finance": "fees",
};
/** Still valid addresses, but no longer offered as separate entries in menus. */
export const HIDDEN_SCREENS = new Set(["receipts", ...Object.keys(RETIRED_SCREENS)]);
export function visibleHubs(allowed: string[]) {
  return MODULE_HUBS.map((hub) => ({
    ...hub,
    screens: hub.screens.filter((screen) => allowed.includes(screen)),
  })).filter((hub) => hub.screens.length);
}
export function activeHub(route: string, allowed: string[]) {
  return visibleHubs(allowed).find((hub) => hubRoute(hub) === route);
}
export function screenLabel(screen: string, labels: Record<string, string>) {
  return (
    labels[screen] ||
    screen
      .replace(/^module-/, "")
      .replaceAll(/[-_]/g, " ")
      .replace(/^\w/, (c) => c.toUpperCase())
  );
}
