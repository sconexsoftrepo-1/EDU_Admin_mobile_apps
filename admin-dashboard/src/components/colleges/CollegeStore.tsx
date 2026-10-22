"use client";
import PDFPreview from "./PDFPreview";
import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  seed,
  execute,
  type CollegeState,
  type Command,
} from "@/lib/colleges/store";
import { validateDataset } from "@/lib/colleges/dataset";
import { ensureOperations } from "@/lib/colleges/operations";
import { roles, type Role } from "@/data/colleges";
type Context = {
  state: CollegeState;
  ready: boolean;
  role: Role | null;
  login: (r: Role, remember: boolean) => void;
  logout: () => void;
  run: (cmd: Omit<Command, "role">) => boolean;
  reset: () => void;
  importDataset: (value: unknown) => boolean;
  message: string;
  clear: () => void;
};
const C = createContext<Context | null>(null);
export function CollegeStore({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const [state, set] = useReducer(
    (_: CollegeState, n: CollegeState) => n,
    slug,
    seed,
  );
  const [role, setRole] = useState<Role | null>(null),
    [ready, setReady] = useState(false),
    [message, setMessage] = useState("");
  const key = `kc-college-v1-${slug}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed.version === 1 &&
          parsed.slug === slug &&
          [
            "students",
            "applications",
            "payments",
            "expenses",
            "invoices",
            "scholarships",
            "certificates",
            "rooms",
            "allocations",
            "leaves",
            "staff",
            "notifications",
            "audit",
            "structures",
          ].every((k) => Array.isArray(parsed[k]))
        )
          set(ensureOperations(parsed));
      }
      const session =
        sessionStorage.getItem(key + "-role") ||
        localStorage.getItem(key + "-role");
      // Restore a browser session after hydration; the server cannot read web storage.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (session && roles.includes(session as Role)) setRole(session as Role);
    } catch {
      /* Reset is available if browser data is corrupt. */
    }
    setReady(true);
  }, [key, slug]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== key || !event.newValue) return;
      try {
        const next = JSON.parse(event.newValue);
        if (
          next.version === 1 &&
          next.slug === slug &&
          Array.isArray(next.students) &&
          Array.isArray(next.audit)
        )
          set(ensureOperations(next));
      } catch {}
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key, slug]);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        /* In-memory demo still works with storage disabled. */
      }
  }, [state, ready, key]);
  const run = useCallback(
    (cmd: Omit<Command, "role">) => {
      try {
        const next = execute(state, { ...cmd, role: role || "Student" });
        set(next);
        setMessage("Saved successfully");
        return true;
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Unable to save");
        return false;
      }
    },
    [state, role],
  );
  const login = (r: Role, remember: boolean) => {
    setRole(r);
    try {
      sessionStorage.setItem(key + "-role", r);
      if (remember) localStorage.setItem(key + "-role", r);
      else localStorage.removeItem(key + "-role");
    } catch {
      /* In-memory role remains usable if web storage is blocked. */
    }
    set(execute(state, { type: "login", role: r }));
  };
  return (
    <C.Provider
      value={{
        state,
        ready,
        role,
        login,
        logout: () => {
          setRole(null);
          try {
            sessionStorage.removeItem(key + "-role");
            localStorage.removeItem(key + "-role");
          } catch {
            /* In-memory logout still succeeds. */
          }
        },
        run,
        importDataset: (value) => {
          try {
            if (role !== "Super Admin")
              throw Error("Only Super Admin can import demo data.");
            const next = validateDataset(value, slug);
            next.audit.unshift({
              id: `IMPORT-${crypto.randomUUID()}`,
              name: "Institution demo dataset imported",
              status: "Recorded",
              date: new Date().toISOString(),
              actor: "Super Admin",
            });
            set(next);
            setMessage("Institution demo dataset imported");
            return true;
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Invalid dataset");
            return false;
          }
        },
        reset: () => {
          set(seed(slug));
          setMessage("Demo data reset");
        },
        message,
        clear: () => setMessage(""),
      }}
    >
      {children}
      <PDFPreview
        slug={slug}
        onDownload={(name) =>
          state.certificates.some((c) => c.id === name)
            ? run({ type: "certificate.download", id: name })
            : true
        }
      />
    </C.Provider>
  );
}
export const useCollege = () => {
  const ctx = useContext(C);
  if (!ctx) throw Error("Missing college store");
  return ctx;
};
