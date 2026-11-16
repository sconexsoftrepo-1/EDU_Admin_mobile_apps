import type {
  AccessLevel,
  PermissionAction,
  PermissionMap,
  Role,
  ScreenSummary,
} from "@/services/api";
import { HIDDEN_SCREENS, MODULE_HUBS } from "./module-hubs";

/** What each access level allows on a screen's records. */
export const LEVEL_ACTIONS: Record<AccessLevel, PermissionAction[]> = {
  view: ["view"],
  edit: ["view", "create", "edit"],
  full: ["view", "create", "edit", "delete", "approve", "export"],
};
export const LEVEL_LABELS: Record<AccessLevel, string> = {
  view: "View",
  edit: "Add & edit",
  full: "Full",
};
export const LEVEL_HELP: Record<AccessLevel, string> = {
  view: "Can open and read",
  edit: "Can add and change records",
  full: "Can also delete, approve and export",
};

/** Screens without tables of their own open with this permission (mirrors the backend). */
const SPECIAL: Record<string, string> = {
  roles: "roles",
  accounts: "accounts",
  forms: "forms",
  "audit-logs": "audit",
  reports: "reports",
  dashboard: "reports",
};

/** Screens offered in the access pickers (old and merged addresses left out). */
export function grantableScreens(screens: ScreenSummary[]) {
  return screens.filter(
    (s) => !HIDDEN_SCREENS.has(s.key) && !s.key.startsWith("module-"),
  );
}

function targets(screen: ScreenSummary): string[] {
  return [...screen.resources, ...(SPECIAL[screen.key] ? [SPECIAL[screen.key]] : [])];
}

/** Role permissions for a set of ticked screens. */
export function permissionsFor(
  selection: Record<string, AccessLevel>,
  screens: ScreenSummary[],
): PermissionMap {
  const map: Record<string, Set<PermissionAction>> = {};
  for (const screen of screens) {
    const level = selection[screen.key];
    if (!level) continue;
    for (const target of targets(screen)) {
      map[target] ??= new Set();
      LEVEL_ACTIONS[level].forEach((a) => map[target].add(a));
    }
  }
  return Object.fromEntries(
    Object.entries(map).map(([k, v]) => [k, [...v].sort()]),
  ) as PermissionMap;
}

/** The access level a set of permissions gives on one screen (null = cannot open it). */
export function levelOf(
  screen: ScreenSummary,
  permissions: PermissionMap,
): AccessLevel | null {
  const list = targets(screen);
  if (!list.length) return null;
  const has = (action: PermissionAction) =>
    list.some((t) => permissions[t]?.includes(action));
  if (!has("view")) return null;
  if (has("delete") || has("approve") || has("export")) return "full";
  if (has("create") || has("edit")) return "edit";
  return "view";
}

/** The ticked screens of an existing role. */
export function roleSelection(
  role: Pick<Role, "permissions" | "screens" | "system_admin"> | undefined,
  screens: ScreenSummary[],
): Record<string, AccessLevel> {
  if (!role) return {};
  const allowed = role.screens ? new Set(role.screens) : null;
  const out: Record<string, AccessLevel> = {};
  for (const screen of grantableScreens(screens)) {
    if (role.system_admin) {
      out[screen.key] = "full";
      continue;
    }
    if (allowed && !allowed.has(screen.key)) continue;
    const level = levelOf(screen, role.permissions || {});
    if (level) out[screen.key] = level;
    else if (allowed?.has(screen.key)) out[screen.key] = "view";
  }
  return out;
}

const RANK: Record<AccessLevel, number> = { view: 1, edit: 2, full: 3 };
/** Combined access of several roles: the highest level per screen. */
export function combined(
  ...selections: Record<string, AccessLevel>[]
): Record<string, AccessLevel> {
  const out: Record<string, AccessLevel> = {};
  for (const sel of selections)
    for (const [key, level] of Object.entries(sel))
      if (!out[key] || RANK[level] > RANK[out[key]]) out[key] = level;
  return out;
}

/** Screens grouped into the sidebar's modules; screens of no module go under "General". */
export function groupByModule(screens: ScreenSummary[]) {
  const list = grantableScreens(screens);
  const byKey = new Map(list.map((s) => [s.key, s]));
  const used = new Set<string>();
  const groups = MODULE_HUBS.map((hub) => {
    const items = hub.screens
      .map((key) => byKey.get(key))
      .filter((s): s is ScreenSummary => !!s && !used.has(s.key));
    items.forEach((s) => used.add(s.key));
    return { key: hub.key, title: hub.title, screens: items };
  }).filter((g) => g.screens.length);
  const rest = list.filter((s) => !used.has(s.key));
  return rest.length
    ? [{ key: "general", title: "General", screens: rest }, ...groups]
    : groups;
}
