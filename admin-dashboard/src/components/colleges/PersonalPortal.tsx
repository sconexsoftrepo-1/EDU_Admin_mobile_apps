"use client";
import WorkspaceSkeleton from "./WorkspaceSkeleton";
import { AdmissionsPopup } from "./AdmissionInsights";
import AdmissionAnalytics from "./AdmissionAnalytics";
import DashboardOverview from "./DashboardOverview";
import EditRequestsWorkspace from "./EditRequestsWorkspace";
import { useErrorToast } from "./toast";
import AssignmentWorkspace from "./AssignmentWorkspace";
import SyllabusWorkspace from "./SyllabusWorkspace";
import CalendarWorkspace from "./CalendarWorkspace";
import AttendanceWorkspace from "./AttendanceWorkspace";
import AssessmentWorkspace from "./AssessmentWorkspace";
import AcademicProgressWorkspace, { AcademicProgressOverview } from "./AcademicProgressWorkspace";
import CertificateWorkspace from "./CertificateWorkspace";
import { useCallback, useEffect, useState } from "react";
import {
  api,
  errorText,
  type Field,
  type PersonalScreen,
  type PersonalScreenData,
  type Row,
} from "@/services/api";
export default function PersonalPortal({
  name,
  session,
  slug,
  roleName,
  teaching = false,
  signOut,
  openForm,
}: {
  name: string;
  /** This sign-in's login code: the admissions popup shows once per login. */
  session?: string;
  slug: string;
  roleName?: string;
  teaching?: boolean;
  signOut: () => Promise<void>;
  openForm: (dialog: {
    title: string;
    fields: Field[];
    form_revision?: number;
    save: (row: Row) => Promise<void>;
  }) => void;
}) {
  const [screens, setScreens] = useState<PersonalScreen[]>([]),
    [selected, setSelected] = useState("profile"),
    [student, setStudent] = useState(""),
    [data, setData] = useState<PersonalScreenData | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true);
  useErrorToast(error);
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setData(await api.mobile.screen(selected, student || undefined));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }, [selected, student]);
  useEffect(() => {
    void api.mobile
      .screens()
      .then((r) => setScreens(r.screens))
      .catch((e) => setError(errorText(e)));
  }, []);
  useEffect(() => {
    // This view has its own data; it is not a mobile screen.
    if (selected === "edit-requests") return;
    let active = true;
    void api.mobile
      .screen(selected, student || undefined)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [selected, student]);
  async function download(kind: string, code: string) {
    try {
      await api.documents.download(kind, code, `${kind}-${code}.pdf`);
    } catch (e) {
      setError(errorText(e));
    }
  }
  function record(row: Row) {
    return (
      <dl>
        {Object.entries(row)
          .filter(([, v]) => v !== null)
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k.replaceAll("_", " ")}</dt>
              <dd style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {typeof v === "object" ? JSON.stringify(v, null, 2) : String(v)}
              </dd>
            </div>
          ))}
      </dl>
    );
  }
  return (
    <main className="edu-connected edu-workspace">
      <aside>
        <div className="edu-brand">
          <strong>{name}</strong>
        </div>
        <nav aria-label="Personal college screens">
          {screens.map((s) => (
            <button
              key={s.key}
              className={selected === s.key ? "active" : ""}
              onClick={() => setSelected(s.key)}
            >
              {s.title}
            </button>
          ))}
          {teaching && (
            <button
              className={selected === "edit-requests" ? "active" : ""}
              onClick={() => setSelected("edit-requests")}
            >
              My edit requests
            </button>
          )}
        </nav>
        <button onClick={signOut}>Sign out</button>
      </aside>
      <section className="edu-content">
        <AdmissionsPopup session={session} />
        {selected === "profile" && teaching && (
          <DashboardOverview
            campusName={name}
            roleName={roleName || "Faculty"}
            session={session}
            teaching
            campusImage={`/assets/colleges-institutions/${slug}/campus.webp`}
            moduleHref={() => undefined}
            actions={[]}
          />
        )}
        {selected === "profile" && teaching && <AdmissionAnalytics />}
        {selected === "overview" && <AcademicProgressOverview onOpen={()=>setSelected("results")}/>}
        {selected === "edit-requests" ? <EditRequestsWorkspace /> : ["academics","results"].includes(selected) ? <AcademicProgressWorkspace onNavigate={setSelected}/> : selected === "assessments" ? <AssessmentWorkspace /> : selected === "attendance" ? <AttendanceWorkspace /> : ["assignments", "submissions"].includes(selected) ? (
          <AssignmentWorkspace studentCode={student || undefined} />
        ) : selected === "syllabus" ? (
          <SyllabusWorkspace studentCode={student || undefined} />
        ) : selected === "calendar" ? (
          <CalendarWorkspace studentCode={student || undefined} />
        ) : selected === "certificates" ? (
          <CertificateWorkspace personal studentCode={student || undefined} />
        ) : (
          <>
            <header className="edu-heading">
              <h1>{data?.title || "My college workspace"}</h1>
              <button onClick={load}>Refresh</button>
            </header>
            {data && data.students.length > 1 && (
              <label>
                Student
                <select
                  value={student || data.selected_student_code || ""}
                  onChange={(e) => setStudent(e.target.value)}
                >
                  {data.students.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {error && (
              <p className="edu-error" role="alert">
                {error}
              </p>
            )}
            {busy && <WorkspaceSkeleton compact label="Loading your college records" />}
            {data?.summary && (
              <article className="edu-special">{record(data.summary)}</article>
            )}
            <div className="edu-toolbar">
              {data?.actions.map((action) => (
                <button
                  key={action.key}
                  onClick={() =>
                    openForm({
                      title: action.label,
                      fields: action.fields,
                      save: async (values) => {
                        const result = await api.mobile.runAction(
                          selected,
                          action.key,
                          {
                            values,
                            form_revision: action.form_revision,
                            student_code:
                              student || data.selected_student_code || null,
                          },
                        );
                        if (
                          result.checkout_url &&
                          /^https?:\/\//i.test(String(result.checkout_url))
                        ) {
                          window.location.assign(String(result.checkout_url));
                          return;
                        }
                        if (result.reauthenticate) {
                          await signOut();
                          return;
                        }
                        await load();
                      },
                    })
                  }
                >
                  {action.label}
                </button>
              ))}
            </div>
            {data?.items.map((row, i) => (
              <article className="edu-special" key={String(row.code || i)}>
                {record(row)}
                {selected === "notifications" && Boolean(row.certificate_request_code || row.certificate_code) && (
                  <button onClick={() => setSelected("certificates")}>View certificates</button>
                )}
                {data.downloads && row.record_type !== "request" && (
                  <button
                    onClick={() => download(data.downloads!, String(row.code))}
                  >
                    Download PDF
                  </button>
                )}
                {Array.isArray(row.receipts) &&
                  row.receipts.map((raw) => {
                    const receipt = raw as Row;
                    return (
                      <button
                        key={String(receipt.code)}
                        onClick={() =>
                          download("receipt", String(receipt.code))
                        }
                      >
                        Download receipt {String(receipt.receipt_number)}
                      </button>
                    );
                  })}
              </article>
            ))}
            {!busy && data?.items.length === 0 && !data.summary && (
              <p>No records are available yet.</p>
            )}
          </>
        )}
      </section>
    </main>
  );
}
