"use client";
import PersonFiles from "./PersonFiles";
import PersonPhoto from "./PersonPhoto";
import { courseLevelLabel } from "@/lib/colleges/person-photo";
import { studentCourseLabels } from "@/lib/colleges/student-course-labels";
import AcademicYearForm from "./AcademicYearForm";
import TableColumnFilter from "./TableColumnFilter";
import StudentEnrollmentDetails from "./StudentEnrollmentDetails";
import {
  studentEditForm,
  studentEditValues,
} from "@/lib/colleges/student-edit-form";
import {
  useCallback,
  useEffect,
  useState,
  useRef,
  type FormEvent,
} from "react";
import { collegeRoot, type College } from "@/data/colleges";
import "./connected-portal.css";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Download,
  FileText,
  Info,
  RefreshCw,
  Plus,
  Search,
} from "lucide-react";
import { excelTable, headerLabel, pdfTable } from "@/lib/colleges/export-table";
/** Admin / configuration screens: no Excel or PDF export (not record registers). */
const NO_EXPORT_SCREENS = new Set([
  "roles",
  "forms",
  "imports",
  "accounts",
  "credentials",
  "documents",
  "settings",
  "course-setup",
]);
import {
  DOWNLOAD_KIND_BY_TABLE,
  FINANCE_SUMMARY_SCREENS,
  api,
  ApiError,
  SCREEN_CATALOG,
  STAFF_SCREENS,
  errorText,
  fileToBase64,
  type Account,
  type MeResponse,
  type Field,
  type Resource,
  type Row,
  type Screen,
  type ScreenSummary,
  type SignInRole,
  type WorkflowAction as Action,
} from "@/services/api";
import {
  rememberRole,
  selectedRole,
  roleScreens,
  roleScreen,
  workspacePath,
} from "@/lib/colleges/role-navigation";
import { useOptionalCollege } from "./CollegeStore";
import PortalShellSkeleton from "./PortalShellSkeleton";
import WorkspaceSkeleton from "./WorkspaceSkeleton";
import {
  readWorkspaceCache,
  prepareWorkspaceSession,
  refreshWorkspaceCache,
  workspaceCacheKey,
  writeWorkspaceCache,
  clearWorkspaceCache,
} from "@/lib/colleges/workspace-cache";
import EntryForm from "./RecordFormDrawer";
import { feeHeadForm } from "@/lib/colleges/fee-head-form";
import ConfigurationEditor from "./ConfigurationEditor";
import PersonalPortal from "./PersonalPortal";
import StudentEnrollmentWizard from "./enrollment/StudentEnrollmentWizard";
import StaffOnboardingForm from "./staff/StaffOnboardingForm";
import StaffDirectory from "./staff/StaffDirectory";
import CourseCards from "./CourseCards";
import { toast, useErrorToast } from "./toast";
import CollegeLogin from "./CollegeLogin";
import UploadBox from "./UploadBox";
import IconAction from "./IconAction";
import { formatDate } from "./DateInput";
import { alignClass } from "./table-align";
export type { Field };
const pretty = (key: string) => key.replaceAll("_", " ").replaceAll("-", " ");
/** Nested values (e.g. previous education) as "Board: SSC; Grade: 9.5" instead of raw JSON. */
const readable = (value: unknown): string =>
  Array.isArray(value)
    ? Array.from(new Set(value.map(readable).filter(Boolean))).join(", ")
    : typeof value === "boolean"
      ? value
        ? "Yes"
        : "No"
      : value !== null && typeof value === "object"
        ? Object.entries(value)
            .filter(([, v]) => v !== null && v !== undefined && v !== "")
            .map(([k, v]) => `${headerLabel(k)}: ${readable(v)}`)
            .join("; ")
        : formatDate(String(value ?? ""));
const text = (value: unknown): string =>
  value === null || value === undefined ? "—" : readable(value) || "—";
/** A nested record (e.g. previous education) shown as a label / value list in its cell. */
const isDetails = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const ACRONYMS = /^(ssc|cbse|icse|mpc|bpc|mec|cec|gpa|cgpa)$/i;
function Details({ value }: { value: Record<string, unknown> }) {
  const entries = Object.entries(value).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );
  if (!entries.length) return <>—</>;
  return (
    <dl className="edu-kv">
      {entries.map(([k, v]) => {
        const shown = readable(v);
        return (
          <div key={k}>
            <dt>{headerLabel(k)}</dt>
            <dd>{ACRONYMS.test(shown) ? shown.toUpperCase() : shown}</dd>
          </div>
        );
      })}
    </dl>
  );
}
/** Administration screens whose content is a list from their own endpoint. */
function specialRows(screen: string): Promise<Row[]> {
  if (screen === "roles") return api.administration.roles();
  if (screen === "accounts" || screen === "credentials")
    return api.administration.accounts();
  if (screen === "forms") return api.forms.list();
  if (screen === "audit-logs") return api.administration.audit();
  return Promise.resolve([]);
}
type ScreenSnapshot = {
  spec: Screen;
  first: Resource | null;
  records: {
    items: Row[];
    total: number;
    filter_options?: Record<string, string[]>;
  };
  totals: Row | null;
  extra: Row[];
};
/**
 * Screens whose "create" is a complete data-entry form (several tables in one step) rather than a
 * single-table record: the value is the master data form's key.
 */
