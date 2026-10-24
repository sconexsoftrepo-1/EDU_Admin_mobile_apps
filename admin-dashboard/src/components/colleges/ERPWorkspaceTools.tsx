"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  X,
  Search,
  ChevronDown,
  BookOpen,
  Users,
  GraduationCap,
  Wallet,
  CreditCard,
  Receipt,
  Building2,
  FileCheck,
  Briefcase,
  Shield,
  Settings,
  LayoutDashboard,
  BarChart3,
  Bus,
  Smartphone,
  Package,
  CalendarDays,
  BadgeIndianRupee,
} from "lucide-react";
import { courseOfferings } from "@/data/colleges/subjects";
import { collegeBySlug, permissions, type Role } from "@/data/colleges";
import type { CollegeState, RecordRow } from "@/lib/colleges/store";

const moduleIcons: Record<string, typeof BookOpen> = {
  dashboard: LayoutDashboard,
  transport: Bus,
  buses: Bus,
  "bus-seating": Bus,
  "mobile-apps": Smartphone,
  "parent-app": Smartphone,
  "student-app": Smartphone,
  "teacher-app": Smartphone,
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
  staff: Briefcase,
  roles: Shield,
  settings: Settings,
  reports: BarChart3,
  notifications: Bell,
};
export function WorkspaceNavigation({
  role,
  allowedModules,
  active,
  labels,
  nav,
  close,
  compact,
  expand,
}: {
  role: Role;
  allowedModules?: string[];
  active: string;
  labels: Record<string, string>;
  nav: (m: string) => string;
  close: () => void;
  compact: boolean;
  expand: () => void;
}) {
  const [flyout, setFlyout] = useState<{
    name: string;
    modules: string[];
    top: number;
  } | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const groupIcons: Record<string, typeof BookOpen> = {
    Overview: LayoutDashboard,
    "Student operations": Users,
    Finance: Wallet,
    Academics: GraduationCap,
    "HR & payroll": Briefcase,
    "Procurement & expenses": Package,
    "Transport & bus": Bus,
    "Mobile apps": Smartphone,
    Certificates: FileCheck,
    Hostel: Building2,
    Communication: Bell,
    Reports: BarChart3,
    Administration: Shield,
  };
  // Setup comes first: courses and batches, their fee structures, then student enrollment.
  const groups: [string, string[]][] = [
    ["Overview", ["dashboard", "campus-analytics"]],
    [
      "Academics",
      [
        "academics",
        "course-setup",
        "teaching-staff",
        "non-teaching-staff",
        "daily-labour",
        "staff",
        "timetable",
        "assignments",
        "syllabus",
        "calendar",
      ],
    ],
    [
      "Finance",
      [
        "fees",
        "fee-structures",
        "payments",
        "receipts",
        "cashbook",
        "expenses",
        "invoices",
        "scholarships",
      ],
    ],
    [
      "Student operations",
      [
        "students",
        "admissions",
        "student-enrollment",
        "attendance",
        "assessments",
      ],
    ],
    [
      "HR & payroll",
      [
        "employees",
        "employee-attendance",
        "employee-leave",
        "salary-structures",
        "payroll",
        "payslips",
        "bonuses",
        "reimbursements",
        "payroll-reports",
      ],
    ],
    [
      "Procurement & expenses",
      [
        "expense-dashboard",
        "purchase-requests",
        "purchase-orders",
        "vendors",
        "equipment",
        "utilities",
        "maintenance",
        "travel",
        "transport-expenses",
        "additional-expenses",
        "inventory",
        "assets",
      ],
    ],
    [
      "Transport & bus",
      [
        "transport",
        "buses",
        "routes",
        "route-stops",
        "drivers",
        "driver-allocation",
        "student-allocation",
        "faculty-allocation",
        "bus-seating",
        "trips",
        "manifest",
        "transport-attendance",
        "vehicle-maintenance",
        "fuel",
        "transport-reports",
      ],
    ],
    [
      "Mobile apps",
      ["mobile-apps", "admin-app", "parent-app", "student-app", "teacher-app"],
    ],
    ["Certificates", ["certificates", "certificate-requests"]],
    ["Hostel", ["hostels", "hostel-permissions"]],
    [
      "Communication",
      [
        "notifications",
        "payment-reminders",
        "announcements",
        "notification-templates",
        "campaigns",
      ],
    ],
    ["Reports", ["reports", "audit-logs"]],
    [
      "Administration",
      [
        "accounts",
        "credentials",
        "roles",
        "forms",
        "imports",
        "documents",
        "settings",
      ],
    ],
  ];
  return (
    <nav
      aria-label="Portal navigation"
      onMouseLeave={() => setFlyout(null)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setFlyout(null);
      }}
    >
      {compact && flyout && (
        <div
          className="erp-rail-flyout"
          style={{ top: flyout.top }}
          onMouseEnter={() => setFlyout(flyout)}
        >
          <strong>{flyout.name}</strong>
          {flyout.modules.map((m) => (
            <Link
              key={m}
              href={nav(m)}
              aria-current={m === active ? "page" : undefined}
              onClick={() => {
                setFlyout(null);
                close();
              }}
            >
              {labels[m]}
            </Link>
          ))}
        </div>
      )}
      <div className="erp-nav-rail" aria-label="Campus sections">
        {groups.map(([name, modules]) => {
          const visible = modules.filter((m) =>
            allowedModules
              ? allowedModules.includes(m)
              : permissions[role].includes(m),
          );
          if (!visible.length) return null;
          const Icon = groupIcons[name];
          return (
            <button
              key={name}
              type="button"
              title={name}
              onMouseEnter={(e) => {
                if (compact)
                  setFlyout({
                    name,
                    modules: visible,
                    top: Math.min(
                      e.currentTarget.getBoundingClientRect().top,
                      window.innerHeight - 340,
                    ),
                  });
              }}
              onFocus={(e) => {
                if (compact)
                  setFlyout({
                    name,
                    modules: visible,
                    top: Math.min(
                      e.currentTarget.getBoundingClientRect().top,
                      window.innerHeight - 340,
                    ),
                  });
              }}
              aria-label={`Open ${name} section`}
              aria-current={visible.includes(active) ? "true" : undefined}
              onClick={() => {
                setExpandedGroup(name);
                expand();
              }}
            >
              <Icon size={19} />
              <span className="erp-rail-tooltip">{name}</span>
            </button>
          );
        })}
      </div>
      <div className="erp-nav-sections">
        {groups.map(([name, modules]) => {
          const visible = modules.filter((m) =>
            allowedModules
              ? allowedModules.includes(m)
              : permissions[role].includes(m),
          );
          if (!visible.length) return null;
          const GroupIcon = groupIcons[name];
          if (visible.length === 1) {
            const visibleModule = visible[0];
            return (
              <div className="erp-nav-group erp-nav-single" key={name}>
                <Link
                  href={nav(visibleModule)}
                  title={labels[visibleModule]}
                  aria-current={visibleModule === active ? "page" : undefined}
                  className={visibleModule === active ? "active" : ""}
                  onClick={() => {
                    setExpandedGroup(null);
                    close();
                  }}
                >
                  <GroupIcon size={16} />
                  <span>{labels[visibleModule]}</span>
                </Link>
              </div>
            );
          }
          return (
            <details
              className="erp-nav-group"
              key={`${name}-${compact}-${active}`}
              name="campus-navigation-groups"
              open={
                expandedGroup
                  ? expandedGroup === name
                  : active === "dashboard"
                    ? name === "Student operations"
                    : visible.includes(active)
              }
            >
              <summary title={name}>
                <GroupIcon size={16} />
                <span>{name}</span>
                <ChevronDown size={12} />
              </summary>
              {visible.map((m) => {
                const Icon = moduleIcons[m] || BookOpen;
                return (
                  <Link
                    key={m}
                    href={nav(m)}
                    title={labels[m]}
                    aria-current={m === active ? "page" : undefined}
                    className={m === active ? "active" : ""}
                    onClick={() => {
                      setExpandedGroup(null);
                      close();
                    }}
                  >
                    <Icon size={15} />
                    <span>{labels[m]}</span>
                  </Link>
                );
              })}
            </details>
          );
        })}
      </div>
    </nav>
  );
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
    ...(permittedModules.includes("academics")
      ? (collegeBySlug(state.slug)?.programs || []).flatMap((p) => [
          {
            name: p.name,
            context: `Program · ${p.department}`,
            url: nav("academics"),
          },
          ...courseOfferings(p.name, 1).map((c) => ({
            name: c.name,
            context: `Course · ${c.code}`,
            url: nav("academics"),
          })),
        ])
      : []),
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
      name: labels[m],
      context: "Module",
      url: nav(m),
    })),
    ...(
      [
        ["students", state.students],
        ["admissions", state.applications],
        ["payments", state.payments],
        ["certificates", state.certificates],
        ["hostels", state.rooms],
        ["staff", state.staff],
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
    <div ref={container} className="erp-global-search">
      <Search size={17} />
      <input
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
