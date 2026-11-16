"use client";
import { useEffect, useState } from "react";
import { Mail, Shield, UserRound } from "lucide-react";
import {
  api,
  errorText,
  type AccessLevel,
  type ApiClient,
  type LoginAccount,
  type Role,
  type ScreenSummary,
} from "@/services/api";
import { combined, roleSelection } from "@/lib/colleges/access";
import AccessPicker from "./AccessPicker";
import SideDrawer from "./SideDrawer";
import { toast } from "./toast";
import "./login-admin.css";

const APPS: { key: ApiClient; label: string; help: string }[] = [
  { key: "admin-web", label: "Admin dashboard", help: "Web portal" },
  { key: "admin-mobile", label: "EduDesk app", help: "Admins and clerks" },
  { key: "teacher-mobile", label: "EduDesk app (teacher)", help: "Teachers and lab in-charges" },
];

/** Create or edit a staff login: login ID, email, roles, apps and extra screens. No password:
 * staff sign in with a code emailed to them. */
export default function LoginDrawer({
  initial,
  roles,
  screens,
  onClose,
  onSaved,
}: {
  initial?: Partial<LoginAccount>;
  roles: Role[];
  screens: ScreenSummary[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const editing = Boolean(initial?.code);
  const [loginId, setLoginId] = useState(String(initial?.login_id || ""));
  const [email, setEmail] = useState(String(initial?.email || ""));
  const [person, setPerson] = useState(
    initial?.person_type === "employee" ? String(initial.person_code || "") : "",
  );
  const [roleCodes, setRoleCodes] = useState<string[]>(initial?.role_codes || []);
  const [clients, setClients] = useState<ApiClient[]>(
    initial?.clients?.length ? initial.clients : ["admin-web", "admin-mobile"],
  );
  const [extra, setExtra] = useState<Record<string, AccessLevel>>(
    initial?.extra_access || {},
  );
  const [employees, setEmployees] = useState<{ value: string; label: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (editing) return;
    void api.workspace
      .lookup("employees")
      .then((rows) => setEmployees(rows.map((r) => ({ value: String(r.value), label: String(r.label) }))))
      .catch(() => setEmployees([]));
  }, [editing]);
  const staffRoles = roles.filter((r) => r.scope !== "self");
  const chosen = staffRoles.filter((r) => roleCodes.includes(r.code));
  const inherited = combined(...chosen.map((r) => roleSelection(r, screens)));
  const superAdmin = chosen.some((r) => r.system_admin);
  const teaching = chosen.some((r) => r.scope === "teaching");
  // Extra screens the roles already give are not stored twice.
  const extraOnly = Object.fromEntries(
    Object.entries(extra).filter(([k]) => !(k in inherited)),
  ) as Record<string, AccessLevel>;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!roleCodes.length) return setError("Choose at least one role");
    if (!clients.length) return setError("Choose where this login can sign in");
    if (!editing && teaching && !person)
      return setError("Teachers, lab in-charges and clerks need a linked employee record");
    setBusy(true);
    try {
      const extra_access = superAdmin ? {} : extraOnly;
      if (editing && initial?.code) {
        await api.administration.updateAccount(initial.code, {
          login_id: loginId.trim(),
          email: email.trim(),
          role_codes: roleCodes,
          clients,
          extra_access,
        });
        toast.success("Login updated");
      } else {
        await api.administration.createAccount({
          login_id: loginId.trim(),
          email: email.trim(),
          person_type: person ? "employee" : "system",
          ...(person ? { person_code: person } : {}),
          role_codes: roleCodes,
          clients,
          extra_access,
        });
        toast.success("Login created. It is active; the person signs in with a code sent to their email.");
      }
      await onSaved();
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SideDrawer
      title={editing ? `Edit login · ${initial?.login_id}` : "Create login"}
      subtitle="Staff sign in with a one-time code sent to this email. No password is needed."
      expanded
      onClose={onClose}
    >
      <form className="la-form" onSubmit={save}>
        <section className="la-section">
          <h3>
            <UserRound size={17} /> Login details
          </h3>
          <div className="la-grid">
            <label>
              Login ID
              <input
                required
                minLength={3}
                maxLength={120}
                pattern="[a-zA-Z0-9@._+\-]+"
                title="Letters, numbers and @ . _ + -"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label>
              Email
              <span className="la-input-icon">
                <Mail size={15} />
                <input
                  required
                  type="email"
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                />
              </span>
            </label>
            <label>
              Employee record
              {editing ? (
                <input
                  readOnly
                  value={
                    initial?.person_type === "employee"
                      ? String(initial.person_code)
                      : "Not linked (administrator login)"
                  }
                />
              ) : (
                <select value={person} onChange={(e) => setPerson(e.target.value)}>
                  <option value="">Not linked (administrator login)</option>
                  {employees.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label} ({p.value})
                    </option>
                  ))}
                </select>
              )}
            </label>
          </div>
        </section>
        <section className="la-section">
          <h3>
            <Shield size={17} /> Roles
          </h3>
          <div className="la-checks">
            {staffRoles.map((role) => (
              <label key={role.code} className={roleCodes.includes(role.code) ? "is-on" : ""}>
                <input
                  type="checkbox"
                  checked={roleCodes.includes(role.code)}
                  onChange={(e) =>
                    setRoleCodes((list) =>
                      e.target.checked ? [...list, role.code] : list.filter((c) => c !== role.code),
                    )
                  }
                />
                <Shield size={15} aria-hidden="true" />
                <span>
                  <strong>{role.name}</strong>
                  <small>
                    {role.system_admin
                      ? "Full access to everything"
                      : role.scope === "teaching"
                        ? "Teaching staff"
                        : "College staff"}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </section>
        <section className="la-section">
          <h3>Signs in on</h3>
          <div className="la-checks la-apps">
            {APPS.map((app) => (
              <label key={app.key} className={clients.includes(app.key) ? "is-on" : ""}>
                <input
                  type="checkbox"
                  checked={clients.includes(app.key)}
                  onChange={(e) =>
                    setClients((list) =>
                      e.target.checked ? [...list, app.key] : list.filter((c) => c !== app.key),
                    )
                  }
                />
                <span>
                  <strong>{app.label}</strong>
                  <small>{app.help}</small>
                </span>
              </label>
            ))}
          </div>
        </section>
        <section className="la-section">
          <h3>Screens</h3>
          {superAdmin ? (
            <p className="la-note">A super admin can open every screen.</p>
          ) : (
            <>
              <p className="la-note">
                Screens from the chosen roles are ticked and locked. Tick more screens to give this
                person extra access on top of their role.
              </p>
              <AccessPicker
                screens={screens}
                inherited={inherited}
                value={extraOnly}
                onChange={setExtra}
                disabled={busy}
              />
            </>
          )}
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
            {busy ? "Saving…" : editing ? "Save changes" : "Create login"}
          </button>
        </footer>
      </form>
    </SideDrawer>
  );
}