const PRIMARY_FORMS: Record<string, string> = {
  "student-enrollment": "enroll-student",
  "course-setup": "create-course",
  "fee-structures": "course-fee-structure",
};
/** Page size per table: the course catalog shows every course at once. */
const pageSize = (table?: string) => (table === "programs" ? 200 : undefined);
/** Screens that show only their data-entry form button (everything is inside that form). */
const PRIMARY_ONLY = new Set(["student-enrollment"]);
/** Screens whose forms sit in the page header (no table picker or search box). */
const HEADER_ACTIONS = new Set<string>();
export default function ConnectedPortal({
  college,
  parts,
  embedded = false,
  loginRedirect = false,
  loginError,
  openPrimaryForm = false,
}: {
  college: College;
  parts: string[];
  embedded?: boolean;
  loginRedirect?: boolean;
  /** Show access failures in the sign-in form without restoring the rejected workspace. */
  loginError?: string;
  /** Open the screen's data-entry form as soon as it is available (e.g. from "Manage …"). */
  openPrimaryForm?: boolean;
}) {
  const shared = useOptionalCollege();
  const sessionAccount = loginError ? null : shared?.account || null;
  const sessionRole = loginError ? null : shared?.activeRole || null;
  const sessionScreens = loginError ? undefined : shared?.assignedScreens;
  const router = useRouter();
  const initialSelection =
    parts.length > 2 ? parts.at(-1) || "dashboard" : "dashboard";
  const initialCacheKey = workspaceCacheKey(
    sessionAccount?.code,
    sessionRole?.code,
    `screen:${initialSelection}`,
  );
  const cachedInitial = readWorkspaceCache<ScreenSnapshot>(initialCacheKey);
  const identityRef = useRef(sessionAccount?.code || "");
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>(
    {},
  );
  const [filterOptions, setFilterOptions] = useState<Record<string, string[]>>(
    {},
  );
  const [pageOffset, setPageOffset] = useState(0);
  const [validatingWorkbook, setValidatingWorkbook] = useState(false);
  const studentFilterRequest = useRef({ path: "", query: "" });
  const [studentInfo, setStudentInfo] = useState<Row | null>(null);
  const [fileOwner, setFileOwner] = useState<{
    personKind: "student" | "employee" | "application";
    personCode: string;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [displayRole, setDisplayRole] = useState(sessionRole);
  const requestSequence = useRef(0);
  const activeRoleRef = useRef<ReturnType<typeof selectedRole>>(sessionRole);
  const [landing, setLanding] = useState("");
  const [account, setAccount] = useState<Account | null>(sessionAccount),
    [screens, setScreens] = useState<ScreenSummary[]>([]),
    [selected, setSelected] = useState(
      parts.length > 2 ? parts.at(-1) || "dashboard" : "dashboard",
    ),
    [screen, setScreen] = useState<Screen | null>(cachedInitial?.spec || null),
    [resource, setResource] = useState<Resource | null>(
      cachedInitial?.first || null,
    ),
    [rows, setRows] = useState<Row[]>(cachedInitial?.records.items || []),
    [total, setTotal] = useState(cachedInitial?.records.total || 0),
    [actions, setActions] = useState<Action[]>([]),
    [summary, setSummary] = useState<Row | null>(cachedInitial?.totals || null),
    [error, setError] = useState(loginError || ""),
    [busy, setBusy] = useState(!loginError && !cachedInitial),
    [filter, setFilter] = useState(""),
    [dialog, setDialog] = useState<{
      resourceName?: string;
      title: string;
      fields: Field[];
      initial?: Row;
      save: (r: Row) => Promise<void>;
    } | null>(null);
  const ActiveEntryForm =
    dialog?.resourceName === "academic_years" &&
    (!dialog.initial?.code || dialog.initial?.program_code)
      ? AcademicYearForm
      : EntryForm;
  useErrorToast(loginRedirect ? "" : error);
  const [special, setSpecial] = useState<Row[]>(cachedInitial?.extra || []);
  const [signInRoles, setSignInRoles] = useState<SignInRole[]>([]),
    [signInRole, setSignInRole] = useState(""),
    [signingIn, setSigningIn] = useState(false);
  const [configuration, setConfiguration] = useState<{
    kind: "role" | "form" | "account";
    initial?: Row;
  } | null>(null);
  const load = useCallback(async (name: string) => {
    const sequence = ++requestSequence.current;
    const key = workspaceCacheKey(
      identityRef.current,
      activeRoleRef.current?.code,
      `screen:${name}`,
    );
    const cached = readWorkspaceCache<ScreenSnapshot>(key);
    const apply = (snapshot: ScreenSnapshot) => {
      setScreen(snapshot.spec);
      setResource(snapshot.first);
      setRows(snapshot.records.items);
      setTotal(snapshot.records.total);
      setFilterOptions(snapshot.records.filter_options || {});
      setPageOffset(0);
      setSummary(snapshot.totals);
      setSpecial(snapshot.extra);
    };
    setError("");
    setBusy(!cached);
    setRefreshing(!!cached);
    if (cached) apply(cached);
    else {
      setRows([]);
      setSpecial([]);
      setSummary(null);
      setResource(null);
      setScreen(null);
    }
    try {
      const snapshot = await refreshWorkspaceCache(key, async () => {
        const rawSpec = await api.workspace.screen(name);
        const spec = activeRoleRef.current
          ? roleScreen(rawSpec, activeRoleRef.current)
          : rawSpec;
        const first = spec.resources[0] || null;
        const [records, totals, extra] = await Promise.all([
          first && !STAFF_SCREENS[name]
            ? api.workspace.list(first.path, 0, pageSize(first.name))
            : Promise.resolve({ items: [], total: 0 }),
          FINANCE_SUMMARY_SCREENS.includes(name)
            ? api.finance.summary().catch(() => null)
            : Promise.resolve(null),
          specialRows(name),
        ]);
        if (first?.name === "students")
          records.items = await studentCourseLabels(
            records.items,
            workspaceCacheKey(
              identityRef.current,
              activeRoleRef.current?.code,
              "student-course-labels",
            ),
          );
        return { spec, first, records, totals: totals as Row | null, extra };
      });
      if (sequence === requestSequence.current) apply(snapshot);
    } catch (e) {
      if (sequence === requestSequence.current) {
        if (e instanceof ApiError && [401, 403].includes(e.status)) {
          clearWorkspaceCache();
          setRows([]);
          setSpecial([]);
          setSummary(null);
          setResource(null);
          setScreen(null);
          window.dispatchEvent(
            new CustomEvent("edunexa:records-changed", {
              detail: { permissions: true },
            }),
          );
          setError(errorText(e));
        } else
          setError(
            `${cached ? "Could not refresh; showing cached records. " : ""}${errorText(e)}`,
          );
      }
    } finally {
      if (sequence === requestSequence.current) {
        setBusy(false);
        setRefreshing(false);
      }
    }
  }, []);
  const initialize = useCallback(
    async (person: Account, preferred: string) => {
      const active = activeRoleRef.current;
      const personal =
        ["student", "parent"].includes(String(person.person_type)) ||
        ["teaching", "self"].includes(String(person.workspace_scope));
      // A workspace's cached screens may be empty after session expiry, or belong
      // to a previously selected role. Derive access from the verified role and
      // full catalog rather than filtering that stale subset again.
      const availableScreens = roleScreens(SCREEN_CATALOG, active);
      if (!active)
        throw Error(
          "No role has been assigned to this account. Contact your college administrator.",
        );
      if (!personal && availableScreens.length === 0)
        throw Error(
          "This role has no workspace access. Contact your college administrator or choose another assigned role.",
        );
      identityRef.current = person.code;
      setDisplayRole(activeRoleRef.current);
      setAccount(person);
      if (
        ["student", "parent"].includes(String(person.person_type)) ||
        ["teaching", "self"].includes(String(person.workspace_scope))
      ) {
        if (loginRedirect && activeRoleRef.current) {
          prepareWorkspaceSession(college.slug, {
            me: { account: person, roles: [activeRoleRef.current] },
            active: activeRoleRef.current,
            screens: [],
          });
          setLanding(
            workspacePath(collegeRoot(college), activeRoleRef.current, [
              { key: "dashboard", title: "Dashboard", resources: [] },
            ]),
          );
        }
        setBusy(false);
        return;
      }
      // The screen catalog ships with the dashboard; the role decides which screens appear.
      const navigation = {
        screens: availableScreens,
      };
      setScreens(navigation.screens);
      if (loginRedirect && activeRoleRef.current) {
        prepareWorkspaceSession(college.slug, {
          me: { account: person, roles: [activeRoleRef.current] },
          active: activeRoleRef.current,
          screens: navigation.screens,
        });
        setLanding(
          workspacePath(
            collegeRoot(college),
            activeRoleRef.current,
            navigation.screens,
          ),
        );
        setBusy(false);
        return;
      }
      const first = navigation.screens.some((s) => s.key === preferred)
        ? preferred
        : navigation.screens[0]?.key || "dashboard";
      setSelected(first);
      void Promise.all([
        api.workflows.list().catch(() => ({ actions: [] })),
        api.masterData.actions().catch(() => ({ actions: [] })),
      ]).then(([workflow, masterData]) =>
        setActions([...workflow.actions, ...masterData.actions]),
      );
      await load(first);
    },
    [load, loginRedirect, college],
  );
  /** Enter the workspace; `known` is the account and roles the login response already gave. */
  async function start(known?: MeResponse, requestedRole?: string) {
    const me = known || (await api.auth.me());
    const active = requestedRole
      ? me.roles.find((role) => role.code === requestedRole) || null
      : selectedRole(me);
    if (!active)
      throw Error(
        requestedRole
          ? "Your account is not assigned to the selected role. Choose your assigned role and try again."
          : "No role has been assigned to this account. Contact your college administrator.",
      );
    rememberRole(me.account.code, active.code);
    activeRoleRef.current = active;
    await initialize(
      {
        ...me.account,
        workspace_scope: active?.scope || me.account.workspace_scope,
      },
      selected,
    );
  }
  useEffect(() => {
    if (loginError) return;
    let active = true;
    const initializeSession = async () => {
      if (sessionAccount && sessionRole) {
        activeRoleRef.current = sessionRole;
        await initialize(sessionAccount, initialSelection);
        return;
      }
      const me = await api.auth.me();
      if (!active) return;
      const chosen = selectedRole(me);
      activeRoleRef.current = chosen;
      await initialize(
        {
          ...me.account,
          workspace_scope: chosen?.scope || me.account.workspace_scope,
        },
        initialSelection,
      );
    };
    void Promise.resolve()
      .then(initializeSession)
      .catch((e) => {
        if (active) {
          setAccount(null);
          setLanding("");
          setBusy(false);
          // No session yet is the normal state of the sign-in page, not an error.
          if (!(e instanceof ApiError && e.status === 401))
            setError(errorText(e));
        }
      });
    return () => {
      active = false;
    };
  }, [initialize, initialSelection, sessionAccount, sessionRole, loginError]);
  useEffect(() => {
    if (account) return;
    let active = true;
    void api.auth
      .signInRoles()
      .then(({ roles: list }) => {
        if (!active) return;
        setSignInRoles(list);
        setSignInRole((old) => old || list[0]?.code || "");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [account]);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signingIn) return;
    setSigningIn(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const signedIn = await api.auth.login({
        login_id: String(form.get("login")).trim(),
        password: String(form.get("password")),
        ...(signInRole ? { role_code: signInRole } : {}),
      });
      await start(
        signedIn.roles
          ? { account: signedIn.account, roles: signedIn.roles }
          : undefined,
        signInRole || undefined,
      );
    } catch (e) {
      setAccount(null);
      setLanding("");
      setError(
        e instanceof ApiError && e.status === 401
          ? "Login ID or password is incorrect. Please try again."
          : e instanceof ApiError && e.status === 403
            ? "Your account does not have access to the selected role. Choose your assigned role and try again."
            : e instanceof ApiError && e.status === 429
              ? "Sign-in is temporarily paused after several unsuccessful attempts. Please wait 15 minutes before trying again."
              : errorText(e),
      );
      setBusy(false);
    } finally {
      setSigningIn(false);
    }
  }
  async function refreshResource(r: Resource, offset = 0) {
    const sequence = ++requestSequence.current;
    const key = workspaceCacheKey(
      identityRef.current,
      activeRoleRef.current?.code,
      `resource:${r.path}:${offset}:${selected === "student-enrollment" && r.name === "students" ? JSON.stringify({ column_filters: JSON.stringify(columnFilters), search: filter }) : ""}`,
    );
    const cached = readWorkspaceCache<{ items: Row[]; total: number }>(key);
    setResource(r);
    setBusy(!cached);
    setRefreshing(!!cached);
    setError("");
    if (cached) {
      setRows(cached.items);
      setTotal(cached.total);
    } else setRows([]);
    try {
      const result = await refreshWorkspaceCache(key, async () => {
        const page = await api.workspace.list(
          r.path,
          offset,
          pageSize(r.name),
          selected === "student-enrollment" && r.name === "students"
            ? { column_filters: JSON.stringify(columnFilters), search: filter }
            : {},
        );
        if (r.name === "students")
          page.items = await studentCourseLabels(
            page.items,
            workspaceCacheKey(
              identityRef.current,
              activeRoleRef.current?.code,
              "student-course-labels",
            ),
          );
        return page;
      });
      if (sequence !== requestSequence.current) return;
      setRows(result.items);
      setTotal(result.total);
      if (result.filter_options) setFilterOptions(result.filter_options);
      setPageOffset(offset);
      const screenKey = workspaceCacheKey(
        identityRef.current,
        activeRoleRef.current?.code,
        `screen:${selected}`,
      );
      const snapshot = readWorkspaceCache<ScreenSnapshot>(screenKey);
      if (
        snapshot?.first?.name === r.name &&
        offset === 0 &&
        !filter &&
        Object.keys(columnFilters).length === 0
      )
        writeWorkspaceCache(screenKey, { ...snapshot, records: result });
    } catch (e) {
      if (sequence === requestSequence.current) setError(errorText(e));
    } finally {
      if (sequence === requestSequence.current) {
        setBusy(false);
        setRefreshing(false);
      }
    }
  }
  const studentResourcePath =
    resource?.name === "students" ? resource.path : "";
  useEffect(() => {
    if (selected !== "student-enrollment" || !studentResourcePath) return;
    const query = JSON.stringify({ columnFilters, filter });
    if (studentFilterRequest.current.path !== studentResourcePath) {
      studentFilterRequest.current = { path: studentResourcePath, query: "" };
      // The screen's initial request already loaded the unfiltered records.
      if (!filter && Object.keys(columnFilters).length === 0) {
        studentFilterRequest.current.query = query;
        return;
      }
    }
    if (studentFilterRequest.current.query === query) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      studentFilterRequest.current = { path: studentResourcePath, query };
      const sequence = ++requestSequence.current;
      setRefreshing(true);
      try {
        const result = await api.workspace.list(
          studentResourcePath,
          0,
          pageSize("students"),
          { column_filters: JSON.stringify(columnFilters), search: filter },
        );
        if (active && sequence === requestSequence.current) {
          setRows(result.items);
          setTotal(result.total);
          if (result.filter_options) setFilterOptions(result.filter_options);
          setPageOffset(0);
          setError("");
        }
      } catch (e) {
        if (active && sequence === requestSequence.current)
          setError(errorText(e));
      } finally {
        if (active && sequence === requestSequence.current)
          setRefreshing(false);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [selected, studentResourcePath, columnFilters, filter]);
  const edit = async (row?: Row) => {
    if (!resource || (!row && selected === "student-enrollment")) return;
    const current = resource;
    try {
      const bound = await api.workspace.resourceForm(
        current.name,
        row ? String(row.code) : undefined,
      );
      const form = bound.form;
      const customFields = form ? form.fields : [];
      const fields = current.fields.map((f) => {
        const override = customFields.find((c) => c.key === f.name);
        return override
          ? {
              ...f,
              label: override.label,
              required: f.required || override.required,
              choices: override.options,
            }
          : f;
      });
      for (const field of customFields)
        if (!fields.some((f) => f.name === field.key))
          fields.push({ ...field, name: field.key, choices: field.options });
      let configured = {
        fields,
        initial: { ...bound.defaults, ...row, ...bound.values },
      };
      if (current.name === "fee_heads") {
        const existing: Row[] = [];
        for (;;) {
          const page = await api.workspace.list(
            current.path,
            existing.length,
            100,
          );
          existing.push(...page.items);
          if (!page.items.length || existing.length >= page.total) break;
        }
        configured = feeHeadForm(fields, configured.initial, existing);
      }
      if (current.name === "students")
        configured = studentEditForm(configured.fields, configured.initial);
      setDialog({
        resourceName: current.name,
        title: (row ? "Edit " : "Create ") + current.title,
        fields: configured.fields,
        initial: configured.initial,
        save: async (values) => {
          const payload = {
            values:
              current.name === "students"
                ? studentEditValues(values, configured.initial)
                : values,
            form_code: form?.code,
            form_revision: form?.revision,
          };
          if (row)
            await api.workspace.update(current.name, String(row.code), payload);
          else await api.workspace.create(current.name, payload);
          await refreshResource(current);
        },
      });
    } catch (e) {
      setError(errorText(e));
    }
  };
  /** The data-entry form that "Create" opens on this screen, when the user may use it. */
  const primaryForm =
    resource?.name === "academic_years"
      ? undefined
      : actions.find((a) => a.key === PRIMARY_FORMS[selected]);
  const primaryOpened = useRef(false);
  /** Student enrollment uses the full wizard (student, guardian, course, fees, review). */
  const [wizard, setWizard] = useState(false);
  async function saveAction(action: Action, values: Row) {
    await api.workflows.run(action, values);
    if (values.administrator_employee_code) {
      // The transaction linked the bootstrap account. Reload its identity and action
      // descriptors so another approval does not submit the old employee-link field.
      const [me, workflows, masterData] = await Promise.all([
        api.auth.me(),
        api.workflows.list(),
        api.masterData.actions(),
      ]);
      setAccount(me.account);
      setActions([...workflows.actions, ...masterData.actions]);
    }
    await load(selected);
  }
  const runAction = (action: Action) =>
    action.key === "enroll-student"
      ? setWizard(true)
      : setDialog({
          title: action.label,
          fields: action.fields,
          save: async (values) => {
            await saveAction(action, values);
          },
        });
  // Opened from "Manage …": student enrollment shows the wizard until it is closed once.
  const [wizardDismissed, setWizardDismissed] = useState(false);
  /** Teaching staff, non-teaching staff and daily labour use the staff onboarding form. */
  const staffKind = STAFF_SCREENS[selected];
  const [staffForm, setStaffForm] = useState(false);
  const [staffDismissed, setStaffDismissed] = useState(false);
  const [staffReload, setStaffReload] = useState(0);
  const staffFormOpen =
    !!staffKind && (staffForm || (openPrimaryForm && !staffDismissed));
  const wizardOpen =
    wizard ||
    (openPrimaryForm &&
      !wizardDismissed &&
      primaryForm?.key === "enroll-student" &&
      !!screen);
  useEffect(() => {
    if (
      !openPrimaryForm ||
      primaryOpened.current ||
      !primaryForm ||
      !screen ||
      primaryForm.key === "enroll-student"
    )
      return;
    primaryOpened.current = true;
    setDialog({
      title: primaryForm.label,
      fields: primaryForm.fields,
      save: async (values) => {
        await api.workflows.run(primaryForm, values);
        await load(selected);
      },
    });
  }, [openPrimaryForm, primaryForm, screen, load, selected]);
  /** Run a download and show its error, if any, in the screen banner. */
  async function download(task: () => Promise<void>) {
    try {
      await task();
    } catch (e) {
      setError(errorText(e));
    }
  }
  if (account && loginRedirect && landing) {
    return (
      <TemplateRedirect
        href={landing}
        college={college}
        reloadWorkspace={!!shared}
      />
    );
  }
  if (loginRedirect && account && !landing)
    return <PortalShellSkeleton college={college} />;
  if (!account && busy) return <PortalShellSkeleton college={college} />;
  if (!account && embedded)
    return (
      <p className="erp-api-warning" role="alert">
        Your session could not be verified. Refresh the page to try again.
      </p>
    );
  if (!account)
    return (
      <CollegeLogin
        college={college}
        roles={signInRoles}
        role={signInRole}
        signingIn={signingIn}
        error={error}
        onSubmit={login}
        onRoleChange={(value) => {
          setSignInRole(value);
          setError("");
        }}
      />
    );
  if (
    ["student", "parent"].includes(String(account.person_type)) ||
    ["teaching", "self"].includes(String(account.workspace_scope))
  )
    return (
      <>
        <PersonalPortal
          name={college.short}
          signOut={async () => {
            try {
              clearWorkspaceCache();
              await api.auth.logout();
            } finally {
              setAccount(null);
            }
          }}
          openForm={setDialog}
        />
        {dialog && (
          <ActiveEntryForm
            title={dialog.title}
            fields={dialog.fields}
            initial={dialog.initial}
            onSave={dialog.save}
            onClose={() => setDialog(null)}
          />
        )}
      </>
    );
  const studentRegister =
    selected === "student-enrollment" && resource?.name === "students";
  const studentTable = resource?.name === "students";
  const studentHeaders: Record<string, string> = {
    student_name: "Student name",
    course_level: "Course level",
    course_name: "Course / branch",
    profile_photo_url: "Photo",
    admission_number: "Admission number",
    university_registration_number: "University registration number",
    batch_year: "Batch year",
    status: "Status",
    email: "Email",
  };
  const columnLabel = (key: string) =>
    resource?.name === "academic_years"
      ? {
          name: "Batch",
          program_code: "Course",
          start_date: "Start date",
          end_date: "End date",
          dates_need_review: "Dates need review",
        }[key] || headerLabel(key)
      : key === "profile_photo_url"
        ? "Photo"
        : studentTable
          ? studentHeaders[key] || headerLabel(key)
          : headerLabel(key);
  const cellValue = (row: Row, key: string) =>
    key === "student_name"
      ? [row.first_name, row.middle_name, row.last_name]
          .filter(Boolean)
          .join(" ") ||
        row.student_name ||
        row.name ||
        row.code
      : key === "course_level"
        ? courseLevelLabel(row[key])
        : row[key];
  const columns = studentTable
    ? Object.keys(studentHeaders)
    : resource?.name === "academic_years"
      ? ["name", "program_code", "start_date", "end_date", "dates_need_review"]
      : Array.from(
          new Set(
            rows.length
              ? rows.flatMap((row) => Object.keys(row))
              : resource?.fields
                  .slice(0, 8)
                  .map((field) => field.name || field.key || "") || [],
          ),
        ).filter(
          (k) =>
            ![
              "storage_key",
              "profile_photo_storage_key",
              "request",
              "staged_rows",
              "password_hash",
            ].includes(k),
        );
  const cards = resource?.name === "programs";
  /** Delete a record; `confirmed` when the card already asked (course cards confirm inline). */
  async function removeRow(row: Row, confirmed = false) {
    if (
      !resource ||
      (!confirmed && !confirm(`Delete ${String(row.name ?? row.code)}?`))
    )
      return;
    try {
      await api.workspace.remove(resource.path, String(row.code));
      toast.success(`${String(row.name ?? row.code)} deleted successfully`);
      await refreshResource(resource);
    } catch (e) {
      setError(errorText(e));
      if (confirmed) throw e;
    }
  }
  /** Business actions of this screen besides its main form. */
  const screenActions = PRIMARY_ONLY.has(selected)
    ? []
    : actions.filter(
        (a) =>
          a.key !== primaryForm?.key &&
          screen?.resources.some((r) => r.name === a.resource),
      );
  const visibleRows = rows.filter(
    (row) =>
      JSON.stringify(row).toLowerCase().includes(filter.toLowerCase()) &&
      (!studentRegister ||
        Object.entries(columnFilters).every(([key, values]) =>
          values.includes(String(cellValue(row, key) || "")),
        )),
  );
  /** Excel / PDF of the table as shown (current search applied), on record screens only. */
  const canExport =
    !!resource &&
    !cards &&
    !staffKind &&
    visibleRows.length > 0 &&
    !NO_EXPORT_SCREENS.has(selected);
  const exportTitle = resource?.title || headerLabel(selected);
  const exportFile = `${selected}-${new Date().toISOString().slice(0, 10)}`;
  const exportKeys = columns.filter((key) => key !== "profile_photo_url");
  const exportColumns = exportKeys.map(columnLabel);
  const exportRows = () =>
    visibleRows.map((row) => exportKeys.map((k) => text(cellValue(row, k))));
  const exportExcel = () =>
    excelTable(exportFile, exportTitle, exportColumns, exportRows());
  const exportPdf = async () => {
    try {
      await pdfTable(
        exportFile,
        exportTitle,
        `${visibleRows.length} of ${total} records`,
        exportColumns,
        exportRows(),
      );
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <main
      className={`edu-connected edu-workspace ${selected === "course-setup" ? "edu-course-workspace" : ""} ${embedded ? "edu-embedded" : ""}`}
    >
      {!embedded && (
        <aside>
          <div className="edu-brand">
            <Image
              src={`/assets/colleges-institutions/${college.slug}/crest.svg`}
              alt=""
              width={34}
              height={40}
            />
            <strong>{college.short}</strong>
          </div>
          <p>{String(account.login_id)}</p>
          <nav aria-label="College modules">
            {screens.map((s) => (
              <button
                key={s.key}
                className={s.key === selected ? "active" : ""}
                onClick={() => {
                  setSelected(s.key);
                  setFilter("");
                  void load(s.key);
                }}
              >
                {s.title}
              </button>
            ))}
          </nav>
          <button
            onClick={async () => {
              try {
                clearWorkspaceCache();
                await api.auth.logout();
              } finally {
                setAccount(null);
              }
            }}
          >
            Sign out
          </button>
        </aside>
      )}
      <section
        className={`edu-content ${selected === "student-enrollment" ? "edu-enroll" : ""}`}
      >
        <header
          className={`edu-heading ${staffKind ? "edu-staff-heading-hidden" : ""}`}
        >
          <div>
            <p>College administration</p>
            <h1>
              {screen?.title ||
                sessionScreens?.find((s) => s.key === selected)?.title ||
                pretty(selected)}
            </h1>
            {selected === "course-setup" && (
              <p className="crs-page-description">
                Manage courses, dated batches, semesters and enrollments in one
                place.
              </p>
            )}
          </div>
          <div className="edu-row-actions">
            {HEADER_ACTIONS.has(selected) && (
              <>
                {primaryForm && (
                  <button
                    className="edu-primary"
                    onClick={() => runAction(primaryForm)}
                  >
                    <Plus size={15} aria-hidden="true" /> {primaryForm.label}
                  </button>
                )}
                <div className="crs-header-desktop">
                  {screenActions.map((a) => (
                    <button key={a.key} onClick={() => runAction(a)}>
                      {a.label}
                    </button>
                  ))}
                </div>
                <details className="crs-header-more">
                  <summary>More actions</summary>
                  <div>
                    {screenActions.map((a) => (
                      <button
                        key={a.key}
                        onClick={(e) => {
                          e.currentTarget
                            .closest("details")
                            ?.removeAttribute("open");
                          runAction(a);
                        }}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </details>
              </>
            )}
            {displayRole?.system_admin && (
              <button
                onClick={() =>
                  setDialog({
                    title: "Change password",
                    fields: [
                      {
                        key: "current_password",
                        label: "Current password",
                        type: "password",
                        required: true,
                      },
                      {
                        key: "new_password",
                        label: "New password (12 or more characters)",
                        type: "password",
                        required: true,
                      },
                    ],
                    save: async (values) => {
                      await api.auth.changePassword({
                        current_password: String(values.current_password),
                        new_password: String(values.new_password),
                      });
                      setAccount(null);
                    },
                  })
                }
              >
                Change password
              </button>
            )}
            <button
              className="edu-icon-button"
              onClick={() =>
                selected === "student-enrollment" && resource
                  ? refreshResource(resource)
                  : load(selected)
              }
              disabled={busy}
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw size={17} className={refreshing ? "edu-spin" : ""} />
            </button>
          </div>
        </header>
        {error && (
          <p className="edu-error" role="alert">
            {error}
          </p>
        )}
        {busy && <WorkspaceSkeleton label="Loading screen data" />}
        {refreshing && (
          <p className="erp-background-refresh" role="status">
            Updating records…
          </p>
        )}
        {summary && (
          <section className="edu-summary">
            {Object.entries(summary).map(([k, v]) => (
              <div key={k}>
                <span>{pretty(k)}</span>
                <strong>{text(v)}</strong>
              </div>
            ))}
          </section>
        )}
        <div className="edu-card">
          <div className="edu-toolbar" hidden={!!staffKind}>
            {resource && !HEADER_ACTIONS.has(selected) && !staffKind && (
              <>
                <select
                  aria-label="Screen resource"
                  value={resource.name}
                  onChange={(e) => {
                    const r = screen?.resources.find(
                      (r) => r.name === e.target.value,
                    );
                    if (r) void refreshResource(r);
                  }}
                >
                  {screen?.resources.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.title}
                    </option>
                  ))}
                </select>
                {selected === "student-enrollment" ? (
                  <>
                    <label className="stf-search">
                      <Search size={15} aria-hidden="true" />
                      <input
                        type="search"
                        aria-label="Search records"
                        placeholder="Search by name, admission no. or email"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      />
                    </label>
                    <p className="edu-count">
                      {visibleRows.length} of {total} records
                    </p>
                    {Object.keys(columnFilters).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setColumnFilters({})}
                      >
                        Clear column filters
                      </button>
                    )}
                  </>
                ) : (
                  <input
                    aria-label="Search records"
                    placeholder="Search this page"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                )}
                {primaryForm ? (
                  <button
                    className="edu-primary"
                    onClick={() => runAction(primaryForm)}
                  >
                    <Plus size={15} aria-hidden="true" /> {primaryForm.label}
                  </button>
                ) : (
                  selected !== "student-enrollment" &&
                  resource.actions.includes("create") && (
                    <button className="edu-primary" onClick={() => edit()}>
                      <Plus size={15} aria-hidden="true" />{" "}
                      {resource.name === "academic_years"
                        ? "Create batch"
                        : "Create record"}
                    </button>
                  )
                )}
                {canExport && (
                  <>
                    <button
                      type="button"
                      className="edu-export"
                      onClick={exportExcel}
                      disabled={!visibleRows.length}
                    >
                      <Download size={14} aria-hidden="true" /> Excel
                    </button>
                    <button
                      type="button"
                      className="edu-export"
                      onClick={() => void exportPdf()}
                      disabled={!visibleRows.length}
                    >
                      <FileText size={14} aria-hidden="true" /> PDF
                    </button>
                  </>
                )}
              </>
            )}
            {!HEADER_ACTIONS.has(selected) &&
              !staffKind &&
              screenActions.map((a) => (
                <button key={a.key} onClick={() => runAction(a)}>
                  {a.label}
                </button>
              ))}
            {selected === "reports" && (
              <>
                <button
                  onClick={() => download(() => api.finance.downloadLedger())}
                >
                  Download student ledger
                </button>
                <button
                  onClick={() =>
                    download(() => api.reports.downloadFinanceReport())
                  }
                >
                  Download finance PDF
                </button>
              </>
            )}
            {selected === "imports" && (
              <div className="edu-file">
                <span>Validate client workbook</span>
                <UploadBox
                  label="Client workbook (.xlsx)"
                  accept=".xlsx"
                  placeholder="No workbook chosen"
                  disabled={validatingWorkbook}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setError("");
                    if (!/\.xlsx$/i.test(file.name)) {
                      setError(
                        "Choose an Excel workbook (.xlsx), using a supplied import template.",
                      );
                      return;
                    }
                    if (file.size > 700000) {
                      setError(
                        "Choose an XLSX workbook up to 700 KB. Remove unused sheets or split large imports into separate workbooks.",
                      );
                      return;
                    }
                    setValidatingWorkbook(true);
                    try {
                      const result = await api.imports.validate({
                        filename: file.name,
                        content_base64: await fileToBase64(file),
                      });
                      setSpecial([result]);
                      if (Number(result.failed_rows) > 0)
                        toast.warning(
                          "Workbook needs corrections",
                          `${result.failed_rows} rows or sheets need attention. Review the validation errors before importing.`,
                        );
                      else toast.success(`${file.name} validated`);
                      if (resource) await refreshResource(resource);
                    } catch (err) {
                      setError(errorText(err));
                    } finally {
                      setValidatingWorkbook(false);
                    }
                  }}
                />
                <small>
                  {validatingWorkbook
                    ? "Checking workbook…"
                    : "XLSX up to 700 KB. Keep the supplied sheet names and headers in row 6."}
                </small>
              </div>
            )}
            {selected === "forms" && (
              <button
                className="edu-primary"
                onClick={() => setConfiguration({ kind: "form" })}
              >
                Create form
              </button>
            )}
            {selected === "roles" && (
              <button
                className="edu-primary"
                onClick={() => setConfiguration({ kind: "role" })}
              >
                Create role
              </button>
            )}
            {["accounts", "credentials"].includes(selected) && (
              <button
                className="edu-primary"
                onClick={() => setConfiguration({ kind: "account" })}
              >
                Create login
              </button>
            )}
          </div>
          {staffKind && (
            <StaffDirectory
              kind={staffKind}
              canEdit={
                !!displayRole &&
                (displayRole.system_admin ||
                  [
                    "employees",
                    ...(staffKind === "labour"
                      ? []
                      : [
                          staffKind === "teaching"
                            ? "teachers"
                            : "staff_profiles",
                          "employee_salary_components",
                        ]),
                  ].every((table) =>
                    displayRole.permissions[table]?.includes("edit"),
                  ))
              }
              reloadKey={staffReload}
              title={
                screen?.title ||
                sessionScreens?.find((s) => s.key === selected)?.title ||
                pretty(selected)
              }
              onRefresh={() => setStaffReload((n) => n + 1)}
              onAdd={() => setStaffForm(true)}
            />
          )}
          {resource && !staffKind && (
            <>
              {cards && (
                <CourseCards
                  rows={rows}
                  canEdit={resource.actions.includes("edit")}
                  canDelete={resource.actions.includes("delete")}
                  onEdit={(row) => void edit(row)}
                  onDelete={(row) => removeRow(row, true)}
                />
              )}
              {!cards && (
                <div className="edu-table">
                  <table>
                    <thead>
                      <tr>
                        {columns.map((k) => (
                          <th key={k} className={alignClass(k) || undefined}>
                            {studentRegister &&
                            k !== "profile_photo_url" &&
                            k !== "course_level" &&
                            !["status", "email"].includes(k) ? (
                              <div className="edu-column-heading">
                                <span>{columnLabel(k)}</span>
                                <TableColumnFilter
                                  label={columnLabel(k)}
                                  options={
                                    filterOptions[k] ||
                                    [
                                      ...new Set(
                                        rows.map((row) =>
                                          String(cellValue(row, k) || ""),
                                        ),
                                      ),
                                    ].sort()
                                  }
                                  value={columnFilters[k]}
                                  onChange={(values) =>
                                    setColumnFilters((current) => {
                                      const next = { ...current };
                                      if (values === undefined) delete next[k];
                                      else next[k] = values;
                                      return next;
                                    })
                                  }
                                />
                              </div>
                            ) : (
                              columnLabel(k)
                            )}
                          </th>
                        ))}
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row) => (
                        <tr key={String(row.code)}>
                          {columns.map((k) => (
                            <td
                              key={k}
                              className={
                                isDetails(row[k])
                                  ? "edu-kv-cell"
                                  : alignClass(k) || undefined
                              }
                            >
                              {k === "profile_photo_url" ? (
                                <PersonPhoto
                                  value={row.profile_photo_url}
                                  name={String(
                                    cellValue(row, "student_name") || row.code,
                                  )}
                                />
                              ) : isDetails(row[k]) ? (
                                <Details value={row[k]} />
                              ) : (
                                text(cellValue(row, k))
                              )}
                            </td>
                          ))}
                          <td>
                            <div className="edu-row-actions">
                              {[
                                "students",
                                "employees",
                                "admission_applications",
                              ].includes(resource.name) &&
                                !studentRegister && (
                                  <IconAction
                                    kind="files"
                                    label={`Files for ${String(cellValue(row, "student_name") || row.name || row.first_name || row.code)}`}
                                    onClick={() =>
                                      setFileOwner({
                                        personKind:
                                          resource.name === "students"
                                            ? "student"
                                            : resource.name === "employees"
                                              ? "employee"
                                              : "application",
                                        personCode: String(row.code),
                                      })
                                    }
                                  />
                                )}
                              {resource.actions.includes("edit") && (
                                <IconAction
                                  kind="edit"
                                  label={`Edit ${String(row.name ?? row.first_name ?? row.code ?? "record")}`}
                                  onClick={() => edit(row)}
                                />
                              )}
                              {studentTable && (
                                <button
                                  type="button"
                                  className="icon-action"
                                  aria-label={`View details for ${String(cellValue(row, "student_name"))}`}
                                  title="Student information"
                                  onClick={() => setStudentInfo(row)}
                                >
                                  <Info size={16} />
                                </button>
                              )}
                              {!studentRegister &&
                                resource.actions.includes("delete") && (
                                  <IconAction
                                    kind="delete"
                                    label={`Delete ${String(row.name ?? row.first_name ?? row.code ?? "record")}`}
                                    onClick={async () => {
                                      if (!confirm("Delete this record?"))
                                        return;
                                      try {
                                        const kind =
                                          DOWNLOAD_KIND_BY_TABLE[resource.name];
                                        if (
                                          [
                                            "document",
                                            "tax-document",
                                            "admission-document",
                                            "import-workbook",
                                          ].includes(kind)
                                        ) {
                                          await api.documents.remove(
                                            kind,
                                            String(row.code),
                                          );
                                        } else {
                                          await api.workspace.remove(
                                            resource.path,
                                            String(row.code),
                                          );
                                        }
                                        toast.success(
                                          `${String(row.name ?? row.code)} deleted successfully`,
                                        );
                                        await refreshResource(resource);
                                      } catch (e) {
                                        setError(errorText(e));
                                      }
                                    }}
                                  />
                                )}
                              {DOWNLOAD_KIND_BY_TABLE[resource.name] && (
                                <button
                                  onClick={() =>
                                    download(() =>
                                      api.documents.download(
                                        DOWNLOAD_KIND_BY_TABLE[resource.name],
                                        String(row.code),
                                      ),
                                    )
                                  }
                                >
                                  Download
                                </button>
                              )}
                              {resource.name === "import_jobs" &&
                                row.status === "validated" && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        await api.imports.commit(
                                          String(row.code),
                                        );
                                        toast.success(
                                          "Import committed successfully",
                                        );
                                        await refreshResource(resource);
                                      } catch (e) {
                                        setError(errorText(e));
                                      }
                                    }}
                                  >
                                    Commit import
                                  </button>
                                )}
                              {resource.name === "certificate_requests" &&
                                row.status === "pending" && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        await api.documents.issueCertificate({
                                          request_code: String(row.code),
                                        });
                                        toast.success(
                                          "Certificate issued successfully",
                                        );
                                        await refreshResource(resource);
                                      } catch (e) {
                                        setError(errorText(e));
                                      }
                                    }}
                                  >
                                    Authorize and issue
                                  </button>
                                )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!cards && !busy && rows.length === 0 && (
                <p className="edu-empty">
                  {selected === "student-enrollment"
                    ? filter || Object.keys(columnFilters).length > 0
                      ? "No students match these filters. Clear the filters or change your search."
                      : "No students enrolled yet. Use Student enrollment to add a student."
                    : "No records yet. Use Create record or complete the preceding setup steps."}
                </p>
              )}
              {!cards && selected !== "student-enrollment" && (
                <p>
                  {rows.length} of {total} records
                </p>
              )}
              {pageOffset > 0 && (
                <button
                  onClick={() =>
                    refreshResource(
                      resource,
                      Math.max(0, pageOffset - (pageSize(resource.name) || 50)),
                    )
                  }
                >
                  Previous page
                </button>
              )}
              {total > pageOffset + rows.length && (
                <button
                  onClick={() =>
                    refreshResource(resource, pageOffset + rows.length)
                  }
                >
                  Next page
                </button>
              )}
            </>
          )}
        </div>
        {special.map((row, i) => (
          <article className="edu-special" key={String(row.code ?? i)}>
            <h2>{String(row.name ?? row.login_id ?? row.code ?? "Details")}</h2>
            <Details value={row} />
            {selected === "roles" && !row.system_admin && (
              <div className="edu-row-actions">
                <IconAction
                  kind="edit"
                  label="Edit role"
                  onClick={() =>
                    setConfiguration({ kind: "role", initial: row })
                  }
                />
                <IconAction
                  kind="delete"
                  label="Delete role"
                  onClick={async () => {
                    if (
                      !confirm(
                        `Delete the role ${String(row.name ?? row.code)}?`,
                      )
                    )
                      return;
                    try {
                      await api.administration.deleteRole(String(row.code));
                      toast.success("Role deleted successfully");
                      await load(selected);
                    } catch (e) {
                      setError(errorText(e));
                    }
                  }}
                />
              </div>
            )}
            {["accounts", "credentials"].includes(selected) && (
              <div className="edu-row-actions">
                <IconAction
                  kind="edit"
                  label="Edit access"
                  onClick={() =>
                    setConfiguration({ kind: "account", initial: row })
                  }
                />
                <button
                  onClick={() =>
                    setDialog({
                      title: "Reset account password",
                      fields: [
                        {
                          key: "new_password",
                          label: "New password (at least 12 characters)",
                          type: "password",
                          required: true,
                        },
                      ],
                      save: async (values) => {
                        await api.administration.resetPassword(
                          String(row.code),
                          { new_password: String(values.new_password) },
                        );
                      },
                    })
                  }
                >
                  Reset password
                </button>
              </div>
            )}
            {selected === "forms" && (
              <div className="edu-row-actions">
                <IconAction
                  kind="edit"
                  label="Edit form"
                  onClick={() =>
                    setConfiguration({ kind: "form", initial: row })
                  }
                />
                <IconAction
                  kind="delete"
                  label="Delete form"
                  onClick={async () => {
                    if (
                      !confirm(
                        `Delete the form ${String(row.name ?? row.code)}?`,
                      )
                    )
                      return;
                    try {
                      await api.forms.remove(String(row.code));
                      toast.success("Form deleted successfully");
                      await load(selected);
                    } catch (e) {
                      setError(errorText(e));
                    }
                  }}
                />
              </div>
            )}
          </article>
        ))}
      </section>
      {configuration && (
        <ConfigurationEditor
          kind={configuration.kind}
          initial={configuration.initial}
          onClose={() => setConfiguration(null)}
          onSaved={() => load(selected)}
        />
      )}{" "}
      {dialog && (
        <ActiveEntryForm
          key={dialog.title}
          title={dialog.title}
          fields={dialog.fields}
          initial={dialog.initial}
          onSave={dialog.save}
          onClose={() => setDialog(null)}
        />
      )}
      {studentInfo && (
        <StudentEnrollmentDetails
          student={studentInfo}
          onClose={() => setStudentInfo(null)}
          onEdit={
            resource?.actions.includes("edit")
              ? () => {
                  setStudentInfo(null);
                  void edit(studentInfo);
                }
              : undefined
          }
        />
      )}
      {fileOwner && (
        <PersonFiles {...fileOwner} onClose={() => setFileOwner(null)} />
      )}
      {staffFormOpen && staffKind && (
        <StaffOnboardingForm
          kind={staffKind}
          onClose={() => {
            setStaffForm(false);
            setStaffDismissed(true);
          }}
          onSaved={() => setStaffReload((n) => n + 1)}
        />
      )}
      {wizardOpen && (
        <StudentEnrollmentWizard
          college={college}
          onClose={() => {
            setWizard(false);
            setWizardDismissed(true);
          }}
          onEnrolled={() => {
            clearWorkspaceCache();
            if (resource?.name === "students") void refreshResource(resource);
            else void load(selected);
          }}
        />
      )}
    </main>
  );
}

function TemplateRedirect({
  href,
  college,
  reloadWorkspace = false,
}: {
  href: string;
  college: College;
  reloadWorkspace?: boolean;
}) {
  const router = useRouter();
  useEffect(() => {
    // Re-authentication inside a workspace must recreate its session provider.
    // Replacing an unchanged URL leaves the old provider mounted and loading.
    if (reloadWorkspace) window.location.replace(href);
    else router.replace(href);
  }, [href, router, reloadWorkspace]);
  return <PortalShellSkeleton college={college} />;
}
