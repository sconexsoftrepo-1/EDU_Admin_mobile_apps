"use client";
import { cohortKey, sessionScope } from "@/lib/colleges/academic-scope";
import AcademicTimetableGrid from "./AcademicTimetableGrid";
import type { College } from "@/data/colleges";
import type { RecordRow } from "@/lib/colleges/store";
import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, MapPin } from "lucide-react";
import type { OperationRecord } from "@/lib/colleges/operations";
import { localDate, scheduleForDate } from "@/lib/colleges/mobile-schedule";
import DateInput from "./DateInput";
export default function MobileAcademicCalendar({
  periods,
  events,
  college,
  staff,
}: {
  college?: College;
  staff?: RecordRow[];
  periods: OperationRecord[];
  events: OperationRecord[];
}) {
  const [date, setDate] = useState(() => localDate(new Date()));
  const [view, setView] = useState("Day");
  const [termStart, setTermStart] = useState(() => {
    const d = new Date();
    return localDate(new Date(d.getFullYear(), d.getMonth() < 6 ? 0 : 6, 1));
  });
  const [termEnd, setTermEnd] = useState(() => {
    const d = new Date();
    return localDate(new Date(d.getFullYear(), d.getMonth() < 6 ? 6 : 12, 0));
  });
  const selected = new Date(`${date}T12:00:00`);
  const move = (days: number) => {
    const d = new Date(selected);
    d.setDate(d.getDate() + days);
    setDate(localDate(d));
  };
  const start = new Date(selected);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
  const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const offset = (monthStart.getDay() + 6) % 7;
  const month = Array.from(
    { length: 42 },
    (_, i) =>
      new Date(selected.getFullYear(), selected.getMonth(), i - offset + 1),
  );
  const days =
    view === "Week"
      ? week
      : view === "Term"
        ? Array.from(
            {
              length: Math.max(
                0,
                Math.min(
                  366,
                  Math.round(
                    (new Date(`${termEnd}T12:00:00`).getTime() -
                      new Date(`${termStart}T12:00:00`).getTime()) /
                      86400000,
                  ) + 1,
                ),
              ),
            },
            (_, i) => {
              const d = new Date(`${termStart}T12:00:00`);
              d.setDate(d.getDate() + i);
              return d;
            },
          )
        : [selected];
  const multipleCohorts =
    new Set(periods.map((p) => cohortKey(sessionScope(p)))).size > 1;
  const list = (d: Date) => scheduleForDate(localDate(d), periods, events);
  return (
    <section className="mobile-calendar">
      <div className="mobile-segments" aria-label="Calendar view">
        {["Day", "Week", "Month", "Term"].map((v) => (
          <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>
            {v}
          </button>
        ))}
      </div>
      {view === "Term" && (
        <div className="mobile-term-range">
          <label>
            Term starts
            <DateInput
              aria-label="Academic term starts"
              value={termStart}
              onChange={(e) => setTermStart(e.target.value)}
            />
          </label>
          <label>
            Term ends
            <DateInput
              aria-label="Academic term ends"
              value={termEnd}
              onChange={(e) => setTermEnd(e.target.value)}
            />
          </label>
          <small>
            Shared schedule within the selected term (up to one year).
          </small>
        </div>
      )}
      <div className="mobile-calendar-heading">
        <button
          aria-label="Previous calendar period"
          onClick={() => move(view === "Day" ? -1 : view === "Week" ? -7 : -30)}
        >
          <ChevronLeft size={18} />
        </button>
        <label>
          <CalendarDays size={16} />
          <DateInput
            aria-label="Academic calendar date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>
        <button
          aria-label="Next calendar period"
          onClick={() => move(view === "Day" ? 1 : view === "Week" ? 7 : 30)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="mobile-week-strip">
        {week.map((d) => (
          <button
            key={localDate(d)}
            aria-pressed={localDate(d) === date}
            onClick={() => setDate(localDate(d))}
          >
            <small>{d.toLocaleDateString("en-US", { weekday: "short" })}</small>
            <strong>{d.getDate()}</strong>
            <i data-has-events={list(d).length > 0} />
          </button>
        ))}
      </div>
      {view === "Month" ? (
        <div className="mobile-month-grid">
          {["M", "T", "W", "T", "F", "S", "S"].map((s, i) => (
            <small key={i}>{s}</small>
          ))}
          {month.map((d) => (
            <button
              key={localDate(d)}
              aria-label={`${localDate(d)}, ${list(d).length} events`}
              aria-pressed={localDate(d) === date}
              data-muted={d.getMonth() !== selected.getMonth()}
              onClick={() => {
                setDate(localDate(d));
                setView("Day");
              }}
            >
              {d.getDate()}
              <i data-has-events={list(d).length > 0} />
            </button>
          ))}
        </div>
      ) : view === "Week" && college && staff ? (
        <AcademicTimetableGrid
          college={college}
          sessions={periods}
          staff={staff}
        />
      ) : (
        days.map((d) => (
          <div key={localDate(d)}>
            <div className="mobile-section-title">
              <h4>
                {d.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </h4>
              <small>{list(d).length} sessions</small>
            </div>
            <div className="mobile-timeline">
              {list(d).length ? (
                list(d).map((e) => (
                  <details
                    className="mobile-timeline-event"
                    data-kind={e.kind}
                    key={e.id}
                  >
                    <summary>
                      <time>
                        {e.start || "Due"}
                        <small>{e.end}</small>
                      </time>
                      <span>
                        <strong>{e.name}</strong>
                        <small>
                          {e.kind}
                          {e.room ? ` · ${e.room}` : ""}
                        </small>
                        {multipleCohorts && e.scopeLabel && (
                          <small className="mobile-event-scope">
                            {e.scopeLabel}
                          </small>
                        )}
                      </span>
                    </summary>
                    <div className="mobile-event-detail">
                      <p>
                        {e.description ||
                          "Scheduled in the shared academic calendar."}
                      </p>
                      {e.room && (
                        <p>
                          <MapPin size={13} /> {e.room}
                        </p>
                      )}
                      <small>{e.status}</small>
                    </div>
                  </details>
                ))
              ) : (
                <p className="mobile-empty">
                  <Image
                    src="/assets/college-portals/shared/schedule-empty.svg"
                    width={160}
                    height={107}
                    alt="An open academic calendar"
                  />
                  No scheduled sessions. Choose another day to see your
                  timetable.
                </p>
              )}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
