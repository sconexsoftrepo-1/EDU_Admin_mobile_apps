"use client";
import { useEffect, useRef } from "react";
import type { College } from "@/data/colleges";
import type { RecordRow } from "@/lib/colleges/store";
import type { OperationRecord } from "@/lib/colleges/operations";
import MobileAcademicCalendar from "./MobileAcademicCalendar";
export default function AcademicCalendarDrawer({
  college,
  periods,
  events,
  staff,
  close,
}: {
  college: College;
  periods: OperationRecord[];
  events: OperationRecord[];
  staff: RecordRow[];
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    d?.showModal();
    return () => {
      d?.close();
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="ops-sheet academic-calendar-drawer mobile-redesign"
      data-panel-size="medium"
      data-institution={college.slug}
      aria-label="Shared academic calendar"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <header>
        <div>
          <small>{college.name}</small>
          <h2>Shared academic calendar</h2>
          <p>Published sessions and events for the selected academic group.</p>
        </div>
        <button onClick={close} aria-label="Close shared academic calendar">
          Close
        </button>
      </header>
      <div className="ops-sheet-body">
        <MobileAcademicCalendar
          college={college}
          staff={staff}
          periods={periods}
          events={events}
        />
      </div>
    </dialog>
  );
}
