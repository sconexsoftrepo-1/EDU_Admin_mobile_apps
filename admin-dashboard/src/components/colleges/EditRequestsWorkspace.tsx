"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ClipboardCheck, RefreshCw, X } from "lucide-react";
import { api, errorText, type EditRequest } from "@/services/api";
import SideDrawer from "./SideDrawer";
import { toast } from "./toast";
import WorkspaceSkeleton from "./WorkspaceSkeleton";
import "./edit-requests.css";

const CHANGED_EVENT = "edunexa:edit-requests-changed";
const POLL_MS = 60_000;
const when = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

/**
 * Top bar shortcut. The Super Admin opens the Change requests page (count = edits waiting).
 * Everyone else opens a side panel of their own requests and is told when the admin decides one.
 */
export function ChangeRequestsBadge({ href }: { href: string }) {
  const [count, setCount] = useState(0);
  const [canDecide, setCanDecide] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const previous = useRef<number | null>(null);
  const seen = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    let active = true;
    const load = () => {
      if (document.visibilityState === "hidden") return;
      void api.editRequests
        .pendingCount()
        .then((result) => {
          if (!active || typeof result?.count !== "number") return;
          setCount(result.count);
          setCanDecide(Boolean(result.can_decide));
          if (result.can_decide && result.count > (previous.current ?? 0))
            toast.info(
              result.count === 1
                ? "1 edit is waiting for your approval"
                : `${result.count} edits are waiting for your approval`,
            );
          previous.current = result.count;
          if (result.can_decide) return;
          // The requester hears about each decision once.
          return api.editRequests.list().then((list) => {
            if (!active) return;
            const before = seen.current;
            const now = new Map(list.items.map((item) => [item.code, item.status]));
            if (before)
              for (const item of list.items) {
                const was = before.get(item.code);
                if (was && was !== item.status && (item.status === "accepted" || item.status === "rejected"))
                  toast[item.status === "accepted" ? "success" : "warning"](
                    item.status === "accepted" ? "Your change was approved" : "Your change was rejected",
                    `${item.target_title} · ${item.target_label}${item.decision_note ? ` — ${item.decision_note}` : ""}`,
                  );
              }
            seen.current = now;
          });
        })
        // A badge must never interrupt the page; the next poll tries again.
        .catch(() => {});
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    window.addEventListener(CHANGED_EVENT, load);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(CHANGED_EVENT, load);
      window.removeEventListener("focus", load);
    };
  }, []);
  const label = canDecide
    ? count
      ? `Change requests, ${count} waiting`
      : "Change requests"
    : count
      ? `My change requests, ${count} waiting for the admin`
      : "My change requests";
  const dot = count > 0 && <span aria-live="polite">{count > 99 ? "99+" : count}</span>;
  if (canDecide !== false)
    return (
      <Link href={href} className="edr-badge" aria-label={label} title={label}>
        <ClipboardCheck size={18} />
        {dot}
      </Link>
    );
  return (
    <>
      <button type="button" className="edr-badge" aria-label={label} title={label} onClick={() => setOpen(true)}>
        <ClipboardCheck size={18} />
        {dot}
      </button>
      {open && (
        <SideDrawer
          title="My change requests"
          subtitle="Edits you made on any screen. Live data changes only after the admin approves."
          onClose={() => setOpen(false)}
        >
          <RequestList compact />
        </SideDrawer>
      )}
    </>
  );
}

const STAGES = { pending: 1, applying: 1, accepted: 2, rejected: 2 } as const;

