"use client";
import "./search-field.css";
import "./module-hub.css";
import { visibleHubs, hubRoute, hubIcons, screenLabel, HIDDEN_SCREENS } from "@/lib/colleges/module-hubs";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  X,
  Search,
  BookOpen,
  Users,
  GraduationCap,
  Wallet,
  CreditCard,
  Receipt,
  Building2,
  FileCheck,
  Shield,
  Settings,
  LayoutDashboard,
  BarChart3,
  Bus,
  Package,
  CalendarDays,
  BadgeIndianRupee,
  ClipboardCheck,
} from "lucide-react";
import { permissions, type Role } from "@/data/colleges";
import type { CollegeState, RecordRow } from "@/lib/colleges/store";

const moduleIcons: Record<string, typeof BookOpen> = {
  dashboard: LayoutDashboard,
  transport: Bus,
  buses: Bus,
  "bus-seating": Bus,
  employees: Users,
  payroll: BadgeIndianRupee,
  "salary-structures": BadgeIndianRupee,
  "expense-dashboard": Package,
  inventory: Package,
  assets: Package,
  "purchase-requests": Package,
  timetable: CalendarDays,
  accounts: Shield,
  students: Users,
  admissions: GraduationCap,
  fees: Wallet,
  payments: CreditCard,
  receipts: Receipt,
  hostels: Building2,
  certificates: FileCheck,
  roles: Shield,
  settings: Settings,
  reports: BarChart3,
  notifications: Bell,
};
export function WorkspaceNavigation({ role, allowedModules, active, labels, nav, close, compact }: {
  role: Role; allowedModules?: string[]; active: string; labels: Record<string, string>;
  nav: (m: string) => string; close: () => void; compact: boolean; expand: () => void;
}) {
  const allowed = allowedModules || permissions[role];
  const hubs = visibleHubs(allowed);
  const assigned = new Set(hubs.flatMap((h) => h.screens));
  const direct = ["dashboard", "campus-analytics", "change-requests", ...allowed.filter((m) => !HIDDEN_SCREENS.has(m) && !assigned.has(m) && !["dashboard", "campus-analytics", "change-requests"].includes(m))].filter((m) => allowed.includes(m));
  return <nav aria-label="Portal navigation" className={`erp-hub-navigation ${compact ? "is-compact" : ""}`}>
    {direct.map((screen) => {
      const Icon = moduleIcons[screen] || ClipboardCheck;
      return <Link key={screen} href={nav(screen)} title={screenLabel(screen, labels)} className={active === screen ? "active" : ""} aria-current={active === screen ? "page" : undefined} onClick={close}>
        <Icon size={18} /><span>{screenLabel(screen, labels)}</span>
      </Link>;
    })}
    {hubs.map((hub) => {
      const Icon = hubIcons[hub.key] || BookOpen;
      const selected = active === hubRoute(hub) || hub.screens.includes(active);
      return <Link key={hub.key} href={nav(hubRoute(hub))} title={hub.title} aria-label={hub.title} className={selected ? "active" : ""} aria-current={selected ? "page" : undefined} onClick={close}>
        <Icon size={18} /><span>{hub.title}</span>
      </Link>;
    })}
  </nav>;
}

