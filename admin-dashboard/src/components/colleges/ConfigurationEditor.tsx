"use client";
import { useErrorToast } from "./toast";
import { useEffect, useState, type FormEvent } from "react";
import {
  API_CLIENTS as clients,
  PERMISSION_ACTIONS as actions,
  PERSON_LOOKUPS,
  api,
  errorText,
  type ApiClient,
  type FormFieldDefinition,
  type LookupOption,
  type PersonType,
  type Role,
  type Row,
  type WorkspaceScope,
} from "@/services/api";
/** A random 16-character password with upper/lower case letters, digits and a symbol. */
export function generatePassword(length = 16): string {
  const sets = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%*-_+=?",
  ];
  const random = (n: number) => {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] % n;
  };
  const all = sets.join("");
  const chars = sets.map((set) => set[random(set.length)]);
  while (chars.length < length) chars.push(all[random(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
export default function ConfigurationEditor({
  kind,
  initial = {},
  onClose,
  onSaved,
}: {
  kind: "role" | "form" | "account";
  initial?: Row;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [scope, setScope] = useState(String(initial.scope || "college"));
  const [name, setName] = useState(
      String(initial.name ?? initial.login_id ?? ""),
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [screenNames, setScreenNames] = useState<string[]>([]),
    [workspaceScreens, setWorkspaceScreens] = useState<
      { key: string; title: string }[]
    >([]),
    // Screens allocated to the role; null means every screen (no allocation).
    [allocated, setAllocated] = useState<string[] | null>(
      Array.isArray(initial.screens) ? (initial.screens as string[]) : null,
    ),
    [roles, setRoles] = useState<Role[]>([]),
    [people, setPeople] = useState<LookupOption[]>([]),
    [personType, setPersonType] = useState(
      String(initial.person_type || "employee"),
    ),
    [person, setPerson] = useState(String(initial.person_code || "")),
    [password, setPassword] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [roleCodes, setRoleCodes] = useState<string[]>(
      (initial.role_codes as string[]) || [],
    ),
    [allowedClients, setClients] = useState<string[]>(
      (initial.clients as string[]) || ["admin-web"],
    ),
    [active, setActive] = useState(initial.active !== false),
    [permissions, setPermissions] = useState<Record<string, string[]>>(
      (initial.permissions as Record<string, string[]>) || {},
    ),
    [binding, setBinding] = useState(String(initial.screen || "students")),
    [published, setPublished] = useState(initial.published === true),
    [fields, setFields] = useState<Row[]>(
      (initial.fields as Row[]) || [
        {
          key: "",
          label: "",
          type: "text",
          required: false,
          options: [],
          section: "",
          help: "",
        },
      ],
    );
  useErrorToast(error);
  useEffect(() => {
    void api.administration
      .screens()
      .then((value) => {
        setScreenNames(value.screens);
        setWorkspaceScreens(value.workspace_screens || []);
      })
      .catch((e) => setError(errorText(e)));
    if (kind === "account")
      void api.administration
        .roles()
        .then(setRoles)
        .catch((e) => setError(errorText(e)));
  }, [kind]);
  useEffect(() => {
    if (kind === "account")
      void api.workspace
        .lookup(PERSON_LOOKUPS[personType as PersonType])
        .then(setPeople)
        .catch((e) => setError(errorText(e)));
  }, [personType, kind]);
  const toggle = (values: string[], value: string) =>
    values.includes(value)
      ? values.filter((v) => v !== value)
      : [...values, value];
  const update = (index: number, key: string, value: unknown) =>
    setFields((old) =>
      old.map((f, i) => (i === index ? { ...f, [key]: value } : f)),
    );
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const code = initial.code ? String(initial.code) : undefined;
      if (kind === "role")
        await api.administration.saveRole(code, {
          name,
          permissions,
          scope: scope as WorkspaceScope,
          screens: allocated,
        });
      if (kind === "account") {
        if (code)
          await api.administration.updateAccount(code, {
            role_codes: roleCodes,
            clients: allowedClients as ApiClient[],
            active,
          });
        else
          await api.administration.createAccount({
            login_id: name,
            password,
            person_type: personType as PersonType,
            person_code: person,
            role_codes: roleCodes,
            clients: allowedClients as ApiClient[],
          });
      }
      if (kind === "form")
        await api.forms.save(code, {
          name,
          screen: binding,
          published,
          fields: fields as Partial<FormFieldDefinition>[],
        });
      await onSaved();
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="edu-dialog-backdrop">
      <section
        className="edu-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${initial.code ? "Edit" : "Create"} ${kind}`}
      >
        <header>
          <h2>
            {initial.code ? "Edit" : "Create"} {kind}
          </h2>
          <button onClick={onClose} aria-label="Close editor">
            ×
          </button>
        </header>
        <form onSubmit={save}>
          {(kind !== "account" || !initial.code) && (
            <label>
              {kind === "account" ? "Login ID" : "Name"}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
          )}
          {kind === "role" && (
            <label>
              Access scope
              <select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="college">College administration</option>
                <option value="teaching">Assigned teaching classes</option>
                <option value="self">Personal access only</option>
              </select>
            </label>
          )}
          {kind === "role" && (
            <fieldset style={{ marginTop: 20 }}>
              <legend>Screen allocation</legend>
              <label>
                <input
                  type="checkbox"
                  checked={allocated === null}
                  onChange={(e) => setAllocated(e.target.checked ? null : [])}
                />{" "}
                All screens the permissions allow
              </label>
              {allocated !== null && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(190px, 1fr))",
                    gap: "4px 16px",
                    maxHeight: "30vh",
                    overflow: "auto",
                    marginTop: 8,
                  }}
                >
                  {workspaceScreens
                    .filter((w) => !w.key.startsWith("module-"))
                    .map((w) => (
                      <label key={w.key}>
                        <input
                          type="checkbox"
                          checked={allocated.includes(w.key)}
                          onChange={() =>
                            setAllocated((old) => toggle(old || [], w.key))
                          }
                        />{" "}
                        {w.title}
                      </label>
                    ))}
                </div>
              )}
            </fieldset>
          )}
          {kind === "role" && (
            <div
              className="edu-table"
              style={{ marginTop: 20, maxHeight: "55vh" }}
            >
              <table>
                <thead>
                  <tr>
                    <th>Screen</th>
                    {actions.map((a) => (
                      <th key={a}>{a}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {screenNames.map((screen) => (
                    <tr key={screen}>
                      <th>{screen.replaceAll("_", " ")}</th>
                      {actions.map((a) => (
                        <td key={a}>
                          <label>
                            <input
                              type="checkbox"
                              aria-label={`${screen} ${a}`}
                              checked={
                                permissions[screen]?.includes(a) || false
                              }
                              onChange={() =>
                                setPermissions((old) => ({
                                  ...old,
                                  [screen]: toggle(old[screen] || [], a),
                                }))
                              }
                            />
                          </label>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {kind === "account" && (
            <>
              <div className="edu-field-grid">
                {!initial.code && (
                  <>
                    <label>
                      Person type
                      <select
                        value={personType}
                        onChange={(e) => {
                          setPersonType(e.target.value);
                          setPerson("");
                        }}
                      >
                        <option value="employee">Employee</option>
                        <option value="student">Student</option>
                        <option value="parent">Parent</option>
                      </select>
                    </label>
                    <label>
                      Existing person
                      <select
                        value={person}
                        onChange={(e) => setPerson(e.target.value)}
                        required
                      >
                        <option value="">Select a person</option>
                        {people.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label} ({p.value})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Initial password
                      <span style={{ display: "flex", gap: 8 }}>
                        <input
                          type={showPassword ? "text" : "password"}
                          minLength={12}
                          maxLength={128}
                          autoComplete="new-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setPassword(generatePassword());
                            setShowPassword(true);
                          }}
                        >
                          Generate
                        </button>
                      </span>
                      <small>
                        At least 12 characters. Note it before saving and share
                        it with the user; it is not shown again.
                      </small>
                    </label>
                  </>
                )}
              </div>
              <fieldset>
                <legend>Assigned roles</legend>
                {roles
                  .filter((r) => !r.system_admin)
                  .map((role) => (
                    <label key={String(role.code)}>
                      <span>
                        <input
                          type="checkbox"
                          checked={roleCodes.includes(String(role.code))}
                          onChange={() =>
                            setRoleCodes((old) =>
                              toggle(old, String(role.code)),
                            )
                          }
                        />{" "}
                        {String(role.name)}
                      </span>
                    </label>
                  ))}
              </fieldset>
              <fieldset>
                <legend>App access</legend>
                {clients.map((client) => (
                  <label key={client}>
                    <span>
                      <input
                        type="checkbox"
                        checked={allowedClients.includes(client)}
                        onChange={() =>
                          setClients((old) => toggle(old, client))
                        }
                      />{" "}
                      {client}
                    </span>
                  </label>
                ))}
              </fieldset>
              {initial.code && (
                <label>
                  <span>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                    />{" "}
                    Active account
                  </span>
                </label>
              )}
            </>
          )}
          {kind === "form" && (
            <>
              <div className="edu-field-grid">
                <label>
                  Screen binding
                  <select
                    value={binding}
                    onChange={(e) => setBinding(e.target.value)}
                  >
                    {screenNames.map((s) => (
                      <option key={s} value={s}>
                        {s.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>
                    <input
                      type="checkbox"
                      checked={published}
                      onChange={(e) => setPublished(e.target.checked)}
                    />{" "}
                    Published
                  </span>
                </label>
              </div>
              <p>
                Use an existing field key to change its label or choices. Add a
                new key for an additional field. Required business fields remain
                protected.
              </p>
              {fields.map((field, index) => (
                <fieldset key={index}>
                  <legend>Field {index + 1}</legend>
                  <div className="edu-field-grid">
                    <label>
                      Field key
                      <input
                        pattern="[a-z][a-z0-9_]*"
                        required
                        value={String(field.key)}
                        onChange={(e) => update(index, "key", e.target.value)}
                      />
                    </label>
                    <label>
                      Label
                      <input
                        required
                        value={String(field.label)}
                        onChange={(e) => update(index, "label", e.target.value)}
                      />
                    </label>
                    <label>
                      Type
                      <select
                        value={String(field.type)}
                        onChange={(e) => update(index, "type", e.target.value)}
                      >
                        {[
                          "text",
                          "email",
                          "phone",
                          "integer",
                          "decimal",
                          "date",
                          "boolean",
                          "select",
                          "textarea",
                        ].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Section
                      <input
                        value={String(field.section || "")}
                        onChange={(e) =>
                          update(index, "section", e.target.value)
                        }
                      />
                    </label>
                    {field.type === "select" && (
                      <label>
                        Options, separated by commas
                        <input
                          required
                          value={((field.options as string[]) || []).join(",")}
                          onChange={(e) =>
                            update(
                              index,
                              "options",
                              e.target.value.split(",").map((s) => s.trim()),
                            )
                          }
                        />
                      </label>
                    )}
                    <label>
                      Help text
                      <input
                        value={String(field.help || "")}
                        onChange={(e) => update(index, "help", e.target.value)}
                      />
                    </label>
                    <label>
                      <span>
                        <input
                          type="checkbox"
                          checked={field.required === true}
                          onChange={(e) =>
                            update(index, "required", e.target.checked)
                          }
                        />{" "}
                        Required
                      </span>
                    </label>
                  </div>
                  <div className="edu-row-actions">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() =>
                        setFields((old) => {
                          const next = [...old];
                          [next[index - 1], next[index]] = [
                            next[index],
                            next[index - 1],
                          ];
                          return next;
                        })
                      }
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      disabled={fields.length === 1}
                      onClick={() =>
                        setFields((old) => old.filter((_, i) => i !== index))
                      }
                    >
                      Remove field
                    </button>
                  </div>
                </fieldset>
              ))}
              <button
                type="button"
                onClick={() =>
                  setFields((old) => [
                    ...old,
                    {
                      key: "",
                      label: "",
                      type: "text",
                      required: false,
                      options: [],
                      section: "",
                      help: "",
                    },
                  ])
                }
              >
                Add field
              </button>
            </>
          )}
          {error && (
            <p className="edu-error" role="alert">
              {error}
            </p>
          )}
          <footer>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="edu-primary" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
