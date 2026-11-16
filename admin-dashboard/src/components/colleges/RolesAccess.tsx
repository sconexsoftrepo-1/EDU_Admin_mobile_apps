"use client";
import SearchField, { searchValues } from "./SearchField";
import { toast, useErrorToast } from "./toast";
import { useCallback, useEffect, useState } from "react";
import {
  LayoutGrid,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import {
  api,
  errorText,
  type AccessLevel,
  type LoginAccount,
  type Role,
  type ScreenSummary,
} from "@/services/api";
import { useOptionalCollege } from "./CollegeStore";
import WorkspaceSkeleton from "./WorkspaceSkeleton";
import {
  readWorkspaceCache,
  workspaceCacheKey,
  refreshWorkspaceCache,
} from "@/lib/colleges/workspace-cache";
import { permissionsFor, roleSelection } from "@/lib/colleges/access";
import AccessPicker from "./AccessPicker";
import LoginActions from "./LoginActions";
import LoginDrawer from "./LoginDrawer";
import SideDrawer from "./SideDrawer";
import "./connected-portal.css";
import "./login-admin.css";

const personName = (row: Record<string, unknown>) => {
  const employee = row.employee as Record<string, unknown> | null;
  const name = employee ? [employee.first_name, employee.last_name].filter(Boolean).join(" ") : "";
  return name || (row.person_type === "system" ? "Administrator" : String(row.person_code || ""));
};

/** Create or edit a role: a name and the screens it opens (checkboxes by module, with icons). */
function RoleDrawer({
  initial,
  screens,
  onClose,
  onSaved,
}: {
  initial?: Role;
  screens: ScreenSummary[];
  onClose: () => void;
  onSaved: (code: string) => void | Promise<void>;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [scope, setScope] = useState<"college" | "teaching">(
    initial?.scope === "teaching" ? "teaching" : "college",
  );
  const [selection, setSelection] = useState<Record<string, AccessLevel>>(() =>
    roleSelection(initial, screens),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!Object.keys(selection).length) return setError("Tick at least one screen");
    setBusy(true);
    setError("");
    try {
      const saved = await api.administration.saveRole(initial?.code, {
        name: name.trim(),
        scope,
        permissions: permissionsFor(selection, screens),
        screens: Object.keys(selection),
      });
      toast.success(initial ? "Role updated" : "Role created");
      await onSaved(String((saved as Role | undefined)?.code || initial?.code || ""));
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SideDrawer
      title={initial ? `Edit role · ${initial.name}` : "Create role"}
      subtitle="Tick the screens this role opens and choose what it may do on each."
      expanded
      onClose={onClose}
    >
      <form className="la-form" onSubmit={save}>
        <section className="la-section">
          <div className="la-grid">
            <label>
              Role name
              <input required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Who holds it
              <select value={scope} onChange={(e) => setScope(e.target.value as "college" | "teaching")}>
                <option value="college">College staff (office, accounts, admissions…)</option>
                <option value="teaching">Teaching staff (sees only their own classes)</option>
              </select>
            </label>
          </div>
        </section>
        <section className="la-section">
          <h3>
            <LayoutGrid size={17} /> Modules &amp; screens
          </h3>
          <p className="la-note">
            View = open and read · Add &amp; edit = also add and change records · Full = also delete,
            approve and export.
          </p>
          <AccessPicker screens={screens} value={selection} onChange={setSelection} disabled={busy} />
        </section>
        {error && (
          <p role="alert" className="la-error">
            {error}
          </p>
        )}
        <footer className="la-actions">
          <button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="erp-primary" disabled={busy}>
            {busy ? "Saving…" : initial ? "Save role" : "Create role"}
          </button>
        </footer>
      </form>
    </SideDrawer>
  );
}

/** Roles & access: roles, the screens each opens, and the logins holding it. */
export default function RolesAccess() {
  const session = useOptionalCollege();
  const me = session?.account?.code;
  const cacheKey = workspaceCacheKey(session?.account?.code, session?.activeRole?.code, "roles:list");
  const cachedRoles = readWorkspaceCache<Role[]>(cacheKey);
  const [roles, setRoles] = useState<Role[]>(cachedRoles || []);
  const [screens, setScreens] = useState<ScreenSummary[]>(session?.assignedScreens || []);
  const [accounts, setAccounts] = useState<LoginAccount[]>([]);
  const [selectedCode, setSelectedCode] = useState(cachedRoles?.[0]?.code || "");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(!cachedRoles);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useErrorToast(error);
  const [accountCode, setAccountCode] = useState("");
  const [roleEditor, setRoleEditor] = useState<{ initial?: Role } | null>(null);
  const [loginEditor, setLoginEditor] = useState<Partial<LoginAccount> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const load = useCallback(async () => {
    setBusy(!readWorkspaceCache(cacheKey));
    setError("");
    const roleList = refreshWorkspaceCache(cacheKey, () => api.administration.roles()).then((saved) => {
      setRoles(saved);
      setSelectedCode((old) => (saved.some((r) => r.code === old) ? old : saved[0]?.code || ""));
    });
    const screenList = api.workspace
      .screens()
      .catch(() => ({ screens: [] as ScreenSummary[] }))
      .then((navigation) => setScreens(navigation.screens));
    const accountList = api.administration
      .accounts()
      .then(setAccounts)
      .catch(() => setAccounts([]));
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
  const changed = useCallback(async () => {
    await load();
    window.dispatchEvent(new CustomEvent("edunexa:records-changed", { detail: { permissions: true } }));
  }, [load]);
  const selected = roles.find((r) => r.code === selectedCode);
  const assigned = (selected?.assigned_accounts || []) as unknown as (LoginAccount & Record<string, unknown>)[];
  const selection = roleSelection(selected, screens);
  const remaining = accounts.filter(
    (a) => a.person_type !== "student" && a.person_type !== "parent" && !a.role_codes.includes(selectedCode),
  );
  async function assign() {
    const target = accounts.find((a) => a.code === accountCode);
    if (!target || !selected) return;
    setSaving(true);
    setError("");
    try {
      await api.administration.updateAccount(target.code, {
        role_codes: [...new Set([...target.role_codes, selected.code])],
      });
      toast.success(`${target.login_id} now holds ${selected.name}`);
      setAccountCode("");
      await changed();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  async function deleteRole() {
    if (!selected) return;
    setSaving(true);
    try {
      await api.administration.deleteRole(selected.code);
      toast.success("Role deleted");
      setConfirmDelete(false);
      await changed();
    } catch (e) {
      setError(errorText(e));
      setConfirmDelete(false);
    } finally {
      setSaving(false);
    }
  }
  const isFamily = (r?: Role) => r?.scope === "self";
  return (
    <section className="erp-roles-access">
      <div className="erp-page-heading">
        <div>
          <h1>Roles &amp; access</h1>
          <p>Choose the screens each role opens, and manage the logins that hold it.</p>
        </div>
        <div className="erp-quick-actions">
          <button onClick={() => void load()} disabled={busy}>
            <RefreshCw size={15} /> Refresh
          </button>
          <button className="erp-primary" onClick={() => setRoleEditor({})}>
            <Plus size={15} /> Create role
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="erp-api-warning">
          {error} <button onClick={() => void load()}>Try again</button>
        </p>
      )}
      {busy && !roles.length && <WorkspaceSkeleton label="Loading roles and assignments" compact />}
      <div className="erp-roles-grid">
        <aside className="erp-panel erp-role-directory">
          <SearchField
            aria-label="Search roles"
            placeholder="Search roles…"
            value={query}
            onValueChange={setQuery}
            suggestions={searchValues(roles, ["name", "code"])}
          />
          <p>{roles.length} roles</p>
          <nav aria-label="Roles">
            {roles
              .filter((r) => `${r.name} ${r.code}`.toLowerCase().includes(query.toLowerCase()))
              .map((role) => (
                <button
                  key={role.code}
                  className={role.code === selectedCode ? "is-selected" : ""}
                  onClick={() => {
                    setSelectedCode(role.code);
                    setAccountCode("");
                    setConfirmDelete(false);
                  }}
                  aria-pressed={role.code === selectedCode}
                >
                  <Shield size={17} />
                  <span>
                    <strong>{role.name}</strong>
                    <small>
                      {role.system_admin
                        ? "Full access"
                        : role.scope === "teaching"
                          ? "Teaching staff"
                          : role.scope === "self"
                            ? "EduNest app"
                            : "College staff"}
                    </small>
                  </span>
                  <span className="erp-role-count">{role.assigned_accounts?.length || 0}</span>
                </button>
              ))}
          </nav>
        </aside>
        {selected && (
          <div className="erp-role-details">
            <section className="erp-panel">
              <div className="erp-role-title">
                <div>
                  <h2>{selected.name}</h2>
                  <p>
                    {Object.keys(selection).length} screens · {assigned.length} logins
                  </p>
                </div>
                <div className="erp-quick-actions">
                  {selected.system_admin || isFamily(selected) ? (
                    <span className="erp-role-protected">
                      {selected.system_admin ? "Super admin: every screen" : "Built-in EduNest role"}
                    </span>
                  ) : confirmDelete ? (
                    <span className="la-confirm">
                      Delete this role?
                      <button className="erp-danger" disabled={saving} onClick={() => void deleteRole()}>
                        Yes, delete
                      </button>
                      <button onClick={() => setConfirmDelete(false)}>Cancel</button>
                    </span>
                  ) : (
                    <>
                      <button onClick={() => setRoleEditor({ initial: selected })}>
                        <Pencil size={14} /> Edit role &amp; screens
                      </button>
                      <button
                        className="erp-danger"
                        onClick={() => setConfirmDelete(true)}
                        title={assigned.length ? "Remove its logins first" : "Delete role"}
                      >
                        <Trash2 size={14} /> Delete role
                      </button>
                    </>
                  )}
                </div>
              </div>
            </section>
            {!isFamily(selected) && (
              <section className="erp-panel">
                <h2>
                  <LayoutGrid size={18} /> Modules &amp; screens
                </h2>
                {selected.system_admin ? (
                  <p>This role opens every screen with full access.</p>
                ) : Object.keys(selection).length ? (
                  <AccessPicker screens={screens} value={selection} readOnly />
                ) : (
                  <p>No screens yet. Use “Edit role &amp; screens” to tick the screens this role opens.</p>
                )}
              </section>
            )}
            <section className="erp-panel">
              <h2>
                <Users size={18} /> Assigned users &amp; employees
              </h2>
              <p>The logins below hold this role. New logins are active straight away.</p>
              <div className="la-table">
                <table>
                  <thead>
                    <tr>
                      <th>Login</th>
                      <th>Person</th>
                      <th>Status</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {assigned.map((user) => (
                      <tr key={user.code} className={user.active ? "" : "is-inactive"}>
                        <td>
                          <span className="la-person">
                            <span>
                              <strong>{user.login_id}</strong>
                              {user.email && (
                                <small>
                                  <Mail size={12} /> {String(user.email)}
                                </small>
                              )}
                            </span>
                          </span>
                        </td>
                        <td>{personName(user)}</td>
                        <td>
                          <span className={`la-status ${user.active ? "is-active" : ""}`}>
                            {user.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <LoginActions
                            account={user}
                            self={user.code === me}
                            onEdit={isFamily(selected) ? undefined : () => setLoginEditor(user)}
                            onChanged={changed}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!assigned.length && <p>No logins hold this role yet.</p>}
              {!isFamily(selected) && (
                <div className="erp-role-assign">
                  <button
                    className="erp-primary"
                    onClick={() => setLoginEditor({ role_codes: [selected.code] })}
                  >
                    <UserPlus size={15} /> Create login for this role
                  </button>
                  <label>
                    Or give this role to an existing login
                    <select
                      aria-label="Existing login"
                      value={accountCode}
                      onChange={(e) => setAccountCode(e.target.value)}
                    >
                      <option value="">Choose a login</option>
                      {remaining.map((user) => (
                        <option key={user.code} value={user.code}>
                          {user.login_id}
                          {user.email ? ` — ${user.email}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button disabled={!accountCode || saving} onClick={() => void assign()}>
                    {saving ? "Assigning…" : "Assign to role"}
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
      {roleEditor && (
        <RoleDrawer
          initial={roleEditor.initial}
          screens={screens}
          onClose={() => setRoleEditor(null)}
          onSaved={async (code) => {
            await changed();
            if (code) setSelectedCode(code);
          }}
        />
      )}
      {loginEditor && (
        <LoginDrawer
          initial={loginEditor}
          roles={roles}
          screens={screens}
          onClose={() => setLoginEditor(null)}
          onSaved={changed}
        />
      )}
    </section>
  );
}
