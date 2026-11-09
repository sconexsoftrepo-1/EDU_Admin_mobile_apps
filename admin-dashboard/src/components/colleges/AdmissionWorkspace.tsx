"use client";
import WorkspaceSkeleton from "./WorkspaceSkeleton";
import SearchField, { searchValues } from "./SearchField";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Info, Plus, Printer, RefreshCw, UserRoundCheck } from "lucide-react";
import type { College } from "@/data/colleges";
import {
  api,
  errorText,
  type EnrollmentOptions,
  type LookupOption,
  type Row,
} from "@/services/api";
import SideDrawer from "./SideDrawer";
import PrintButtons from "./PrintButtons";
import PDFActions from "./PDFActions";
import { pdfTable } from "@/lib/colleges/export-table";
import StudentEnrollmentWizard from "./enrollment/StudentEnrollmentWizard";
import WorkspacePrimaryAction from "./WorkspacePrimaryAction";
import "./admission-workspace.css";
import { COURSE_LEVELS } from "@/lib/colleges/course-levels";
import type { CourseLevel } from "@/services/api";

type Lookups = { employees: LookupOption[]; options: EnrollmentOptions };
type Props = {
  college: College;
  path: string;
  canCreate: boolean;
  canConvert: boolean;
};
const isPlatformReference = (value: unknown) =>
  ["social_media", "advertising"].includes(String(value));
const admissionSnapshots = new Map<
  string,
  { rows: Row[]; lookups: Lookups; savedAt: number }
>();
const text = (value: unknown) =>
  value == null || value === "" ? "—" : String(value);
