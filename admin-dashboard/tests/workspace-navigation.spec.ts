import { test, expect } from "@playwright/test";
import {
  firstScreen,
  roleArea,
  roleScreens,
  roleScreen,
  selectedRole,
  rememberRole,
  templateRole,
  workspacePath,
} from "../src/lib/colleges/role-navigation";
import {
  clearWorkspaceCache,
  readWorkspaceCache,
  writeWorkspaceCache,
  refreshWorkspaceCache,
  workspaceCacheKey,
  prepareWorkspaceSession,
  readPreparedWorkspaceSession,
} from "../src/lib/colleges/workspace-cache";
import { validCollegePath, collegeBySlug } from "../src/data/colleges";
import type {
  AccountRole,
  MeResponse,
  ScreenSummary,
  Screen,
} from "../src/services/api";
const master: AccountRole = {
  code: "MASTER-DATA-ENTRY",
  name: "Master Data Entry",
  scope: "college",
  permissions: {
    students: ["view", "create"],
    parents: ["view", "create"],
    import_jobs: ["view", "create"],
  },
  screens: ["student-enrollment", "parent-enrollment", "imports"],
};
const admin: AccountRole = {
  code: "SYSTEM-ADMIN",
  name: "Super Admin",
  scope: "college",
  system_admin: true,
  permissions: {},
};
const navigation: ScreenSummary[] = [
  { key: "dashboard", title: "Dashboard", resources: ["students", "payments"] },
  { key: "roles", title: "Roles & access", resources: [] },
  { key: "imports", title: "Imports", resources: ["import_jobs"] },
  {
    key: "student-enrollment",
    title: "Student enrollment",
    resources: ["students", "parents", "payments"],
  },
  {
    key: "parent-enrollment",
    title: "Parent enrollment",
    resources: ["parents"],
  },
];
test.beforeEach(() => clearWorkspaceCache());
test("failed record refreshes cannot replace the last successful cache", async () => {
  const key = workspaceCacheKey("ADMIN", "ROOT", "template:dashboard");
  const complete = { records: ["EMP-1"], errors: [] as string[] };
  writeWorkspaceCache(key, complete);
  const failed = await refreshWorkspaceCache(
    key,
    async () => ({ records: [], errors: ["Dashboard"] }),
    (value) => value.errors.length === 0,
  );
  expect(failed.errors).toEqual(["Dashboard"]);
  expect(readWorkspaceCache(key)).toEqual(complete);
});
test("removed mobile preview modules no longer have dashboard routes", () => {
  for (const key of [
    "mobile-apps",
    "admin-app",
    "parent-app",
    "teacher-app",
    "student-app",
    "staff",
  ]) {
    expect(
      validCollegePath(collegeBySlug("edunexa-college")!, [
        "portal",
        "admin",
        key,
      ]),
    ).toBe(false);
  }
});
test("dedicated staff directories remain registered after removing the legacy staff screen", () => {
  for (const key of ["teaching-staff", "non-teaching-staff", "daily-labour"]) {
    expect(
      validCollegePath(collegeBySlug("edunexa-college")!, [
        "portal",
        "admin",
        key,
      ]),
    ).toBe(true);
  }
});
test("Master Data Entry uses its own URL and first assigned screen", () => {
  expect(roleArea(master)).toBe("master-data-entry");
  expect(templateRole(master)).toBe("Master Data Entry");
  const allowed = roleScreens(navigation, master);
  expect(allowed.map((s) => s.key)).toEqual([
    "imports",
    "student-enrollment",
    "parent-enrollment",
  ]);
  expect(
    workspacePath("", master, allowed),
  ).toBe(
    "/portal/master-data-entry/student-enrollment",
  );
  expect(
    validCollegePath(collegeBySlug("edunexa-college")!, [
      "portal",
      "master-data-entry",
      "student-enrollment",
    ]),
  ).toBe(true);
});
test("selected role limits resources and actions even for an account holding multiple roles", () => {
  const spec: Screen = {
    key: "student-enrollment",
    title: "Enrollment",
    resources: [
      {
        name: "students",
        title: "Students",
        path: "/students",
        fields: [],
        actions: ["view", "create", "edit", "delete"],
      },
      {
        name: "payments",
        title: "Payments",
        path: "/payments",
        fields: [],
        actions: ["view"],
      },
    ],
  };
  expect(
    roleScreen(spec, master).resources.map((r) => [r.name, r.actions]),
  ).toEqual([["students", ["view", "create"]]]);
  expect(roleScreens(navigation, master).some((s) => s.key === "roles")).toBe(
    false,
  );
});
test("role preference must match a server-assigned role and never falls back to Principal", () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => values.get(k) || null,
      setItem: (k: string, v: string) => values.set(k, v),
    },
  });
  const me = {
    account: { code: "account-a" },
    roles: [admin, master],
  } as MeResponse;
  rememberRole("account-a", master.code);
  expect(selectedRole(me)?.code).toBe(master.code);
  rememberRole("account-a", "UNASSIGNED-PRINCIPAL");
  expect(selectedRole(me)?.code).toBe(admin.code);
  expect(selectedRole({ ...me, roles: [master] })?.name).toBe(
    "Master Data Entry",
  );
  delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
});
test("custom role URLs are safe and no role gains a dashboard by default", () => {
  expect(roleArea({ ...master, name: "Front Desk / Admissions" })).toBe(
    "front-desk-admissions",
  );
  expect(firstScreen([])).toBeNull();
  expect(roleScreens(navigation, null)).toEqual([]);
  expect(roleScreens(navigation, admin)).toHaveLength(navigation.length);
});
test("cache isolates accounts and roles and remains available during background refresh", async () => {
  const key = workspaceCacheKey("a", master.code, "screen:students");
  writeWorkspaceCache(key, { name: "cached" });
  expect(
    readWorkspaceCache(workspaceCacheKey("b", master.code, "screen:students")),
  ).toBeUndefined();
  expect(
    readWorkspaceCache(workspaceCacheKey("a", admin.code, "screen:students")),
  ).toBeUndefined();
  let release!: (value: { name: string }) => void;
  const network = new Promise<{ name: string }>((resolve) => {
    release = resolve;
  });
  const updating = refreshWorkspaceCache(key, () => network);
  expect(readWorkspaceCache(key)).toEqual({ name: "cached" });
  release({ name: "fresh" });
  await updating;
  expect(readWorkspaceCache(key)).toEqual({ name: "fresh" });
});
test("concurrent requests for the same screen are deduplicated", async () => {
  const key = workspaceCacheKey("a", master.code, "screen:students");
  let calls = 0;
  let release!: (n: number) => void;
  const network = new Promise<number>((resolve) => {
    release = resolve;
  });
  const load = () => {
    calls++;
    return network;
  };
  const a = refreshWorkspaceCache(key, load),
    b = refreshWorkspaceCache(key, load);
  expect(a).toBe(b);
  release(1);
  await Promise.all([a, b]);
  expect(calls).toBe(1);
});
test("logout clears cached data and an older in-flight request cannot repopulate it", async () => {
  const key = workspaceCacheKey("a", master.code, "screen:students");
  let release!: (n: number) => void;
  const network = new Promise<number>((resolve) => {
    release = resolve;
  });
  writeWorkspaceCache(key, 1);
  const pending = refreshWorkspaceCache(key, () => network);
  clearWorkspaceCache();
  release(2);
  await pending;
  expect(readWorkspaceCache(key)).toBeUndefined();
});
test("failed refresh preserves previously loaded records and cache age is bounded", async () => {
  const key = workspaceCacheKey("a", master.code, "screen:students");
  writeWorkspaceCache(key, 42);
  await expect(
    refreshWorkspaceCache(key, async () => {
      throw Error("offline");
    }),
  ).rejects.toThrow("offline");
  expect(readWorkspaceCache(key)).toBe(42);
  const now = Date.now;
  try {
    Date.now = () => now() + 6 * 60_000;
    expect(readWorkspaceCache(key)).toBeUndefined();
  } finally {
    Date.now = now;
  }
});

test("verified login session is reused only for the matching college and cleared on logout", () => {
  const prepared = {
    me: {
      account: { code: "account-a", workspace_scope: "college" },
      roles: [master],
    } as MeResponse,
    active: master,
    screens: roleScreens(navigation, master),
  };
  prepareWorkspaceSession("edunexa-college", prepared);
  expect(readPreparedWorkspaceSession("edunexa-college")?.active.code).toBe(
    master.code,
  );
  expect(readPreparedWorkspaceSession("another-college")).toBeUndefined();
  clearWorkspaceCache();
  expect(readPreparedWorkspaceSession("edunexa-college")).toBeUndefined();
});
test("login handoff expires rather than retaining a stale session", () => {
  prepareWorkspaceSession("edunexa-college", {
    me: { account: { code: "account-a" }, roles: [master] } as MeResponse,
    active: master,
    screens: [],
  });
  const now = Date.now;
  try {
    Date.now = () => now() + 11_000;
    expect(readPreparedWorkspaceSession("edunexa-college")).toBeUndefined();
  } finally {
    Date.now = now;
  }
});
