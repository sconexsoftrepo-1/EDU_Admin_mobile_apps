"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GraduationCap, X } from "lucide-react";
import { api, type NewAdmission } from "@/services/api";
import { courseLevelLabel } from "@/lib/colleges/person-photo";
import "./admission-insights.css";
import { formatDate } from "@/lib/colleges/dates";

const POPUP_KEY = "edunexa-admissions-popup-session";
const SEEN_KEY = "edunexa-admissions-seen";
const shortDate = (value: string) => formatDate(value);

function seenThisLogin(session: string) {
  try {
    return localStorage.getItem(POPUP_KEY) === session;
  } catch {
    return false;
  }
}
function seenStudents(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
function markSeen(session: string, codes: string[]) {
  try {
    localStorage.setItem(POPUP_KEY, session);
    const all = [...new Set([...codes, ...seenStudents()])].slice(0, 1000);
    localStorage.setItem(SEEN_KEY, JSON.stringify(all));
  } catch {}
}

/** After sign-in: the students admitted since this browser last showed the list (last 7 days). */
export function AdmissionsPopup({
  session,
  admissionsHref,
}: {
  session?: string;
  admissionsHref?: string;
}) {
  const [rows, setRows] = useState<NewAdmission[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!session || seenThisLogin(session)) return;
    let active = true;
    void api.admissions
      .insights()
      .then((result) => {
        if (!active) return;
        const seen = new Set(seenStudents());
        setRows(
          (result.new_admissions || []).filter(
            (row) => !seen.has(row.student_code),
          ),
        );
      })
      // The popup is a notice; a failed request should not interrupt the home screen.
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [session]);
  useEffect(() => {
    if (rows.length && !dialog.current?.open) dialog.current?.showModal();
  }, [rows]);
  if (!rows.length) return null;
  const close = () => dialog.current?.close();
  return (
    <dialog
      ref={dialog}
      className="adi-popup"
      aria-labelledby="adi-popup-title"
      // The portal shell can remount during startup, so only a real close counts as seen.
      onClose={() =>
        session &&
        markSeen(
          session,
          rows.map((row) => row.student_code),
        )
      }
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="adi-popup-body">
        <header>
          <span className="adi-popup-icon">
            <GraduationCap size={20} />
          </span>
          <div>
            <h2 id="adi-popup-title">New admissions</h2>
            <p>
              {rows.length} {rows.length === 1 ? "student has" : "students have"}{" "}
              joined since you last checked
            </p>
          </div>
          <button aria-label="Close new admissions" onClick={close}>
            <X size={18} />
          </button>
        </header>
        <ul>
          {rows.map((row) => (
            <li key={row.student_code}>
              <div>
                <strong>{row.name}</strong>
                <small>
                  {[
                    row.course_name,
                    row.course_level && courseLevelLabel(row.course_level),
                    row.reference && `Ref: ${row.reference}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </div>
              <div className="adi-popup-meta">
                {row.admission_number && <span>{row.admission_number}</span>}
                <small>Admitted {shortDate(row.admission_date)}</small>
              </div>
            </li>
          ))}
        </ul>
        <footer>
          {admissionsHref && (
            <Link href={admissionsHref} onClick={close}>
              View admissions
            </Link>
          )}
          <button autoFocus onClick={close}>
            Close
          </button>
        </footer>
      </div>
    </dialog>
  );
}
