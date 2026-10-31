"use client";
import SearchField, { searchValues } from "./SearchField";
import { useErrorToast } from "./toast";
import { useCallback, useEffect, useState } from "react";
import {
  KeyRound,
  Plus,
  RefreshCw,
  Shield,
  Users,
  Pencil,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  api,
  errorText,
  type Role,
  type ScreenSummary,
  type LoginAccount,
  type Row,
} from "@/services/api";
import { useOptionalCollege } from "./CollegeStore";
import WorkspaceSkeleton from "./WorkspaceSkeleton";
import {
  readWorkspaceCache,
  workspaceCacheKey,
  writeWorkspaceCache,
  refreshWorkspaceCache,
} from "@/lib/colleges/workspace-cache";
import ConfigurationEditor, { generatePassword } from "./ConfigurationEditor";
import "./connected-portal.css";

const ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "export",
] as const;
/** Permission that opens a screen without tables of its own (mirrors the backend's rule). */
const SCREEN_PERMISSION: Record<string, string> = {
  roles: "roles",
  accounts: "accounts",
  credentials: "accounts",
  forms: "forms",
  "audit-logs": "audit",
};
/** Sensible defaults for a new login of a role: who the person is and where they sign in. */
function loginDefaults(role: Role): Row {
  const name = role.name.toLowerCase();
  if (role.scope === "self" && name.includes("parent"))
    return { person_type: "parent", clients: ["parent-mobile", "admin-web"] };
  if (role.scope === "self")
    return { person_type: "student", clients: ["student-mobile", "admin-web"] };
  if (role.scope === "teaching")
    return {
      person_type: "employee",
      clients: ["admin-web", "teacher-mobile"],
    };
  return { person_type: "employee", clients: ["admin-web", "admin-mobile"] };
}
const personName = (row: Row) => {
  const employee = row.employee as Row | null;
  return employee
    ? [employee.first_name, employee.last_name].filter(Boolean).join(" ") ||
        String(row.person_code || row.login_id)
    : String(row.person_code || row.login_id);
};
/** Authenticated template screen: data requests use the existing HttpOnly-cookie proxy. */
export default function RolesAccess() {
  const session = useOptionalCollege();
  const cacheKey = workspaceCacheKey(
    session?.account?.code,
    session?.activeRole?.code,
    "roles:list",
  );
  const cachedRoles = readWorkspaceCache<Role[]>(cacheKey);
  const [roles, setRoles] = useState<Role[]>(cachedRoles || []);
  const [screens, setScreens] = useState<ScreenSummary[]>(
    session?.assignedScreens || [],
  );
  const [accounts, setAccounts] = useState<LoginAccount[]>([]);
  const [accountsAvailable, setAccountsAvailable] = useState(false);
  const [selectedCode, setSelectedCode] = useState(
    cachedRoles?.[0]?.code || "",
  );
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(!cachedRoles);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useErrorToast(error);
  const [accountCode, setAccountCode] = useState("");
  const [editor, setEditor] = useState<{
    kind: "role" | "account";
    initial?: Row;
  } | null>(null);
  const [deleteCode, setDeleteCode] = useState<string | null>(null);
  const [credential, setCredential] = useState<{
    login: string;
    password: string;
  } | null>(null);
  const load = useCallback(async () => {
    setBusy(!readWorkspaceCache(cacheKey));
    setError("");
    // Each list is shown as soon as it arrives; roles do not wait for screens or accounts.
    const roleList = refreshWorkspaceCache(cacheKey, () =>
      api.administration.roles(),
    ).then((saved) => {
      setRoles(saved);
      setSelectedCode((old) =>
        saved.some((r) => r.code === old) ? old : saved[0]?.code || "",
      );
    });
    const screenList = api.workspace
      .screens()
      .catch(() => ({ screens: [] as ScreenSummary[] }))
      .then((navigation) => setScreens(navigation.screens));
    const accountList = api.administration
      .accounts()
      .then((items) => {
        setAccounts(items);
        setAccountsAvailable(true);
      })
      .catch(() => setAccountsAvailable(false));
    try {
      await Promise.all([roleList, screenList, accountList]);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }, [cacheKey]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  const selected = roles.find((r) => r.code === selectedCode);
  const assigned = selected?.assigned_accounts || [];
  const allocated = selected
    ? screens.filter((screen) => {
        if (selected.screens?.length && !selected.screens.includes(screen.key))
          return false;
        if (selected.system_admin) return true;
        // Backend rule: a screen opens when any of its tables is viewable, or else when the
        // role may view the screen's own permission (reports for screens such as the dashboard).
        return (
          screen.resources.some((table) =>
            selected.permissions[table]?.includes("view"),
          ) ||
          !!selected.permissions[
            SCREEN_PERMISSION[screen.key] || "reports"
          ]?.includes("view")
        );
      })
    : [];
  const remaining = accounts.filter(
    (a) => a.active && !a.role_codes.includes(selectedCode),
  );
  async function resetPassword(user: Row) {
    const password = generatePassword();
    setSaving(true);
    setError("");
    try {
      await api.administration.resetPassword(String(user.code), {
        new_password: password,
      });
      setCredential({ login: String(user.login_id), password });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  async function assign() {
    const target = accounts.find((a) => a.code === accountCode);
    if (!target || !selected) return;
    setSaving(true);
    setError("");
    try {
      await api.administration.updateAccount(target.code, {
        role_codes: [...new Set([...target.role_codes, selected.code])],
      });
      setAccountCode("");
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="erp-roles-access">
      <div className="erp-page-heading">
        <div>
          <h1>Roles &amp; access</h1>
          <p>
            Manage college roles, allocated screens and the people assigned to
            each role.
          </p>
        </div>
        <div className="erp-quick-actions">
          <button onClick={() => void load()} disabled={busy}>
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            className="erp-primary"
            onClick={() => setEditor({ kind: "role" })}
          >
            <Plus size={15} /> Create role
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="erp-api-warning">
          {error} <button onClick={() => void load()}>Try again</button>
        </p>
      )}
      {busy && !roles.length && (
        <WorkspaceSkeleton label="Loading roles and assignments" compact />
      )}
      {credential && (
        <div className="erp-panel erp-role-credential" role="status">
          <KeyRound size={18} />
          <p>
            New password for <strong>{credential.login}</strong>:{" "}
            <code>{credential.password}</code>. Share it with the user now; it
            is not shown again and the user should change it after signing in.
          </p>
          <button
            onClick={() =>
              void navigator.clipboard?.writeText(credential.password)
            }
          >
            Copy
          </button>
          <button onClick={() => setCredential(null)}>Done</button>
        </div>
      )}
      <div className="erp-roles-grid">
        <aside className="erp-panel erp-role-directory">
          <SearchField
            aria-label="Search roles"
            placeholder="Search roles…"
            value={query}
            onValueChange={setQuery}
            suggestions={searchValues(roles, ["name", "code"])}
          />
          <p>{roles.length} existing roles</p>
          <nav aria-label="Existing roles">
            {roles
              .filter((r) =>
                `${r.name} ${r.code}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((role) => (
                <button
                  key={role.code}
                  className={role.code === selectedCode ? "is-selected" : ""}
                  onClick={() => {
                    setSelectedCode(role.code);
                    setAccountCode("");
                  }}
                  aria-pressed={role.code === selectedCode}
                >
                  <Shield size={17} />
                  <span>
                    <strong>{role.name}</strong>
                    <small>
                      {role.system_admin
                        ? "System administrator"
                        : role.scope + " access"}
                    </small>
                  </span>
                  <span className="erp-role-count">
                    {role.assigned_accounts?.length || 0}
                  </span>
                </button>
              ))}
          </nav>
          {!busy && !error && !roles.length && (
            <p>No roles have been created yet.</p>
          )}
        </aside>
        {selected && (
          <div className="erp-role-details">
            <section className="erp-panel">
              <div className="erp-role-title">
                <div>
                  <h2>{selected.name}</h2>
                  <p>
                    {selected.code} · {selected.scope} access
                  </p>
                </div>
                <div className="erp-quick-actions">
                  {selected.system_admin ? (
                    <span className="erp-role-protected">
                      Protected system role
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() =>
                          setEditor({ kind: "role", initial: selected })
                        }
                      >
                        <Pencil size={14} /> Edit role &amp; screens
                      </button>
                      <button
                        className="erp-danger"
                        onClick={() => setDeleteCode(selected.code)}
                      >
                        <Trash2 size={14} /> Delete role
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="erp-role-stats">
                <span>
                  <strong>{allocated.length}</strong> permitted screens
                </span>
                <span>
                  <strong>{assigned.length}</strong> assigned users
                </span>
              </div>
            </section>
            <section className="erp-panel">
              <h2>
                <Shield size={18} /> Screens &amp; permissions
              </h2>
              <p>
                {selected.system_admin
                  ? "This system role has full access to all college screens."
                  : "Screen allocation is combined with the role’s resource permissions. The backend enforces every action."}
              </p>
              <div className="erp-role-table">
                <table>
                  <thead>
                    <tr>
                      <th>Screen</th>
                      {ACTIONS.map((action) => (
                        <th key={action}>{action}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allocated.map((screen) => (
                      <tr key={screen.key}>
                        <td>
                          <strong>{screen.title}</strong>
                          <small>{screen.key}</small>
                        </td>
                        {ACTIONS.map((action) => (
                          <td key={action}>
                            {selected.system_admin ||
                            screen.resources.some((target) =>
                              selected.permissions[target]?.includes(action),
                            ) ||
                            selected.permissions[screen.key]?.includes(
                              action,
                            ) ? (
                              <span
                                aria-label={`${action} allowed`}
                                className="erp-role-allowed"
                              >
                                ✓
                              </span>
                            ) : (
                              <span aria-label={`${action} not granted`}>
                                —
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!allocated.length && (
                <p>No college screens are currently permitted for this role.</p>
              )}
            </section>
            <section className="erp-panel">
              <h2>
                <Users size={18} /> Assigned users &amp; employees
              </h2>
              <p>The accounts below currently hold this role.</p>
              <div className="erp-role-table">
                <table>
                  <thead>
                    <tr>
                      <th>Employee / person</th>
                      <th>Login ID</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assigned.map((user) => (
                      <tr key={String(user.code)}>
                        <td>{personName(user)}</td>
                        <td>{String(user.login_id)}</td>
                        <td>{String(user.person_type)}</td>
                        <td>{user.active ? "Active" : "Inactive"}</td>
                        <td>
                          {accountsAvailable && !selected.system_admin ? (
                            <>
                              <button
                                onClick={() =>
                                  setEditor({ kind: "account", initial: user })
                                }
                              >
                                Edit assigned roles
                              </button>{" "}
                              <button
                                disabled={saving}
                                onClick={() => void resetPassword(user)}
                              >
                                <KeyRound size={13} /> Reset password
                              </button>
                            </>
                          ) : (
                            "Assigned"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!assigned.length && <p>No users are assigned to this role.</p>}
              {accountsAvailable && !selected.system_admin && (
                <button
                  className="erp-primary"
                  onClick={() =>
                    setEditor({
                      kind: "account",
                      initial: {
                        role_codes: [selected.code],
                        ...loginDefaults(selected),
                      },
                    })
                  }
                >
                  <UserPlus size={15} /> Create login for this role
                </button>
              )}
              {accountsAvailable && !selected.system_admin && (
                <div className="erp-role-assign">
                  <label>
                    Assign an existing user
                    <select
                      aria-label="Existing user to assign"
                      value={accountCode}
                      onChange={(e) => setAccountCode(e.target.value)}
                    >
                      <option value="">Choose an existing account</option>
                      {remaining.map((user) => (
                        <option key={user.code} value={user.code}>
                          {user.login_id} — {user.person_code}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="erp-primary"
                    disabled={!accountCode || saving}
                    onClick={() => void assign()}
                  >
                    {saving ? "Assigning…" : "Assign to role"}
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
      {editor && (
        <div className="edu-connected">
          <ConfigurationEditor
            kind={editor.kind}
            initial={editor.initial}
            onClose={() => setEditor(null)}
            onSaved={async () => {
              await load();
              window.dispatchEvent(
                new CustomEvent("edunexa:records-changed", {
                  detail: { permissions: true },
                }),
              );
            }}
          />
        </div>
      )}
      {deleteCode && (
        <div
          className="erp-api-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Delete role"
        >
          <section className="erp-panel erp-role-confirm">
            <h2>Delete this role?</h2>
            <p>
              Assigned or protected roles cannot be deleted. Remove user
              assignments first.
            </p>
            <button onClick={() => setDeleteCode(null)}>Cancel</button>
            <button
              className="erp-danger"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await api.administration.deleteRole(deleteCode);
                  setDeleteCode(null);
                  await load();
                } catch (e) {
                  setError(errorText(e));
                  setDeleteCode(null);
                } finally {
                  setSaving(false);
                }
              }}
            >
              Delete role
            </button>
          </section>
        </div>
      )}
    </section>
  );
}
