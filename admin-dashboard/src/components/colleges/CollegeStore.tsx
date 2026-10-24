"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  api,
  ApiError,
  SCREEN_CATALOG,
  errorText,
  type Account,
  type AccountRole,
  type MeResponse,
  type ScreenSummary,
  type Row,
} from "@/services/api";
import { roles, type Role } from "@/data/colleges";
import {
  emptyTemplateState,
  loadTemplateState,
} from "@/lib/colleges/template-api";
import {
  readWorkspaceCache,
  readPreparedWorkspaceSession,
  readStoredWorkspaceSession,
  storeWorkspaceSession,
  refreshWorkspaceCache,
  workspaceCacheKey,
  clearWorkspaceCache,
} from "@/lib/colleges/workspace-cache";
import type { CollegeState, Command } from "@/lib/colleges/store";

import {
  selectedRole,
  templateRole,
  roleArea,
  roleScreens,
  firstScreen,
} from "@/lib/colleges/role-navigation";
import { toast } from "./toast";

type Context = {
  activeRole: AccountRole | null;
  assignedScreens: ScreenSummary[];
  roleName: string;
  workspaceArea: string;
  sessionError: string;
  state: CollegeState;
  ready: boolean;
  role: Role | null;
  account: Account | null;
  modules: string[];
  message: string;
  clear: () => void;
  login: (r: Role, remember: boolean) => void;
  logout: () => void;
  run: (cmd: Omit<Command, "role">) => boolean;
  reset: () => void;
  importDataset: (value: unknown) => boolean;
  refresh: () => Promise<void>;
};
const C = createContext<Context | null>(null);
export function CollegeStore({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const [initialSession] = useState(() => readPreparedWorkspaceSession(slug));
  const sessionCache = useRef<{
    me: MeResponse;
    active: AccountRole;
    screens: ScreenSummary[];
  } | null>(initialSession || null);
  const sessionPending = useRef<Promise<
    NonNullable<typeof sessionCache.current>
  > | null>(null);
  const dataRequest = useRef(0);
  const [activeRole, setActiveRole] = useState<AccountRole | null>(
    initialSession?.active || null,
  );
  const [assignedScreens, setAssignedScreens] = useState<ScreenSummary[]>(
    initialSession?.screens || [],
  );
  const pathname = usePathname();
  const router = useRouter();
  const [roleName, setRoleName] = useState(initialSession?.active.name || "");
  const [workspaceArea, setWorkspaceArea] = useState(
    initialSession ? roleArea(initialSession.active) : "",
  );
  const [sessionError, setSessionError] = useState("");
  const [state, setState] = useState(() => emptyTemplateState(slug));
  const [ready, setReady] = useState(!!initialSession),
    [role, setRole] = useState<Role | null>(
      initialSession ? templateRole(initialSession.active) : null,
    ),
    [account, setAccount] = useState<Account | null>(
      initialSession
        ? {
            ...initialSession.me.account,
            workspace_scope: initialSession.active.scope,
          }
        : null,
    ),
    [modules, setModules] = useState<string[]>(
      initialSession?.screens.map((s) => s.key) || [],
    ),
    [message, setMessage] = useState("");
  const activeModule =
    pathname.split("/portal/")[1]?.split("/")[1] || "dashboard";
  const refresh = useCallback(async () => {
    setSessionError("");
    const sequence = ++dataRequest.current;
    if (!sessionCache.current) {
      if (!sessionPending.current)
        sessionPending.current = (async () => {
          const me = await api.auth.me();
          const active = selectedRole(me);
          if (!active)
            throw Error("No role has been assigned to this account.");
          const personal =
            ["student", "parent"].includes(me.account.person_type) ||
            ["teaching", "self"].includes(active.scope);
          // Screens come from the bundled catalog and the role: no request for navigation.
          const session = {
            me,
            active,
            screens: personal ? [] : roleScreens(SCREEN_CATALOG, active),
          };
          sessionCache.current = session;
          storeWorkspaceSession(slug, session);
          return session;
        })();
      try {
        await sessionPending.current;
      } catch (error) {
        sessionPending.current = null;
        throw error;
      }
    }
    if (sequence !== dataRequest.current) return;
    const { me, active, screens: allowed } = sessionCache.current!;
    setActiveRole(active);
    setAssignedScreens(allowed);
    const resolved = templateRole(active);
    const ownArea = roleArea(active);
    setRole(resolved);
    setRoleName(active.name);
    setWorkspaceArea(ownArea);
    setAccount((previous) =>
      previous?.session_code === me.account.session_code &&
      previous?.code === me.account.code &&
      previous?.workspace_scope === active.scope
        ? previous
        : { ...me.account, workspace_scope: active.scope },
    );
    if (
      ["student", "parent"].includes(me.account.person_type) ||
      ["teaching", "self"].includes(active.scope || "")
    ) {
      setReady(true);
      return;
    }
    setModules(allowed.map((s) => s.key));
    const currentArea = pathname.split("/portal/")[1]?.split("/")[0];
    const landing = firstScreen(allowed);
    if (
      currentArea !== ownArea ||
      (!pathname.split("/portal/")[1]?.split("/")[1] && landing)
    ) {
      const destination = allowed.some((s) => s.key === activeModule)
        ? activeModule
        : landing;
      if (destination)
        router.replace(
          `/colleges-institutions/${slug}/portal/${ownArea}/${destination}`,
        );
      setReady(true);
      return;
    }
    setReady(true);
    if (
      [
        "student-enrollment",
        "teaching-staff",
        "non-teaching-staff",
        "daily-labour",
        "course-setup",
        "roles",
        "accounts",
        "credentials",
        "forms",
        "imports",
        "documents",
      ].includes(activeModule)
    ) {
      setState(emptyTemplateState(slug));
      setMessage("");
      return;
    }
    const key = workspaceCacheKey(
      me.account.code,
      active.code,
      `template:${activeModule}`,
    );
    const cached =
      readWorkspaceCache<Awaited<ReturnType<typeof loadTemplateState>>>(key);
    if (cached) setState(cached.state);
    const result = await refreshWorkspaceCache(key, () =>
      loadTemplateState(slug, allowed, activeModule),
    );
    if (sequence !== dataRequest.current) return;
    setState(result.state);
    setMessage(
      result.errors.length
        ? "Some records could not be loaded: " + result.errors.join("; ")
        : "",
    );
    if (result.errors.length)
      toast.warning(
        "Some records could not be loaded",
        result.errors.join("; "),
      );
  }, [slug, activeModule, pathname, router]);
  // A reload restores this tab's signed-in navigation before the first refresh, so the sidebar
  // shows at once; the session is then revalidated in the background.
  const restored = useRef(false);
  useEffect(() => {
    if (sessionCache.current || restored.current) return;
    const stored = readStoredWorkspaceSession(slug);
    if (!stored) return;
    restored.current = true;
    sessionCache.current = stored;
    void api.auth
      .me()
      .then((me) => {
        const active = selectedRole(me);
        const changed =
          !active ||
          JSON.stringify([me.account.code, me.roles]) !==
            JSON.stringify([stored.me.account.code, stored.me.roles]);
        if (!changed) return;
        clearWorkspaceCache();
        sessionCache.current = null;
        sessionPending.current = null;
        void refresh().catch((e) => {
          setMessage(errorText(e));
          toast.error("Could not refresh records", errorText(e));
        });
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          clearWorkspaceCache();
          sessionCache.current = null;
          setAccount(null);
          setRole(null);
          router.replace(`/colleges-institutions/${slug}/portal/login`);
        }
      });
  }, [slug, refresh, router]);
  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(refresh)
      .catch((e) => {
        if (active) {
          setMessage(errorText(e));
          if (!(e instanceof ApiError && e.status === 401)) {
            setSessionError(errorText(e));
            toast.error("Could not load the workspace", errorText(e));
          }
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [refresh]);
  useEffect(() => {
    const reload = (event: Event) => {
      if ((event as CustomEvent).detail?.permissions) {
        clearWorkspaceCache();
        sessionCache.current = null;
        sessionPending.current = null;
      }
      void refresh().catch((e) => {
        setMessage(errorText(e));
        toast.error("Could not refresh records", errorText(e));
      });
    };
    window.addEventListener("edunexa:records-changed", reload);
    return () => window.removeEventListener("edunexa:records-changed", reload);
  }, [refresh]);
  const manage = (cmd?: Omit<Command, "role">) => {
    window.dispatchEvent(
      new CustomEvent("edunexa:manage-records", { detail: cmd }),
    );
    return false;
  };
  return (
    <C.Provider
      value={{
        state,
        activeRole,
        assignedScreens,
        roleName,
        workspaceArea,
        sessionError,
        ready,
        role,
        account,
        modules,
        message,
        clear: () => setMessage(""),
        refresh,
        login: () => {
          setMessage("Sign in with your college account.");
          toast.info("Sign in with your college account.");
        },
        logout: () => {
          void api.auth.logout().finally(() => {
            clearWorkspaceCache();
            sessionCache.current = null;
            sessionPending.current = null;
            dataRequest.current++;
            setState(emptyTemplateState(slug));
            setAccount(null);
            setRole(null);
            router.push(`/colleges-institutions/${slug}/portal/login`);
          });
        },
        run: manage,
        reset: () => {
          const text =
            "Live college records cannot be reset from the template.";
          setMessage(text);
          toast.warning(text);
        },
        importDataset: () => manage(),
      }}
    >
      {children}
    </C.Provider>
  );
}
export const useCollege = () => {
  const value = useContext(C);
  if (!value) throw Error("Missing college store");
  return value;
};

export const useOptionalCollege = () => useContext(C);
