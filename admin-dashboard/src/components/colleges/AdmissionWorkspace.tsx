"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Info, Plus, RefreshCw, Search, UserRoundCheck } from "lucide-react";
import type { College } from "@/data/colleges";
import {
  api,
  errorText,
  type EnrollmentOptions,
  type LookupOption,
  type Row,
} from "@/services/api";
import SideDrawer from "./SideDrawer";
import StudentEnrollmentWizard from "./enrollment/StudentEnrollmentWizard";
import "./admission-workspace.css";

type Lookups = { employees: LookupOption[]; options: EnrollmentOptions };
type Props = {
  college: College;
  path: string;
  canCreate: boolean;
  canConvert: boolean;
};
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
  const [tab, setTab] = useState<"manage" | "create">("manage");
  const [rows, setRows] = useState<Row[]>([]);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<Row | null>(null);
  const [convert, setConvert] = useState<Row | null>(null);
  const [courseLevel, setCourseLevel] = useState<"intermediate" | "degree">(
    "intermediate",
  );
  const [programCode, setProgramCode] = useState("");
  const [referenceType, setReferenceType] = useState("walk_in");
  const [employeeCode, setEmployeeCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [page, employees, options] = await Promise.all([
        api.workspace.list(path, 0, 200),
        api.workspace.lookup("employees").catch(() => []),
        api.masterData.enrollmentOptions(),
      ]);
      setRows(page.items);
      setLookups({ employees, options });
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
          detail.course_level === "degree" ? "degree" : "intermediate"
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
        campaign_reference: value("reference_mobile") || null,
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
        reference_mobile: value("reference_mobile") || null,
      });
      target.reset();
      setProgramCode("");
      setEmployeeCode("");
      setReferenceType("walk_in");
      setSuccess("Admission enquiry saved.");
      setTab("manage");
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
          <h1>Manage admission &amp; new application</h1>
          <span>
            Capture enquiries, follow up, and continue into student enrollment.
          </span>
        </div>
        <button
          type="button"
          className="adm-refresh"
          onClick={() => {
            void load();
          }}
          disabled={loading}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </header>
      <div className="adm-tabs" role="tablist" aria-label="Admissions">
        <button
          role="tab"
          aria-selected={tab === "manage"}
          onClick={() => setTab("manage")}
        >
          Manage admissions <span>{rows.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "create"}
          onClick={() => setTab("create")}
          disabled={!canCreate}
        >
          <Plus size={16} /> New application
        </button>
      </div>
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
      {tab === "manage" ? (
        <div className="adm-list-panel">
          <div className="adm-list-toolbar">
            <div>
              <h2>Admission enquiries</h2>
              <p>
                Review applicant details and convert an enquiry through
                enrollment.
              </p>
            </div>
            <label className="adm-search">
              <Search size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search applicants"
              />
            </label>
          </div>
          {loading && <div className="adm-loading">Loading enquiries…</div>}
          {!loading && visible.length === 0 && (
            <div className="adm-empty">
              No admission enquiries yet. Use “New application” to add one.
            </div>
          )}
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
      ) : (
        <form className="adm-create-form" onSubmit={create}>
          <div className="adm-form-title">
            <div>
              <span>NEW ENQUIRY</span>
              <h2>Applicant information</h2>
              <p>
                Choose the course first; the form will keep the enquiry, family
                and follow-up details together.
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
                <option value="intermediate">Intermediate</option>
                <option value="degree">Degree</option>
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
                referenceType !== "walk_in" && (
                  <>
                    <label>
                      Reference name
                      <input name="reference_name" />
                    </label>
                    <label>
                      Reference mobile
                      <input name="reference_mobile" type="tel" />
                    </label>
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
            <span>Campus and enquiry source are assigned automatically.</span>
            <button className="adm-submit" disabled={saving || !programCode}>
              {saving ? "Saving…" : "Save admission enquiry"}
            </button>
          </footer>
        </form>
      )}
      {detail && (
        <SideDrawer
          expanded
          title="Admission enquiry details"
          subtitle={`${text(detail.first_name)} ${text(detail.last_name)} · ${text(detail.code)}`}
          onClose={() => setDetail(null)}
        >
          <div className="adm-detail-grid">
            {Object.entries({
              "Course level": nice(detail.course_level),
              Course:
                detailCourses.find(
                  (course) => course.code === detail.program_code,
                )?.name || text(detail.program_code),
              "Academic year": text(detail.academic_year_code),
              "First name": text(detail.first_name),
              "Last name": text(detail.last_name),
              Phone: text(detail.phone),
              "Second phone": text(detail.secondary_phone),
              "Guardian name": text(detail.parent_name),
              "Guardian relationship": nice(detail.guardian_relationship),
              "Guardian mobile": text(
                detail.guardian_mobile || detail.parent_phone,
              ),
              Email: text(detail.email),
              Street: text(detailAddress.street),
              Area: text(detailAddress.area),
              City: text(detailAddress.city),
              State: text(detailAddress.state),
              "PIN code": text(detailAddress.postal_code),
              Reference: nice(detail.reference_type),
              "Reference name": text(
                detail.reference_name || detail.referrer_name,
              ),
              "Reference mobile": text(
                detail.reference_mobile || detail.campaign_reference,
              ),
              Status: nice(detail.workflow_status || detail.status),
              "Next follow up": dateTime(detail.next_follow_up_at),
              "Communication consent": detail.communication_consent
                ? "Recorded"
                : "Not recorded",
              "Consent recorded at": dateTime(detail.consent_recorded_at),
            }).map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{text(value)}</strong>
              </div>
            ))}
          </div>
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
                convert.course_level === "degree" ? "degree" : "intermediate",
            }}
            onClose={() => setConvert(null)}
            onEnrolled={(studentCode) => void joined(studentCode)}
          />
        </div>
      )}
    </section>
  );
}
