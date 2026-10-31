"use client";
import { useEffect, useState } from "react";
import {
  courseCurricula,
  type Curriculum,
} from "@/services/api/modules/assessments/service";
import { errorText } from "@/services/api";
import SideDrawer from "./SideDrawer";
import "./assessment-workspace.css";
export function CurriculumSummary({ program }: { program: string }) {
  const [data, setData] = useState<Curriculum | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    courseCurricula
      .get(program)
      .then((r) => {
        if (active) setData(r);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [program]);
  return (
    <div className="assessment-curriculum">
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p>Loading semester subjects…</p>
      ) : (
        <>
          <p>
            {data.status === "starter_draft"
              ? "Generated starter curriculum · review before use"
              : "Course semester curriculum"}
          </p>
          {[...new Set(data.items.map((s) => s.semester_number))].map((n) => (
            <div key={n}>
              <strong>Semester {n}</strong>
              <span>
                {
                  data.items.filter(
                    (s) =>
                      s.semester_number === n && s.subject_type !== "practical",
                  ).length
                }{" "}
                subjects ·{" "}
                {
                  data.items.filter(
                    (s) =>
                      s.semester_number === n && s.subject_type === "practical",
                  ).length
                }{" "}
                labs
              </span>
              <p>
                {data.items
                  .filter((s) => s.semester_number === n)
                  .map(
                    (s) =>
                      s.name + (s.subject_type === "practical" ? " (lab)" : ""),
                  )
                  .join(" · ")}
              </p>
            </div>
          ))}
          {!data.items.length && (
            <p>
              Add subjects and labs in Courses & enrollment before publishing
              assessments.
            </p>
          )}
        </>
      )}
    </div>
  );
}
export default function CourseCurriculum({
  program,
  name,
  semesters,
  canEdit,
  onClose,
}: {
  program: string;
  name: string;
  semesters: number;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<Curriculum | null>(null);
  const [values, setValues] = useState<{ subjects: string; labs: string }[]>(
    [],
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    courseCurricula
      .get(program)
      .then((r) => {
        if (active) {
          setData(r);
          setValues(
            Array.from({ length: semesters }, (_, i) => ({
              subjects: r.items
                .filter(
                  (s) =>
                    s.semester_number === i + 1 &&
                    s.subject_type !== "practical",
                )
                .map((s) => s.name)
                .join("\n"),
              labs: r.items
                .filter(
                  (s) =>
                    s.semester_number === i + 1 &&
                    s.subject_type === "practical",
                )
                .map((s) => s.name)
                .join("\n"),
            })),
          );
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [program, semesters]);
  const split = (s: string) =>
    s
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);
  return (
    <SideDrawer title={`${name} · Subjects & labs`} onClose={onClose}>
      <form
        className="assessment-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!data || !canEdit) return;
          setBusy(true);
          setError("");
          try {
            await courseCurricula.save(program, {
              revision: data.revision,
              semesters: values.map((v, i) => ({
                semester_number: i + 1,
                subjects: split(v.subjects),
                labs: split(v.labs),
              })),
            });
            onClose();
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          Enter one subject or lab per line. These subjects become available for
          assessments, teaching allocation and timetables.
        </p>
        {data?.status === "starter_draft" && (
          <p role="status">
            This is a generated starter draft. Check it against your
            institution’s syllabus before saving it as reviewed.
          </p>
        )}
        {values.map((v, i) => (
          <fieldset key={i}>
            <legend>
              Semester {i + 1} · {split(v.subjects).length} subjects ·{" "}
              {split(v.labs).length} labs
            </legend>
            <div className="assessment-grid">
              {(["subjects", "labs"] as const).map((k) => (
                <label key={k}>
                  {k === "subjects" ? "Subjects" : "Labs"}
                  <textarea
                    rows={6}
                    value={v[k]}
                    disabled={busy || !canEdit}
                    onChange={(e) =>
                      setValues((all) =>
                        all.map((row, n) =>
                          n === i ? { ...row, [k]: e.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        {error && (
          <p role="alert" className="edu-error">
            {error}
          </p>
        )}
        <button className="edu-primary" disabled={!data || busy || !canEdit}>
          {busy
            ? "Saving…"
            : canEdit
              ? "Save reviewed curriculum"
              : "View only"}
        </button>
      </form>
    </SideDrawer>
  );
}
