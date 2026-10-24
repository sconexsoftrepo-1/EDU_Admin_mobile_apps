"use client";
import { api, errorText } from "@/services/api";
import { toast } from "./toast";
import PortalShellSkeleton from "./PortalShellSkeleton";
import RolesAccess from "./RolesAccess";
import ConnectedPortal from "./ConnectedPortal";
import FloatingMobileApps from "./FloatingMobileApps";
import PDFActions from "./PDFActions";
import OperationsWorkspace, { OperationsSummary } from "./OperationsWorkspace";
import { operationLabels, visibleNotices } from "@/lib/colleges/operations";
import RoleWorkspace from "./RoleWorkspace";
import FeeStructures from "./FeeStructures";
import FeeStructureManager from "./FeeStructureManager";
import StudentFeeSchedule from "./StudentFeeSchedule";
import ERPFormFields, { type FormField } from "./ERPFormFields";
import {
  receiptReport,
  certificateReport,
  admissionReport,
  ledgerReport,
  financialRecordReport,
  tableReport,
} from "@/lib/colleges/reports";
import ERPActionDrawer, { type DrawerAction } from "./ERPActionDrawer";
import dynamic from "next/dynamic";
const ERPAnalytics = dynamic(() => import("./ERPAnalytics"), {
  loading: () => (
    <section className="erp-panel">Loading collection analytics…</section>
  ),
});
const ERPInsights = dynamic(() => import("./ERPInsights"), {
  loading: () => (
    <section className="erp-panel">Loading campus insights…</section>
  ),
});
import {
  WorkspaceNavigation,
  WorkspaceSearch,
  NotificationCenter,
} from "./ERPWorkspaceTools";
import {
  useState,
  useRef,
  useEffect,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ArrowLeft,
  Users,
  GraduationCap,
  Wallet,
  CreditCard,
  Receipt,
  BookOpen,
  Building2,
  Bell,
  BarChart3,
  Shield,
  Settings,
  LogOut,
  Menu,
  X,
  Plus,
  Download,
  Search,
  Eye,
  EyeOff,
  Check,
  ChevronDown,
  Printer,
  FileCheck,
  Briefcase,
  ArrowRight,
} from "lucide-react";
import {
  collegeRoot,
  roles,
  roleHome,
  permissions,
  money,
  type College,
  type Role,
} from "@/data/colleges";
import { useCollege } from "./CollegeStore";
import {
  balance,
  paid,
  canRead,
  type RecordRow,
  type Student,
} from "@/lib/colleges/store";
import { csv, professionalPdf } from "@/lib/colleges/download";
import ERPTable, { type TableRecord } from "./ERPTable";
import DateInput from "./DateInput";
import IconAction from "./IconAction";
type Field = FormField;
const entryScreens = [
  "student-enrollment",
  "parent-enrollment",
  "admission-forms",
  "teaching-staff",
  "non-teaching-staff",
  "daily-labour",
  "course-setup",
  "course-enrollment",
];
const labels: Record<string, string> = {
  ...operationLabels,
  dashboard: "Dashboard",
  students: "Students",
  admissions: "Admissions",
  fees: "Fees & Finance",
  "fee-structures": "Fee structures",
  payments: "Payments",
  receipts: "Receipts",
  cashbook: "Cashbook",
  expenses: "Expenses",
  invoices: "Invoices",
  scholarships: "Scholarships",
  certificates: "Certificates",
  "certificate-requests": "Certificate requests",
  hostels: "Hostel management",
  "hostel-permissions": "Hostel permissions",
  academics: "Academics",
  staff: "Faculty & staff",
  notifications: "Notifications",
  reports: "Reports & analytics",
  "audit-logs": "Audit logs",
  roles: "Roles & access",
  "student-enrollment": "Student enrollment",
  "course-setup": "Courses & enrollment",
  "teaching-staff": "Teaching staff",
  "non-teaching-staff": "Non-teaching staff",
  "daily-labour": "Daily labour",
  settings: "Settings",
  forms: "Form builder",
  imports: "Excel imports",
  documents: "Documents",
};
const cols = (...names: string[]) =>
  names.map((key) => ({
    key,
    label:
      key === "studentId"
        ? "Student"
        : key.replace(/([A-Z])/g, " $1").replace(/^./, (x) => x.toUpperCase()),
    ...(key === "amount"
      ? { render: (r: TableRecord) => money(Number(r.amount || 0)) }
      : {}),
  }));
