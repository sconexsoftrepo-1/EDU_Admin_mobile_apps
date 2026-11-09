"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Briefcase,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileCheck,
  GraduationCap,
  Layers,
  Receipt,
  RefreshCw,
  Users,
  Wallet,
  type LucideProps,
} from "lucide-react";
import { money } from "@/data/colleges";
import {
  api,
  errorText,
  type DashboardMetric,
  type DashboardOverviewData,
  type DashboardSections,
  type SectionError,
} from "@/services/api";
import "./dashboard-overview.css";
import { formatDate } from "@/lib/colleges/dates";

const DashboardFeeChart = dynamic(() => import("./DashboardFeeChart"), {
  ssr: false,
  loading: () => <div className="dov-skeleton dov-chart-skeleton" />,
});

/** One request per sign-in for the page and the header; a retry replaces it. */
const pending = new Map<string, Promise<DashboardOverviewData>>();
function fetchOverview(key: string, fresh = false) {
  if (fresh) pending.delete(key);
  let request = pending.get(key);
  if (!request) {
    request = api.dashboard.overview();
    pending.set(key, request);
    request.catch(() => pending.delete(key));
  }
  return request;
}

export function useDashboardOverview(key?: string) {
  const cacheKey = key || "current";
  const [data, setData] = useState<DashboardOverviewData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(
    (fresh = false) => {
      setLoading(true);
      setError("");
      return fetchOverview(cacheKey, fresh)
        .then(setData)
        .catch((e) => setError(errorText(e)))
        .finally(() => setLoading(false));
    },
    [cacheKey],
  );
  useEffect(() => {
    let active = true;
    fetchOverview(cacheKey)
      .then((value) => active && setData(value))
      .catch((e) => active && setError(errorText(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [cacheKey]);
  return { data, error, loading, retry: () => load(true) };
}

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

export function greetingFor(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Welcome back";
}

/** What each role cares about first. Sections the role may not read are simply absent. */
type RoleView = { line: string; metrics: string[] };
const DEFAULT_VIEW: RoleView = {
  line: "Here's what's happening across your campus today.",
  metrics: ["students", "enquiries", "fee_collection", "outstanding_fees"],
};
const ROLE_VIEWS: Record<string, RoleView> = {
  Principal: {
    line: "Here's your institution's academic and operational overview.",
    metrics: ["students", "departments", "faculty", "attendance"],
  },
  "Accounts Manager": {
    line: "Track collections, outstanding fees and financial activity.",
    metrics: ["fee_collection", "outstanding_fees", "today_collection", "expenses"],
  },
  "Admission Officer": {
    line: "Follow every enquiry from first contact to joining.",
    metrics: ["enquiries", "applied", "joined", "conversion"],
  },
  "HR Manager": {
    line: "Staffing, leave and payroll at a glance.",
    metrics: ["employees", "faculty", "non_teaching", "staff_leave"],
  },
  "Payroll Officer": {
    line: "Payroll runs, payslips and pending staff actions.",
    metrics: ["employees", "payroll_pending", "staff_leave", "faculty"],
  },
  "Certificate Officer": {
    line: "Certificate requests waiting for your action.",
    metrics: ["certificates", "students", "enrolled", "student_leave"],
  },
  "Hostel Warden": {
    line: "Hostel occupancy and student requests.",
    metrics: ["hostel", "students", "student_leave", "enrolled"],
  },
  "Demo Academic Administrator": {
    line: "Courses, batches, results and attendance in one place.",
    metrics: ["courses", "batches", "students", "attendance"],
  },
};
const TEACHING_VIEW: RoleView = {
  line: "Here's your teaching schedule and student progress.",
  metrics: ["assigned_classes", "sections", "backlogs", "batches"],
};

const METRIC_ICONS: Record<string, ComponentType<LucideProps>> = {
  students: Users,
  enrolled: Users,
  enquiries: GraduationCap,
  applied: ClipboardList,
  joined: GraduationCap,
  in_progress: ClipboardList,
  conversion: Layers,
  fee_collection: Wallet,
  today_collection: Wallet,
  month_collection: Wallet,
  outstanding_fees: Receipt,
  expenses: Receipt,
  attendance: CalendarDays,
  departments: Layers,
  courses: BookOpen,
  batches: Layers,
  backlogs: BookOpen,
  employees: Briefcase,
  faculty: GraduationCap,
  non_teaching: Briefcase,
  staff_leave: CalendarDays,
  student_leave: CalendarDays,
  certificates: FileCheck,
  payroll_pending: Wallet,
  hostel: Layers,
  assigned_classes: BookOpen,
  sections: Layers,
};

const failed = (section: unknown): section is SectionError =>
  Boolean((section as SectionError | undefined)?.error);
function ok<T>(section: T | SectionError | undefined) {
  return section && !failed(section) ? (section as T) : undefined;
}
function allMetrics(sections: DashboardSections) {
  const merged: Record<string, DashboardMetric> = {};
  for (const section of Object.values(sections)) {
    const metrics = (section as { metrics?: Record<string, DashboardMetric> })
      ?.metrics;
    if (metrics) Object.assign(merged, metrics);
  }
  return merged;
}
function metricText(metric: DashboardMetric) {
  if (metric.value === null || metric.value === undefined) return "—";
  // The API sends rupees; money() takes paise.
  if (metric.kind === "money") return money(Number(metric.value) * 100);
  if (metric.kind === "percent") return `${+Number(metric.value).toFixed(1)}%`;
  return Number(metric.value).toLocaleString("en-IN");
}

export type DashboardAction = {
  key: string;
  label: string;
  icon: ComponentType<LucideProps>;
  href?: string;
  onClick?: () => void;
};

type Props = {
  campusName: string;
  roleName: string;
  session?: string;
  teaching?: boolean;
  campusImage: string;
  /** Link for a module this role can open; undefined hides the link. */
  moduleHref: (module: string) => string | undefined;
  actions: DashboardAction[];
};

function Card({
  title,
  action,
  className = "",
  children,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`dov-card ${className}`}>
      <header className="dov-card-head">
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}
const HeadLink = ({ href, label }: { href?: string; label: string }) =>
  href ? (
    <Link href={href} className="dov-head-link" aria-label={label}>
      <ArrowRight size={16} />
    </Link>
  ) : null;
const Empty = ({ children }: { children: ReactNode }) => (
  <p className="dov-empty">{children}</p>
);
const SectionFailed = ({ retry }: { retry: () => void }) => (
  <div className="dov-failed" role="alert">
    <p>This section could not be loaded.</p>
    <button onClick={retry}>
      <RefreshCw size={13} /> Try again
    </button>
  </div>
);

function Banner({
  name,
  line,
  campusName,
  session,
  image,
}: {
  name?: string;
  line: string;
  campusName: string;
  session?: string;
  image: string;
}) {
  // The clock is read in the browser so the greeting follows the viewer's own time zone.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setNow(new Date()), 0);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <section
      className="dov-banner"
      style={{ backgroundImage: `url(${image})` }}
      aria-label="Welcome"
    >
      <div className="dov-banner-text">
        <p>{now ? `${greetingFor(now.getHours())},` : " "}</p>
        <h1>
          {name ? (
            `Welcome back, ${name}!`
          ) : (
            <span className="dov-skeleton dov-name-skeleton" />
          )}
        </h1>
        <span>{line.replace("your campus", campusName)}</span>
      </div>
      <div className="dov-date">
        <small>
          {now?.toLocaleDateString("en-IN", { weekday: "long" }) || " "}
        </small>
        <strong>
          {now ? formatDate(now) : " "}
        </strong>
        <small>Academic session</small>
        <b>{session?.replace("-", " – ") || " "}</b>
      </div>
    </section>
  );
}

function Kpi({
  id,
  metric,
  href,
}: {
  id: string;
  metric: DashboardMetric;
  href?: string;
}) {
  const Icon = METRIC_ICONS[id] || Layers;
  const body = (
    <>
      <span className="dov-kpi-icon">
        <Icon size={20} />
      </span>
      <span className="dov-kpi-text">
        <small>{metric.label}</small>
        <strong>{metricText(metric)}</strong>
        <em>{metric.hint}</em>
      </span>
      {metric.trend !== null && metric.trend !== undefined && (
        <span
          className={`dov-trend ${metric.trend < 0 ? "is-down" : "is-up"}`}
          aria-label={`${metric.trend < 0 ? "Down" : "Up"} ${Math.abs(metric.trend)} percent`}
        >
          {metric.trend < 0 ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
          {Math.abs(metric.trend)}%
        </span>
      )}
    </>
  );
  return href ? (
    <Link className="dov-kpi" href={href}>
      {body}
    </Link>
  ) : (
    <div className="dov-kpi">{body}</div>
  );
}

const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
function sessionOf(month: string) {
  const [year, m] = month.split("-").map(Number);
  const start = m >= 4 ? year : year - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}
function FeeCard({
  monthly,
  current,
  href,
}: {
  monthly: { month: string; collected: number; outstanding: number }[];
  current: string;
  href?: string;
}) {
  const sessions = useMemo(
    () =>
      Array.from(new Set([current, ...monthly.map((m) => sessionOf(m.month))]))
        .sort()
        .reverse(),
    [monthly, current],
  );
  const [session, setSession] = useState(current);
  const [show, setShow] = useState({ collected: true, outstanding: true });
  const rows = useMemo(() => {
    const start = Number(session.slice(0, 4));
    const inSession = MONTHS.map((name, index) => {
      const number = index + 4 > 12 ? index - 8 : index + 4;
      const year = index + 4 > 12 ? start + 1 : start;
      const key = `${year}-${String(number).padStart(2, "0")}`;
      const row = monthly.find((m) => m.month === key);
      return {
        name,
        collected: row?.collected || 0,
        outstanding: row?.outstanding || 0,
      };
    });
    return inSession;
  }, [monthly, session]);
  const hasData = rows.some((r) => r.collected || r.outstanding);
  return (
    <Card
      title="Fee collection (monthly)"
      className="dov-fee"
      action={
        <div className="dov-head-actions">
          <select
            aria-label="Academic session"
            value={session}
            onChange={(e) => setSession(e.target.value)}
          >
            {sessions.map((s) => (
              <option key={s} value={s}>
                {s.replace("-", " – ")}
              </option>
            ))}
          </select>
          <HeadLink href={href} label="Open payments" />
        </div>
      }
    >
      <div className="dov-legend" role="group" aria-label="Show or hide series">
        {(
          [
            ["collected", "Collected"],
            ["outstanding", "Outstanding"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={show[key]}
            onClick={() => setShow({ ...show, [key]: !show[key] })}
          >
            <i className={`is-${key}`} /> {label}
          </button>
        ))}
      </div>
      {hasData ? (
        <div
          className="dov-chart"
          role="img"
          aria-label={`Monthly fee collection for ${session}`}
        >
          <DashboardFeeChart rows={rows} show={show} />
        </div>
      ) : (
        <Empty>No fee transactions found for {session.replace("-", " – ")}.</Empty>
      )}
    </Card>
  );
}

function AcademicCard({
  data,
  href,
}: {
  data: NonNullable<Extract<DashboardSections["academics"], { percentage: unknown }>>;
  href?: string;
}) {
  const value = data.percentage;
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  return (
    <Card
      title="Academic progress"
      className="dov-academic"
      action={<HeadLink href={href} label="Open academics" />}
    >
      <div className="dov-academic-body">
        <div className="dov-ring">
          <svg viewBox="0 0 108 108" aria-hidden="true">
            <circle cx="54" cy="54" r={radius} className="dov-ring-track" />
            <circle
              cx="54"
              cy="54"
              r={radius}
              className="dov-ring-value"
              strokeDasharray={`${(circumference * (value || 0)) / 100} ${circumference}`}
              transform="rotate(-90 54 54)"
            />
          </svg>
          <div>
            <strong>{value === null ? "—" : `${+value.toFixed(1)}%`}</strong>
            <small>Average in published results</small>
          </div>
        </div>
        <ul className="dov-stat-list">
          {(
            [
              [GraduationCap, data.students, "Students"],
              [Layers, data.backlog_students, "With backlogs"],
              [BookOpen, data.all_clear, "All-clear semesters"],
            ] as const
          ).map(([Icon, count, label]) => (
            <li key={label}>
              <Icon size={17} />
              <strong>{count}</strong>
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function ActivityCard({
  items,
  href,
}: {
  items: { code: string; title: string; starts_at: string; detail: string | null }[];
  href?: string;
}) {
  return (
    <Card
      title="Campus activity"
      className="dov-activity"
      action={<HeadLink href={href} label="Open calendar" />}
    >
      {items.length ? (
        <ul className="dov-events">
          {items.map((item) => {
            const date = new Date(item.starts_at);
            const inner = (
              <>
                <span className="dov-event-date">
                  <small>
                    {date.toLocaleDateString("en-IN", { month: "short" })}
                  </small>
                  <b>{date.toLocaleDateString("en-IN", { day: "2-digit" })}</b>
                </span>
                <span className="dov-event-text">
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </span>
                {href && <ChevronRight size={15} />}
              </>
            );
            return (
              <li key={item.code}>
                {href ? <Link href={href}>{inner}</Link> : <div>{inner}</div>}
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>No campus activities scheduled.</Empty>
      )}
    </Card>
  );
}

const statusText = (status: string) =>
  status.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase());
function RecentAdmissions({
  rows,
  href,
}: {
  rows: Extract<DashboardSections["admissions"], { recent: unknown }>["recent"];
  href?: string;
}) {
  return (
    <Card
      title="Recent admissions"
      className="dov-recent"
      action={
        href ? (
          <Link className="dov-view-all" href={href}>
            View all
          </Link>
        ) : undefined
      }
    >
      {rows.length ? (
        <ul className="dov-people">
          {rows.slice(0, 5).map((row) => {
            const inner = (
              <>
                <span className="dov-avatar">{initialsOf(row.name)}</span>
                <span className="dov-person">
                  <strong>{row.name}</strong>
                  <small>{row.course_name || "Course not chosen"}</small>
                </span>
                <span className={`dov-status is-${row.status}`}>
                  {statusText(row.status)}
                </span>
              </>
            );
            return (
              <li key={row.code}>
                {/* Opens this exact enquiry's details, not just the register. */}
                {href ? (
                  <Link
                    className="dov-person-link"
                    href={`${href}?enquiry=${encodeURIComponent(row.code)}`}
                    aria-label={`View enquiry of ${row.name}`}
                  >
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>No admissions recorded yet.</Empty>
      )}
    </Card>
  );
}

function QuickActions({ actions }: { actions: DashboardAction[] }) {
  return (
    <Card title="Quick actions" className="dov-actions">
      <div className="dov-action-grid">
        {actions.map(({ key, label, icon: Icon, href, onClick }) =>
          href ? (
            <Link key={key} href={href}>
              <Icon size={22} />
              <span>{label}</span>
            </Link>
          ) : (
            <button key={key} onClick={onClick}>
              <Icon size={22} />
              <span>{label}</span>
            </button>
          ),
        )}
      </div>
    </Card>
  );
}

const FUNNEL_COLOURS = ["#8a5520", "#a56824", "#c99448", "#e0bb82", "#f0d8b4"];
function Funnel({
  stages,
}: {
  stages: { name: string; count: number; percentage: number }[];
}) {
  const hasData = stages[0]?.count > 0;
  return (
    <Card title="Admission funnel" className="dov-funnel">
      {hasData ? (
        <div className="dov-funnel-body">
          <div className="dov-funnel-shape" aria-hidden="true">
            {stages.map((stage, index) => {
              // A fixed taper keeps the shape readable even when the counts are very small.
              const top = 100 - index * (72 / stages.length);
              const bottom = 100 - (index + 1) * (72 / stages.length);
              const inset = (100 - top) / 2;
              const insetBottom = (100 - bottom) / 2;
              return (
                <i
                  key={stage.name}
                  style={{
                    background: FUNNEL_COLOURS[index % FUNNEL_COLOURS.length],
                    clipPath: `polygon(${inset}% 0, ${100 - inset}% 0, ${100 - insetBottom}% 100%, ${insetBottom}% 100%)`,
                  }}
                />
              );
            })}
          </div>
          <ul className="dov-funnel-list">
            {stages.map((stage, index) => (
              <li key={stage.name}>
                <i
                  style={{
                    background: FUNNEL_COLOURS[index % FUNNEL_COLOURS.length],
                  }}
                />
                <span>{stage.name}</span>
                <small>{stage.percentage}%</small>
                <strong>{stage.count}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <Empty>No enquiries yet, so the funnel is empty.</Empty>
      )}
    </Card>
  );
}

function CoursePerformance({
  courses,
}: {
  courses: { name: string; percentage: number }[];
}) {
  return (
    <Card title="Course performance" className="dov-courses">
      {courses.length ? (
        <ul className="dov-bars">
          {courses.map((course) => (
            <li key={course.name}>
              <span>{course.name}</span>
              <b>{+course.percentage.toFixed(1)}%</b>
              <i>
                <em style={{ width: `${Math.min(100, course.percentage)}%` }} />
              </i>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No published results yet.</Empty>
      )}
    </Card>
  );
}

function TodayClasses({
  classes,
}: {
  classes: { code: string; subject_name: string; start_time: string; end_time: string; state: string; period: number }[];
}) {
  return (
    <Card title="Today's classes" className="dov-classes">
      {classes.length ? (
        <ul className="dov-people">
          {classes.map((row) => (
            <li key={row.code}>
              <span className="dov-avatar">P{row.period}</span>
              <span className="dov-person">
                <strong>{row.subject_name}</strong>
                <small>
                  {row.start_time} – {row.end_time}
                </small>
              </span>
              <span className={`dov-status is-${row.state}`}>
                {statusText(row.state)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No classes scheduled for you today.</Empty>
      )}
    </Card>
  );
}

function Skeleton() {
  return (
    <div className="dov-loading" aria-label="Loading dashboard" role="status">
      <div className="dov-kpis">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dov-skeleton dov-kpi-skeleton" />
        ))}
      </div>
      <div className="dov-row">
        <div className="dov-skeleton dov-panel-skeleton" style={{ flexGrow: 40 }} />
        <div className="dov-skeleton dov-panel-skeleton" style={{ flexGrow: 35 }} />
        <div className="dov-skeleton dov-panel-skeleton" style={{ flexGrow: 25 }} />
      </div>
    </div>
  );
}

export default function DashboardOverview({
  campusName,
  roleName,
  session,
  teaching = false,
  campusImage,
  moduleHref,
  actions,
}: Props) {
  const { data, error, loading, retry } = useDashboardOverview(session);
  const view = teaching ? TEACHING_VIEW : ROLE_VIEWS[roleName] || DEFAULT_VIEW;
  const sections: DashboardSections = data?.sections || {};
  const metrics = allMetrics(sections);
  // Fill up to four cards so a role with few permissions still gets an even row.
  const chosen = view.metrics.filter((key) => metrics[key]);
  const kpis = [
    ...chosen,
    ...Object.keys(metrics).filter((key) => !chosen.includes(key)),
  ].slice(0, 4);
  const finance = ok(sections.finance);
  const admissions = ok(sections.admissions);
  const academics = ok(sections.academics);
  const activity = ok(sections.activity);
  const brokenCount = Object.values(sections).filter(failed).length;
  return (
    <div className="dov">
      <Banner
        name={data?.viewer?.name}
        line={view.line}
        campusName={campusName}
        session={data?.academic_session}
        image={campusImage}
      />
      {loading && !data && <Skeleton />}
      {error && !data && (
        <section className="dov-card">
          <SectionFailed retry={retry} />
        </section>
      )}
      {data && (
        <>
          {kpis.length > 0 && (
            <div className="dov-kpis" data-count={kpis.length}>
              {kpis.map((key) => (
                <Kpi
                  key={key}
                  id={key}
                  metric={metrics[key]}
                  href={
                    metrics[key].module
                      ? moduleHref(metrics[key].module!)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
          {brokenCount > 0 && (
            <section className="dov-card dov-partial">
              <SectionFailed retry={retry} />
            </section>
          )}
          {(finance || academics || activity) && (
            <div className="dov-row">
              {finance && (
                <FeeCard
                  monthly={finance.monthly}
                  current={data.academic_session}
                  href={moduleHref("payments")}
                />
              )}
              {academics && (
                <AcademicCard data={academics} href={moduleHref("academics")} />
              )}
              {activity && (
                <ActivityCard
                  items={activity.items}
                  href={moduleHref("calendar")}
                />
              )}
            </div>
          )}
          {(admissions || actions.length > 0 || academics) && (
            <div className="dov-row">
              {teaching && academics && (
                <TodayClasses classes={academics.today_classes} />
              )}
              {admissions && (
                <RecentAdmissions
                  rows={admissions.recent}
                  href={moduleHref("admissions")}
                />
              )}
              {actions.length > 0 && <QuickActions actions={actions} />}
              {admissions ? (
                <Funnel stages={admissions.funnel} />
              ) : (
                academics && <CoursePerformance courses={academics.courses} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Secondary dashboards live behind tabs so the home screen stays short. */
export function DashboardTabs({
  tabs,
  action,
}: {
  tabs: { key: string; label: string; content: ReactNode }[];
  action?: ReactNode;
}) {
  const [active, setActive] = useState(tabs[0]?.key);
  const current = tabs.find((tab) => tab.key === active) || tabs[0];
  if (!current) return null;
  return (
    <section className="dov-more">
      <div className="dov-tabs" role="tablist" aria-label="More dashboards">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={tab.key === current.key}
            onClick={() => setActive(tab.key)}
          >
            {tab.label}
          </button>
        ))}
        {action && <div className="dov-tabs-action">{action}</div>}
      </div>
      <div role="tabpanel">{current.content}</div>
    </section>
  );
}
