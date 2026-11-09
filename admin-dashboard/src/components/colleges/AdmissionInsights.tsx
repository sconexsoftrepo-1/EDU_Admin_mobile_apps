"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GraduationCap, X } from "lucide-react";
import { api, type AdmissionOpening } from "@/services/api";
import { courseLevelLabel } from "@/lib/colleges/person-photo";
import "./admission-insights.css";
import { formatDate } from "@/lib/colleges/dates";

const POPUP_KEY = "edunexa-admissions-popup-session";
const shortDate = (value: string) => formatDate(value);

function seenThisLogin(session: string) {
  try {
    return localStorage.getItem(POPUP_KEY) === session;
  } catch {
    return false;
  }
}
function markSeen(session: string) {
  try {
    localStorage.setItem(POPUP_KEY, session);
  } catch {}
}

/** Shown once after each sign-in: every login has a new login code. */
export function AdmissionsPopup({
  session,
  admissionsHref,
}: {
  session?: string;
  admissionsHref?: string;
}) {
  const [rows, setRows] = useState<AdmissionOpening[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!session || seenThisLogin(session)) return;
    let active = true;
    void api.admissions
      .insights()
      .then((result) => {
        if (active) setRows(result.available || []);
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
      onClose={() => session && markSeen(session)}
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
            <h2 id="adi-popup-title">Admissions open</h2>
            <p>
              {rows.length} {rows.length === 1 ? "course" : "courses"} available
              for admission
            </p>
          </div>
          <button aria-label="Close admissions list" onClick={close}>
            <X size={18} />
          </button>
        </header>
        <ul>
          {rows.map((row, index) => (
            <li key={`${row.program_code || row.cycle_name}-${index}`}>
              <div>
                <strong>{row.course_name || row.cycle_name}</strong>
                <small>
                  {[
                    row.course_level && courseLevelLabel(row.course_level),
                    row.academic_year,
                    row.cycle_name,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </div>
              <div className="adi-popup-meta">
                {row.intake_capacity != null && (
                  <span>{row.intake_capacity} seats</span>
                )}
                {row.closes_on && (
                  <small>Closes {shortDate(row.closes_on)}</small>
                )}
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