export function WorkspaceSearch({
  state,
  role,
  allowedModules,
  labels,
  nav,
}: {
  state: CollegeState;
  role: Role;
  allowedModules?: string[];
  labels: Record<string, string>;
  nav: (m: string) => string;
}) {
  const permittedModules = allowedModules || permissions[role];
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
      }
      if (e.key === "Escape") {
        setQuery("");
        input.current?.blur();
      }
    };
    const outside = (e: PointerEvent) => {
      if (!container.current?.contains(e.target as Node)) setQuery("");
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", outside);
    };
  }, []);
  const sources = [
    ...visibleHubs(permittedModules).map((hub) => ({ name: hub.title, context: "Module dashboard", url: nav(hubRoute(hub)) })),
    ...(permittedModules.includes("timetable")
      ? (state.operations?.records.timetable || []).slice(0, 500).map((p) => ({
          name: p.name,
          context: `Timetable · ${p.day} ${p.start} · ${p.room}`,
          url: nav("timetable"),
        }))
      : []),
    ...(permittedModules.includes("routes")
      ? (state.operations?.routes || []).map((r) => ({
          name: r.name,
          context: "Transport route",
          url: nav("routes"),
        }))
      : []),
    ...permittedModules.map((m) => ({
      name: screenLabel(m, labels),
      context: "Submodule",
      url: nav(m),
    })),
    ...(
      [
        ["students", state.students],
        ["admissions", state.applications],
        ["payments", state.payments],
        ["certificates", state.certificates],
        ["hostels", state.rooms],
        ["employees", state.staff],
      ] as const
    ).flatMap(([m, rows]) =>
      permittedModules.includes(m) && role !== "Student"
        ? rows.map((r) => ({
            name: r.name,
            context: `${labels[m]} · ${r.id}`,
            url: m === "students" ? `${nav(m)}/${r.id}` : nav(m),
          }))
        : [],
    ),
  ];
  const results = query.trim()
    ? sources
        .filter((r) =>
          `${r.name} ${r.context}`.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 8)
    : [];
  return (
    <div ref={container} className="erp-global-search edu-search-field">
      <Search size={17} />
      <input className="edu-search-input"
        ref={input}
        value={query}
        aria-label="Search portal modules"
        placeholder="Search students, fees, admissions…"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={!!query}
        aria-controls="erp-command-results"
        aria-activedescendant={
          query && results[index] ? `erp-command-option-${index}` : undefined
        }
        onChange={(e) => {
          setQuery(e.target.value);
          setIndex(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setIndex((i) => Math.min(i + 1, results.length - 1));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndex((i) => Math.max(i - 1, 0));
          }
          if (e.key === "Enter") {
            e.preventDefault();
            container.current
              ?.querySelectorAll<HTMLAnchorElement>(".erp-search-results a")
              [index]?.click();
          }
        }}
      />
      <kbd>⌘ K</kbd>
      {query && (
        <div
          className="erp-search-results"
          id="erp-command-results"
          role="listbox"
          aria-label="Search results"
        >
          {results.length ? (
            results.map((r, i) => (
              <Link
                key={`${r.url}-${r.context}`}
                id={`erp-command-option-${i}`}
                role="option"
                aria-selected={index === i}
                className={index === i ? "is-selected" : ""}
                href={r.url}
                onClick={() => setQuery("")}
              >
                <strong>{r.name}</strong>
                <small>{r.context}</small>
              </Link>
            ))
          ) : (
            <p>No matching records. Try a name, ID, or module.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function NotificationCenter({
  rows,
  slug,
  href,
}: {
  rows: RecordRow[];
  slug: string;
  href: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [read, setRead] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(`kc-notifications-${slug}`) || "[]",
      );
      return Array.isArray(saved)
        ? saved.filter((id): id is string => typeof id === "string")
        : [];
    } catch {
      return [];
    }
  });
  const [filter, setFilter] = useState("all");
  const mark = (ids: string[]) => {
    const next = Array.from(new Set([...read, ...ids]));
    setRead(next);
    try {
      localStorage.setItem(`kc-notifications-${slug}`, JSON.stringify(next));
    } catch {}
  };
  const unread = rows.filter((r) => !read.includes(r.id)).length;
  return (
    <>
      <button
        className="erp-notification"
        aria-label="Open notifications"
        onClick={() => dialog.current?.showModal()}
      >
        <Bell size={19} />
        {unread > 0 && <span>{unread}</span>}
      </button>
      <dialog
        className="erp-notification-drawer"
        data-panel-size="compact"
        ref={dialog}
        aria-labelledby="erp-notification-title"
      >
        <div className="erp-panel-title">
          <div>
            <h2 id="erp-notification-title">Notifications</h2>
            <p>{unread} unread campus updates</p>
          </div>
          <button
            aria-label="Close notifications"
            onClick={() => dialog.current?.close()}
          >
            <X size={18} />
          </button>
        </div>
        <div className="erp-notification-controls">
          <select
            aria-label="Notification filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All updates</option>
            <option value="unread">Unread only</option>
          </select>
          <button onClick={() => mark(rows.map((r) => r.id))}>
            Mark all as read
          </button>
        </div>
        <div className="erp-notification-list">
          {rows
            .filter((r) => filter !== "unread" || !read.includes(r.id))
            .map((r) => (
              <article
                key={r.id}
                className={read.includes(r.id) ? "is-read" : ""}
              >
                <Bell size={17} />
                <div>
                  <small>
                    {r.category || "Campus update"} ·{" "}
                    {r.date.slice(0, 16).replace("T", " ")}
                  </small>
                  <h3>{r.name}</h3>
                  <p>{r.note}</p>
                  <Link
                    href={href}
                    onClick={() => {
                      mark([r.id]);
                      dialog.current?.close();
                    }}
                  >
                    View update
                  </Link>
                  {!read.includes(r.id) && (
                    <button onClick={() => mark([r.id])}>Mark as read</button>
                  )}
                </div>
              </article>
            ))}
        </div>
        {filter === "unread" && !unread && (
          <p className="erp-empty">You’re all caught up.</p>
        )}
      </dialog>
    </>
  );
}
