"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  api,
  errorText,
  type Row,
  type Resource,
  type LookupOption,
} from "@/services/api";
import type { ResourceFormResponse } from "@/services/api/modules/workspace/consts";
import SearchField, { searchValues } from "./SearchField";
import Select from "./SearchSelect";
import "./fee-head-manager.css";
const groups = {
  academic: "Academic / training",
  hostel: "Hostel",
  transport: "Transport",
  other: "Other",
};
const fresh = (): Row => ({
  code: `FH-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
  name: "",
  category: "academic",
  category_label: "Academic",
  description: "",
  collection_ownership: "internal",
  scholarship_eligible: false,
});
export default function FeeHeadManager({
  initial,
  onChanged,
}: {
  initial?: Row | null;
  onChanged?: () => void | Promise<void>;
}) {
  const [binding, setBinding] = useState<ResourceFormResponse | null>(null);
  const [resource, setResource] = useState<Resource | null>(null),
    [rows, setRows] = useState<Row[]>([]),
    [draft, setDraft] = useState<Row>(() =>
      initial ? { ...initial } : fresh(),
    ),
    [editing, setEditing] = useState(!!initial?.code),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [pendingDelete, setPendingDelete] = useState<Row | null>(null),
    [parties, setParties] = useState<LookupOption[]>([]);
  async function load(current: Resource) {
    const all: Row[] = [];
    for (;;) {
      const page = await api.workspace.list(current.path, all.length, 100);
      all.push(...page.items);
      if (!page.items.length || all.length >= page.total) break;
    }
    setRows(all);
  }
  useEffect(() => {
    let active = true;
    void Promise.all([
      api.workspace.screen("fee-structures"),
      api.workspace.resourceForm(
        "fee_heads",
        initial?.code ? String(initial.code) : undefined,
      ),
    ])
      .then(async ([screen, bound]) => {
        const r = screen.resources.find((r) => r.name === "fee_heads");
        if (!r) throw Error("Fee-head access is not assigned to this role.");
        if (active) {
          setResource(r);
          setBinding(bound);
          await load(r);
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [initial?.code]);
  useEffect(() => {
    if (draft.collection_ownership !== "external") return;
    let active = true;
    void api.workspace
      .lookup("external_parties")
      .then((r) => {
        if (active) setParties(r);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [draft.collection_ownership]);
  function change(key: string, value: unknown) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSuccess("");
  }
  function beginNew() {
    setDraft(fresh());
    setEditing(false);
    setBinding((b) => (b ? { ...b, values: {} } : b));
    setError("");
  }
  async function editHead(row: Row) {
    setBusy(true);
    setError("");
    try {
      const bound = await api.workspace.resourceForm(
        "fee_heads",
        String(row.code),
      );
      setBinding(bound);
      setDraft({
        ...row,
        category_label:
          row.category_label ||
          groups[row.category as keyof typeof groups] ||
          row.category,
      });
      setEditing(true);
      setSuccess("");
      document
        .querySelector(".fh-manager")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function updated() {
    if (resource) await load(resource);
    await onChanged?.();
    window.dispatchEvent(new Event("edunexa:records-changed"));
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!resource || busy) return;
    setBusy(true);
    setError("");
    try {
      const name = String(draft.name || "").trim();
      if (
        rows.some(
          (r) =>
            String(r.code) !== String(draft.code) &&
            String(r.name).trim().toLowerCase() === name.toLowerCase(),
        )
      )
        throw Error(
          "A fee head with this name already exists. Edit it in the table below.",
        );
      const known = new Set(resource.fields.map((f) => f.name || f.key));
      const values = {
        ...binding?.defaults,
        ...binding?.values,
        ...Object.fromEntries(
          Object.entries(draft).filter(([key]) => known.has(key)),
        ),
        name,
        category_label: String(draft.category_label || "").trim(),
        external_party_code:
          draft.collection_ownership === "external"
            ? draft.external_party_code
            : null,
      };
      const payload = {
        values,
        form_code: binding?.form?.code,
        form_revision: binding?.form?.revision,
      };
      if (editing)
        await api.workspace.update("fee_heads", String(draft.code), payload);
      else await api.workspace.create("fee_heads", payload);
      await updated();
      beginNew();
      setSuccess(
        "Fee head saved. It is available in every course fee structure.",
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!pendingDelete || !resource) return;
    setBusy(true);
    setError("");
    try {
      await api.workspace.remove(resource.path, String(pendingDelete.code));
      if (draft.code === pendingDelete.code) {
        setDraft(fresh());
        setEditing(false);
      }
      setPendingDelete(null);
      await updated();
      setSuccess("Unused fee head deleted.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const visible = rows.filter((r) =>
    [r.name, r.code, r.category_label, r.category]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <section className="fh-manager">
      <header>
        <div>
          <h3>{editing ? "Edit fee head" : "Add custom fee head"}</h3>
          <p>
            Create the fee names and categories your institution uses, including
            training or academy charges.
          </p>
        </div>
        {editing && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setDraft(fresh());
              setEditing(false);
              setError("");
            }}
          >
            <Plus size={16} />
            Add custom fee head
          </button>
        )}
      </header>
      {error && (
        <p role="alert" className="edu-error">
          {error}
        </p>
      )}
      {success && <p role="status">{success}</p>}
      {resource && resource.actions.includes(editing ? "edit" : "create") && (
        <form onSubmit={save}>
          <fieldset disabled={busy}>
            <div className="fh-fields">
              <label>
                Fee head name *
                <input
                  required
                  maxLength={100}
                  value={String(draft.name || "")}
                  placeholder="e.g. Physical training, Uniform, Coaching"
                  onChange={(e) => change("name", e.target.value)}
                />
              </label>
              <label>
                Category *
                <input
                  required
                  list="fee-head-categories"
                  maxLength={80}
                  value={String(draft.category_label || "")}
                  placeholder="Choose or type a custom category"
                  onChange={(e) => change("category_label", e.target.value)}
                />
                <datalist id="fee-head-categories">
                  {[
                    ...new Set([
                      "Academic",
                      "Training",
                      "Hostel",
                      "Transport",
                      "Other",
                      ...rows
                        .map((r) => String(r.category_label || ""))
                        .filter(Boolean),
                    ]),
                  ].map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label>
                Billing group
                <Select
                  aria-label="Billing group"
                  value={String(draft.category || "academic")}
                  onChange={(e) => change("category", e.target.value)}
                >
                  {Object.entries(groups).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              </label>
              <label>
                Collection ownership
                <Select
                  aria-label="Collection ownership"
                  value={String(draft.collection_ownership || "internal")}
                  onChange={(e) =>
                    change("collection_ownership", e.target.value)
                  }
                >
                  <option value="internal">Institution collection</option>
                  <option value="external">
                    Collected for another organization
                  </option>
                </Select>
              </label>
              {draft.collection_ownership === "external" && (
                <label>
                  External organization *
                  <Select
                    required
                    aria-label="External organization"
                    value={String(draft.external_party_code || "")}
                    onChange={(e) =>
                      change("external_party_code", e.target.value)
                    }
                  >
                    <option value="">Select organization</option>
                    {parties.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                </label>
              )}
              <label className="fh-wide">
                Description
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={String(draft.description || "")}
                  onChange={(e) => change("description", e.target.value)}
                />
              </label>
              <label className="fh-check">
                <input
                  type="checkbox"
                  checked={!!draft.scholarship_eligible}
                  onChange={(e) =>
                    change("scholarship_eligible", e.target.checked)
                  }
                />
                Scholarship eligible
              </label>
            </div>
            <p className="fh-help">
              Academic / training and Other apply to enrolled students. Hostel
              and Transport depend on the selected services. Set the amount
              separately in each course’s fee breakdown.
            </p>
            <button className="edu-primary" disabled={busy}>
              {busy ? "Saving…" : editing ? "Save fee head" : "Add fee head"}
            </button>
            {editing && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setDraft(fresh());
                  setEditing(false);
                }}
              >
                Cancel edit
              </button>
            )}
          </fieldset>
        </form>
      )}
      <header>
        <h3>Existing fee heads ({rows.length})</h3>
        <SearchField
          aria-label="Search fee heads"
          placeholder="Search name or category"
          value={query}
          onValueChange={setQuery}
          suggestions={searchValues(rows, ["name", "category_label"])}
        />
      </header>
      {pendingDelete && (
        <div className="fh-delete">
          <p>
            Delete unused fee head “{String(pendingDelete.name)}”? Linked fee
            heads are protected.
          </p>
          <button disabled={busy} onClick={() => void remove()}>
            Delete fee head
          </button>
          <button disabled={busy} onClick={() => setPendingDelete(null)}>
            Cancel
          </button>
        </div>
      )}
      <div className="fh-table">
        <table>
          <thead>
            <tr>
              <th>Fee head</th>
              <th>Category</th>
              <th>Billing group</th>
              <th>Collection</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={String(r.code)}>
                <td>
                  <strong>{String(r.name)}</strong>
                  <small>{String(r.code)}</small>
                </td>
                <td>
                  {String(
                    r.category_label ||
                      groups[r.category as keyof typeof groups] ||
                      r.category ||
                      "Other",
                  )}
                </td>
                <td>
                  {groups[r.category as keyof typeof groups] ||
                    String(r.category)}
                </td>
                <td>
                  {r.collection_ownership === "external"
                    ? "External organization"
                    : "Institution"}
                </td>
                <td>
                  <div className="fh-actions">
                    {resource?.actions.includes("edit") && (
                      <button
                        aria-label={`Edit ${r.name}`}
                        disabled={busy}
                        onClick={() => void editHead(r)}
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {resource?.actions.includes("delete") && (
                      <button
                        aria-label={`Delete ${r.name}`}
                        disabled={busy}
                        onClick={() => setPendingDelete(r)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={5}>
                  {resource
                    ? "No fee heads match your search."
                    : "Loading fee heads…"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
