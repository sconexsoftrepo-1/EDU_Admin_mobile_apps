"use client";
import WorkspaceSkeleton from "./WorkspaceSkeleton";
import dynamic from "next/dynamic";
import SearchField, { searchValues } from "./SearchField";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Download, FileCheck2, FileText, Plus } from "lucide-react";
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
import {
  readWorkspaceCache,
  workspaceCacheKey,
  writeWorkspaceCache,
} from "@/lib/colleges/workspace-cache";
import "./assignment-workspace.css";

const PDFCanvasViewer = dynamic(() => import("./PDFCanvasViewer"), {
  ssr: false,
  loading: () => (
    <WorkspaceSkeleton compact label="Loading certificate viewer" />
  ),
});

export default function CertificateWorkspace({
  personal = false,
  studentCode,
}: {
  personal?: boolean;
  studentCode?: string;
}) {
  const session = useOptionalCollege();
  const dataKey = workspaceCacheKey(
    session?.account?.code,
    session?.activeRole?.code,
    `special:certificates:${studentCode || "self"}`,
  );
  const cached = readWorkspaceCache<{
    items: CertificateRow[];
    issued: CertificateRow[];
    options: CertificateOptions;
  }>(dataKey);
  const [items, setItems] = useState<CertificateRow[]>(cached?.items || []);
  const [issued, setIssued] = useState<CertificateRow[]>(cached?.issued || []);
  const [options, setOptions] = useState<CertificateOptions | null>(
    cached?.options || null,
  );
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
  const [issuer, setIssuer] = useState("");
  const [preview, setPreview] = useState<{ key: string; url: string } | null>(
    null,
  );
  const [previewError, setPreviewError] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const previewKey = [
    student,
    template,
    program,
    year,
    issuer,
    previewAttempt,
  ].join(":");
  const selectionReady =
    !!student && !!program && !!year && (!options?.issuer_required || !!issuer);
  useEffect(() => {
    if (!drawer || !selectionReady) return;
    const abort = new AbortController();
    let url = "";
    api.certificates
      .preview(
        {
          student_code: student,
          template_code: template,
          program_code: program,
          academic_year_code: year,
          issuer_employee_code: issuer || undefined,
        },
        abort.signal,
      )
      .then((blob) => {
        if (abort.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setPreview({ key: previewKey, url });
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setPreviewError({ key: previewKey, message: errorText(e) });
      });
    return () => {
      abort.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [
    drawer,
    selectionReady,
    student,
    template,
    program,
    year,
    issuer,
    previewKey,
    previewAttempt,
  ]);

  function load() {
    return Promise.all([
      api.certificates.list(studentCode || undefined),
      api.certificates.options(),
    ])
      .then(([list, resultOptions]) => {
        setItems(list.items);
        setIssued(list.certificates);
        setOptions(resultOptions);
        writeWorkspaceCache(dataKey, {
          items: list.items,
          issued: list.certificates,
          options: resultOptions,
        });
        setError("");
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setBusy(false));
  }

  useEffect(() => {
    void load();
    // Each personal portal child selection owns a separately scoped list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentCode, dataKey]);

  const courses =
    options?.courses.filter((course) => course.course_level === level) || [];
  const years =
    options?.academic_years.filter((row) => row.program_code === program) || [];
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
      if (accept) await api.certificates.approve(row.code, issuer || undefined);
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
      await api.certificates.issue(
        student,
        template,
        program,
        year,
        issuer || undefined,
      );
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
          <WorkspacePrimaryAction
            onClick={() => {
              setPreview(null);
              setPreviewError(null);
              setDrawer(true);
            }}
          >
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
          suggestions={searchValues(items, [
            "student_name",
            "template_name",
            "status",
          ])}
        />
        <button
          onClick={() => {
            setBusy(true);
            void load();
          }}
          disabled={busy}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="as-alert" role="alert">
          {error}
          <button
            onClick={() => {
              setBusy(true);
              void load();
            }}
          >
            Retry
          </button>
        </div>
      )}
      {busy && <WorkspaceSkeleton compact label="Loading certificates" />}
      {!busy && filtered.length === 0 && (
        <div className="as-empty">
          <FileText />
          <h2>No certificate requests</h2>
          <p>Requests and issued documents will appear here.</p>
        </div>
      )}

      <div className="as-cards">
        {filtered.map((row) => {
          const certificate = issued.find(
            (item) => item.request_code === row.code,
          );
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

      {!personal && (
        <section className="edu-student-section">
          {options?.issuer_required && (
            <label>
              Authorized certificate issuer
              <select
                required
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
              >
                <option value="">Select issuing employee</option>
                {options.issuers?.map((e) => (
                  <option key={e.code} value={e.code}>
                    {e.name}
                    {e.designation ? ` · ${e.designation}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
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
              disabled={
                saving || !selectionReady || preview?.key !== previewKey
              }
            >
              {saving ? "Issuing…" : "Issue certificate"}
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
              {options?.issuer_required && (
                <label>
                  Authorized certificate issuer
                  <select
                    required
                    value={issuer}
                    onChange={(e) => setIssuer(e.target.value)}
                  >
                    <option value="">Select issuing employee</option>
                    {options.issuers?.map((e) => (
                      <option key={e.code} value={e.code}>
                        {e.name}
                        {e.designation ? ` · ${e.designation}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
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
              <p>
                {
                  options?.templates.find((row) => row.code === template)
                    ?.paper_size
                }{" "}
                · Preview uses the issued PDF design.
              </p>
              {!selectionReady ? (
                <p>
                  Select the student, course, academic year and authorized
                  issuer to preview.
                </p>
              ) : previewError?.key === previewKey ? (
                <div role="alert">
                  <p>{previewError.message}</p>
                  <button
                    type="button"
                    onClick={() => setPreviewAttempt((n) => n + 1)}
                  >
                    Retry preview
                  </button>
                </div>
              ) : preview?.key === previewKey ? (
                <PDFCanvasViewer
                  key={preview.url}
                  url={preview.url}
                  name="Certificate preview"
                />
              ) : (
                <WorkspaceSkeleton label="Preparing certificate preview" />
              )}
            </fieldset>
          </form>
        </SideDrawer>
      )}
    </main>
  );
}
