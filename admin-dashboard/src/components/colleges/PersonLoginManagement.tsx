"use client";

import { useEffect, useState } from "react";
import {
  api,
  errorText,
  type ApiClient,
  type LoginAccount,
} from "@/services/api";
import { apiRequest } from "@/services/api/client";
import WorkspaceSkeleton from "./WorkspaceSkeleton";
import "./person-login-management.css";

type Person = {
  person_type: "student" | "parent" | "employee";
  person_code: string;
  name: string;
  relationship: string;
  account: LoginAccount | null;
  manageable: boolean;
};
type Logins = {
  people: Person[];
  roles: { code: string; name: string; scope: string }[];
  can_create: boolean;
  can_edit: boolean;
};
const clientNames: Partial<Record<ApiClient, string>> = {
  "student-mobile": "Student app",
  "parent-mobile": "Parent app",
  "teacher-mobile": "Teacher app",
  "admin-web": "Web dashboard",
};

function LoginEditor({
  person,
  data,
  reload,
}: {
  person: Person;
  data: Logins;
  reload: () => Promise<void>;
}) {
  const account = person.account;
  const personal = person.person_type !== "employee";
  const choices: ApiClient[] =
    person.person_type === "employee"
      ? ["teacher-mobile", "admin-web"]
      : [person.person_type === "student" ? "student-mobile" : "parent-mobile"];
  const [login, setLogin] = useState(account?.login_id || "");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<string[]>(account?.role_codes || []);
  const [clients, setClients] = useState<ApiClient[]>(
    account?.clients || choices,
  );
  const [active, setActive] = useState(account?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const availableRoles = data.roles.filter((role) =>
    person.person_type === "employee"
      ? role.scope !== "self"
      : role.scope === "self" || account?.role_codes.includes(role.code),
  );
  const allowed =
    person.manageable && (account ? data.can_edit : data.can_create);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (account) {
        await api.administration.updateAccount(account.code, {
          login_id: login,
          role_codes: personal ? [] : roles,
          clients: personal ? choices : clients,
          active,
        });
      } else {
        await api.administration.createAccount({
          login_id: login,
          password,
          person_type: person.person_type,
          person_code: person.person_code,
          role_codes: personal ? [] : roles,
          clients: personal ? choices : clients,
        });
      }
      setPassword("");
      setMessage("Login saved. Existing sessions end when access changes.");
      await reload();
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (!account || password.length < 12) return;
    setBusy(true);
    setMessage("");
    try {
      await api.administration.resetPassword(account.code, {
        new_password: password,
      });
      setPassword("");
      setMessage("Password reset. Existing sessions have ended.");
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="edu-student-section person-login-card">
      <h3>
        {person.name || person.person_code} · {person.relationship}
      </h3>
      <p>
        {account
          ? account.active
            ? "Active login"
            : "Login disabled"
          : "No login created"}
      </p>
      {!person.manageable && (
        <p>This protected account is managed through administrator settings.</p>
      )}
      <form className="as-form" onSubmit={save}>
        <fieldset disabled={!allowed || busy}>
          <legend>Login access</legend>
          <label>
            Login ID
            <input
              required
              minLength={3}
              maxLength={120}
              pattern="[a-zA-Z0-9@._+\-]+"
              autoComplete="off"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
          </label>
          <label>
            {account ? "New password (for reset)" : "Initial password"}
            <input
              type="password"
              autoComplete="new-password"
              required={!account}
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <small>
              Use at least 12 characters. Saved passwords cannot be viewed.
            </small>
          </label>
          {personal ? (
            <p>
              Access:{" "}
              {person.person_type === "student"
                ? "Student app · Student role"
                : "Parent app · Parent / guardian role"}
              . Role and mobile access are assigned automatically.
            </p>
          ) : (
            <>
              <label>
                Assigned roles
                <select
                  multiple
                  required
                  value={roles}
                  onChange={(e) =>
                    setRoles(
                      Array.from(e.target.selectedOptions, (o) => o.value),
                    )
                  }
                >
                  {availableRoles.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="person-login-apps">
                <strong>Applications</strong>
                {Array.from(
                  new Set([...choices, ...(account?.clients || [])]),
                ).map((client) => (
                  <label key={client}>
                    <input
                      type="checkbox"
                      checked={clients.includes(client)}
                      onChange={(e) =>
                        setClients(
                          e.target.checked
                            ? [...clients, client]
                            : clients.filter((c) => c !== client),
                        )
                      }
                    />
                    {clientNames[client] || client}
                  </label>
                ))}
              </div>
            </>
          )}
          {account && (
            <label>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Login enabled
            </label>
          )}
          <div className="as-actions">
            <button
              type="submit"
              disabled={!personal && (!clients.length || !roles.length)}
            >
              {busy
                ? "Saving…"
                : account
                  ? "Save login access"
                  : "Create login"}
            </button>
            {account && (
              <button
                type="button"
                disabled={password.length < 12}
                onClick={() => void reset()}
              >
                Reset password
              </button>
            )}
          </div>
        </fieldset>
      </form>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
export default function PersonLoginManagement({
  personType,
  personCode,
}: {
  personType: "student" | "employee";
  personCode: string;
}) {
  const [data, setData] = useState<Logins | null>(null),
    [error, setError] = useState("");
  const path = `administration/people/${personType}/${encodeURIComponent(personCode)}/logins`;
  async function reload() {
    const value = await apiRequest<Logins>(path);
    setData(value);
  }
  useEffect(() => {
    const abort = new AbortController();
    apiRequest<Logins>(path, { signal: abort.signal })
      .then((value) => {
        setData(value);
        setError("");
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(errorText(e));
      });
    return () => abort.abort();
  }, [path]);
  return (
    <div className="person-login-manager">
      <h2>Login management</h2>
      <p>
        {personType === "student"
          ? "Manage this student’s login and linked guardian logins."
          : "Manage teacher app and web dashboard access."}
      </p>
      {error && <p role="alert">{error}</p>}
      {!data && !error && (
        <WorkspaceSkeleton compact label="Loading login access" />
      )}
      <div className="person-login-cards">
        {data?.people.map((person) => (
          <LoginEditor
            key={`${person.person_type}:${person.person_code}:${person.account?.code || "new"}`}
            person={person}
            data={data}
            reload={reload}
          />
        ))}
      </div>
    </div>
  );
}