const nice = (value: unknown) =>
  String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const dateTime = (value: unknown) => {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

export default function AdmissionWorkspace({
  college,
  path,
  canCreate,
  canConvert,
}: Props) {
  const snapshot = admissionSnapshots.get(path);
  const [openedAt] = useState(() => Date.now());
  const cached =
    snapshot && openedAt - snapshot.savedAt < 5 * 60_000 ? snapshot : undefined;
  const hasCachedData = useRef(Boolean(cached));
  const [creating, setCreating] = useState(false);
  const [rows, setRows] = useState<Row[]>(cached?.rows || []);
  const [lookups, setLookups] = useState<Lookups | null>(
    cached?.lookups || null,
  );
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<Row | null>(null);
  const [convert, setConvert] = useState<Row | null>(null);
  const [courseLevel, setCourseLevel] = useState<CourseLevel>(
    "intermediate",
  );
  const [programCode, setProgramCode] = useState("");
  const [referenceType, setReferenceType] = useState("self");
  const [employeeCode, setEmployeeCode] = useState("");
  const platformReference = isPlatformReference(referenceType);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [formError, setFormError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  useEffect(() => {
    if (!creating || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [creating, dirty]);
  const closeForm = () => {
    // Kept in the URL until now: the page can remount while it starts up.
    if (window.location.search.includes("new=1"))
      window.history.replaceState(null, "", window.location.pathname);
    setCreating(false);
    setDirty(false);
    setConfirmDiscard(false);
  };
  const requestClose = () => {
    if (saving) return;
    if (dirty) setConfirmDiscard(true);
    else closeForm();
  };

  useEffect(() => {
    if (!canCreate) return;
    const open = () => {
      setFormError("");
      setCreating(true);
    };
    window.addEventListener("edunexa:new-application", open);
    return () => window.removeEventListener("edunexa:new-application", open);
  }, [canCreate]);
  // "Recent admissions" on the dashboard links here with ?enquiry=CODE: open that exact enquiry.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("enquiry");
    if (!wanted || !rows.length) return;
    const found = rows.find((row) => String(row.code) === wanted);
    const id = window.setTimeout(() => {
      if (found) setDetail(found);
      window.history.replaceState(null, "", window.location.pathname);
    }, 0);
    return () => window.clearTimeout(id);
  }, [rows]);
  // "New enquiry" on the dashboard links here with ?new=1.
  useEffect(() => {
    if (!canCreate) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") !== "1") return;
    const id = window.setTimeout(() => setCreating(true), 0);
    return () => window.clearTimeout(id);
  }, [canCreate]);

  const load = useCallback(async () => {
    if (!hasCachedData.current) setLoading(true);
    setError("");
    try {
      const [page, employees, options] = await Promise.all([
        api.workspace.list(path, 0, 200),
        api.workspace.lookup("employees").catch(() => []),
        api.masterData.enrollmentOptions(),
      ]);
      setRows(page.items);
      setLookups({ employees, options });
      admissionSnapshots.set(path, {
        rows: page.items,
        lookups: { employees, options },
        savedAt: Date.now(),
      });
      hasCachedData.current = true;
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const courses = lookups?.options.courses[courseLevel] || [];
  const years =
    lookups?.options.academic_years.filter(
      (year) => year.program_code === programCode,
    ) || [];
  const campuses = lookups?.options.campuses || [];
  const detailCourses =
    detail && lookups
      ? lookups.options.courses[
          (COURSE_LEVELS.some((l) => l.key === detail.course_level)
            ? detail.course_level
            : "intermediate") as CourseLevel
        ]
      : [];
  const detailAddress =
    detail?.address && typeof detail.address === "object"
      ? (detail.address as Row)
      : {};
  const visible = useMemo(
    () =>
      rows.filter((row) =>
        `${row.first_name || ""} ${row.last_name || ""} ${row.phone || ""} ${row.email || ""} ${row.program_code || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [rows, query],
  );

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSuccess("");
    if (!lookups || !campuses[0]) {
      setFormError("Set up at least one campus before creating enquiries.");
      return;
    }
    const target = event.currentTarget;
    const form = new FormData(target);
    const value = (key: string) => String(form.get(key) || "").trim();
    const employee = lookups.employees.find(
      (item) => item.value === employeeCode,
    );
    const referenceMobile = platformReference
      ? null
      : value("reference_mobile") || null;
    const follow = value("next_follow_up_at");
    const consent = form.get("communication_consent") === "on";
    setSaving(true);
    try {
      await api.admissions.createIntake({
        campus_code: campuses[0].code,
        program_code: programCode || null,
        first_name: value("first_name"),
        last_name: value("last_name"),
        phone: value("phone"),
        email: value("email") || null,
        parent_name: value("guardian_name") || null,
        parent_phone: value("second_phone") || null,
        assigned_employee_code: employeeCode || null,
        referrer_name: employee?.label || value("reference_name") || null,
        campaign_reference: referenceMobile,
        status: "new",
        next_follow_up_at: follow ? new Date(follow).toISOString() : null,
        communication_consent: consent,
        consent_recorded_at: consent ? new Date().toISOString() : null,
        course_level: courseLevel,
        academic_year_code: value("academic_year_code") || null,
        secondary_phone: value("second_phone") || null,
        guardian_relationship: value("guardian_relationship") || null,
        guardian_mobile: value("guardian_mobile") || null,
        address: {
          street: value("street"),
          area: value("area"),
          city: value("city"),
          state: value("state"),
          postal_code: value("postal_code"),
        },
        reference_type: referenceType,
        reference_name: employee?.label || value("reference_name") || null,
        reference_mobile: referenceMobile,
        reference_relationship:
          referenceType === "relative"
            ? value("reference_relationship") || null
            : null,
      });
      target.reset();
      setProgramCode("");
      setEmployeeCode("");
      setReferenceType("self");
      setSuccess("Admission enquiry saved.");
      closeForm();
      await load();
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function joined(studentCode: string) {
    if (!convert) return;
    try {
      await api.admissions.updateIntake(String(convert.code), {
        status: "joined",
        converted_student_code: studentCode,
      });
      setConvert(null);
      setSuccess("Student enrolled and enquiry marked as joined.");
      await load();
    } catch (e) {
      setError(
        `Student was enrolled, but the enquiry status could not be updated: ${errorText(e)}`,
      );
    }
  }

  return (
    <section className="adm-workspace">
      <header className="adm-heading">
        <div>
          <p>Admissions office</p>
          <h1>Admissions</h1>
          <span>
            Capture enquiries, follow up, and continue into student enrollment.
          </span>
        </div>
        <div className="adm-heading-actions">
          <button
            type="button"
            className="adm-refresh"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <WorkspacePrimaryAction
            disabled={!canCreate}
            onClick={() => {
              setFormError("");
              setCreating(true);
            }}
            title="Create an application"
          >
            <Plus size={16} /> New application
          </WorkspacePrimaryAction>
        </div>
      </header>
      {error && (
        <div className="adm-alert" role="alert">
          {error}
          <button onClick={() => void load()}>Retry</button>
        </div>
      )}
      {success && (
        <div className="adm-success" role="status">
          {success}
          <button onClick={() => setSuccess("")}>Dismiss</button>
        </div>
      )}
      <div className="adm-list-panel">
        <div className="adm-list-toolbar">
          <div>
            <h2>Admission enquiries</h2>
            <p>
              Review applicant details and convert an enquiry through
              enrollment.
            </p>
          </div>
          <PDFActions
            viewLabel="View list"
            onAction={(mode) =>
              pdfTable(
                "admission-enquiries",
                "Admission enquiries",
                `${visible.length} applicants`,
                [
                  "Applicant",
                  "Phone",
                  "Email",
                  "Course",
                  "Academic year",
                  "Guardian",
                  "Follow up",
                  "Status",
                ],
                visible.map((row) => [
                  `${text(row.first_name)} ${text(row.last_name)}`,
                  text(row.phone),
                  text(row.email),
                  `${nice(row.course_level)} ${text(row.program_code)}`,
                  text(row.academic_year_code),
                  `${text(row.parent_name)} ${row.parent_phone ? `(${String(row.parent_phone)})` : ""}`,
                  dateTime(row.next_follow_up_at),
                  nice(row.workflow_status || row.status || "new"),
                ]),
                mode,
              )
            }
          >
            Download PDF
          </PDFActions>
          <SearchField
            placeholder="Search applicants"
            value={query}
            onValueChange={setQuery}
            suggestions={searchValues(rows, [
              "first_name",
              "last_name",
              "phone",
              "email",
              "program_code",
            ])}
          />
        </div>
        <div className="adm-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Course</th>
                <th>Phone</th>
                <th>Follow up</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(loading || visible.length === 0) && (
                <tr>
                  <td colSpan={6}>
                    <div className="adm-empty" role="status">
                      {loading ? (
                        <WorkspaceSkeleton compact label="Loading enquiries" />
                      ) : query.trim() ? (
                        "No matching applicants. Try another name, phone number or email."
                      ) : (
                        "No admission enquiries yet. Use “New application” to add one."
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {visible.map((row) => (
                <tr key={String(row.code)}>
                  <td>
                    <strong>
                      {text(row.first_name)} {text(row.last_name)}
                    </strong>
                    <small>{text(row.email)}</small>
                  </td>
                  <td>
                    {text(row.course_level && nice(row.course_level))}
                    <small>
                      {text(row.program_code)}
                      {row.academic_year_code
                        ? ` · ${row.academic_year_code}`
                        : ""}
                    </small>
                  </td>
                  <td>
                    {text(row.phone)}
                    <small>Parent: {text(row.parent_phone)}</small>
                  </td>
                  <td>{dateTime(row.next_follow_up_at)}</td>
                  <td>
                    <span
                      className={`adm-status adm-status-${String(row.workflow_status || row.status || "new")}`}
                    >
                      {nice(row.workflow_status || row.status || "new")}
                    </span>
                  </td>
                  <td>
                    <div className="adm-actions">
                      <button
                        title="View enquiry details"
                        aria-label={`View ${text(row.first_name)} details`}
                        onClick={() => setDetail(row)}
                      >
                        <Info size={17} />
                      </button>
                      {canConvert && row.workflow_status !== "joined" && (
                        <button
                          className="adm-convert"
                          onClick={() => setConvert(row)}
                        >
                          <UserRoundCheck size={15} /> Convert to student
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {creating && (
        <SideDrawer
          title="New enquiry"
          subtitle="Create a new student enquiry and track follow-ups."
          className="adm-application-drawer"
          onClose={requestClose}
        >
          <form
            className="adm-create-form"
            onSubmit={create}
            onChange={() => setDirty(true)}
          >
            <div className="adm-form-title">
              <div>
                <span>NEW ENQUIRY</span>
                <h2>Applicant information</h2>
                <p>
                  Choose the course first; the form will keep the enquiry,
                  family and follow-up details together.
                </p>
              </div>
            </div>
            <div className="adm-form-grid">
              <label>
                Course level *
                <select
                  value={courseLevel}
                  onChange={(e) => {
                    setCourseLevel(e.target.value as typeof courseLevel);
                    setProgramCode("");
                  }}
                >
                  {COURSE_LEVELS.map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Course / branch *
                <select
                  required
                  value={programCode}
                  onChange={(e) => setProgramCode(e.target.value)}
                >
                  <option value="">
                    Select{" "}
                    {courseLevel === "intermediate"
                      ? "an Intermediate group"
                      : "a Degree course"}
                  </option>
                  {courses.map((course) => (
                    <option key={course.code} value={course.code}>
                      {course.name}
                      {course.branch ? ` · ${course.branch}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Academic year
                <select name="academic_year_code" disabled={!programCode}>
                  <option value="">Select academic year</option>
                  {years.map((year) => (
                    <option key={year.code} value={year.code}>
                      {year.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                First name *
                <input required name="first_name" autoComplete="given-name" />
              </label>
              <label>
                Last name *
                <input required name="last_name" autoComplete="family-name" />
              </label>
              <label>
                Phone number *
                <input required name="phone" type="tel" autoComplete="tel" />
              </label>
              <label>
                Second phone · parent
                <input name="second_phone" type="tel" />
              </label>
              <label>
                Guardian name
                <input name="guardian_name" />
              </label>
              <label>
                Guardian relationship
                <select name="guardian_relationship">
                  <option value="">Choose relationship</option>
                  {["Father", "Mother", "Guardian", "Sibling", "Other"].map(
                    (x) => (
                      <option key={x} value={x.toLowerCase()}>
                        {x}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Guardian mobile number
                <input name="guardian_mobile" type="tel" />
              </label>
              <label>
                Email address
                <input name="email" type="email" autoComplete="email" />
              </label>
            </div>
            <fieldset className="adm-address">
              <legend>Address</legend>
              <div className="adm-form-grid">
                <label className="adm-span-2">
                  Street
                  <input name="street" autoComplete="address-line1" />
                </label>
                <label>
                  Area
                  <input name="area" />
                </label>
                <label>
                  City
                  <input name="city" autoComplete="address-level2" />
                </label>
                <label>
                  State
                  <input name="state" autoComplete="address-level1" />
                </label>
                <label>
                  PIN code
                  <input
                    name="postal_code"
                    inputMode="numeric"
                    autoComplete="postal-code"
                  />
                </label>
              </div>
            </fieldset>
            <section className="adm-referral">
              <h3>Reference</h3>
              <div className="adm-form-grid">
                <label>
                  How did they hear about us?
                  <select
                    value={referenceType}
                    onChange={(e) => {
                      setReferenceType(e.target.value);
                      setEmployeeCode("");
                    }}
                  >
                    <option value="self">My reference (entered by me)</option>
                    <option value="walk_in">Walk-in / direct</option>
                    <option value="employee">Employee reference</option>
                    <option value="staff">Staff reference</option>
                    <option value="relative">Relative reference</option>
                    <option value="advertising">Advertising</option>
                    <option value="post">Post / mail</option>
                    <option value="social_media">Social media</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                {["employee", "staff"].includes(referenceType) ? (
                  <>
                    <label>
                      Employee / staff name
                      <select
                        value={employeeCode}
                        onChange={(e) => setEmployeeCode(e.target.value)}
                        required
                      >
                        <option value="">Select employee</option>
                        {(lookups?.employees || []).map((item) => (
                          <option
                            key={String(item.value)}
                            value={String(item.value)}
                          >
                            {String(item.label)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Reference mobile
                      <input name="reference_mobile" type="tel" />
                    </label>
                  </>
                ) : (
                  !["walk_in", "self"].includes(referenceType) && (
                    <>
                      <label>
                        {platformReference
                          ? "Platform name"
                          : referenceType === "post"
                            ? "Mail or campaign reference"
                            : referenceType === "other"
                              ? "Source description"
                              : "Relative's name"}
                        <input
                          key={referenceType}
                          name="reference_name"
                          placeholder={
                            platformReference
                              ? "e.g. Instagram, Facebook, Google Ads"
                              : undefined
                          }
                        />
                      </label>
                      {referenceType === "relative" && (
                        <label>
                          Relationship
                          <input
                            name="reference_relationship"
                            autoComplete="off"
                            placeholder="e.g. Uncle, cousin…"
                          />
                        </label>
                      )}
                      {!platformReference && (
                        <label>
                          Reference mobile
                          <input name="reference_mobile" type="tel" />
                        </label>
                      )}
                    </>
                  )
                )}
              </div>
            </section>
            <section className="adm-followup">
              <h3>Follow-up &amp; consent</h3>
              <div className="adm-form-grid">
                <label>
                  Status
                  <select value="new" disabled>
                    <option value="new">New</option>
                  </select>
                </label>
                <label>
                  Next follow up at
                  <input name="next_follow_up_at" type="datetime-local" />
                </label>
                <label className="adm-consent">
                  <input name="communication_consent" type="checkbox" />{" "}
                  Communication consent recorded
                </label>
              </div>
            </section>
            {formError && (
              <div className="adm-alert" role="alert">
                {formError}
              </div>
            )}
            <footer className="adm-form-actions">
              {confirmDiscard ? (
                <>
                  <span role="status">Discard the details you entered?</span>
                  <button type="button" onClick={() => setConfirmDiscard(false)}>
                    Keep editing
                  </button>
                  <button type="button" className="adm-discard" onClick={closeForm}>
                    Discard
                  </button>
                </>
              ) : (
                <>
                  <span>Campus and enquiry source are assigned automatically.</span>
                  <button type="button" disabled={saving} onClick={requestClose}>
                    Cancel
                  </button>
                  <button className="adm-submit" disabled={saving || !programCode}>
                    {saving ? "Saving…" : "Save enquiry"}
                  </button>
                </>
              )}
            </footer>
          </form>
        </SideDrawer>
      )}
      {detail && (
        <SideDrawer
          expanded
          className="adm-doc-drawer"
          title="Admission enquiry details"
          subtitle={`${text(detail.first_name)} ${text(detail.last_name)} · ${text(detail.code)}`}
          onClose={() => setDetail(null)}
          actions={
            <>
              <button type="button" className="adm-print" onClick={() => window.print()}>
                <Printer size={15} /> Print
              </button>
              <PrintButtons
                path={`enquiry/${encodeURIComponent(String(detail.code))}`}
                filename={`enquiry-${text(detail.first_name)}-${text(detail.last_name)}`}
                viewLabel="View as PDF"
              />
              {canConvert && detail.workflow_status !== "joined" && (
                <button
                  type="button"
                  className="adm-convert"
                  onClick={() => {
                    const row = detail;
                    setDetail(null);
                    setConvert(row);
                  }}
                >
                  <UserRoundCheck size={15} /> Continue to enrollment
                </button>
              )}
            </>
          }
        >
          {detail.workflow_status === "joined" ? (
            <p className="adm-success" role="status">
              This applicant has joined and is enrolled as a student.
            </p>
          ) : (
            canConvert && (
              <div className="adm-next-step">
                <div>
                  <strong>Ready to admit?</strong>
                  <span>
                    Continue into student enrollment with these details filled
                    in.
                  </span>
                </div>
                <button
                  type="button"
                  className="adm-convert"
                  onClick={() => {
                    const row = detail;
                    setDetail(null);
                    setConvert(row);
                  }}
                >
                  <UserRoundCheck size={15} /> Enroll as student
                </button>
              </div>
            )
          )}
          <article className="adm-doc" aria-label="Admission enquiry">
            <header className="adm-doc-head">
              {college.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={college.logo} alt="" width={56} height={56} />
              )}
              <div>
                <strong>{college.name}</strong>
                <span>Admissions office</span>
              </div>
              <div className="adm-doc-title">
                <strong>ADMISSION ENQUIRY</strong>
                <span>No. {text(detail.code)}</span>
                <span>
                  Recorded{" "}
                  {dateTime(detail.enquiry_date || detail.recorded_at || detail.created_at)}
                </span>
              </div>
            </header>
            <p className="adm-doc-status">
              <span>Status</span>
              <strong>{nice(detail.workflow_status || detail.status)}</strong>
              <span>Next follow-up</span>
              <strong>{dateTime(detail.next_follow_up_at)}</strong>
            </p>
            {(
              [
                [
                  "Course applied for",
                  {
                    "Course level": nice(detail.course_level),
                    Course:
                      detailCourses.find((course) => course.code === detail.program_code)?.name ||
                      text(detail.program_code),
                    "Academic year": text(detail.academic_year_code),
                  },
                ],
                [
                  "Applicant",
                  {
                    "Full name": `${text(detail.first_name)} ${detail.last_name ? text(detail.last_name) : ""}`.trim(),
                    Phone: text(detail.phone),
                    "Second phone": text(detail.secondary_phone),
                    Email: text(detail.email),
                  },
                ],
                [
                  "Parent / guardian",
                  {
                    "Guardian name": text(detail.parent_name),
                    Relationship: nice(detail.guardian_relationship) || "—",
                    "Guardian mobile": text(detail.guardian_mobile || detail.parent_phone),
                  },
                ],
                [
                  "Address",
                  {
                    Street: text(detailAddress.street),
                    Area: text(detailAddress.area),
                    City: text(detailAddress.city),
                    State: text(detailAddress.state),
                    "PIN code": text(detailAddress.postal_code),
                  },
                ],
                [
                  "Reference",
                  {
                    "Reference type": nice(detail.reference_type) || "—",
                    [isPlatformReference(detail.reference_type) ? "Platform name" : "Reference name"]: text(
                      detail.reference_name || detail.referrer_name,
                    ),
                    ...(detail.reference_relationship ? { Relationship: text(detail.reference_relationship) } : {}),
                    ...(!isPlatformReference(detail.reference_type)
                      ? { "Reference mobile": text(detail.reference_mobile || detail.campaign_reference) }
                      : {}),
                  },
                ],
                [
                  "Follow-up & consent",
                  {
                    "Next follow-up": dateTime(detail.next_follow_up_at),
                    "Communication consent": detail.communication_consent ? "Recorded" : "Not recorded",
                    "Consent recorded at": dateTime(detail.consent_recorded_at),
                  },
                ],
              ] as [string, Record<string, string>][]
            ).map(([title, fields]) => (
              <section key={title} className="adm-doc-section">
                <h3>{title}</h3>
                <dl>
                  {Object.entries(fields).map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{text(value)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
            <footer className="adm-doc-sign">
              <span>Applicant / guardian signature</span>
              <span>Admissions officer</span>
            </footer>
          </article>
        </SideDrawer>
      )}
      {convert && (
        <div className="adm-wizard-overlay">
          <StudentEnrollmentWizard
            college={college}
            initialApplicant={{
              first_name: String(convert.first_name || ""),
              last_name: String(convert.last_name || ""),
              email: String(convert.email || ""),
              phone: String(convert.phone || ""),
              parent_name: String(convert.parent_name || ""),
              parent_phone: String(
                convert.guardian_mobile || convert.parent_phone || "",
              ),
              program_code: String(convert.program_code || ""),
              academic_year_code: String(convert.academic_year_code || ""),
              course_level:
                (COURSE_LEVELS.some((l) => l.key === convert.course_level)
                  ? convert.course_level
                  : "intermediate") as CourseLevel,
            }}
            onClose={() => setConvert(null)}
            onEnrolled={(studentCode) => void joined(studentCode)}
          />
        </div>
      )}
    </section>
  );
}