/** Submitted → with the admin → accepted / rejected. */
function Stages({ item }: { item: EditRequest }) {
  const reached = STAGES[item.status];
  const last = item.status === "rejected" ? "Rejected" : "Approved";
  const steps: [string, string | null][] = [
    ["Submitted", when(item.requested_at)],
    ["Waiting for admin", item.status === "pending" || item.status === "applying" ? "In review" : "Reviewed"],
    [item.status === "pending" || item.status === "applying" ? "Decision" : last, item.decided_at ? when(item.decided_at) : null],
  ];
  return (
    <ol className={`edr-stages is-${item.status}`} aria-label="Request stage">
      {steps.map(([name, detail], i) => (
        <li key={name} className={i < reached ? "is-done" : i === reached ? "is-current" : ""}>
          <span aria-hidden="true">{i < reached ? <Check size={12} /> : i + 1}</span>
          <div>
            <strong>{name}</strong>
            {detail && <small>{detail}</small>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function RequestCard({
  item,
  canDecide,
  onDone,
}: {
  item: EditRequest;
  canDecide: boolean;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const stale = item.stale_fields || [];
  const finish = (message: string) => {
    toast.success(message);
    window.dispatchEvent(new Event(CHANGED_EVENT));
    onDone();
  };
  async function accept() {
    setBusy(true);
    setError("");
    try {
      await api.editRequests.accept(item.code, stale.length > 0);
      finish("Change accepted and applied");
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }
  async function reject() {
    setBusy(true);
    setError("");
    try {
      await api.editRequests.reject(item.code, note.trim());
      finish("Change rejected. The data was not changed.");
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }
  const pending = item.status === "pending";
  return (
    <article className="edr-card">
      <header>
        {canDecide ? (
          <p>
            At <strong>{when(item.requested_at)}</strong>,{" "}
            <strong>{item.requester_role || "A staff member"}</strong>{" "}
            <strong>{item.requester_name || ""}</strong> edited{" "}
            <strong>{item.target_label}</strong>
          </p>
        ) : (
          <p>
            You edited <strong>{item.target_label}</strong>
          </p>
        )}
        <span className={`edr-status is-${item.status}`}>
          {pending ? "Waiting" : item.status === "applying" ? "Applying…" : item.status === "accepted" ? "Accepted" : "Rejected"}
        </span>
      </header>
      <small className="edr-kind">{item.target_title}</small>
      {!canDecide && <Stages item={item} />}
      {item.changes.length > 0 ? (
        <div className="edr-table">
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>From</th>
                <th aria-hidden="true" />
                <th>To</th>
              </tr>
            </thead>
            <tbody>
              {item.changes.map((change) => (
                <tr key={change.field}>
                  <th scope="row">{change.label}</th>
                  <td className="edr-from">{change.from}</td>
                  <td className="edr-arrow" aria-label="changes to">
                    <ArrowRight size={14} />
                  </td>
                  <td className="edr-to">{change.to}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="edr-note">An action on this record, with no field values to compare.</p>
      )}
      {stale.length > 0 && pending && (
        <p className="edr-warning" role="status">
          Changed since this request was made: {stale.join(", ")}. Accepting
          replaces those newer values.
        </p>
      )}
      {item.last_error && pending && (
        <p className="edr-warning" role="status">
          Last attempt was not applied: {item.last_error}
        </p>
      )}
      {error && (
        <p className="edr-error" role="alert">
          {error}
        </p>
      )}
      {item.decision_note && (
        <p className="edr-note">Admin note: {item.decision_note}</p>
      )}
      {!pending && item.decided_at && (
        <p className="edr-note">Decided {when(item.decided_at)}</p>
      )}
      {!canDecide && item.status === "rejected" && (
        <p className="edr-note">The record was not changed.</p>
      )}
      {pending && canDecide && (
        <footer>
          {rejecting ? (
            <>
              <label>
                Reason (optional)
                <input
                  name="rejection-note"
                  autoComplete="off"
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Please confirm the number with the parent…"
                />
              </label>
              <button disabled={busy} onClick={() => setRejecting(false)}>
                Cancel
              </button>
              <button className="edr-reject" disabled={busy} onClick={reject}>
                <X size={15} /> {busy ? "Rejecting…" : "Confirm reject"}
              </button>
            </>
          ) : (
            <>
              <button
                className="edr-reject"
                disabled={busy}
                onClick={() => setRejecting(true)}
              >
                <X size={15} /> Reject
              </button>
              <button className="edr-accept" disabled={busy} onClick={accept}>
                <Check size={15} />{" "}
                {busy ? "Applying…" : stale.length ? "Accept anyway" : "Accept"}
              </button>
            </>
          )}
        </footer>
      )}
    </article>
  );
}

type Tab = "pending" | "accepted" | "rejected";
const TABS: [Tab, string][] = [
  ["pending", "Pending"],
  ["accepted", "Accepted"],
  ["rejected", "Rejected"],
];
const inTab = (item: EditRequest, tab: Tab) =>
  tab === "pending" ? item.status === "pending" || item.status === "applying" : item.status === tab;

/** Requests in three tabs. The admin sees everyone's; other users see only their own. */
function RequestList({ compact = false }: { compact?: boolean }) {
  const [items, setItems] = useState<EditRequest[]>([]);
  const [canDecide, setCanDecide] = useState(false);
  const [tab, setTab] = useState<Tab>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const result = await api.editRequests.list();
      setItems(result.items || []);
      setCanDecide(Boolean(result.can_decide));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  const shown = items.filter((item) => inTab(item, tab));
  const empty = {
    pending: canDecide ? "Nothing is waiting for approval." : "None of your changes are waiting for the admin.",
    accepted: canDecide ? "No accepted changes yet." : "None of your changes have been approved yet.",
    rejected: canDecide ? "No rejected changes." : "None of your changes were rejected.",
  }[tab];
  return (
    <div className={`edr-body ${compact ? "is-compact" : ""}`}>
      <div className="edr-controls">
        <div role="tablist" aria-label="Change requests" className="edr-tabs">
          {TABS.map(([key, name]) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
              {name} ({items.filter((item) => inTab(item, key)).length})
            </button>
          ))}
        </div>
        <button className="edr-refresh" onClick={load} aria-label="Refresh change requests">
          <RefreshCw size={15} />
        </button>
      </div>
      {loading && <WorkspaceSkeleton compact label="Loading change requests…" />}
      {error && (
        <p className="edr-error" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && shown.length === 0 && <p className="edr-empty">{empty}</p>}
      <div className="edr-list">
        {shown.map((item) => (
          <RequestCard key={item.code} item={item} canDecide={canDecide} onDone={load} />
        ))}
      </div>
    </div>
  );
}

export default function EditRequestsWorkspace() {
  const [canDecide, setCanDecide] = useState<boolean | null>(null);
  useEffect(() => {
    void api.editRequests
      .pendingCount()
      .then((r) => setCanDecide(Boolean(r.can_decide)))
      .catch(() => setCanDecide(false));
  }, []);
  return (
    <section className="edr">
      <header className="edr-head">
        <div>
          <h1>{canDecide === false ? "My change requests" : "Change requests"}</h1>
          <p>
            {canDecide === false
              ? "Edits you made on any screen. Live data changes only after the admin approves."
              : "Edits made by staff on any screen. Live data changes only when you accept."}
          </p>
        </div>
      </header>
      <RequestList />
    </section>
  );
}
