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
  LayoutDashboard,
  BadgeIndianRupee,
  CalendarDays,
  CreditCard,
  Receipt,
  Settings,
  ClipboardCheck,
  UserCog,
  KeyRound,
  FileText,
  Upload,
  History,
  Megaphone,
  ClipboardList,
  FlaskConical,
  CalendarCheck,
  NotebookPen,
  BookMarked,
  Landmark,
  Award,
  HandCoins,
  BedDouble,
  Truck,
  Boxes,
  type LucideIcon,
} from "lucide-react";
export type ModuleHub = {
  key: string;
  title: string;
  description: string;
  screens: string[];
};
/** Modules this college does not use: hidden from menus, search, dashboards and access pickers. */
export const HIDDEN_HUBS = new Set(["transport"]);
const ALL_HUBS: ModuleHub[] = definitions;
/** Screens of hidden modules (and transport costs in Procurement), never offered anywhere. */
export const HIDDEN_MODULE_SCREENS = new Set([
  ...ALL_HUBS.filter((h) => HIDDEN_HUBS.has(h.key)).flatMap((h) => h.screens),
  "transport-expenses",
  // Administration screens the college does not use.
  "imports",
  "module-imports",
  "module-access_control",
]);
export const MODULE_HUBS: ModuleHub[] = ALL_HUBS.filter((h) => !HIDDEN_HUBS.has(h.key)).map((h) => ({
  ...h,
  screens: h.screens.filter((s) => !HIDDEN_MODULE_SCREENS.has(s)),
}));
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
/** Icons of single screens, shared by the sidebar and the access pickers. */
export const screenIcons: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  "campus-analytics": BarChart3,
  "change-requests": ClipboardCheck,
  transport: Bus,
  buses: Bus,
  "bus-seating": Bus,
  routes: Truck,
  employees: Users,
  "teaching-staff": Users,
  "non-teaching-staff": Users,
  "daily-labour": Users,
  "employee-attendance": CalendarCheck,
  payroll: BadgeIndianRupee,
  "salary-structures": BadgeIndianRupee,
  "expense-dashboard": Package,
  inventory: Boxes,
  assets: Package,
  "purchase-requests": Package,
  timetable: CalendarDays,
  calendar: CalendarDays,
  attendance: CalendarCheck,
  assignments: NotebookPen,
  assessments: ClipboardList,
  syllabus: BookMarked,
  labs: FlaskConical,
  "course-setup": GraduationCap,
  academics: GraduationCap,
  accounts: UserCog,
  credentials: KeyRound,
  students: Users,
  "student-enrollment": Users,
  "student-leave": CalendarDays,
  admissions: GraduationCap,
  fees: Wallet,
  "fee-structures": Landmark,
  "late-fees": Wallet,
  scholarships: Award,
  payments: CreditCard,
  "manual-payments": HandCoins,
  cashbook: HandCoins,
  receipts: Receipt,
  hostels: Building2,
  "hostel-rooms": BedDouble,
  certificates: FileCheck,
  roles: Shield,
  settings: Settings,
  reports: BarChart3,
  notifications: Bell,
  announcements: Megaphone,
  campaigns: Megaphone,
  forms: FileText,
  imports: Upload,
  documents: FileText,
  "audit-logs": History,
};
/** A screen's icon; otherwise the icon of the module it belongs to. */
export function screenIcon(key: string): LucideIcon {
  if (screenIcons[key]) return screenIcons[key];
  const hub = MODULE_HUBS.find((h) => h.screens.includes(key));
  return (hub && hubIcons[hub.key]) || ClipboardCheck;
}
/** Screens merged into another one: their old address opens the screen that replaced them. */
export const RETIRED_SCREENS: Record<string, string> = {
  "module-admissions": "admissions",
  "module-finance": "fees",
  // Logins and their access are managed on one screen.
  credentials: "accounts",
};
/** Still valid addresses, but no longer offered as separate entries in menus. */
export const HIDDEN_SCREENS = new Set(["receipts", ...Object.keys(RETIRED_SCREENS), ...HIDDEN_MODULE_SCREENS]);
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
