"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ClipboardList,
  Download,
  Eye,
  FileText,
  GraduationCap,
  Percent,
  Plus,
  Search,
  UserCheck,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  api,
  errorText,
  type AdmissionAnalyticsData,
  type ApplicationRow,
  type EnquiryRow,
} from "@/services/api";
import { courseLevelLabel } from "@/lib/colleges/person-photo";
import { excelTable, pdfTable } from "@/lib/colleges/export-table";
import SideDrawer from "./SideDrawer";
import PDFActions from "./PDFActions";
import { toast } from "./toast";
import {
  BarList,
  Donut,
  Empty,
  FilterDate,
  FilterSelect,
  LoadFailed,
  nice,
  Panel,
  percentOf,
  shortDate,
  Stat,
} from "./AnalyticsParts";

const ACTIVE = new Set(["new", "contacted", "counselling", "applied"]);
const PAGE = 8;
const NO_FILTERS = { year: "", level: "", course: "", reference: "", stage: "", status: "", from: "", to: "" };
type Filters = typeof NO_FILTERS;
type View = "enquiries" | "applications" | "admissions" | "followups";
const tally = <T,>(rows: T[], keyOf: (row: T) => string | null | undefined) => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
};
const dayOf = (value: string | null | undefined) => String(value || "").slice(0, 10);

function followUpState(row: EnquiryRow, today: string) {
  if (!ACTIVE.has(row.status)) return null;
  const day = dayOf(row.next_follow_up_at);
  if (!day) return "unscheduled";
  return day < today ? "overdue" : day === today ? "today" : "upcoming";
}

type Column = { key: string; label: string; value: (row: EnquiryRow) => string };
const COLUMNS: Column[] = [
  { key: "name", label: "Applicant", value: (r) => r.name || "—" },
  { key: "level", label: "Course level", value: (r) => (r.course_level ? courseLevelLabel(r.course_level) : "—") },
  { key: "course", label: "Course / branch", value: (r) => r.course_name || "—" },
  { key: "reference", label: "Reference", value: (r) => r.reference_label },
  { key: "phone", label: "Phone", value: (r) => r.phone || "—" },
  { key: "status", label: "Status", value: (r) => nice(r.status) },
  { key: "next", label: "Next follow-up", value: (r) => shortDate(r.next_follow_up_at) },
  { key: "year", label: "Academic year", value: (r) => r.academic_year || "—" },
];

