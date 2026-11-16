"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail, Plus, RefreshCw, Shield, UserCog } from "lucide-react";
import {
  api,
  errorText,
  type LoginAccount,
  type Role,
  type ScreenSummary,
} from "@/services/api";
import { useOptionalCollege } from "./CollegeStore";
import LoginActions from "./LoginActions";
import LoginDrawer from "./LoginDrawer";
import WorkspaceSkeleton from "./WorkspaceSkeleton";
import { useErrorToast } from "./toast";
import "./login-admin.css";

type Filter = "staff" | "family" | "inactive" | "all";
const APP_NAMES: Record<string, string> = {
  "admin-web": "Dashboard",
  "admin-mobile": "EduDesk",
  "teacher-mobile": "EduDesk (teacher)",
  "student-mobile": "EduNest (student)",
  "parent-mobile": "EduNest (parent)",
};

/** Users & logins: every login on one screen; staff sign in with an emailed code. */
export default function UserAccounts() {
  const session = useOptionalCollege();
  const me = session?.account?.code;
  const [accounts, setAccounts] = useState<LoginAccount[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [screens, setScreens] = useState<ScreenSummary[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useErrorToast(error);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("staff");
  const [roleFilter, setRoleFilter] = useState("");
  const [editor, setEditor] = useState<Partial<LoginAccount> | null>(null);
  const load = useCallback(async () => {
    setError("");
    try {
      const [list, roleList, nav] = await Promise.all([
        api.administration.accounts(),
        api.administration.roles(),
        api.workspace.screens().catch(() => ({ screens: [] as ScreenSummary[] })),
      ]);
      setAccounts(list);
      setRoles(roleList);
      setScreens(nav.screens);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  const roleName = useMemo(() => Object.fromEntries(roles.map((r) => [r.code, r.name])), [roles]);
  const family = (a: LoginAccount) => a.person_type === "student" || a.person_type === "parent";
  const shown = accounts
    .filter((a) =>
      filter === "all" ? true : filter === "inactive" ? !a.active : filter === "family" ? family(a) : !family(a),
    )
    .filter((a) => !roleFilter || a.role_codes.includes(roleFilter))
    .filter((a) =>
      `${a.login_id} ${a.email || ""} ${a.person_code} ${a.role_codes.map((r) => roleName[r]).join(" ")}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) => Number(b.active) - Number(a.active) || a.login_id.localeCompare(b.login_id));
  const counts = {
    staff: accounts.filter((a) => !family(a)).length,
    family: accounts.filter(family).length,
    inactive: accounts.filter((a) => !a.active).length,
    all: accounts.length,
  };
  return (
    <section className="la-page">
      <div className="erp-page-heading">
        <div>
          <h1>Users &amp; logins</h1>
          <p>
            Create, change, turn off or delete logins. Staff sign in with a one-time code sent to their
            email, so there are no passwords to hand out.
          </p>
        </div>
        <div className="erp-quick-actions">
          <button onClick={() => void load()} disabled={busy}>
            <RefreshCw size={15} /> Refresh
          </button>
          <button className="erp-primary" onClick={() => setEditor({})}>
            <Plus size={15} /> Create login
          </button>
        </div>
      </div>
      <div className="la-filters">
        <div className="la-tabs" role="tablist" aria-label="Show logins">
          {(
            [
              ["staff", "Staff"],
              ["family", "Students & parents"],
              ["inactive", "Inactive"],
              ["all", "All"],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={filter === key}
              className={filter === key ? "is-active" : ""}
              onClick={() => setFilter(key)}
            >
              {label} <small>{counts[key]}</small>
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search login ID, email or role…"
          aria-label="Search logins"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select aria-label="Filter by role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          {roles.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      {busy && !accounts.length ? (
        <WorkspaceSkeleton label="Loading logins" compact />
      ) : (
        <div className="erp-panel la-table">
          <table>
            <thead>
              <tr>
                <th>Login</th>
                <th>Roles</th>
                <th>Signs in on</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => (
                <tr key={a.code} className={a.active ? "" : "is-inactive"}>
                  <td>
                    <span className="la-person">
                      <UserCog size={17} aria-hidden="true" />
                      <span>
                        <strong>{a.login_id}</strong>
                        {a.email ? (
                          <small>
                            <Mail size={12} /> {a.email}
                          </small>
                        ) : (
                          <small>{a.person_type === "system" ? "Administrator" : `${a.person_type} · ${a.person_code}`}</small>
                        )}
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className="la-chips">
                      {a.role_codes.map((r) => (
                        <span key={r} className="la-chip">
                          <Shield size={12} /> {roleName[r] || r}
                        </span>
                      ))}
                      {Object.keys(a.extra_access || {}).length > 0 && (
                        <span className="la-chip la-chip-extra">
                          +{Object.keys(a.extra_access || {}).length} extra screens
                        </span>
                      )}
                    </span>
                  </td>
                  <td>{a.clients.map((c) => APP_NAMES[c] || c).join(", ")}</td>
                  <td>
                    <span className={`la-status ${a.active ? "is-active" : ""}`}>
                      {a.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <LoginActions
                      account={a}
                      self={a.code === me}
                      onEdit={family(a) ? undefined : () => setEditor(a)}
                      onChanged={load}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && <p className="la-empty">No logins match.</p>}
        </div>
      )}
      {editor && (
        <LoginDrawer
          initial={editor}
          roles={roles}
          screens={screens}
          onClose={() => setEditor(null)}
          onSaved={load}
        />
      )}
    </section>
  );
}
