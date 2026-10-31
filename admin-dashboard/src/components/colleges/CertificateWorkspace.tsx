"use client";
import SearchField, { searchValues } from "./SearchField";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Download,
  FileCheck2,
  FileText,
  Plus,
} from "lucide-react";
import SideDrawer from "./SideDrawer";
import {
  api,
  errorText,
  type CertificateOptions,
  type CertificateRow,
} from "@/services/api";
import { toast } from "./toast";
import WorkspacePrimaryAction from "./WorkspacePrimaryAction";
import { useOptionalCollege } from "./CollegeStore";
import { readWorkspaceCache, workspaceCacheKey, writeWorkspaceCache } from "@/lib/colleges/workspace-cache";
import "./assignment-workspace.css";

export default function CertificateWorkspace({
  personal = false,
  studentCode,
}: {
  personal?: boolean;
  studentCode?: string;
}) {
  const session = useOptionalCollege();
  const dataKey = workspaceCacheKey(session?.account?.code, session?.activeRole?.code, `special:certificates:${studentCode || "self"}`);
  const cached = readWorkspaceCache<{ items: CertificateRow[]; issued: CertificateRow[]; options: CertificateOptions }>(dataKey);
  const [items, setItems] = useState<CertificateRow[]>(cached?.items || []);
  const [issued, setIssued] = useState<CertificateRow[]>(cached?.issued || []);
  const [options, setOptions] = useState<CertificateOptions | null>(cached?.options || null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(!cached);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("intermediate");
  const [program, setProgram] = useState("");
  const [year, setYear] = useState("");
  const [student, setStudent] = useState(studentCode || "");
  const [template, setTemplate] = useState("study_certificate");
  const [saving, setSaving] = useState(false);

  async function load(force = false) {
    if (force || !cached) setBusy(true);
    try {
      const [list, resultOptions] = await Promise.all([
        api.certificates.list(studentCode || undefined),
        api.certificates.options(),
      ]);
      setItems(list.items);
      setIssued(list.certificates);
      setOptions(resultOptions);
      writeWorkspaceCache(dataKey, { items: list.items, issued: list.certificates, options: resultOptions });
      setError("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load(false);
    // Each personal portal child selection owns a separately scoped list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentCode, dataKey]);

  const courses =
    options?.courses.filter((course) => course.course_level === level) || [];
  const selectedCourse = courses.find((course) => course.code === program);
  const years =
    options?.academic_years.filter((row) => row.program_code === program) || [];
  const selectedStudent = options?.students.find((row) => row.code === student);
  const selectedYear = years.find((row) => row.code === year);
  const filtered = useMemo(
    () =>
      items.filter((row) =>
        `${row.student_name} ${row.template_name} ${row.status}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [items, search],
  );

  async function decide(row: CertificateRow, accept: boolean) {
    try {
      if (accept) await api.certificates.approve(row.code);
      else await api.certificates.reject(row.code);
      toast.success(accept ? "Certificate approved" : "Request rejected");
      await load();
    } catch (e) {
      toast.error("Could not update request", errorText(e));
    }
  }

  async function issue() {
    if (!student || !template || !program || !year) return;
    setSaving(true);
    try {
      await api.certificates.issue(student, template, program, year);
      toast.success(
        "Certificate issued",
        "The student and linked parents have been notified.",
      );
      setDrawer(false);
      await load();
    } catch (e) {
      toast.error("Could not issue certificate", errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function request() {
    try {
      await api.certificates.request(template, studentCode);
      toast.success(
        "Request sent",
        "The college administration has been notified.",
      );
      await load();
    } catch (e) {
      toast.error("Could not request certificate", errorText(e));
    }
  }

  async function download(code: string) {
    try {
      await api.certificates.download(code);
    } catch (e) {
      toast.error("Could not download certificate", errorText(e));
    }
  }

  return (
    <main className="as-workspace certificate-workspace">
      <header className="as-header">
        <div>
          <span className="as-eyebrow">STUDENT SERVICES</span>
          <h1>Certificates</h1>
          <p>
            Request, review, issue and securely download official college
            certificates.
          </p>
        </div>
        {!personal && (
          <WorkspacePrimaryAction onClick={() => setDrawer(true)}>
            <Plus size={17} /> Issue certificate
          </WorkspacePrimaryAction>
        )}
      </header>

      {!personal && (
        <section className="as-metrics">
          <div>
            <FileCheck2 />
            <span>
              <b>{items.filter((row) => row.status === "pending").length}</b>
              <small>Awaiting review</small>
            </span>
          </div>
          <div>
            <BadgeCheck />
            <span>
              <b>{issued.length}</b>
              <small>Issued certificates</small>
            </span>
          </div>
        </section>
      )}

      {personal && (
        <section className="certificate-request-panel">
          <div>
            <h2>Request a certificate</h2>
            <p>
              Select a certificate type. The administration will review your
              request and notify you when it is ready.
            </p>
          </div>
          <label>
            Certificate type
            <select
              value={template}
              onChange={(event) => setTemplate(event.target.value)}
            >
              {options?.templates.map((row) => (
                <option key={row.code} value={row.code}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <button className="as-primary" onClick={() => void request()}>
            Request certificate
          </button>
        </section>
      )}

      <div className="as-toolbar">
        <SearchField
          placeholder="Search certificates"
          value={search}
          onValueChange={setSearch}
          suggestions={searchValues(items, ["student_name", "template_name", "status"])}
        />
          <button onClick={() => void load(true)} disabled={busy}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="as-alert" role="alert">
          {error}
          <button onClick={() => void load(true)}>Retry</button>
        </div>
      )}
      {busy && <div className="as-empty">Loading certificates…</div>}
      {!busy && filtered.length === 0 && (
        <div className="as-empty">
          <FileText />
          <h2>No certificate requests</h2>
          <p>Requests and issued documents will appear here.</p>
        </div>
      )}

      <div className="as-cards">
        {filtered.map((row) => {
          const certificate = issued.find((item) => item.request_code === row.code);
          return (
            <article className="as-card" key={row.code}>
              <div className="as-card-top">
                <span className="as-pill">{row.status}</span>
                <span className="as-date">
                  {row.requested_on
                    ? new Date(row.requested_on).toLocaleDateString("en-IN")
                    : ""}
                </span>
              </div>
              <h2>{row.template_name}</h2>
              <p className="as-audience">
                {row.student_name}
                {row.admission_number
                  ? ` · Admission ${row.admission_number}`
                  : ""}
              </p>
              {row.decision_message && <p>{row.decision_message}</p>}
              <div className="as-actions">
                {row.status === "pending" && !personal && (
                  <>
                    <button
                      className="as-primary"
                      onClick={() => void decide(row, true)}
                    >
                      Approve &amp; issue
                    </button>
                    <button onClick={() => void decide(row, false)}>
                      Reject
                    </button>
                  </>
                )}
                {certificate && (
                  <button onClick={() => void download(certificate.code)}>
                    <Download size={15} /> Download certificate
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {issued.length > 0 && (
        <section className="certificate-issued-section">
          <h2>Approved certificates</h2>
          <div className="as-cards">
            {issued.map((row) => (
              <article className="as-card" key={row.code}>
                <h3>Certificate {row.certificate_number || row.code}</h3>
                <p>Issued {row.issued_on || ""}</p>
                <button onClick={() => void download(row.code)}>
                  <Download size={15} /> Preview / download PDF
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {!personal && drawer && (
        <SideDrawer
          title="Issue a certificate"
          subtitle="Choose the student's course, academic year and certificate design."
          className="as-drawer certificate-drawer"
          actions={
            <button
              form="cert-issue-form"
              className="as-primary"
              disabled={saving || !student || !program || !year}
            >
              {saving ? "Issuing…" : "Preview and issue"}
            </button>
          }
          onClose={() => !saving && setDrawer(false)}
        >
          <form
            id="cert-issue-form"
            className="as-form certificate-issue-form"
            onSubmit={(event) => {
              event.preventDefault();
              void issue();
            }}
          >
            <fieldset>
              <legend>Student and course</legend>
              <label>
                Course level
                <select
                  value={level}
                  onChange={(event) => {
                    setLevel(event.target.value);
                    setProgram("");
                    setYear("");
                    setStudent("");
                    void api.certificates
                      .options({ course_level: event.target.value })
                      .then(setOptions);
                  }}
                >
                  <option value="intermediate">Intermediate</option>
                  <option value="degree">Degree</option>
                </select>
              </label>
              <label>
                Course
                <select
                  required
                  value={program}
                  onChange={(event) => {
                    const selected = event.target.value;
                    setProgram(selected);
                    setYear("");
                    setStudent("");
                    void api.certificates
                      .options({
                        course_level: level,
                        program_code: selected,
                      })
                      .then(setOptions);
                  }}
                >
                  <option value="">Select course</option>
                  {courses.map((row) => (
                    <option key={row.code} value={row.code}>
                      {row.name}
                      {row.specialization ? ` · ${row.specialization}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Academic year
                <select
                  required
                  disabled={!program}
                  value={year}
                  onChange={(event) => {
                    const selected = event.target.value;
                    setYear(selected);
                    setStudent("");
                    void api.certificates
                      .options({
                        course_level: level,
                        program_code: program,
                        academic_year_code: selected,
                      })
                      .then(setOptions);
                  }}
                >
                  <option value="">Select academic year</option>
                  {years.map((row) => (
                    <option key={row.code} value={row.code}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Student
                <select
                  required
                  disabled={!year}
                  value={student}
                  onChange={(event) => setStudent(event.target.value)}
                >
                  <option value="">Select student</option>
                  {options?.students.map((row) => (
                    <option key={row.code} value={row.code}>
                      {row.name}
                      {row.admission_number ? ` · ${row.admission_number}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
            <fieldset>
              <legend>Certificate design</legend>
              <label>
                Certificate template
                <select
                  value={template}
                  onChange={(event) => setTemplate(event.target.value)}
                >
                  {options?.templates.map((row) => (
                    <option key={row.code} value={row.code}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              {options?.templates.find((row) => row.code === template) && (
                <article className={`as-cert-preview as-cert-${template}`}>
                  <span className="as-eyebrow">
                    {options.templates.find((row) => row.code === template)?.name}
                  </span>
                  <h3>{selectedStudent?.name || "Student name"}</h3>
                  <p>
                    {options.templates.find((row) => row.code === template)?.description}
                  </p>
                  <div>
                    {selectedCourse?.name || "Course"}
                    {selectedCourse?.specialization
                      ? ` · ${selectedCourse.specialization}`
                      : ""}
                  </div>
                  <div>
                    {selectedYear?.name || "Academic year"} · Admission{" "}
                    {selectedStudent?.admission_number || "number"}
                  </div>
                  <footer>
                    <span>Official college seal</span>
                    <span>Authorized signature</span>
                  </footer>
                </article>
              )}
            </fieldset>
          </form>
        </SideDrawer>
      )}
    </main>
  );
}
