/** Workspace selection is a UI preference; API authorization remains enforced by the backend. */
import { roleHome, roles, type Role } from "@/data/colleges";
import type {
  AccountRole,
  MeResponse,
  ScreenSummary,
  Screen,
} from "@/services/api";
const preferenceKey = (accountCode: string) =>
  `edunexa-active-role:${accountCode}`;
export function rememberRole(accountCode: string, roleCode: string) {
  try {
    sessionStorage.setItem(preferenceKey(accountCode), roleCode);
  } catch {
    /* Navigation still works when browser storage is disabled. */
  }
}
export function selectedRole(me: MeResponse): AccountRole | null {
  let remembered: string | null = null;
  try {
    remembered = sessionStorage.getItem(preferenceKey(me.account.code));
  } catch {
    /* Use an assigned role below. */
  }
  return (
    me.roles.find((role) => role.code === remembered) ||
    me.roles.find((role) => role.system_admin) ||
    me.roles[0] ||
    null
  );
}
export function roleArea(role: Pick<AccountRole, "name" | "code">): string {
  if (roles.includes(role.name as Role)) return roleHome[role.name as Role];
  return (
    role.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) ||
    role.code
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 64) ||
    "workspace"
  );
}
export function templateRole(role: AccountRole): Role {
  return roles.includes(role.name as Role)
    ? (role.name as Role)
    : "Master Data Entry";
}
const special: Record<string, string> = {
  credentials: "accounts",
  "audit-logs": "audit",
  "campus-analytics": "reports",
};
const SELF_PERMISSION = new Set(["roles", "accounts", "forms", "reports"]);
export function roleScreens(
  screens: ScreenSummary[],
  role: AccountRole | null,
): ScreenSummary[] {
  if (!role) return [];
  if (role.system_admin) return screens;
  return screens.flatMap((screen) => {
    if (role.screens?.length && !role.screens.includes(screen.key)) return [];
    const resources = screen.resources.filter((target) =>
      role.permissions[target]?.includes("view"),
    );
    // Backend rule: without a viewable table, the screen's own permission decides (roles,
    // accounts, forms, audit) and every other screen falls back to "reports".
    const permitted =
      resources.length > 0 ||
      role.permissions[
        special[screen.key] ||
          (SELF_PERMISSION.has(screen.key) ? screen.key : "reports")
      ]?.includes("view");
    return permitted ? [{ ...screen, resources }] : [];
  });
}
export function roleScreen(screen: Screen, role: AccountRole): Screen {
  if (role.system_admin) return screen;
  return {
    ...screen,
    resources: screen.resources
      .filter((r) => role.permissions[r.name]?.includes("view"))
      .map((r) => ({
        ...r,
        actions: r.actions.filter((a) => role.permissions[r.name]?.includes(a)),
      })),
  };
}
export function firstScreen(screens: ScreenSummary[]): string | null {
  return (
    ["dashboard", "student-enrollment"].find((key) =>
      screens.some((s) => s.key === key),
    ) ||
    screens[0]?.key ||
    null
  );
}
export function workspacePath(
  root: string,
  role: AccountRole,
  screens: ScreenSummary[],
): string {
  const first = firstScreen(screens);
  return `${root}/portal/${roleArea(role)}${first ? `/${first}` : ""}`;
}