export default function AdmissionAnalytics({
  admissionsHref,
}: {
  admissionsHref?: string;
}) {
  const [data, setData] = useState<AdmissionAnalyticsData | null>(null);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [view, setView] = useState<View>("enquiries");
  const [mineOnly, setMineOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; down: boolean } | null>(null);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<EnquiryRow | null>(null);
  const [allCourses, setAllCourses] = useState(false);
  const load = useCallback(() => {
    setError("");
    return api.analytics
      .admissions()
      .then(setData)
      .catch((e) => setError(errorText(e)));
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const set = (patch: Partial<Filters>) => {
    setPage(0);
    setFilters((current) => {
      const next = { ...current, ...patch };
      // A parent filter clears any child selection it no longer allows.
      const courses = data?.options.courses || [];
      if (next.course && next.level && courses.find((c) => c.code === next.course)?.level !== next.level)
        next.course = "";
      const year = data?.options.years.find((y) => y.code === next.year);
      if (year?.program_code) {
        if (next.course && year.program_code !== next.course) next.year = "";
        const level = courses.find((c) => c.code === year.program_code)?.level;
        if (next.level && level !== next.level) next.year = "";
      }
      return next;
    });
  };
  const toggle = (key: keyof Filters, value: string) => set({ [key]: filters[key] === value ? "" : value });

  const matches = useCallback(
    (row: EnquiryRow | ApplicationRow, date: string | null) =>
      (!filters.year || row.academic_year_code === filters.year) &&
      (!filters.level || row.course_level === filters.level) &&
      (!filters.course || row.program_code === filters.course) &&
      (!filters.reference || row.reference_type === filters.reference) &&
      // Records without a date cannot be placed in a range, so a range leaves them out.
      (!filters.from || dayOf(date) >= filters.from) &&
      (!filters.to || (Boolean(date) && dayOf(date) <= filters.to)),
    [filters],
  );
  const enquiries = useMemo(
    () =>
      (data?.enquiries || []).filter(
        (r) =>
          matches(r, r.recorded_at) &&
          (!filters.stage || r.stage === filters.stage) &&
          (!filters.status || r.status === filters.status),
      ),
    [data, filters, matches],
  );
  const applications = useMemo(
    () =>
      (data?.applications || []).filter(
        (r) => matches(r, r.applied_on) && (!filters.stage || filters.stage === "application"),
      ),
    [data, filters, matches],
  );
  const today = data?.today || "";
  const stats = useMemo(() => {
    const joined = enquiries.filter((r) => r.status === "joined").length;
    const appliedWithoutRecord = enquiries.filter(
      (r) => (r.stage === "application" || r.stage === "joined") && !r.has_application,
    ).length;
    const follow = { overdue: 0, today: 0, upcoming: 0, unscheduled: 0, done: 0 };
    for (const row of enquiries) {
      const state = followUpState(row, today);
      if (state) follow[state] += 1;
      follow.done += row.followups_done;
    }
    return {
      total: enquiries.length,
      applications: applications.length + appliedWithoutRecord,
      inProgress: enquiries.filter((r) => ACTIVE.has(r.status)).length,
      joined,
      conversion: percentOf(joined, enquiries.length),
      follow,
    };
  }, [enquiries, applications, today]);

  const courseRows = useMemo(() => {
    const rows = new Map<string, { code: string; name: string; enquiries: number; applications: number; joined: number; followups: number }>();
    const entry = (code: string | null, name: string | null) => {
      const key = code || "none";
      if (!rows.has(key))
        rows.set(key, { code: key, name: name || "Course not chosen", enquiries: 0, applications: 0, joined: 0, followups: 0 });
      return rows.get(key)!;
    };
    for (const row of enquiries) {
      const item = entry(row.program_code, row.course_name);
      item.enquiries += 1;
      if ((row.stage === "application" || row.stage === "joined") && !row.has_application) item.applications += 1;
      if (row.status === "joined") item.joined += 1;
      const state = followUpState(row, today);
      if (state === "overdue" || state === "today") item.followups += 1;
    }
    for (const row of applications) entry(row.program_code, row.course_name).applications += 1;
    return [...rows.values()].sort((a, b) => b.enquiries - a.enquiries || a.name.localeCompare(b.name));
  }, [enquiries, applications, today]);

  // Admissions credited to each member of staff (the enquiry was entered by them or names them).
  const staffRows = useMemo(() => {
    const rows = new Map<string, { key: string; name: string; role: string; enquiries: number; applied: number; joined: number; courses: Map<string, number> }>();
    for (const row of enquiries) {
      if (!row.credited_to) continue;
      const key = row.credited_key || row.credited_to;
      if (!rows.has(key))
        rows.set(key, { key, name: row.credited_to, role: row.reference_label.replace(/ reference$/, ""), enquiries: 0, applied: 0, joined: 0, courses: new Map() });
      const item = rows.get(key)!;
      item.enquiries += 1;
      if (row.stage !== "enquiry") item.applied += 1;
      if (row.status === "joined") {
        item.joined += 1;
        const course = row.course_name || "Course not chosen";
        item.courses.set(course, (item.courses.get(course) || 0) + 1);
      }
    }
    return [...rows.values()].sort((a, b) => b.joined - a.joined || b.enquiries - a.enquiries || a.name.localeCompare(b.name));
  }, [enquiries]);
  const staffColumns = ["Staff member", "Role", "Enquiries", "Applied", "Admissions confirmed", "Conversion", "Admissions by course"];
  const staffExport = () =>
    staffRows.map((r) => [
      r.name, r.role, String(r.enquiries), String(r.applied), String(r.joined), `${percentOf(r.joined, r.enquiries)}%`,
      [...r.courses].map(([course, n]) => `${course} × ${n}`).join(", ") || "—",
    ]);

  const referenceCounts = useMemo(() => tally(enquiries, (r) => r.reference_type), [enquiries]);
  const levelCounts = useMemo(() => tally(enquiries, (r) => r.course_level || "Not set"), [enquiries]);
  const statusCounts = useMemo(() => tally(enquiries, (r) => r.status), [enquiries]);
  const followList = useMemo(
    () =>
      enquiries
        .filter((r) => r.visible && ["overdue", "today", "unscheduled"].includes(String(followUpState(r, today))))
        .sort((a, b) => dayOf(a.next_follow_up_at || "9999").localeCompare(dayOf(b.next_follow_up_at || "9999")))
        .slice(0, 5),
    [enquiries, today],
  );

  const applicationAsRow = (row: ApplicationRow): EnquiryRow => ({
    ...row,
    mine: false,
    reference_name: null,
    assigned_to: null,
    stage: "application",
    has_application: true,
    next_follow_up_at: null,
    followups_done: 0,
    recorded_at: row.applied_on,
  });
  const register = useMemo(() => {
    let rows: EnquiryRow[];
    if (view === "applications") rows = applications.map(applicationAsRow);
    else if (view === "admissions") rows = enquiries.filter((r) => r.status === "joined");
    else if (view === "followups") rows = enquiries.filter((r) => followUpState(r, today));
    else rows = enquiries;
    rows = rows.filter((r) => r.visible && (!mineOnly || r.mine));
    const text = query.trim().toLowerCase();
    if (text)
      rows = rows.filter((r) =>
        `${r.name} ${r.phone} ${r.course_name} ${r.reference_label} ${r.code}`.toLowerCase().includes(text),
      );
    if (sort) {
      const column = COLUMNS.find((c) => c.key === sort.key);
      if (column)
        rows = [...rows].sort((a, b) => column.value(a).localeCompare(column.value(b)) * (sort.down ? -1 : 1));
    }
    return rows;
  }, [view, enquiries, applications, today, mineOnly, query, sort]);
  const pages = Math.max(1, Math.ceil(register.length / PAGE));
  const shown = register.slice(page * PAGE, page * PAGE + PAGE);
  const hidden = enquiries.filter((r) => !r.visible).length;

  if (error && !data) return <LoadFailed message="Admission analytics could not be loaded." retry={load} />;
  if (!data)
    return (
      <div role="status" aria-label="Loading admission analytics…" className="anw-loading">
        <div className="anw-skeleton" />
        <div className="anw-skeleton" />
        <div className="anw-skeleton anw-skeleton-tall" />
      </div>
    );
  const courses = data.options.courses.filter((c) => !filters.level || c.level === filters.level);
  const levels = [...new Set(data.options.courses.map((c) => c.level).filter(Boolean))] as string[];
  const years = data.options.years.filter(
    (y) =>
      (!filters.course || y.program_code === filters.course) &&
      (!filters.level || data.options.courses.find((c) => c.code === y.program_code)?.level === filters.level),
  );
  const exportColumns = COLUMNS.map((c) => c.label);
  const exportRows = () => register.map((row) => COLUMNS.map((c) => c.value(row)));
  const exportName = `admission-${view}-${data.today}`;
  const statusKeys = [...statusCounts.keys()];
  const active = Object.values(filters).some(Boolean);
  return (
    <div className="anw">
      <header className="anw-head">
        <span className="anw-head-icon">
          <Users size={22} />
        </span>
        <div>
          <h2>Admission analytics</h2>
          <p>Enquiries, applications, conversions and course performance.</p>
        </div>
        {admissionsHref && (
          <Link className="anw-primary" href={`${admissionsHref}?new=1`}>
            <Plus size={15} /> New enquiry
          </Link>
        )}
      </header>
      <div className="anw-filters">
        <FilterSelect label="Course level" value={filters.level} onChange={(v) => set({ level: v })} all="All levels"
          options={levels.map((l) => ({ value: l, label: courseLevelLabel(l) }))} />
        <FilterSelect label="Course / branch" value={filters.course} onChange={(v) => set({ course: v })} all="All courses"
          options={courses.map((c) => ({ value: c.code, label: c.name }))} />
        <FilterSelect label="Academic year" value={filters.year} onChange={(v) => set({ year: v })} all="All years"
          options={years.map((y) => ({ value: y.code, label: y.name }))} />
        <FilterSelect label="Reference type" value={filters.reference} onChange={(v) => set({ reference: v })} all="All references"
          options={data.options.references.map((r) => ({ value: r.key, label: r.label }))} />
        <FilterSelect label="Admission stage" value={filters.stage} onChange={(v) => set({ stage: v })} all="All stages"
          options={[{ value: "enquiry", label: "Enquiry" }, { value: "application", label: "Application" }, { value: "joined", label: "Joined" }]} />
        <FilterDate label="From" value={filters.from} onChange={(v) => set({ from: v })} />
        <FilterDate label="To" value={filters.to} onChange={(v) => set({ to: v })} />
        <button className="anw-reset" disabled={!active} onClick={() => { setFilters(NO_FILTERS); setPage(0); }}>
          Reset
        </button>
      </div>
      <div className="anw-stats">
        <Stat icon={Users} label="Total enquiries" value={stats.total} />
        <Stat icon={ClipboardList} label="Applications" value={stats.applications} />
        <Stat icon={CalendarClock} label="In progress" value={stats.inProgress} />
        <Stat icon={UserCheck} label="Joined" value={stats.joined} />
        <Stat icon={Percent} label="Conversion rate" value={`${stats.conversion}%`} />
        <Stat icon={GraduationCap} label="Follow-ups due" value={stats.follow.overdue + stats.follow.today}
          tone={stats.follow.overdue ? "warn" : undefined} hint={stats.follow.overdue ? `${stats.follow.overdue} overdue` : undefined} />
      </div>
      <div className="anw-grid anw-grid-3">
        <Panel title="Enquiries by reference">
          <Donut title="Enquiries by reference" centre={String(stats.total)} centreLabel="Enquiries" selected={filters.reference}
            onSelect={(key) => toggle("reference", key)}
            slices={data.options.references.map((r) => ({ key: r.key, label: r.label, value: referenceCounts.get(r.key) || 0 }))} />
        </Panel>
        <Panel title="Course level split">
          {stats.total ? (
            <BarList selected={filters.level} onSelect={(key) => key !== "Not set" && toggle("level", key)}
              items={[...levelCounts.entries()].map(([key, value]) => ({
                key,
                label: key === "Not set" ? key : courseLevelLabel(key),
                value,
                display: `${value} · ${percentOf(value, stats.total)}%`,
              }))} />
          ) : <Empty>No enquiries match these filters.</Empty>}
        </Panel>
        <Panel title="Enquiry status">
          {stats.total ? (
            <Donut title="Enquiry status" centre={String(stats.total)} centreLabel="Total" selected={filters.status}
              onSelect={(key) => toggle("status", key)}
              slices={statusKeys.map((key) => ({ key, label: nice(key), value: statusCounts.get(key) || 0 }))} />
          ) : <Empty>No enquiries match these filters.</Empty>}
        </Panel>
      </div>
      <div className="anw-grid anw-grid-2">
        <Panel title="Follow-up intelligence">
          <div className="anw-mini-stats">
            {([["Overdue", stats.follow.overdue], ["Due today", stats.follow.today], ["Upcoming", stats.follow.upcoming],
              ["Not scheduled", stats.follow.unscheduled], ["Completed", stats.follow.done]] as const).map(([label, value]) => (
              <div key={label}><strong>{value}</strong><small>{label}</small></div>
            ))}
          </div>
          {followList.length ? (
            <ul className="anw-list">
              {followList.map((row) => (
                <li key={row.key}>
                  <div>
                    <strong>{row.name}</strong>
                    <small>{row.phone} · {row.course_name || "Course not chosen"} · {row.reference_label}{row.assigned_to ? ` · ${row.assigned_to}` : ""}</small>
                  </div>
                  <span className={`anw-tag is-${followUpState(row, today)}`}>
                    {row.next_follow_up_at ? shortDate(row.next_follow_up_at) : "Not scheduled"}
                  </span>
                  <button aria-label={`View ${row.name}`} onClick={() => setDetail(row)}><Eye size={15} /></button>
                </li>
              ))}
            </ul>
          ) : <Empty>Nothing needs a follow-up right now.</Empty>}
        </Panel>
        <Panel title="Course / branch performance"
          action={courseRows.length > 5 ? <button className="anw-link" onClick={() => setAllCourses(!allCourses)}>{allCourses ? "Show top 5" : `Show all ${courseRows.length}`}</button> : undefined}>
          {courseRows.length ? (
            <div className="anw-table">
              <table>
                <thead><tr><th>Course</th><th>Enquiries</th><th>Applications</th><th>Joined</th><th>Conversion</th><th>Follow-ups due</th></tr></thead>
                <tbody>
                  {(allCourses ? courseRows : courseRows.slice(0, 5)).map((row) => (
                    <tr key={row.code}>
                      <td>
                        {row.code === "none" ? row.name : (
                          <button className="anw-link" onClick={() => toggle("course", row.code)}>{row.name}</button>
                        )}
                      </td>
                      <td>{row.enquiries}</td><td>{row.applications}</td><td>{row.joined}</td>
                      <td>{percentOf(row.joined, row.enquiries)}%</td><td>{row.followups}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty>No courses match these filters.</Empty>}
        </Panel>
      </div>
      <Panel
        title="Staff referrals & incentives"
        action={
          staffRows.length ? (
            <span className="anw-actions">
              <button type="button" className="anw-link" onClick={() => excelTable("staff-referrals", "Staff referrals", staffColumns, staffExport())}>
                <Download size={14} /> Excel
              </button>
              <PDFActions
                viewLabel="View PDF"
                onAction={(mode) =>
                  pdfTable("staff-referrals", "Staff referrals & incentives", `${staffRows.length} staff · ${stats.total} enquiries`, staffColumns, staffExport(), mode).catch((e) =>
                    toast.error("Could not create the PDF", errorText(e)),
                  )
                }
              >
                <FileText size={14} /> PDF
              </PDFActions>
            </span>
          ) : undefined
        }
      >
        {staffRows.length ? (
          <div className="anw-table">
            <table>
              <thead>
                <tr>{staffColumns.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {staffRows.map((r) => (
                  <tr key={r.key}>
                    <td><strong>{r.name}</strong></td>
                    <td>{r.role}</td>
                    <td>{r.enquiries}</td>
                    <td>{r.applied}</td>
                    <td><strong>{r.joined}</strong></td>
                    <td>{percentOf(r.joined, r.enquiries)}%</td>
                    <td>{[...r.courses].map(([course, n]) => `${course} × ${n}`).join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No enquiries credited to staff yet. Enquiries entered by an admin, teacher or staff member are credited to them.</Empty>
        )}
      </Panel>
      <section className="anw-panel anw-register">
        <div className="anw-register-bar">
          <div className="anw-chips" role="group" aria-label="Which records">
            {([["enquiries", "Enquiries", enquiries.length], ["applications", "Applications", applications.length],
              ["admissions", "Admissions", stats.joined], ["followups", "Follow-ups", stats.inProgress]] as const).map(([key, label, count]) => (
              <button key={key} aria-pressed={view === key} onClick={() => { setView(key); setPage(0); }}>
                {label} ({count})
              </button>
            ))}
          </div>
          <label className="anw-check">
            <input type="checkbox" checked={mineOnly} onChange={(e) => { setMineOnly(e.target.checked); setPage(0); }} /> Only mine
          </label>
          <label className="anw-search">
            <Search size={15} />
            <input aria-label="Search records" name="admission-search" autoComplete="off" value={query}
              placeholder="Search by name, phone, course…" onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
          </label>
          <button className="anw-export" disabled={!register.length}
            onClick={() => excelTable(exportName, "Admission register", exportColumns, exportRows())}>
            <Download size={14} /> Excel
          </button>
          <PDFActions viewLabel="View PDF" className="anw-export"
            onAction={(mode) => pdfTable(exportName, "Admission register", `${register.length} records`, exportColumns, exportRows(), mode).catch((e) => toast.error("Could not create the PDF", errorText(e)))}>
            <FileText size={14} /> PDF
          </PDFActions>
        </div>
        {hidden > 0 && (
          <p className="anw-note">
            {hidden} {hidden === 1 ? "record is" : "records are"} counted above without personal details, because your role shows only your own admissions.
          </p>
        )}
        {shown.length ? (
          <>
            <div className="anw-table">
              <table>
                <thead>
                  <tr>
                    {COLUMNS.map((column) => (
                      <th key={column.key} aria-sort={sort?.key === column.key ? (sort.down ? "descending" : "ascending") : "none"}>
                        <button onClick={() => setSort({ key: column.key, down: sort?.key === column.key ? !sort.down : false })}>
                          {column.label}
                          {sort?.key === column.key && (sort.down ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
                        </button>
                      </th>
                    ))}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => (
                    <tr key={row.key}>
                      {COLUMNS.map((column) => <td key={column.key}>{column.value(row)}</td>)}
                      <td><button className="anw-icon" aria-label={`View ${row.name}`} onClick={() => setDetail(row)}><Eye size={15} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="anw-pager">
              <span>Showing {page * PAGE + 1}–{Math.min(register.length, (page + 1) * PAGE)} of {register.length}</span>
              <div>
                <button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                <span>Page {page + 1} of {pages}</span>
                <button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            </footer>
          </>
        ) : <Empty>No records match this view.</Empty>}
      </section>
      {detail && (
        <SideDrawer title={detail.name || "Admission record"} subtitle={detail.code || undefined} onClose={() => setDetail(null)}>
          <dl className="anw-details">
            {Object.entries({
              Phone: detail.phone, "Course level": detail.course_level ? courseLevelLabel(detail.course_level) : null,
              "Course / branch": detail.course_name, "Academic year": detail.academic_year, Reference: detail.reference_label,
              "Referred by": detail.reference_name, Status: nice(detail.status), Stage: nice(detail.stage),
              "Next follow-up": shortDate(detail.next_follow_up_at), "Follow-ups completed": String(detail.followups_done),
              "Assigned to": detail.assigned_to,
            }).map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>
            ))}
          </dl>
          {admissionsHref && <Link className="anw-primary" href={admissionsHref}>Open in Admissions</Link>}
        </SideDrawer>
      )}
    </div>
  );
}
