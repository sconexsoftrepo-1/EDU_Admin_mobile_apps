"use client";
/**
 * App-wide floating notifications for the college workspace.
 * Call `toast.success(...)`, `toast.error(...)`, `toast.warning(...)` or `toast.info(...)` from
 * anywhere; `<Toaster />` (mounted once in CollegeWorkspaceProvider) renders the stack top-right.
 */
import { useEffect, useSyncExternalStore } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import "./toast.css";

export type ToastKind = "success" | "error" | "warning" | "info";
type ToastItem = {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
  count: number;
};

const DURATION: Record<ToastKind, number> = {
  success: 3500,
  info: 4000,
  warning: 4500,
  error: 5000,
};
const MAX_VISIBLE = 4;

let items: ToastItem[] = [];
let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function schedule(id: number, kind: ToastKind) {
  clearTimeout(timers.get(id));
  timers.set(
    id,
    setTimeout(() => dismiss(id), DURATION[kind]),
  );
}

function dismiss(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  items = items.filter((t) => t.id !== id);
  emit();
}

function show(kind: ToastKind, title: string, detail?: string) {
  const text = title.trim();
  if (!text || typeof window === "undefined") return;
  // The same message already on screen is refreshed rather than stacked again.
  const same = items.find(
    (t) => t.kind === kind && t.title === text && t.detail === detail,
  );
  if (same) {
    items = items.map((t) =>
      t.id === same.id ? { ...t, count: t.count + 1 } : t,
    );
    schedule(same.id, kind);
    emit();
    return same.id;
  }
  const id = nextId++;
  items = [...items, { id, kind, title: text, detail, count: 1 }];
  while (items.length > MAX_VISIBLE) dismiss(items[0].id);
  schedule(id, kind);
  emit();
  return id;
}

export const toast = {
  success: (title: string, detail?: string) => show("success", title, detail),
  error: (title: string, detail?: string) => show("error", title, detail),
  warning: (title: string, detail?: string) => show("warning", title, detail),
  info: (title: string, detail?: string) => show("info", title, detail),
  dismiss,
};

/** Raises an error toast each time a screen's error text becomes non-empty. */
export function useErrorToast(
  error: string | null | undefined,
  title?: string,
) {
  useEffect(() => {
    if (!error) return;
    if (title) toast.error(title, error);
    else toast.error(error);
  }, [error, title]);
}

/** "Edit Students" → "Students updated successfully"; "Create Fee" → "Fee created successfully". */
export function successText(title: string) {
  if (/student.*enrol|enrol.*student/i.test(title))
    return "Student enrolled successfully";
  const [, verb, rest] =
    /^(edit|update|create|add|new)\s+(.+)$/i.exec(title) || [];
  if (!verb) return `${title} completed successfully`;
  return /^(edit|update)$/i.test(verb)
    ? `${rest} updated successfully`
    : `${rest} created successfully`;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => items;
const emptyServerSnapshot: ToastItem[] = [];
const serverSnapshot = (): ToastItem[] => emptyServerSnapshot;

const ICON = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export function Toaster() {
  const list = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  // Any form check that finds empty mandatory fields marks the form (fields turn red via
  // `.is-validated :invalid`) and raises one warning, however many fields failed.
  useEffect(() => {
    let pending = false;
    const onInvalid = (e: Event) => {
      const field = e.target as HTMLElement;
      const scope = field.closest("form") ?? field.parentElement;
      scope?.classList.add("is-validated");
      if (pending) return;
      pending = true;
      setTimeout(() => {
        pending = false;
        toast.warning("Please fill in all required fields.");
      });
    };
    document.addEventListener("invalid", onInvalid, true);
    return () => document.removeEventListener("invalid", onInvalid, true);
  }, []);
  // Escape closes the newest notification.
  useEffect(() => {
    if (!list.length) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss(list[list.length - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list]);
  return (
    <div className="app-toaster" aria-live="polite" aria-relevant="additions">
      {list.map((t) => {
        const Icon = ICON[t.kind];
        return (
          <div
            key={t.id}
            className={`app-toast app-toast-${t.kind}`}
            role={t.kind === "error" ? "alert" : "status"}
            onMouseEnter={() => clearTimeout(timers.get(t.id))}
            onMouseLeave={() => schedule(t.id, t.kind)}
          >
            <Icon className="app-toast-icon" size={18} aria-hidden="true" />
            <div className="app-toast-body">
              <strong>
                {t.title}
                {t.count > 1 && (
                  <span className="app-toast-count">×{t.count}</span>
                )}
              </strong>
              {t.detail && <p>{t.detail}</p>}
            </div>
            <button
              type="button"
              className="app-toast-close"
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