const toRows = (r: object[]) => r as TableRecord[];
export default function CollegePortal({
  college: c,
  parts,
}: {
  college: College;
  parts: string[];
}) {
  const {
      state: s,
      ready,
      role,
      login,
      logout,
      run,
      reset,
      message,
      clear,
      account,
      roleName,
      workspaceArea,
      sessionError,
      modules,
    } = useCollege(),
    router = useRouter(),
    root = collegeRoot(c);
  const [apiOpen, setApiOpen] = useState(false);
  const [feeStructureId, setFeeStructureId] = useState<string | null>(null);
  const [manageModule, setManageModule] = useState<string | null>(null);
  useEffect(() => {
    const show = (event: Event) => {
      const command = (event as CustomEvent).detail?.type || "";
      const target = command.startsWith("payment")
        ? "payments"
        : command.startsWith("certificate")
          ? "certificates"
          : command.startsWith("admission")
            ? "admissions"
            : command.startsWith("student")
              ? "students"
              : command.startsWith("room")
                ? "hostels"
                : command.startsWith("leave")
                  ? "hostel-permissions"
                  : null;
      setManageModule(
        command.startsWith("structure") ? "fee-structures" : target,
      );
      setFeeStructureId(
        command.startsWith("structure")
          ? (event as CustomEvent).detail?.id || null
          : null,
      );
      setApiOpen(true);
    };
    window.addEventListener("edunexa:manage-records", show);
    return () => window.removeEventListener("edunexa:manage-records", show);
  }, []);
  const [selectedRole, setSelectedRole] = useState<Role>("Super Admin"),
    [showPassword, setShowPassword] = useState(false),
    [formBusy, setFormBusy] = useState(false),
    [open, setOpen] = useState(false),
    [filtersOpen, setFiltersOpen] = useState(false),
    [compact, setCompact] = useState(true),
    [year, setYear] = useState("all"),
    [department, setDepartment] = useState("all"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [profileTab, setProfileTab] = useState("Overview"),
    [admissionSource, setAdmissionSource] = useState(""),
    [admissionStatus, setAdmissionStatus] = useState(""),
    [selectedRoom, setSelectedRoom] = useState(""),
    [certificateStatus, setCertificateStatus] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    [modal, setModal] = useState<{
      title: string;
      type: string;
      id?: string;
      fields: Field[];
    } | null>(null);
  const area = parts[1] || "admin",
    activeModule = parts[2] || "dashboard",
    detail = parts[3];
  /** Student directory list: its filters live inside the table card (Teaching staff layout). */
  const studentDirectory = activeModule === "students" && !detail;
  const [confirmation, setConfirmation] = useState<DrawerAction | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const [preferencesReady, setPreferencesReady] = useState(false);
  useEffect(() => {
    try {
      setCompact(
        localStorage.getItem(`kc-floating-sidebar-${c.slug}`)
          ? localStorage.getItem(`kc-floating-sidebar-${c.slug}`) !== "expanded"
          : !false,
      );
      const filters = JSON.parse(
        sessionStorage.getItem(`kc-filters-${c.slug}`) || "{}",
      );
      if (typeof filters.year === "string") setYear(filters.year);
      if (typeof filters.department === "string")
        setDepartment(filters.department);
      if (typeof filters.from === "string") setFrom(filters.from);
      if (typeof filters.to === "string") setTo(filters.to);
    } catch {}
    setPreferencesReady(true);
  }, [c.slug]);
  useEffect(() => {
    if (preferencesReady) {
      try {
        localStorage.setItem(
          `kc-floating-sidebar-${c.slug}`,
          compact ? "compact" : "expanded",
        );
      } catch {}
    }
  }, [compact, c.slug, preferencesReady]);
  useEffect(() => {
    if (!preferencesReady) return;
    try {
      sessionStorage.setItem(
        `kc-filters-${c.slug}`,
        JSON.stringify({ year, department, from, to }),
      );
    } catch {}
  }, [year, department, from, to, preferencesReady, c.slug]);
  useEffect(() => {
    if (!open && !modal) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, modal]);
  useEffect(() => {
    if (!open) return;
    const first = sidebarRef.current?.querySelector<HTMLElement>("a,button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        document.querySelector<HTMLButtonElement>(".erp-mobile-menu")?.focus();
      }
      if (e.key === "Tab") {
        const elements = Array.from(
          sidebarRef.current?.querySelectorAll<HTMLElement>(
            "a,button,summary",
          ) || [],
        ).filter((el) => el.getClientRects().length);
        const start = elements[0],
          end = elements.at(-1);
        if (e.shiftKey && document.activeElement === start) {
          e.preventDefault();
          end?.focus();
        } else if (!e.shiftKey && document.activeElement === end) {
          e.preventDefault();
          start?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  const selfStudent = s.students.find((st) => st.id === account?.person_code) ||
    s.students[0] || {
      id: "",
      name: "Student",
      program: "",
      year: "",
      fee: 0,
      scholarship: 0,
      status: "",
      email: "",
      guardian: "",
      date: "",
      department: "",
    };
  const field = (
    key: string,
    label: string,
    type = "text",
    options?: string[],
    value?: string,
  ): Field => ({ key, label, type, options, value, required: true });
  const studentField = () =>
    field(
      "studentId",
      "Student",
      "select",
      role === "Student" ? [selfStudent.id] : s.students.map((x) => x.id),
    );
  function form(title: string, type: string, fields: Field[], id?: string) {
    void title;
    void type;
    void fields;
    void id;
    clear();
    window.dispatchEvent(
      new CustomEvent("edunexa:manage-records", { detail: { type } }),
    );
  }

  useEffect(() => {
    if (modal) dialog.current?.showModal();
  }, [modal]);
  const allowed = (...r: Role[]) => !!role && r.includes(role);
  const action = (type: string, id: string, status: string) =>
    run({ type, id, data: { status } });
  const studentRows = s.students.filter(
    (x) =>
      (year === "all" || x.year === year) &&
      (department === "all" || x.department === department) &&
      (role !== "Student" || x.id === selfStudent.id),
  );
  const ids = new Set(studentRows.map((x) => x.id));
  const payments = s.payments.filter(
    (p) =>
      ids.has(p.studentId || "") &&
      (!from || p.date >= from) &&
      (!to || p.date <= to),
  );
  const collection = payments.reduce((n, p) => n + (p.amount || 0), 0),
    outstanding = studentRows.reduce((n, x) => n + balance(s, x), 0),
    expenses = s.expenses.filter(
      (e) => (!from || e.date >= from) && (!to || e.date <= to),
    );
  const own = (rows: RecordRow[]) =>
    role === "Student"
      ? rows.filter((x) => x.studentId === selfStudent.id)
      : rows;
  const nav = (m: string) => `${root}/portal/${area}/${m}`;
  function collect(st?: Student) {
    form("Record payment", "payment", [
      field(
        "studentId",
        "Student",
        "select",
        role === "Student" ? [selfStudent.id] : s.students.map((x) => x.id),
        st?.id,
      ),
      field("amount", "Amount (INR)", "number"),
      field("category", "Fee category", "select", [
        "Tuition Fee",
        "Admission Fee",
        "Library Fee",
        "Stationery Fee",
        "Laboratory Fee",
        "Hostel Fee",
        "Transportation Fee",
        "University Fee",
        "Examination Fee",
        "Other Charges",
      ]),
      field("method", "Payment method", "select", [
        "Cash",
        "UPI demo",
        "Card demo",
        "Bank Transfer demo",
        "Online Payment demo",
      ]),
      field("outcome", "Simulation outcome", "select", ["Success", "Failure"]),
      field(
        "reference",
        "Unique transaction reference",
        "text",
        undefined,
        crypto.randomUUID(),
      ),
      {
        key: "paymentDate",
        label: "Payment date",
        type: "date",
        section: "Payment & confirmation",
        help: "Leave blank to use the date this payment is recorded.",
      },
      {
        key: "paidBy",
        label: "Paid by / payer name",
        section: "Payment & confirmation",
      },
      {
        key: "paymentTaxMode",
        label: "GST treatment for this payment",
        type: "select",
        options: ["not-configured", "no-tax", "intra-state", "inter-state"],
        section: "Tax & reconciliation",
        help: "Only select a tax treatment that has been verified. The payment amount includes any configured GST.",
      },
      {
        key: "paymentGstRate",
        label: "GST rate (%) included in payment",
        type: "number",
        value: "0",
        section: "Tax & reconciliation",
      },
      {
        key: "note",
        label: "Payment remarks / supporting reference",
        type: "textarea",
        section: "Payment & confirmation",
      },
    ]);
  }
  function certificate() {
    form("Request a certificate", "certificate.request", [
      studentField(),
      field("name", "Certificate type", "select", [
        "Bonafide Certificate",
        "Study Certificate",
        "Transfer Certificate",
        "Conduct Certificate",
        "Course Completion Certificate",
        "Migration Request",
        "Other",
      ]),
      field("note", "Purpose", "textarea"),
    ]);
  }
  function leave() {
    form("Request hostel leave", "leave.request", [
      studentField(),
      field("name", "Reason"),
      field("departure", "Departure", "date"),
      field("expectedReturn", "Expected return", "date"),
      field("pickup", "Pickup person"),
      field("relationship", "Pickup relationship", "select", [
        "Parent",
        "Sibling",
        "Guardian",
        "Authorized Relative",
      ]),
      field("contact", "Contact number"),
    ]);
  }
  function downloadCertificate(
    row: RecordRow,
    mode: "view" | "download" = "download",
  ) {
    void mode;
    void api.documents
      .download("certificate", row.id)
      .catch((e) =>
        toast.error("Could not download certificate", errorText(e)),
      );
  }
  function receipt(row: RecordRow, mode: "view" | "download" = "download") {
    void mode;
    void api.documents
      .download("receipt", row.reference || row.id)
      .catch((e) => toast.error("Could not download receipt", errorText(e)));
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!modal) return;
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    if (run({ type: modal.type, id: modal.id, data })) {
      dialog.current?.close();
      setModal(null);
    }
  }
  if (!ready) return <PortalShellSkeleton college={c} />;
  if (!account && sessionError)
    return (
      <div className="erp-access">
        <Shield size={40} />
        <h1>Your session could not be loaded</h1>
        <p>{sessionError}</p>
        <button
          className="college-button"
          onClick={() => window.location.reload()}
        >
          Retry session
        </button>
      </div>
    );
  if (area === "login" || !account)
    return <ConnectedPortal college={c} parts={parts} loginRedirect />;
  if (!role)
    return (
      <ConnectedPortal
        college={c}
        parts={parts}
        loginRedirect
        loginError="No role has been assigned to this account. Contact your college administrator or sign in with another account."
      />
    );
  if (
    ["student", "parent"].includes(account.person_type) ||
    ["teaching", "self"].includes(account.workspace_scope || "")
  )
    return <ConnectedPortal college={c} parts={parts} />;
  const homeArea = workspaceArea || roleHome[role];
  const areaAllowed = area === homeArea;
  if (!areaAllowed && modules.length)
    return <PortalShellSkeleton college={c} />;
  if (!areaAllowed || !modules.includes(activeModule))
    return (
      <ConnectedPortal
        college={c}
        parts={parts}
        loginRedirect
        loginError="Your account or selected role does not have access to this workspace. Choose your assigned role and sign in again."
      />
    );
  const dashboard = () => (
    <>
      <div className="erp-welcome">
        <div>
          <span>
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          <h1>
            {role === "Student"
              ? `Hi, ${selfStudent.name.split(" ")[0]}.`
              : role === "Principal"
                ? "A clear view of your institution."
                : role === "Accounts Manager"
                  ? "Every transaction, connected."
                  : `Welcome back, ${role === "Super Admin" ? "Admin" : role}.`}
          </h1>
          <p>
            {role === "Student"
              ? `${selfStudent.program} / ${selfStudent.year}`
              : role === "Principal"
                ? "Enrollment, performance, and the decisions that matter."
                : "Here’s what’s happening across your campus today."}
          </p>
        </div>
        <div className="erp-quick-actions">
          {allowed("Super Admin", "Accounts Manager", "Student") && (
            <button className="erp-primary" onClick={() => collect()}>
              {role === "Student" ? "Pay fees" : "Collect fee"}{" "}
              <Plus size={15} />
            </button>
          )}
          {allowed("Super Admin", "Admission Officer") && (
            <button onClick={() => application()}>
              New admission <Plus size={15} />
            </button>
          )}
        </div>
      </div>
      <RoleWorkspace college={c} role={role!} nav={nav} />
      {role !== "Student" && (
        <>
          <div className="erp-metrics">
            {[
              [
                Users,
                "Total students",
                studentRows.length,
                "View student directory",
                "students",
              ],
              [
                Wallet,
                "Fee collection",
                money(collection),
                "View payments",
                "payments",
              ],
              [
                CreditCard,
                "Outstanding fees",
                money(outstanding),
                "View fee ledger",
                "fees",
              ],
              [
                GraduationCap,
                "New applications",
                s.applications.filter((a) => a.status !== "Rejected").length,
                "View admission register",
                "admissions",
              ],
              [
                FileCheck,
                "Pending certificates",
                own(s.certificates).filter(
                  (x) => x.status !== "Issued" && x.status !== "Rejected",
                ).length,
                "View requests",
                "certificates",
              ],
              [
                Building2,
                "Hostel occupancy",
                `${s.allocations.filter((x) => x.status === "Allocated").length} / ${s.rooms.reduce((n, r) => n + (r.capacity || 0), 0)}`,
                "View hostels",
                "hostels",
              ],
              [
                Bell,
                "Pending permissions",
                own(s.leaves).filter((x) => x.status === "Pending").length,
                "View leave requests",
                "hostel-permissions",
              ],
              [
                Briefcase,
                "Expenses paid",
                money(
                  expenses
                    .filter((x) => x.status === "Paid")
                    .reduce((n, e) => n + (e.amount || 0), 0),
                ),
                "View expenses",
                "expenses",
              ],
            ]
              .filter((_, i) =>
                role === "Faculty"
                  ? [0].includes(i)
                  : role === "Admission Officer"
                    ? [0, 3].includes(i)
                    : role === "Certificate Officer"
                      ? [0, 4].includes(i)
                      : role === "Hostel Warden"
                        ? [5, 6].includes(i)
                        : role === "Accounts Manager"
                          ? [0, 1, 2, 7].includes(i)
                          : i < 4,
              )
              .map(([Icon, label, value, desc, m]) => {
                const I = Icon as typeof Users;
                return (
                  <article key={String(label)}>
                    <div className="erp-metric-icon">
                      <I size={19} />
                    </div>
                    <span>{String(label)}</span>
                    <strong>{String(value)}</strong>
                    {canRead(role, String(m)) ? (
                      <Link href={nav(String(m))}>
                        {String(desc)} <ArrowUpRight size={12} />
                      </Link>
                    ) : (
                      <small>Current demo records</small>
                    )}
                  </article>
                );
              })}
          </div>
          <div className="erp-dashboard-grid">
            {allowed("Super Admin", "Principal", "Accounts Manager") && (
              <ERPAnalytics
                payments={payments}
                useAreaDefault={false}
                onMonth={(month, selectedYear) => {
                  const last = new Date(
                    Number(selectedYear),
                    month,
                    0,
                  ).getDate();
                  setFrom(
                    `${selectedYear}-${String(month).padStart(2, "0")}-01`,
                  );
                  setTo(
                    `${selectedYear}-${String(month).padStart(2, "0")}-${last}`,
                  );
                  try {
                    sessionStorage.setItem(
                      `kc-filters-${c.slug}`,
                      JSON.stringify({
                        year,
                        department,
                        from: `${selectedYear}-${String(month).padStart(2, "0")}-01`,
                        to: `${selectedYear}-${String(month).padStart(2, "0")}-${last}`,
                      }),
                    );
                  } catch {}
                  router.push(
                    nav(canRead(role!, "payments") ? "payments" : "reports"),
                  );
                }}
              />
            )}
            {allowed("Super Admin", "Principal", "Accounts Manager") ? (
              <ERPInsights
                state={s}
                role={role!}
                students={studentRows}
                payments={payments}
                expenses={expenses}
                nav={nav}
                from={from}
                to={to}
              />
            ) : (
              <section className="erp-panel">
                <div className="erp-panel-title">
                  <h2>Program distribution</h2>
                  <BookOpen size={17} />
                </div>
                <div
                  className="erp-donut"
                  style={
                    {
                      background: `conic-gradient(${c.programs
                        .map((p, i) => {
                          const total = Math.max(1, studentRows.length),
                            start =
                              (c.programs
                                .slice(0, i)
                                .reduce(
                                  (n, pr) =>
                                    n +
                                    studentRows.filter(
                                      (st) => st.program === pr.name,
                                    ).length,
                                  0,
                                ) /
                                total) *
                              100,
                            end =
                              start +
                              (studentRows.filter((st) => st.program === p.name)
                                .length /
                                total) *
                                100;
                          return `${["#1769e0", "#69b8f4", "#9669df", "#26b59e", "#e6ab52", "#e57c8e"][i]} ${start}% ${end}%`;
                        })
                        .join(",")})`,
                    } as React.CSSProperties
                  }
                >
                  <div>
                    <strong>{studentRows.length}</strong>
                    <span>Students</span>
                  </div>
                </div>
                <div className="erp-program-legend">
                  {c.programs.map((p) => (
                    <button
                      key={p.slug}
                      onClick={() => setDepartment(p.department)}
                    >
                      <span>{p.name}</span>
                      <strong>
                        {studentRows.filter((s) => s.program === p.name).length}
                      </strong>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {canRead(role, "admissions") && (
              <section className="erp-panel erp-recent-admissions">
                <div className="erp-panel-title">
                  <h2>Recent admissions</h2>
                  <Link href={nav("admissions")}>View all</Link>
                </div>
                <div className="erp-compact-records">
                  {s.applications
                    .filter(
                      (a) =>
                        department === "all" ||
                        c.programs.find((p) => p.name === a.program)
                          ?.department === department,
                    )
                    .slice(0, 5)
                    .map((a) => (
                      <Link key={a.id} href={nav("admissions")}>
                        <span className="erp-record-avatar">
                          {a.name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <div>
                          <strong>{a.name}</strong>
                          <small>
                            {a.program} · {a.source}
                          </small>
                        </div>
                        <span
                          className={`erp-status status-${a.status.toLowerCase().replaceAll(" ", "-")}`}
                        >
                          {a.status}
                        </span>
                      </Link>
                    ))}
                </div>
              </section>
            )}
            {allowed("Super Admin", "Principal", "Accounts Manager") && (
              <section className="erp-panel erp-due-alerts">
                <div className="erp-panel-title">
                  <h2>{"Fee due alerts"}</h2>
                  <Link href={nav(canRead(role, "fees") ? "fees" : "reports")}>
                    View all
                  </Link>
                </div>
                <div className="erp-compact-records">
                  {studentRows
                    .filter((st) => balance(s, st) > 0)
                    .slice(0, 4)
                    .map((st) => (
                      <Link
                        key={st.id}
                        href={
                          canRead(role, "students")
                            ? `${nav("students")}/${st.id}`
                            : nav("fees")
                        }
                      >
                        <span className="erp-record-avatar">
                          {st.name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <div>
                          <strong>{st.name}</strong>
                          <small>{st.program}</small>
                        </div>
                        <b>{money(balance(s, st))}</b>
                      </Link>
                    ))}
                </div>
              </section>
            )}
            {allowed("Super Admin", "Principal") && (
              <div className="erp-secondary-metrics">
                {[
                  [
                    "Pending certificates",
                    String(
                      s.certificates.filter(
                        (r) => !["Issued", "Rejected"].includes(r.status),
                      ).length,
                    ),
                    "certificates",
                  ],
                  [
                    "Hostel occupancy",
                    `${s.allocations.filter((a) => a.status === "Allocated").length} / ${s.rooms.reduce((n, r) => n + (r.capacity || 0), 0)}`,
                    "hostels",
                  ],
                  [
                    "Pending permissions",
                    String(
                      s.leaves.filter((r) => r.status === "Pending").length,
                    ),
                    "hostel-permissions",
                  ],
                  [
                    "Expenses paid",
                    money(
                      expenses
                        .filter((r) => r.status === "Paid")
                        .reduce((n, r) => n + (r.amount || 0), 0),
                    ),
                    "expenses",
                  ],
                ]
                  .filter(([, , module]) => canRead(role, module))
                  .map(([label, value, module]) => (
                    <Link href={nav(module)} key={module}>
                      <BookOpen size={20} />
                      <div>
                        <span>{label}</span>
                        <strong>{value}</strong>
                        <small>View records</small>
                      </div>
                      <ArrowUpRight size={15} />
                    </Link>
                  ))}
              </div>
            )}
            <section className="erp-panel">
              <div className="erp-panel-title">
                <h2>
                  {role === "Principal"
                    ? "Decisions awaiting you"
                    : "Campus activity"}
                </h2>
                <Bell size={16} />
              </div>
              <div className="erp-activity">
                {s.audit.slice(0, 5).map((a) => (
                  <div key={a.id}>
                    <span className="erp-activity-dot" />
                    <div>
                      <strong>{a.name.replaceAll(".", " / ")}</strong>
                      <small>
                        {a.actor} · {a.date.slice(0, 16).replace("T", " ")}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="erp-panel">
              <div className="erp-panel-title">
                <h2>Student services</h2>
                <Building2 size={16} />
              </div>
              <div className="erp-service-grid">
                {[
                  [
                    "Certificates",
                    `${own(s.certificates).filter((x) => x.status === "Issued").length} issued`,
                    "certificates",
                  ],
                  [
                    "Hostel leave",
                    `${own(s.leaves).length} requests`,
                    "hostel-permissions",
                  ],
                  [
                    "Announcements",
                    `${visibleNotices(s, role).length} updates`,
                    "notifications",
                  ],
                  ["Reports", "Live derived data", "reports"],
                ]
                  .filter((x) => canRead(role, x[2]))
                  .map(([label, v, m]) => (
                    <Link key={m} href={nav(m)}>
                      <BookOpen size={20} />
                      <strong>{label}</strong>
                      <span>{v}</span>
                      <ArrowUpRight size={14} />
                    </Link>
                  ))}
              </div>
            </section>
          </div>
        </>
      )}
      {role === "Student" && (
        <section className="erp-panel">
          <h2>Your campus updates</h2>
          <div className="erp-activity">
            {s.notifications
              .filter((n) => !n.studentId || n.studentId === selfStudent.id)
              .slice(0, 3)
              .map((n) => (
                <div key={n.id}>
                  <Bell size={16} />
                  <div>
                    <strong>{n.name}</strong>
                    <small>{n.note}</small>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}
      {role === "Student" && (
        <div className="erp-student-actions">
          <button onClick={() => collect(selfStudent)}>
            Start demo payment
          </button>
          <button onClick={certificate}>Request certificate</button>
          <button onClick={leave}>Request hostel leave</button>
        </div>
      )}
    </>
  );
  function personalFields(st?: Pick<Student, "profile">): Field[] {
    const profile = st?.profile;
    return [
      ...(
        [
          ["academicYear", "Academic year", "2026-2027"],
          ["studyYear", "Year of study", "1"],
          ["branch", "Branch / discipline", ""],
          ["specialization", "Specialization", "General"],
          ["semester", "Semester", "1"],
          ["section", "Section", "A"],
          ["batch", "Batch", "Main"],
        ] as const
      ).map(([key, label, fallback]) => ({
        key,
        label,
        value: profile?.[key] || fallback,
        section: "Academic enrollment",
        required: false,
      })),
      {
        key: "photo",
        label: "Student photograph",
        type: "photo",
        value: profile?.photo,
        section: "Student identity",
      },
      {
        key: "dob",
        label: "Date of birth",
        type: "date",
        value: profile?.dob,
        section: "Student identity",
      },
      {
        key: "gender",
        label: "Gender",
        type: "select",
        options: ["Prefer not to say", "Female", "Male", "Other"],
        value: profile?.gender,
        section: "Student identity",
      },
      {
        key: "nationality",
        label: "Nationality",
        value: profile?.nationality,
        section: "Student identity",
      },
      {
        key: "phone",
        label: "Student phone",
        type: "tel",
        value: profile?.phone,
        section: "Contact & address",
      },
      {
        key: "address",
        label: "Correspondence address",
        type: "textarea",
        value: profile?.address,
        section: "Contact & address",
      },
      {
        key: "city",
        label: "City / district",
        value: profile?.city,
        section: "Contact & address",
      },
      {
        key: "state",
        label: "State / region",
        value: profile?.state,
        section: "Contact & address",
      },
      {
        key: "postalCode",
        label: "Postal code",
        value: profile?.postalCode,
        section: "Contact & address",
      },
      {
        key: "guardianPhone",
        label: "Guardian phone",
        type: "tel",
        value: profile?.guardianPhone,
        section: "Guardian & emergency contact",
      },
      {
        key: "relationship",
        label: "Guardian relationship",
        type: "select",
        options: ["Not specified", "Parent", "Guardian", "Sibling", "Other"],
        value: profile?.relationship,
        section: "Guardian & emergency contact",
      },
      {
        key: "emergencyContact",
        label: "Emergency contact",
        type: "tel",
        value: profile?.emergencyContact,
        section: "Guardian & emergency contact",
      },
      {
        key: "previousSchool",
        label: "Previous school / college",
        value: profile?.previousSchool,
        section: "Academic information",
      },
      {
        key: "qualification",
        label: "Previous qualification",
        value: profile?.qualification,
        section: "Academic information",
      },
      {
        key: "remarks",
        label: "Additional notes / support needs",
        type: "textarea",
        value: profile?.remarks,
        section: "Additional information",
      },
    ];
  }
  function application() {
    form("New admission application", "admission.create", [
      field("name", "Student name"),
      field("email", "Fictional email", "email"),
      field("guardian", "Guardian name"),
      field(
        "program",
        "Program",
        "select",
        c.programs.map((p) => p.name),
      ),
      field("source", "Admission source", "select", [
        "Walk-in",
        "Social Media",
        "Referral",
        "Website",
        "Campaign",
        "Education Fair",
        "Other",
      ]),
      field("note", "Documents & eligibility notes", "textarea"),
      ...personalFields(),
    ]);
  }
  function studentForm(st?: Student) {
    form(
      st ? "Edit student" : "Add student",
      "student.save",
      [
        {
          ...field("name", "Student name", "text", undefined, st?.name),
          section: "Student identity",
        },
        field("email", "Demo email", "email", undefined, st?.email),
        {
          ...field(
            "guardian",
            "Guardian name",
            "text",
            undefined,
            st?.guardian,
          ),
          section: "Guardian & emergency contact",
        },
        {
          ...field(
            "year",
            "Academic year",
            "select",
            ["2024-2025", "2025-2026", "2026-2027"],
            st?.year || "2026-2027",
          ),
          section: "Academic information",
        },
        ...personalFields(st),
        field(
          "program",
          "Program",
          "select",
          c.programs.map((p) => p.name),
          st?.program,
        ),
        field(
          "status",
          "Enrollment status",
          "select",
          ["Active", "Graduated", "Relieved"],
          st?.status,
        ),
      ],
      st?.id,
    );
  }
  const table = (
    title: string,
    rows: object[],
    columns: ReturnType<typeof cols>,
    actions?: (r: TableRecord) => ReactNode,
    detailsExtra?: (r: TableRecord) => ReactNode,
    filters?: ReactNode,
  ) => (
    <ERPTable
      title={title}
      rows={toRows(rows)}
      columns={columns}
      actions={actions}
      detailsExtra={detailsExtra}
      filters={filters}
    />
  );
  const heading = (title: string, description: string, button?: ReactNode) => (
    <div className="erp-welcome">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {button}
    </div>
  );
  const button = (label: string, onClick: () => void) => (
    <button className="erp-primary" onClick={onClick}>
      <Plus size={15} />
      {label}
    </button>
  );
  const certTable = () =>
    table(
      "Certificate register",
      own(s.certificates)
        .filter(
          (cert) => !certificateStatus || cert.status === certificateStatus,
        )
        .map((cert) => {
          const st = s.students.find((x) => x.id === cert.studentId);
          return {
            ...cert,
            eligibility: st
              ? balance(s, st) > 0
                ? `Outstanding fees: ${money(balance(s, st))}`
                : "Fees clear"
              : "Student record unavailable",
          };
        }),
      cols(
        "id",
        "studentId",
        "name",
        "status",
        "date",
        "downloads",
        "eligibility",
      ),
      (r) => (
        <>
          {allowed("Super Admin", "Principal", "Certificate Officer") &&
            r.status !== "Issued" &&
            r.status !== "Rejected" && (
              <>
                <button
                  onClick={() =>
                    action("certificate.status", r.id, "Under Review")
                  }
                >
                  Review
                </button>
                <button
                  onClick={() => action("certificate.status", r.id, "Issued")}
                >
                  Issue
                </button>
                <button
                  onClick={() =>
                    form(
                      "Reject certificate",
                      "certificate.status",
                      [
                        field("status", "Decision", "select", ["Rejected"]),
                        field("note", "Remarks"),
                      ],
                      r.id,
                    )
                  }
                >
                  Reject
                </button>
              </>
            )}
          {r.status === "Issued" && (
            <>
              <PDFActions
                onAction={(mode) =>
                  downloadCertificate(r as unknown as RecordRow, mode)
                }
              >
                Download PDF
              </PDFActions>
              <Link href={`${root}/verify-certificate/${r.id}`}>Verify</Link>
            </>
          )}
        </>
      ),
      (r) => (
        <section className="erp-detail-note">
          <h3>Purpose & review remarks</h3>
          <p>{String(r.note || "No remarks recorded.")}</p>
          <small>
            Issuance is a demo action. Review the student’s eligibility and
            supporting documents before deciding.
          </small>
        </section>
      ),
    );
  function content() {
    if (activeModule === "roles") return <RolesAccess />;
    if (operationLabels[activeModule])
      return <OperationsWorkspace college={c} module={activeModule} />;
    if (activeModule === "dashboard" && role === "Parent")
      return <OperationsWorkspace college={c} module="parent-app" />;
    if (activeModule === "dashboard")
      return (
        <>
          <OperationsSummary college={c} />
          {dashboard()}
        </>
      );
    if (activeModule === "students" && detail) {
      const st = s.students.find((x) => x.id === detail);
      const visibleTab =
        role === "Faculty" &&
        !["Overview", "Academic Details"].includes(profileTab)
          ? "Overview"
          : profileTab;
      if (!st)
        return heading(
          "Student not found",
          "Choose a record from the student directory.",
        );
      return (
        <>
          {heading(
            st.name,
            `${st.id} / ${st.program}`,
            allowed("Super Admin", "Admission Officer")
              ? button("Edit student", () => studentForm(st))
              : undefined,
          )}
          <div className="erp-profile-tabs">
            {[
              "Overview",
              "Personal Information",
              "Academic Details",
              "Admission History",
              "Fee Ledger",
              "Scholarships",
              "Receipts",
              "Certificates",
              "Hostel",
              "Notifications",
              "Activity Timeline",
            ]
              .filter(
                (t) =>
                  role !== "Faculty" ||
                  ["Overview", "Academic Details"].includes(t),
              )
              .map((t) => (
                <button
                  key={t}
                  aria-pressed={visibleTab === t}
                  onClick={() => setProfileTab(t)}
                >
                  {t}
                </button>
              ))}
          </div>
          {role !== "Faculty" &&
            ["Overview", "Fee Ledger"].includes(visibleTab) && (
              <StudentFeeSchedule studentCode={st.id} />
            )}
          {[
            "Overview",
            "Personal Information",
            "Academic Details",
            "Admission History",
          ].includes(visibleTab) ? (
            <section className="erp-panel erp-profile">
              <div className="erp-profile-avatar">
                {st.profile?.photo ? (
                  <Image
                    src={st.profile.photo}
                    width={75}
                    height={75}
                    alt={`${st.name} student photo`}
                    unoptimized
                  />
                ) : (
                  <>
                    {st.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </>
                )}{" "}
              </div>
              <h2>{st.name}</h2>
              <dl>
                {Object.entries({
                  Roll: st.id,
                  Program: st.program,
                  Department: st.department,
                  "Academic year": st.year,
                  "Admission date": st.date,
                  Email: st.email,
                  Guardian: st.guardian,
                  ...(visibleTab === "Personal Information"
                    ? {
                        "Date of birth": st.profile?.dob || "Not provided",
                        Gender: st.profile?.gender || "Not provided",
                        Phone: st.profile?.phone || "Not provided",
                        Address: st.profile?.address || "Not provided",
                        City: st.profile?.city || "Not provided",
                        State: st.profile?.state || "Not provided",
                        "Postal code": st.profile?.postalCode || "Not provided",
                        "Guardian phone":
                          st.profile?.guardianPhone || "Not provided",
                        "Emergency contact":
                          st.profile?.emergencyContact || "Not provided",
                        "Previous institution":
                          st.profile?.previousSchool || "Not provided",
                        "Previous qualification":
                          st.profile?.qualification || "Not provided",
                        Remarks: st.profile?.remarks || "Not provided",
                      }
                    : {}),
                  Status: st.status,
                  "Total fee": money(st.fee),
                  Scholarships: money(st.scholarship),
                  Paid: money(paid(s, st.id)),
                  Outstanding: money(balance(s, st)),
                })
                  .filter(
                    ([k]) =>
                      role !== "Faculty" ||
                      ![
                        "Email",
                        "Guardian",
                        "Total fee",
                        "Scholarships",
                        "Paid",
                        "Outstanding",
                      ].includes(k),
                  )
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
              </dl>
            </section>
          ) : visibleTab === "Fee Ledger" || visibleTab === "Receipts" ? (
            table(
              visibleTab,
              s.payments.filter((x) => x.studentId === st.id),
              cols("id", "date", "amount", "method", "category"),
              (r) => (
                <PDFActions
                  onAction={(mode) => receipt(r as unknown as RecordRow, mode)}
                >
                  Receipt PDF
                </PDFActions>
              ),
            )
          ) : visibleTab === "Certificates" ? (
            table(
              "Student certificates",
              s.certificates.filter((x) => x.studentId === st.id),
              cols("id", "name", "status", "downloads"),
              (r) =>
                r.status === "Issued" && (
                  <PDFActions
                    onAction={(mode) =>
                      downloadCertificate(r as unknown as RecordRow, mode)
                    }
                  >
                    Download PDF
                  </PDFActions>
                ),
            )
          ) : visibleTab === "Hostel" ? (
            table(
              "Hostel allocation",
              s.allocations.filter((x) => x.studentId === st.id),
              cols("id", "room", "status"),
            )
          ) : visibleTab === "Notifications" ? (
            table(
              "Student notifications",
              s.notifications.filter((x) => x.studentId === st.id),
              cols("name", "status", "note"),
            )
          ) : visibleTab === "Scholarships" ? (
            table(
              "Scholarships",
              s.scholarships.filter((x) => x.studentId === st.id),
              cols("name", "amount", "status"),
            )
          ) : (
            table(
              "Student activity",
              s.audit.filter(
                (x) => x.reference === st.id || x.note?.includes(st.id),
              ),
              cols("name", "actor", "date", "note"),
            )
          )}
        </>
      );
    }
    if (activeModule === "students")
      return (
        <>
          {heading(
            "Student directory",
            "Manage the complete student lifecycle, while preserving financial history.",
            <div className="erp-quick-actions erp-heading-actions">
              <button
                className="erp-primary"
                onClick={() => {
                  setManageModule(null);
                  setFeeStructureId(null);
                  setApiOpen(true);
                }}
              >
                Manage {labels.students || "Students"} <Plus size={15} />
              </button>
              {allowed("Super Admin", "Admission Officer") &&
                button("Add student", () => studentForm())}
            </div>,
          )}
          {table(
            "Students",
            studentRows.map((st) => ({
              ...st,
              roll: st.id,
              outstanding: balance(s, st),
              hostel: s.allocations.some(
                (a) => a.studentId === st.id && a.status === "Allocated",
              )
                ? "Allocated"
                : "Day scholar",
            })),
            [
              ...cols(
                "id",
                "name",
                "program",
                "department",
                "year",
                "date",
                "status",
                "hostel",
              ),
              {
                key: "outstanding",
                label: "Outstanding",
                render: (r: TableRecord) => money(Number(r.outstanding)),
              },
            ].filter(
              (column) => role !== "Faculty" || column.key !== "outstanding",
            ),
            (r) => (
              <>
                <Link href={`${nav("students")}/${r.id}`}>View profile</Link>
                {allowed("Super Admin", "Admission Officer") && (
                  <>
                    <IconAction
                      kind="edit"
                      label={`Edit ${String(r.name ?? r.id)}`}
                      onClick={() =>
                        studentForm(s.students.find((st) => st.id === r.id))
                      }
                    />
                    <button
                      disabled={r.status === "Relieved"}
                      onClick={() => {
                        setConfirmation({
                          title: "Relieve student",
                          description:
                            "Relieve this student? Their history will be preserved.",
                          confirm: () => {
                            run({ type: "student.archive", id: r.id });
                          },
                        });
                      }}
                    >
                      Relieve
                    </button>
                  </>
                )}
              </>
            ),
            undefined,
            <div className="erp-filters erp-card-filters">{filterFields}</div>,
          )}
        </>
      );
    if (activeModule === "admissions") {
      const a = detail
        ? s.applications.filter((x) => x.id === detail)
        : s.applications.filter(
            (a) =>
              (!admissionSource || a.source === admissionSource) &&
              (!admissionStatus || a.status === admissionStatus) &&
              (!from || a.date >= from) &&
              (!to || a.date <= to) &&
              (department === "all" ||
                c.programs.find((p) => p.name === a.program)?.department ===
                  department),
          );
      return (
        <>
          {heading(
            detail ? "Application review" : "Admissions",
            "Inquiry → Application → Verification → Approval → Fee assignment → Enrollment",
            allowed("Super Admin", "Admission Officer")
              ? button("New application", application)
              : undefined,
          )}
          <div className="erp-pipeline" aria-label="Admission pipeline">
            {[
              "Application",
              "Verification",
              "Approved",
              "Enrolled",
              "Rejected",
            ].map((status) => (
              <button
                key={status}
                aria-pressed={admissionStatus === status}
                onClick={() =>
                  setAdmissionStatus(admissionStatus === status ? "" : status)
                }
              >
                <span>{status}</span>
                <strong>
                  {s.applications.filter((a) => a.status === status).length}
                </strong>
              </button>
            ))}
          </div>
          <div className="erp-source-strip">
            {[
              "Website",
              "Walk-in",
              "Social Media",
              "Referral",
              "Campaign",
              "Education Fair",
              "Other",
            ].map((source) => (
              <button
                key={source}
                aria-pressed={admissionSource === source}
                onClick={() =>
                  setAdmissionSource(admissionSource === source ? "" : source)
                }
              >
                {source}
                <strong>
                  {s.applications.filter((a) => a.source === source).length}
                </strong>
              </button>
            ))}
          </div>
          {(admissionSource || admissionStatus) && (
            <button
              onClick={() => {
                setAdmissionSource("");
                setAdmissionStatus("");
              }}
            >
              Clear admission filters
            </button>
          )}
          {table(
            "Applications",
            a,
            cols("id", "name", "program", "source", "status", "date", "note"),
            (r) => (
              <>
                <Link href={`${nav("admissions")}/${r.id}`}>Details</Link>
                {allowed("Super Admin", "Admission Officer") &&
                  r.status !== "Enrolled" && (
                    <IconAction
                      kind="edit"
                      label="Edit application"
                      onClick={() =>
                        form(
                          "Edit application",
                          "admission.edit",
                          [
                            field(
                              "name",
                              "Applicant name",
                              "text",
                              undefined,
                              String(r.name),
                            ),
                            field(
                              "program",
                              "Program",
                              "select",
                              c.programs.map((p) => p.name),
                              String(r.program),
                            ),
                            field(
                              "source",
                              "Source",
                              "select",
                              [
                                "Website",
                                "Walk-in",
                                "Social Media",
                                "Referral",
                                "Campaign",
                                "Education Fair",
                                "Other",
                              ],
                              String(r.source),
                            ),
                            {
                              key: "email",
                              label: "Applicant email",
                              type: "email",
                              value: String(r.email || ""),
                              section: "Contact & address",
                            },
                            {
                              key: "guardian",
                              label: "Guardian name",
                              value: String(r.guardian || ""),
                              section: "Guardian & emergency contact",
                            },
                            ...personalFields({
                              profile: r.profile as Student["profile"],
                            }),
                            field(
                              "note",
                              "Documents & review notes",
                              "textarea",
                              undefined,
                              String(r.note || ""),
                            ),
                          ],
                          r.id,
                        )
                      }
                    />
                  )}
                {allowed("Super Admin", "Principal", "Admission Officer") &&
                  r.status !== "Enrolled" &&
                  r.status !== "Rejected" && (
                    <>
                      <button
                        onClick={() =>
                          action("admission.status", r.id, "Verification")
                        }
                      >
                        Request documents
                      </button>
                      <button
                        onClick={() =>
                          action("admission.status", r.id, "Approved")
                        }
                      >
                        Approve
                      </button>
                      {r.status === "Approved" && (
                        <button
                          onClick={() =>
                            action("admission.status", r.id, "Enrolled")
                          }
                        >
                          Enroll
                        </button>
                      )}
                      <button
                        onClick={() =>
                          action("admission.status", r.id, "Rejected")
                        }
                      >
                        Reject
                      </button>
                    </>
                  )}
                <PDFActions
                  onAction={(mode) =>
                    professionalPdf(
                      r.id,
                      admissionReport(c, s, r as unknown as RecordRow, role),
                      mode,
                    )
                  }
                >
                  Acknowledgment
                </PDFActions>
              </>
            ),
          )}
        </>
      );
    }
    if (["fees", "payments", "receipts"].includes(activeModule))
      return (
        <>
          {heading(
            labels[activeModule],
            activeModule === "fees"
              ? "All amounts derive from fee assignments, scholarships, and completed payments."
              : "Simulated transactions only. No real money is transferred.",
            allowed("Super Admin", "Accounts Manager", "Student")
              ? button("Record payment", () => collect())
              : undefined,
          )}
          {activeModule === "fees"
            ? table(
                "Student fee ledgers",
                studentRows.map((st) => ({
                  ...st,
                  amount: st.fee,
                  paid: paid(s, st.id),
                  outstanding: balance(s, st),
                })),
                [
                  ...cols("id", "name", "program", "amount"),
                  {
                    key: "scholarship",
                    label: "Scholarship",
                    render: (r) => money(Number(r.scholarship)),
                  },
                  {
                    key: "paid",
                    label: "Paid",
                    render: (r) => money(Number(r.paid)),
                  },
                  {
                    key: "outstanding",
                    label: "Outstanding",
                    render: (r: TableRecord) => money(Number(r.outstanding)),
                  },
                ],
                (r) => (
                  <>
                    <PDFActions
                      onAction={(mode) => {
                        const st = s.students.find((st) => st.id === r.id);
                        if (st)
                          return professionalPdf(
                            `${st.id}-fee-statement`,
                            ledgerReport(c, s, st, role),
                            mode,
                          );
                      }}
                    >
                      Detailed fee statement PDF
                    </PDFActions>
                    {allowed("Super Admin", "Accounts Manager", "Student") && (
                      <button
                        onClick={() =>
                          collect(s.students.find((st) => st.id === r.id))
                        }
                      >
                        Collect fee
                      </button>
                    )}
                    {allowed("Super Admin", "Accounts Manager") && (
                      <button
                        onClick={() =>
                          form("Assign student fee", "fee.assign", [
                            field("studentId", "Student", "select", [r.id]),
                            field(
                              "amount",
                              "Total fee (INR)",
                              "number",
                              undefined,
                              String(Number(r.amount) / 100),
                            ),
                          ])
                        }
                      >
                        Assign fee
                      </button>
                    )}
                  </>
                ),
              )
            : table(
                activeModule === "receipts"
                  ? "Receipt register"
                  : "Payment transactions",
                payments,
                cols(
                  "id",
                  "name",
                  "studentId",
                  "date",
                  "amount",
                  "method",
                  "category",
                  "status",
                ),
                (r) => (
                  <PDFActions
                    onAction={(mode) =>
                      receipt(r as unknown as RecordRow, mode)
                    }
                  >
                    Download receipt
                  </PDFActions>
                ),
              )}
        </>
      );
    if (activeModule === "fee-structures") return <FeeStructures college={c} />;
    if (activeModule === "scholarships")
      return (
        <>
          {heading(
            "Scholarships & discounts",
            "Propose an award, then approve it to update the student ledger.",
            allowed("Super Admin", "Accounts Manager")
              ? button("Propose scholarship", () =>
                  form("Propose scholarship", "scholarship.create", [
                    studentField(),
                    field("name", "Award type", "select", [
                      "Merit",
                      "Need-Based",
                      "Sports",
                      "Institutional",
                      "Special Category",
                      "Other",
                    ]),
                    field("category", "Adjustment method", "select", [
                      "Fixed amount",
                      "Percentage",
                    ]),
                    field("amount", "Amount (INR) or percentage", "number"),
                    field("note", "Eligibility & reason", "textarea"),
                  ]),
                )
              : undefined,
          )}
          {table(
            "Scholarship awards",
            s.scholarships,
            cols(
              "id",
              "studentId",
              "name",
              "amount",
              "status",
              "actor",
              "note",
            ),
            (r) =>
              allowed("Super Admin", "Principal") &&
              r.status === "Pending" && (
                <button
                  onClick={() => run({ type: "scholarship.approve", id: r.id })}
                >
                  Approve award
                </button>
              ),
          )}
          {table(
            "Existing student adjustments",
            studentRows
              .filter((st) => st.scholarship > 0)
              .map((st) => ({
                id: st.id,
                name: st.name,
                amount: st.scholarship,
                status: "Approved",
              })),
            cols("id", "name", "amount", "status"),
          )}
        </>
      );
    if (["expenses", "invoices"].includes(activeModule)) {
      const isExpense = activeModule === "expenses",
        records = isExpense ? s.expenses : s.invoices,
        prefix = isExpense ? "expense" : "invoice";
      return (
        <>
          {heading(
            labels[activeModule],
            "Draft → Submitted → Approved → Paid. Paid expenses automatically appear in the cashbook.",
            allowed("Super Admin", "Accounts Manager")
              ? button("Create " + (isExpense ? "expense" : "invoice"), () =>
                  form("Create " + prefix, prefix + ".create", [
                    field("name", "Vendor / payee"),
                    field("amount", "Amount (INR)", "number"),
                    field("category", "Category", "select", [
                      "Library",
                      "Laboratory",
                      "Salary",
                      "Hostel",
                      "University",
                      "Examination",
                      "External",
                      "Operations",
                    ]),
                    field("method", "Payment method", "select", [
                      "Cash",
                      "Bank Transfer demo",
                      "UPI demo",
                    ]),
                    field("note", "Supporting document reference"),
                  ]),
                )
              : undefined,
          )}
          {table(
            labels[activeModule],
            records,
            cols(
              "id",
              "name",
              "category",
              "amount",
              "status",
              "date",
              "actor",
              "note",
            ),
            (r) => (
              <>
                {r.status === "Draft" &&
                  allowed("Super Admin", "Accounts Manager") && (
                    <IconAction
                      kind="edit"
                      label="Edit draft"
                      onClick={() =>
                        form(
                          "Edit draft",
                          prefix + ".edit",
                          [
                            field(
                              "name",
                              "Vendor / payee",
                              "text",
                              undefined,
                              String(r.name),
                            ),
                            field(
                              "amount",
                              "Amount (INR)",
                              "number",
                              undefined,
                              String(Number(r.amount) / 100),
                            ),
                            field(
                              "note",
                              "Supporting document reference",
                              "text",
                              undefined,
                              String(r.note || "Demo reference"),
                            ),
                          ],
                          r.id,
                        )
                      }
                    />
                  )}
                {r.status === "Draft" || r.status === "Pending" ? (
                  <button
                    onClick={() =>
                      action(prefix + ".status", r.id, "Submitted")
                    }
                  >
                    Submit
                  </button>
                ) : r.status === "Submitted" &&
                  allowed("Super Admin", "Principal") ? (
                  <button
                    onClick={() => action(prefix + ".status", r.id, "Approved")}
                  >
                    Approve
                  </button>
                ) : r.status === "Approved" &&
                  allowed("Super Admin", "Accounts Manager") ? (
                  <button
                    onClick={() => action(prefix + ".status", r.id, "Paid")}
                  >
                    Mark paid
                  </button>
                ) : null}
                <PDFActions
                  onAction={(mode) =>
                    professionalPdf(
                      r.id,
                      financialRecordReport(
                        c,
                        s,
                        r as unknown as RecordRow,
                        prefix,
                        role,
                      ),
                      mode,
                    )
                  }
                >
                  PDF
                </PDFActions>
              </>
            ),
          )}
        </>
      );
    }
    if (activeModule === "cashbook") {
      let running = 0;
      const entries = [
        ...s.payments.map((p) => ({ ...p, direction: "In", reference: p.id })),
        ...s.expenses
          .filter((e) => e.status === "Paid")
          .map((e) => ({ ...e, direction: "Out", reference: e.id })),
        ...s.invoices
          .filter(
            (e) =>
              e.status === "Paid" &&
              !s.operations?.records["purchase-orders"]?.some(
                (p) => p.id === e.reference,
              ),
          )
          .map((e) => ({ ...e, direction: "Out", reference: e.id })),
      ]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((e) => {
          running += (e.direction === "In" ? 1 : -1) * (e.amount || 0);
          return { ...e, running };
        })
        .filter((e) => (!from || e.date >= from) && (!to || e.date <= to));
      return (
        <>
          {heading(
            "Cashbook",
            `Closing balance: ${money(entries.at(-1)?.running || 0)}. Running balances include all earlier transactions.`,
          )}
          {table("Cashbook entries", entries, [
            ...cols(
              "date",
              "reference",
              "name",
              "category",
              "direction",
              "amount",
              "method",
            ),
            {
              key: "running",
              label: "Running balance",
              render: (r) => money(Number(r.running)),
            },
          ])}
        </>
      );
    }
    if (
      activeModule === "certificates" ||
      activeModule === "certificate-requests"
    )
      return (
        <>
          {heading(
            "Certificates",
            "Request, review, issue, and verify fictional academic documents.",
            button("Request certificate", certificate),
          )}
          <div
            className="erp-segmented"
            aria-label="Certificate status filters"
          >
            {["", "Pending", "Under Review", "Issued", "Rejected"].map(
              (status) => (
                <button
                  key={status}
                  aria-pressed={certificateStatus === status}
                  onClick={() => setCertificateStatus(status)}
                >
                  {status || "All requests"}{" "}
                  <b>
                    {
                      own(s.certificates).filter(
                        (r) => !status || r.status === status,
                      ).length
                    }
                  </b>
                </button>
              ),
            )}
          </div>
          {certTable()}
        </>
      );
    if (activeModule === "hostels")
      return (
        <>
          {heading(
            "Hostel management",
            "Manage room capacity, active bed allocations, and residential life.",
            allowed("Super Admin", "Hostel Warden") ? (
              <div className="erp-quick-actions">
                {button("Add room", () =>
                  form("Add hostel room", "room.create", [
                    field("name", "Building / floor / room"),
                    field("capacity", "Bed capacity", "number"),
                  ]),
                )}
                {button("Allocate bed", () =>
                  form("Allocate hostel bed", "room.allocate", [
                    studentField(),
                    field(
                      "room",
                      "Room",
                      "select",
                      s.rooms.map((r) => r.id),
                    ),
                  ]),
                )}
              </div>
            ) : undefined,
          )}
          <section className="erp-panel erp-room-overview">
            <div className="erp-panel-title">
              <div>
                <h2>Room occupancy</h2>
                <p>
                  {s.allocations.filter((a) => a.status === "Allocated").length}{" "}
                  occupied beds /{" "}
                  {s.rooms.reduce((n, r) => n + (r.capacity || 0), 0)} total
                  beds
                </p>
              </div>
              {selectedRoom && (
                <button onClick={() => setSelectedRoom("")}>
                  Show all rooms
                </button>
              )}
            </div>
            <div className="erp-room-map">
              {s.rooms.map((room) => {
                const occupied = s.allocations.filter(
                  (a) => a.room === room.id && a.status === "Allocated",
                ).length;
                return (
                  <button
                    key={room.id}
                    aria-pressed={selectedRoom === room.id}
                    onClick={() =>
                      setSelectedRoom(selectedRoom === room.id ? "" : room.id)
                    }
                  >
                    <span>{room.name}</span>
                    <strong>
                      {occupied} / {room.capacity}
                    </strong>
                    <div
                      aria-label={`${occupied} occupied of ${room.capacity} beds`}
                    >
                      {Array.from(
                        { length: Math.min(12, room.capacity || 0) },
                        (_, i) => (
                          <i
                            key={i}
                            className={i < occupied ? "is-occupied" : ""}
                          />
                        ),
                      )}
                    </div>
                    <small>
                      {room.status === "Archived"
                        ? "Archived"
                        : occupied === (room.capacity || 0)
                          ? "Full"
                          : "Available"}
                    </small>
                  </button>
                );
              })}
            </div>
          </section>
          {table(
            "Rooms",
            s.rooms
              .filter((r) => !selectedRoom || r.id === selectedRoom)
              .map((r) => ({
                ...r,
                occupied: s.allocations.filter(
                  (a) => a.room === r.id && a.status === "Allocated",
                ).length,
                available:
                  (r.capacity || 0) -
                  s.allocations.filter(
                    (a) => a.room === r.id && a.status === "Allocated",
                  ).length,
              })),
            cols(
              "id",
              "name",
              "capacity",
              "occupied",
              "available",
              "note",
              "status",
            ),
            (r) =>
              allowed("Super Admin", "Hostel Warden") && (
                <button
                  onClick={() =>
                    form(
                      "Edit hostel room",
                      "room.update",
                      [
                        field(
                          "name",
                          "Block / floor / room",
                          "text",
                          undefined,
                          String(r.name),
                        ),
                        field(
                          "capacity",
                          "Capacity",
                          "number",
                          undefined,
                          String(r.capacity),
                        ),
                        field(
                          "status",
                          "Room status",
                          "select",
                          ["Available", "Archived"],
                          String(r.status),
                        ),
                        field(
                          "note",
                          "Warden & building notes",
                          "text",
                          undefined,
                          String(r.note || "Warden: Demo warden"),
                        ),
                      ],
                      r.id,
                    )
                  }
                >
                  Edit / archive
                </button>
              ),
          )}
          {table(
            "Bed allocations",
            s.allocations,
            cols("id", "studentId", "name", "room", "status"),
            (r) =>
              allowed("Super Admin", "Hostel Warden") &&
              r.status === "Allocated" && (
                <button
                  onClick={() => {
                    setConfirmation({
                      title: "Release bed allocation",
                      description:
                        "Release this bed allocation? The bed will become available for another student.",
                      confirm: () => {
                        run({ type: "room.release", id: r.id });
                      },
                    });
                  }}
                >
                  Release bed
                </button>
              ),
          )}
        </>
      );
    if (activeModule === "hostel-permissions")
      return (
        <>
          {heading(
            "Hostel leave permissions",
            "Pickup details, warden approval, departure, and return are recorded together.",
            button("Request leave", leave),
          )}
          {table(
            "Leave register",
            own(s.leaves),
            cols(
              "id",
              "studentId",
              "name",
              "departure",
              "expectedReturn",
              "pickup",
              "relationship",
              "status",
              "actor",
              "approvedAt",
              "actualReturn",
            ),
            (r) =>
              allowed("Super Admin", "Hostel Warden") && (
                <>
                  {["Pending", "Under Review"].includes(String(r.status)) && (
                    <>
                      <button
                        onClick={() => action("leave.status", r.id, "Approved")}
                      >
                        Approve leave
                      </button>
                      <button
                        onClick={() => action("leave.status", r.id, "Rejected")}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {r.status === "Approved" && (
                    <button
                      onClick={() =>
                        action("leave.status", r.id, "Checked Out")
                      }
                    >
                      Check out
                    </button>
                  )}
                  {r.status === "Checked Out" && (
                    <button
                      onClick={() => action("leave.status", r.id, "Returned")}
                    >
                      Record return
                    </button>
                  )}
                </>
              ),
          )}
        </>
      );
    if (activeModule === "staff")
      return (
        <>
          {heading(
            "Faculty & staff",
            "Assigned responsibilities and role management.",
            role === "Super Admin"
              ? button("Add staff", () =>
                  form("Add staff member", "staff.save", [
                    field("name", "Staff name"),
                    field("category", "Demo role", "select", [...roles]),
                  ]),
                )
              : undefined,
          )}
          {table(
            "Staff directory",
            s.staff,
            cols("id", "name", "category", "note", "status"),
            (r) =>
              role === "Super Admin" && (
                <button
                  onClick={() =>
                    form(
                      "Edit staff member",
                      "staff.save",
                      [
                        field(
                          "name",
                          "Staff name",
                          "text",
                          undefined,
                          String(r.name),
                        ),
                        field(
                          "category",
                          "Assigned role",
                          "select",
                          [...roles],
                          String(r.category),
                        ),
                        field("status", "Status", "select", [
                          "Active",
                          "Archived",
                        ]),
                      ],
                      r.id,
                    )
                  }
                >
                  Edit / assign role
                </button>
              ),
          )}
        </>
      );
    if (activeModule === "academics") {
      const programs = c.programs.filter(
        (p) => department === "all" || p.department === department,
      );
      return (
        <>
          {heading(
            "Academic responsibilities",
            "Explore departments, program coordinators, and enrollment for the selected academic year.",
          )}
          <div className="erp-academic-summary">
            <article>
              <GraduationCap size={22} />
              <span>Academic programs</span>
              <strong>{programs.length}</strong>
            </article>
            <article>
              <Building2 size={22} />
              <span>Departments</span>
              <strong>{new Set(programs.map((p) => p.department)).size}</strong>
            </article>
            <article>
              <Users size={22} />
              <span>Students in selection</span>
              <strong>{studentRows.length}</strong>
            </article>
          </div>
          <div className="erp-academic-programs">
            {programs.map((p) => {
              const faculty = s.staff.filter(
                (st) =>
                  st.status !== "Archived" &&
                  st.category === "Faculty" &&
                  st.note === p.department,
              );
              return (
                <section className="erp-panel" key={p.slug}>
                  <div className="erp-panel-title">
                    <BookOpen size={21} />
                    <span className="erp-status">{p.department}</span>
                  </div>
                  <h2>{p.name}</h2>
                  <p>
                    {p.duration} ·{" "}
                    {studentRows.filter((st) => st.program === p.name).length}{" "}
                    students in selection
                  </p>
                  <p>Coordinator: {faculty[0]?.name || "Not assigned yet"}</p>
                  <Link href={`${root}/academics/${p.slug}`}>
                    View program details <ArrowUpRight size={13} />
                  </Link>
                </section>
              );
            })}
          </div>
          {table(
            "Academic programs",
            programs.map((p) => ({
              id: p.slug,
              name: p.name,
              department: p.department,
              duration: p.duration,
              status: "Active",
              faculty:
                s.staff.find(
                  (st) =>
                    st.status !== "Archived" &&
                    st.category === "Faculty" &&
                    st.note === p.department,
                )?.name || "Coordinator not assigned",
              students: studentRows.filter((st) => st.program === p.name)
                .length,
            })),
            cols(
              "name",
              "department",
              "duration",
              "faculty",
              "students",
              "status",
            ),
            (r) => (
              <Link href={`${root}/academics/${r.id}`}>Program website</Link>
            ),
          )}
        </>
      );
    }
    if (activeModule === "notifications")
      return (
        <>
          {heading(
            "Notification center",
            "Preview and simulate messages. No real SMS delivery.",
            role !== "Student"
              ? button("Compose message", () =>
                  form("Compose demo notification", "notification", [
                    field("name", "Message subject"),
                    field("note", "Message preview", "textarea"),
                    { ...studentField(), required: false },
                    field("status", "Simulation mode", "select", [
                      "Simulated",
                      "Scheduled",
                    ]),
                    {
                      ...field(
                        "expectedReturn",
                        "Scheduled time",
                        "datetime-local",
                      ),
                      required: false,
                    },
                  ]),
                )
              : undefined,
          )}
          {table(
            "Notification history",
            visibleNotices(s, role),
            cols(
              "name",
              "studentId",
              "note",
              "status",
              "date",
              "expectedReturn",
            ),
          )}
        </>
      );
    if (activeModule === "reports") {
      const reportRows = studentRows.map((st) => ({
        id: st.id,
        name: st.name,
        program: st.program,
        department: st.department,
        year: st.year,
        status: st.status,
        amount: st.fee,
        scholarship: st.scholarship,
        paid: paid(s, st.id),
        outstanding: balance(s, st),
      }));
      const report = (mode: "view" | "download" = "download") =>
        professionalPdf(
          "campus-finance-report",
          tableReport(
            c,
            s,
            "Campus finance & enrollment report",
            reportRows,
            [
              { key: "id", label: "Student ID" },
              { key: "name", label: "Student" },
              { key: "program", label: "Program" },
              { key: "department", label: "Department" },
              { key: "year", label: "Academic year" },
              { key: "amount", label: "Assigned fee" },
              { key: "scholarship", label: "Scholarship" },
              { key: "paid", label: "Paid" },
              { key: "outstanding", label: "Outstanding" },
            ],
            role,
            `Academic year: ${year}; Department: ${department}; Collections: ${from || "all"} to ${to || "all"}`,
          ),
          mode,
        );
      return (
        <>
          {heading(
            "Reports & analytics",
            "Student ledgers use lifetime payments; collection totals respect the date range.",
            <div className="erp-quick-actions">
              <PDFActions onAction={report}>
                <Download size={15} /> PDF report
              </PDFActions>
              <button onClick={() => window.print()}>
                <Printer size={15} /> Print
              </button>
            </div>,
          )}
          <div className="erp-dashboard-grid erp-report-charts">
            <ERPAnalytics
              payments={payments}
              useAreaDefault={false}
              onMonth={(month, selectedYear) => {
                setFrom(`${selectedYear}-${String(month).padStart(2, "0")}-01`);
                setTo(
                  `${selectedYear}-${String(month).padStart(2, "0")}-${new Date(Number(selectedYear), month, 0).getDate()}`,
                );
              }}
            />
            <ERPInsights
              state={s}
              role={role!}
              students={studentRows}
              payments={payments}
              expenses={expenses}
              nav={nav}
              from={from}
              to={to}
            />
          </div>
          <div className="erp-report-summary">
            <strong>{studentRows.length} students</strong>
            <strong>{money(collection)} collected</strong>
            <strong>{money(outstanding)} outstanding</strong>
          </div>
          {table("Filtered student finance report", reportRows, [
            ...cols("id", "name", "department", "year", "status", "amount"),
            {
              key: "paid",
              label: "Paid",
              render: (r) => money(Number(r.paid)),
            },
            {
              key: "outstanding",
              label: "Outstanding",
              render: (r: TableRecord) => money(Number(r.outstanding)),
            },
          ])}
          {table(
            "Filtered collection report",
            payments,
            cols(
              "id",
              "date",
              "studentId",
              "name",
              "amount",
              "method",
              "category",
            ),
          )}
          {table(
            "Admission sources",
            s.applications,
            cols("id", "name", "source", "program", "status"),
          )}
          {table(
            "Expense report",
            expenses,
            cols("id", "name", "amount", "category", "status"),
          )}
          {table(
            "Certificate download report",
            s.certificates,
            cols("id", "name", "studentId", "status", "downloads"),
          )}
          {table(
            "Hostel report",
            s.leaves,
            cols(
              "id",
              "studentId",
              "departure",
              "expectedReturn",
              "status",
              "actor",
              "actualReturn",
            ),
          )}
        </>
      );
    }
    if (activeModule === "audit-logs")
      return (
        <>
          {heading(
            "Audit logs",
            "Browser-local demo events. These logs are editable client data, not tamper-proof audit records.",
          )}
          {table(
            "Audit events",
            s.audit,
            cols("id", "name", "actor", "date", "reference", "note"),
          )}
        </>
      );
    if (activeModule === "roles")
      return (
        <>
          {heading(
            "Roles & access",
            "Centralized demo permissions. Real authorization must be enforced on a server.",
          )}
          <div className="erp-role-grid">
            {roles.map((r) => (
              <section className="erp-panel" key={r}>
                <Shield />
                <h2>{r}</h2>
                <p>{permissions[r].map((m) => labels[m]).join(", ")}</p>
                <small>
                  Institution scope: {c.short}
                  {r === "Student" ? " / own student records" : ""}
                </small>
              </section>
            ))}
          </div>
        </>
      );
    if (activeModule === "settings")
      return <ConnectedPortal college={c} parts={parts} embedded />;
    if (activeModule === "__legacy-settings")
      return (
        <>
          {heading(
            "Workspace settings",
            "Manage the fictional dataset and local display preferences.",
          )}
          <section className="erp-panel erp-settings">
            <h2>Institution</h2>
            <p>{c.name}</p>
            <p>Academic year: {year === "all" ? "All years" : year}</p>
            <button
              onClick={() =>
                form(
                  "Institution details for PDF exports",
                  "institution.save",
                  [
                    ...[
                      ["address", "Institution address"],
                      ["state", "State / place of supply"],
                      ["email", "Institution email"],
                      ["phone", "Institution phone"],
                      ["website", "Institution website"],
                      ["gstin", "GSTIN (if registered)"],
                      ["registration", "Registration / affiliation reference"],
                    ].map(([key, label]) => ({
                      key,
                      label,
                      type: key === "address" ? "textarea" : "text",
                      value:
                        s.institution?.[
                          key as keyof NonNullable<typeof s.institution>
                        ] || "",
                      required: false,
                    })),
                  ],
                )
              }
            >
              Edit institution details
            </button>

            <label>
              <input
                type="checkbox"
                checked={compact}
                onChange={(e) => setCompact(e.target.checked)}
              />{" "}
              Compact sidebar
            </label>
            <h2>Reset demo data</h2>
            <p>
              Restores this institution’s original fictional records. The other
              college is unaffected.
            </p>
            <button
              className="erp-danger"
              onClick={() => {
                setConfirmation({
                  title: "Reset demo data",
                  description:
                    "Reset all demo changes for this college? This restores the original fictional records.",
                  confirm: reset,
                });
              }}
            >
              Reset Demo Data
            </button>
            <h2>Production integration requirements</h2>
            <p>
              Real use requires server-side authentication, authorization and
              tenant isolation; validated database transactions; protected
              document storage; append-only audit records; payment orders,
              signed webhooks, reconciliation and refunds; SMS provider
              credentials and consent; cryptographic certificate signing;
              encryption, rate limits, backups and retention controls.
            </p>
          </section>
        </>
      );
    return <ConnectedPortal college={c} parts={parts} embedded />;
  }
  /** Academic year / department / date filters (top bar, or inside the Student directory card). */
  const filterFields = (
    <>
      <label>
        Academic year
        <select
          aria-label="Academic year filter"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        >
          <option value="all">All academic years</option>
          {["2024-2025", "2025-2026", "2026-2027"].map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </label>
      <label>
        Department
        <select
          aria-label="Department filter"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        >
          <option value="all">All departments</option>
          {Array.from(new Set(c.programs.map((p) => p.department))).map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </label>
      <label>
        From
        <DateInput value={from} onChange={(e) => setFrom(e.target.value)} />
      </label>
      <label>
        To
        <DateInput value={to} onChange={(e) => setTo(e.target.value)} />
      </label>
      <button
        onClick={() => {
          setYear("all");
          setDepartment("all");
          setFrom("");
          setTo("");
        }}
      >
        Reset filters
      </button>
    </>
  );
  return (
    <div
      className={`college-erp ${!compact ? "erp-rail-expanded" : ""} ${compact ? "erp-compact" : ""} ${""}`}
      style={{ "--college-accent": c.accent } as React.CSSProperties}
    >
      <a href="#erp-content" className="erp-skip">
        Skip to content
      </a>
      <aside
        ref={sidebarRef}
        className={`erp-sidebar ${open ? "is-open" : ""}`}
      >
        <button
          className="erp-floating-toggle"
          aria-label={
            compact ? "Expand floating menu" : "Minimize floating menu"
          }
          aria-expanded={!compact}
          onClick={() => setCompact(!compact)}
        >
          <ChevronDown size={16} />
        </button>
        <div className="erp-sidebar-brand">
          <Link href={root}>
            <Image
              className="erp-brand-logo"
              src="/assets/pragathilogo.jpg"
              width={40}
              height={40}
              alt=""
            />
            <strong>{c.name}</strong>
          </Link>
          <button aria-label="Close sidebar" onClick={() => setOpen(false)}>
            <X size={17} />
          </button>
        </div>
        <small className="erp-sidebar-label">Campus workspace</small>
        <WorkspaceNavigation
          role={role!}
          allowedModules={modules}
          active={activeModule}
          labels={labels}
          nav={nav}
          close={() => setOpen(false)}
          compact={compact}
          expand={() => setCompact(false)}
        />
        <div className="erp-sidebar-foot">
          <button
            aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!compact}
            onClick={() => {
              setCompact(!compact);
            }}
          >
            <Menu size={17} />
            <span>{compact ? "Expand sidebar" : "Collapse sidebar"}</span>
          </button>
        </div>
      </aside>
      {open && (
        <button
          className="erp-scrim"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="erp-workspace">
        <header className="erp-topbar">
          <div className="erp-topbar-breadcrumb" aria-label="Breadcrumb">
            <Link href={`${root}/portal/${area}`}>{c.short}</Link>
            <span aria-hidden="true">/</span>
            <span>{labels[activeModule] || activeModule}</span>
            {detail && (
              <>
                <span aria-hidden="true">/</span>
                <span>{detail}</span>
              </>
            )}
          </div>
          <button
            className="erp-mobile-menu"
            aria-label="Open portal navigation"
            onClick={() => setOpen(true)}
          >
            <Menu size={21} />
          </button>
          <button
            className="erp-desktop-toggle"
            aria-label={compact ? "Expand navigation" : "Collapse navigation"}
            onClick={() => {
              setCompact(!compact);
            }}
          >
            <Menu size={18} />
          </button>
          <WorkspaceSearch
            state={s}
            role={role!}
            allowedModules={modules}
            labels={labels}
            nav={nav}
          />
          {modules.includes("notifications") && (
            <NotificationCenter
              rows={visibleNotices(s, role)}
              slug={`${c.slug}-${role}`}
              href={nav("notifications")}
            />
          )}
          {false}
          <details className="erp-header-actions">
            <summary>
              Quick actions <ChevronDown size={13} />
            </summary>
            <div
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("button,a"))
                  e.currentTarget.closest("details")?.removeAttribute("open");
              }}
            >
              {allowed("Super Admin", "Accounts Manager", "Student") && (
                <button onClick={() => collect()}>Collect fee</button>
              )}
              {allowed("Super Admin", "Admission Officer") && (
                <>
                  <button onClick={() => application()}>New admission</button>
                  <button onClick={() => studentForm()}>Add student</button>
                </>
              )}
              {allowed("Super Admin", "Certificate Officer", "Student") && (
                <button onClick={() => certificate()}>
                  Request certificate
                </button>
              )}
              {role === "Super Admin" && (
                <>
                  <Link href={nav("employees")}>Add faculty</Link>
                  <Link href={nav("timetable")}>Create timetable</Link>
                  <Link href={nav("bus-seating")}>Assign bus seat</Link>
                  <Link href={nav("assessments")}>Create assessment</Link>
                </>
              )}
              {canRead(role, "notifications") && (
                <Link href={nav("notifications")}>Campus announcements</Link>
              )}
            </div>
          </details>
          <details className="erp-profile-menu">
            <summary>
              <span className="erp-avatar">
                {role === "Student" ? "AS" : role === "Principal" ? "RS" : "AD"}
              </span>
              <span>
                <strong>{roleName || role}</strong>
                <small>{c.short}</small>
              </span>
              <ChevronDown size={14} />
            </summary>
            <div>
              <p>{String(account.login_id)}</p>
              <span>{roleName}</span>
              <button
                onClick={() => {
                  logout();
                }}
              >
                <LogOut size={14} /> Log out
              </button>
            </div>
          </details>
        </header>
        {activeModule === "dashboard" && (
          <div className="erp-campus-banner">
            <Image
              src={`/assets/colleges-institutions/${c.slug}/campus.webp`}
              alt={`${c.short} campus`}
              fill
              priority
              sizes="(max-width: 650px) 100vw, 85vw"
            />
            <div>
              <span>{c.short}</span>
              <strong>{"Learn today. Lead tomorrow."}</strong>
            </div>
            <span className="erp-campus-live">Campus workspace</span>
          </div>
        )}
        <main id="erp-content" className="erp-content">
          {activeModule !== "timetable" &&
            !entryScreens.includes(activeModule) &&
            !studentDirectory && (
              <>
                <button
                  className="erp-filter-toggle"
                  aria-expanded={filtersOpen}
                  aria-controls="erp-global-filters"
                  onClick={() => setFiltersOpen(!filtersOpen)}
                >
                  Filters{" "}
                  <span>
                    {
                      [
                        year !== "all",
                        department !== "all",
                        !!from,
                        !!to,
                      ].filter(Boolean).length
                    }{" "}
                    active
                  </span>
                  <ChevronDown size={14} />
                </button>
                <div
                  id="erp-global-filters"
                  className={`erp-filters ${filtersOpen ? "is-open" : ""}`}
                >
                  {filterFields}
                </div>
              </>
            )}
          {message && (
            <p className="erp-api-warning" role="status">
              {message}
            </p>
          )}
          {activeModule !== "roles" && !entryScreens.includes(activeModule) && (
            <div className="erp-api-controls">
              <span>College records</span>
              {/* The Student directory shows Manage beside "Add student" instead. */}
              {!studentDirectory && (
                <button
                  className="erp-primary"
                  onClick={() => {
                    setManageModule(null);
                    setFeeStructureId(null);
                    setApiOpen(true);
                  }}
                >
                  Manage {labels[activeModule] || activeModule}{" "}
                  <Plus size={15} />
                </button>
              )}
            </div>
          )}

          {[
            "accounts",
            "credentials",
            "forms",
            "imports",
            "documents",
          ].includes(activeModule) ? (
            <ConnectedPortal college={c} parts={parts} embedded />
          ) : (
            content()
          )}
        </main>
        <footer className="erp-footer">
          {c.name} / Campus management <span>{c.name}</span>
        </footer>
      </div>
      {apiOpen && (
        <div
          className="erp-api-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Manage college records"
        >
          <div className="erp-api-drawer">
            <header>
              <h2>{labels[activeModule] || activeModule}</h2>
              <button
                onClick={() => {
                  setApiOpen(false);
                  window.dispatchEvent(new Event("edunexa:records-changed"));
                }}
                aria-label="Close record management"
              >
                <X size={20} />
              </button>
            </header>
            {(manageModule || activeModule) === "fee-structures" ? (
              <FeeStructureManager initialId={feeStructureId} />
            ) : (
              <ConnectedPortal
                college={c}
                parts={["portal", area, manageModule || activeModule]}
                embedded
                openPrimaryForm
              />
            )}
          </div>
        </div>
      )}
      <ERPActionDrawer
        action={confirmation}
        close={() => setConfirmation(null)}
      />
      <dialog
        className="erp-modal"
        data-panel-size={
          (modal?.fields.length || 0) > 12
            ? "wide"
            : (modal?.fields.length || 0) > 5
              ? "medium"
              : "compact"
        }
        ref={dialog}
        onClose={() => setModal(null)}
        aria-labelledby="erp-modal-title"
      >
        <div className="erp-panel-title">
          <h2 id="erp-modal-title">{modal?.title}</h2>
          <button
            aria-label="Close form"
            onClick={() => {
              dialog.current?.close();
              setModal(null);
            }}
          >
            <X size={20} />
          </button>
        </div>
        {modal && (
          <form onSubmit={submit}>
            <p className="erp-help">
              Use fictional information only. Changes update this college’s demo
              records.
            </p>
            <ERPFormFields
              key={`${modal.type}-${modal.id || "new"}`}
              fields={modal.fields}
              type={modal.type}
              onBusyChange={setFormBusy}
            />
            <p role="alert">
              {message && message !== "Saved successfully" ? message : ""}
            </p>
            <div className="erp-modal-actions">
              <button type="button" onClick={() => dialog.current?.close()}>
                Cancel
              </button>
              <button className="erp-primary" type="submit" disabled={formBusy}>
                {modal.type === "payment"
                  ? "Confirm simulated payment"
                  : "Save changes"}{" "}
                <Check size={16} />
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
