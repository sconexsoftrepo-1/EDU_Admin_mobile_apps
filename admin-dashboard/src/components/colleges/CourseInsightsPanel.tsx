"use client";
import { useErrorToast } from "./toast";
import CourseSemesterWorkspace from "./CourseSemesterWorkspace";
/**
 * Side panel of a course: its details and year-wise batches with student counts — total, by year
 * of study, hostel and bus users, gender split and fees raised.
 */
import { useEffect, useId, useRef, useState } from "react";
import { BedDouble, Bus, CalendarRange, Users, X } from "lucide-react";
import { api, errorText, type CourseInsights, type Row } from "@/services/api";

const text = (value: unknown) =>
  value === null || value === undefined ? "" : String(value);
const ordinal = (n: number) =>
  `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"} year`;

export default function CourseInsightsPanel({
  course,
  colour,
  onClose,
}: {
  course: Row;
  colour: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<CourseInsights | null>(null);
  const [error, setError] = useState("");
  useErrorToast(error);
  const close = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    let active = true;
    void api.masterData
      .courseInsights(text(course.code))
      .then((value) => active && setData(value))
      .catch((e) => active && setError(errorText(e)));
    return () => {
      active = false;
    };
  }, [course.code]);
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (node && !node.open) node.showModal();
    close.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      requestAnimationFrame(() => {
        if (previous?.isConnected) previous.focus();
      });
    };
  }, []);

  const totals = data?.totals;
  const yearsOfStudy = Array.from(
    { length: data?.years || 0 },
    (_, i) => i + 1,
  );
  return (
    <dialog
      ref={dialog}
      className="crs-panel crs-details-drawer"
      aria-labelledby={titleId}
      style={{ "--family": colour } as React.CSSProperties}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const bounds = e.currentTarget.getBoundingClientRect();
          if (e.clientX < bounds.left || e.clientX > bounds.right) onClose();
        }
      }}
    >
      <header className="crs-panel-head">
        <div>
          <span className="crs-panel-eyebrow">Course overview</span>
          <h2 id={titleId}>{text(course.name) || text(course.branch)}</h2>
          <p>{text(course.code)}</p>
          {!!course.duration_label && (
            <span className="crs-panel-duration">
              {text(course.duration_label)}
            </span>
          )}
        </div>
        <button
          ref={close}
          type="button"
          className="crs-panel-close"
          onClick={onClose}
          aria-label="Close course details"
        >
          <X size={20} />
        </button>
      </header>

      <div className="crs-panel-body">
        {error && (
          <p className="crs-panel-error" role="alert">
            {error}
          </p>
        )}
        {!data && !error && (
          <div className="crs-panel-loading" role="status">
            <span />
            <span />
            <span />
            Loading enrollment summary…
          </div>
        )}

        {data && totals && (
          <>
            <section className="crs-kpis" aria-label="Course totals">
              <div className="crs-kpi crs-kpi-main">
                <Users size={18} />
                <strong>{totals.students}</strong>
                <span>students across {totals.batches} batches</span>
              </div>
              <div className="crs-kpi">
                <BedDouble size={16} />
                <strong>{totals.hostel}</strong>
                <span>in hostel</span>
              </div>
              <div className="crs-kpi">
                <Bus size={16} />
                <strong>{totals.transport}</strong>
                <span>use the bus</span>
              </div>
              {totals.intake_capacity ? (
                <div className="crs-kpi">
                  <CalendarRange size={16} />
                  <strong>
                    {Math.round(
                      (100 * (data.batches[0]?.students || 0)) /
                        Number(totals.intake_capacity),
                    )}
                    %
                  </strong>
                  <span>
                    of {text(totals.intake_capacity)} seats filled this year
                  </span>
                </div>
              ) : null}
            </section>

            {totals.students > 0 && (
              <section className="crs-panel-section">
                <h3>Students by year of study</h3>
                <div className="crs-years">
                  {yearsOfStudy.map((y) => {
                    const count = totals.by_current_year[String(y)] || 0;
                    return (
                      <div key={y} className="crs-year">
                        <span>{ordinal(y)}</span>
                        <div className="crs-bar">
                          <i
                            style={{
                              width: `${(100 * count) / Math.max(1, totals.students)}%`,
                            }}
                          />
                        </div>
                        <b>{count}</b>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
        <CourseSemesterWorkspace key={text(course.code)} course={course} />
        <section className="crs-panel-section">
          <h3>Course details</h3>
          <dl className="crs-details">
            {[
              ["Qualification", course.qualification],
              ["Family", course.category],
              ["Duration", course.duration_label],
              [
                "Semesters",
                course.semesters_label || course.duration_semesters,
              ],
              ["Subjects", course.subjects],
              ["Careers", course.career_opportunities],
              ["Course code", course.code],
              ["Admission branch code", course.branch_code],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={text(k)}>
                  <dt>{text(k)}</dt>
                  <dd>{text(v)}</dd>
                </div>
              ))}
          </dl>
        </section>
      </div>
      <footer className="crs-panel-footer">
        <span>Course details & enrollment summary</span>
        <button type="button" onClick={onClose}>
          Done
        </button>
      </footer>
    </dialog>
  );
}
