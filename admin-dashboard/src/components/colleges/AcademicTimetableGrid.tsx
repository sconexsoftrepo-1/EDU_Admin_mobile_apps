"use client";
import Link from "next/link";
import { courseOfferings } from "@/data/colleges/subjects";
import { sessionForStudent } from "@/lib/colleges/academic-scope";
import Image from "next/image";
import { localDate } from "@/lib/colleges/daily-schedule";
import { useCollege } from "./CollegeStore";
import { scheduleConfiguration } from "@/lib/colleges/academic-engine";
import { useEffect, useRef, useState } from "react";
import type { College } from "@/data/colleges";
import type { RecordRow } from "@/lib/colleges/store";
import type { OperationRecord } from "@/lib/colleges/operations";
import {
  sessionScope,
  cohortKey,
  timetableDays,
  timeMinutes,
  clockTime,
} from "@/lib/colleges/academic-scope";
export default function AcademicTimetableGrid({
  college,
  sessions,
  staff,
  teacherView = false,
  onSessionAction,
  onSessionMove,
  weekOffset = 0,
  mode = "Week",
  selectedDay = "Monday",
}: {
  college: College;
  sessions: OperationRecord[];
  staff: RecordRow[];
  teacherView?: boolean;
  onSessionMove?: (s: OperationRecord, day: string, start: string) => void;
  onSessionAction?: (
    s: OperationRecord,
    action: "edit" | "swap" | "cancel",
  ) => void;
  weekOffset?: number;
  mode?: string;
  selectedDay?: string;
}) {
  const { state } = useCollege();
  const configuration = scheduleConfiguration(state);
  const [mobileWeek, setMobileWeek] = useState(0);
  const [dragging, setDragging] = useState<OperationRecord | null>(null);
  const [mobileDay, setMobileDay] = useState("Monday");
  const [fullWeek, setFullWeek] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [selected, setSelected] = useState<OperationRecord | null>(null);
  const groups = new Map<string, OperationRecord[]>();
  for (const s of sessions) {
    const key = teacherView ? "faculty-view" : cohortKey(sessionScope(s));
    groups.set(key, [...(groups.get(key) || []), s]);
  }
  const faculty = (s: OperationRecord) =>
    staff.find((t) => t.id === s.employeeId)?.name ||
    (["Break", "Lunch"].includes(String(s.kind))
      ? "—"
      : "Faculty not assigned");
  if (!groups.size)
    return (
      <div className="academic-grid-empty">
        <Image
          src={"/assets/college-portals/shared/schedule-empty.svg"}
          width={120}
          height={90}
          alt=""
        />
        <h4>No published timetable for this academic group</h4>
        <p>
          Select another year, branch, specialization or section. An
          administrator can create and publish the matching timetable.
        </p>
      </div>
    );
  return (
    <div className="academic-timetables">
      {Array.from(groups).map(([key, records]) => {
        const scope = sessionScope(records[0]);
        const holidayForDay = (day: string) => {
          const date = new Date();
          date.setDate(
            date.getDate() -
              ((date.getDay() + 6) % 7) +
              timetableDays.indexOf(day) +
              (weekOffset + mobileWeek) * 7,
          );
          return (state.operations?.records.calendar || []).find(
            (e) =>
              e.date === localDate(date) &&
              e.kind === "Holiday" &&
              !["Draft", "Cancelled", "Inactive", "Archived"].includes(
                e.status,
              ) &&
              (!e.program || e.program === scope.program) &&
              (!e.section || e.section === scope.section),
          );
        };
        const valid = records.filter(
          (s) =>
            Number.isFinite(timeMinutes(String(s.start))) &&
            Number.isFinite(timeMinutes(String(s.end))) &&
            s.end > s.start &&
            !holidayForDay(String(s.day)),
        );
        const recordedBounds = valid.flatMap((s) => [
          timeMinutes(String(s.start)),
          timeMinutes(String(s.end)),
        ]);
        const first = recordedBounds.length ? Math.min(...recordedBounds) : 560;
        const last = recordedBounds.length ? Math.max(...recordedBounds) : 980;
        const dayEdges = configuration.slots
          .flatMap((slot) => [timeMinutes(slot.start), timeMinutes(slot.end)])
          .filter((t) => t < first || t > last);
        const boundaries = Array.from(
          new Set([...recordedBounds, ...dayEdges]),
        ).sort((a, b) => a - b);
        const days = mode === "Day" ? [selectedDay] : configuration.workingDays;
        const commonPauses = valid.filter(
          (s) =>
            s.day === days[0] &&
            ["Break", "Lunch"].includes(String(s.kind)) &&
            days.every(
              (day) =>
                valid.some(
                  (p) =>
                    p.day === day &&
                    p.kind === s.kind &&
                    p.start === s.start &&
                    p.end === s.end,
                ) &&
                !valid.some(
                  (p) =>
                    p.day === day &&
                    !["Break", "Lunch"].includes(String(p.kind)) &&
                    String(p.start) < String(s.end) &&
                    String(p.end) > String(s.start),
                ),
            ),
        );
        const courses = Array.from(
          new Map(
            valid
              .filter(
                (s) =>
                  ![
                    "Break",
                    "Lunch",
                    "Sports",
                    "Library",
                    "Counselling",
                  ].includes(String(s.kind)),
              )
              .map((s) => [`${s.name}-${s.employeeId}-${s.room}`, s]),
          ).values(),
        );
        return (
          <section
            className="academic-cohort-sheet"
            key={key}
            aria-label={`Year ${scope.studyYear} ${scope.branch} section ${scope.section} timetable`}
          >
            <header className="academic-sheet-heading">
              <strong>{college.name}</strong>
              <h3>
                {teacherView ? "Allocated faculty timetable" : scope.branch}
              </h3>
              <p>
                {scope.academicYear} · Year {scope.studyYear} · Semester{" "}
                {scope.semester}
              </p>
              <div>
                <span>
                  {scope.specialization} · Section {scope.section} ·{" "}
                  {scope.batch}
                </span>
                <span>
                  {teacherView
                    ? "Your assigned teaching sessions"
                    : "Published class timetable"}
                </span>
              </div>
              {records[0].coordinator && (
                <small>Class coordinator: {records[0].coordinator}</small>
              )}
            </header>
            <p className="academic-grid-hint">
              Scroll horizontally to view every period. Select a subject for
              faculty and room details.
            </p>
            <div className="academic-mobile-week">
              <div className="academic-mobile-week-nav">
                <button
                  aria-label="Previous mobile timetable week"
                  onClick={() => setMobileWeek(mobileWeek - 1)}
                >
                  ←
                </button>
                <strong>
                  {(() => {
                    const d = new Date();
                    d.setDate(
                      d.getDate() -
                        ((d.getDay() + 6) % 7) +
                        (weekOffset + mobileWeek) * 7,
                    );
                    return `Week of ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
                  })()}
                </strong>
                <button
                  aria-label="Next mobile timetable week"
                  onClick={() => setMobileWeek(mobileWeek + 1)}
                >
                  →
                </button>
              </div>
              <div
                className="academic-mobile-days"
                role="group"
                aria-label="Select timetable day"
              >
                {configuration.workingDays.map((day) => (
                  <button
                    key={day}
                    aria-pressed={mobileDay === day}
                    onClick={() => setMobileDay(day)}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
              <button onClick={() => setFullWeek(!fullWeek)}>
                {fullWeek ? "Selected day" : "Full week grid"}
              </button>
              {!fullWeek && holidayForDay(mobileDay) && (
                <p>
                  {holidayForDay(mobileDay)?.name} · Holiday. No teaching
                  sessions.
                </p>
              )}
              {!fullWeek && (
                <div
                  className="academic-mobile-timeline"
                  onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
                  onTouchEnd={(e) => {
                    const delta = e.changedTouches[0].clientX - touchStart;
                    if (Math.abs(delta) > 45)
                      setMobileDay(
                        timetableDays[
                          (timetableDays.indexOf(mobileDay) +
                            (delta < 0 ? 1 : 5)) %
                            6
                        ],
                      );
                  }}
                >
                  {valid
                    .filter((s) => s.day === mobileDay)
                    .sort((a, b) =>
                      String(a.start).localeCompare(String(b.start)),
                    )
                    .map((s) => (
                      <button
                        data-kind={s.kind}
                        key={s.id}
                        onClick={() => setSelected(s)}
                      >
                        <time>
                          {s.start}
                          <small>{s.end}</small>
                        </time>
                        <span>
                          <strong>{s.name}</strong>
                          <small>
                            {faculty(s)} · {s.room}
                          </small>
                          <small>
                            {s.kind} ·{" "}
                            {s.status === "Active" ? "Scheduled" : s.status}
                          </small>
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
            <div
              data-mobile-full={fullWeek}
              className="academic-grid-scroll academic-primary-grid"
              tabIndex={0}
              role="region"
              aria-label="Weekly timetable, scroll horizontally to view all periods"
            >
              <table className="academic-week-table">
                <caption>
                  Weekly timetable · {scope.program} · Section {scope.section}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    {days.map((day) => (
                      <th scope="col" key={day}>
                        {day}
                        <span>
                          {(() => {
                            const d = new Date();
                            d.setDate(
                              d.getDate() -
                                ((d.getDay() + 6) % 7) +
                                timetableDays.indexOf(day) +
                                (weekOffset + mobileWeek) * 7,
                            );
                            return d.toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            });
                          })()}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {boundaries.slice(0, -1).map((time, i) => {
                    const pause = commonPauses.find(
                      (p) =>
                        time >= timeMinutes(String(p.start)) &&
                        time < timeMinutes(String(p.end)),
                    );
                    return (
                      <tr key={time}>
                        <th scope="row">
                          {clockTime(time)}
                          <span>{clockTime(boundaries[i + 1])}</span>
                        </th>
                        {pause ? (
                          <td
                            colSpan={days.length}
                            className="academic-shared-pause"
                            data-kind={pause.kind}
                          >
                            <span>{pause.name}</span>
                          </td>
                        ) : (
                          days.map((day) => {
                            const active = valid.filter(
                              (s) =>
                                s.day === day &&
                                timeMinutes(String(s.start)) <= time &&
                                timeMinutes(String(s.end)) > time,
                            );
                            if (
                              active.length === 1 &&
                              timeMinutes(String(active[0].start)) < time
                            )
                              return null;
                            if (!active.length)
                              return (
                                <td
                                  key={day}
                                  className="academic-free"
                                  data-drop-target={!!dragging}
                                  onDragOver={(e) => {
                                    if (onSessionMove) e.preventDefault();
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    if (dragging && onSessionMove)
                                      onSessionMove(
                                        dragging,
                                        day,
                                        clockTime(time),
                                      );
                                    setDragging(null);
                                  }}
                                >
                                  {holidayForDay(day)?.name || "Not scheduled"}
                                </td>
                              );
                            const span =
                              active.length === 1
                                ? Math.max(
                                    1,
                                    boundaries.indexOf(
                                      timeMinutes(String(active[0].end)),
                                    ) - i,
                                  )
                                : 1;
                            return (
                              <td
                                key={day}
                                rowSpan={span}
                                data-kind={active[0].kind}
                                data-conflict={active.length > 1}
                              >
                                {active.map((s) => (
                                  <button
                                    key={s.id}
                                    draggable={!!onSessionMove}
                                    onDragStart={() => setDragging(s)}
                                    onDragEnd={() => setDragging(null)}
                                    onClick={() => setSelected(s)}
                                    title={`${s.name} · ${faculty(s)} · ${s.room}`}
                                    aria-label={`${s.name}, ${s.day}, ${s.start}–${s.end}, ${faculty(s)}, ${s.room}`}
                                  >
                                    <strong>
                                      {s.subjectCode ||
                                        s.name
                                          .split(/\s+/)
                                          .map((w) => w[0])
                                          .join("")
                                          .slice(0, 8)
                                          .toUpperCase()}
                                    </strong>
                                    <span>{s.name}</span>
                                    <small>{faculty(s)}</small>
                                    <small>
                                      {s.room} · {s.kind}
                                      {teacherView
                                        ? ` · Year ${s.studyYear} · Section ${s.section}`
                                        : ""}
                                    </small>
                                    <small>
                                      {s.status === "Active"
                                        ? "Scheduled"
                                        : s.status}
                                    </small>
                                  </button>
                                ))}
                                {active.length > 1 && (
                                  <small className="academic-conflict">
                                    Overlapping sessions
                                  </small>
                                )}
                              </td>
                            );
                          })
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="academic-grid-legend">
              <span data-kind="Class">Theory</span>
              <span data-kind="Lab">Laboratory</span>
              <span data-kind="Sports">Sports / activity</span>
              <span data-kind="Break">Break / lunch</span>
            </div>
            <details className="academic-faculty-directory" open>
              <summary>
                Course names, faculty & rooms ({courses.length})
              </summary>
              <div className="academic-grid-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Course / code</th>
                      <th>Faculty</th>
                      <th>Room / laboratory</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((c) => (
                      <tr key={`${c.name}-${c.employeeId}-${c.room}`}>
                        <td>
                          {c.name}
                          {c.subjectCode ? ` (${c.subjectCode})` : ""}
                        </td>
                        <td>{faculty(c)}</td>
                        <td>{c.room}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        );
      })}
      {selected && (
        <TimetableSessionDetails
          session={selected}
          faculty={faculty(selected)}
          close={() => setSelected(null)}
          onAction={onSessionAction}
        />
      )}
    </div>
  );
}
function TimetableSessionDetails({
  session,
  faculty,
  close,
  onAction,
}: {
  session: OperationRecord;
  faculty: string;
  onAction?: (s: OperationRecord, action: "edit" | "swap" | "cancel") => void;
  close: () => void;
}) {
  const { state, role } = useCollege();
  const course = courseOfferings(
    String(session.program),
    Number(session.semester || 1),
  ).find((c) => c.name === session.name || c.code === session.subjectCode);
  const enrolled = state.students.filter((st) =>
    sessionForStudent(session, st),
  );
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
  const scope = sessionScope(session);
  return (
    <dialog
      ref={dialog}
      className="ops-sheet academic-session-sheet"
      data-panel-size="compact"
      aria-label="Selected timetable session"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <header>
        <div>
          <small>Published timetable session</small>
          <h2>{session.name}</h2>
        </div>
        <button onClick={close} aria-label="Close session details">
          Close
        </button>
      </header>
      <div className="ops-sheet-body">
        <dl>
          <dt>Day & time</dt>
          <dd>
            {session.day} · {session.start}–{session.end}
          </dd>
          <dt>Faculty</dt>
          <dd>{faculty}</dd>
          <dt>Room / laboratory</dt>
          <dd>{session.room}</dd>
          <dt>Academic year</dt>
          <dd>{scope.academicYear}</dd>
          <dt>Year & semester</dt>
          <dd>
            Year {scope.studyYear} · Semester {scope.semester}
          </dd>
          <dt>Branch</dt>
          <dd>{scope.branch}</dd>
          <dt>Specialization</dt>
          <dd>{scope.specialization}</dd>
          <dt>Section / batch</dt>
          <dd>
            {scope.section} / {scope.batch}
          </dd>
          <dt>Enrolled students</dt>
          <dd>{enrolled.length}</dd>
          <dt>Status</dt>
          <dd>{session.status}</dd>
          <dt>Course code / type</dt>
          <dd>
            {session.subjectCode || "—"} · {session.kind}
          </dd>
        </dl>
        {course && (
          <details>
            <summary>Course outline & learning materials</summary>
            <ol>
              {course.units.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ol>
            <p>{course.experiments.join(" · ")}</p>
          </details>
        )}
        {role === "Faculty" && (
          <div className="ops-row-actions">
            <Link
              href={`/colleges-institutions/${state.slug}/portal/staff/attendance`}
            >
              Mark attendance
            </Link>
            <Link
              href={`/colleges-institutions/${state.slug}/portal/staff/students`}
            >
              View students
            </Link>
            <Link
              href={`/colleges-institutions/${state.slug}/portal/staff/assignments`}
            >
              Open assignments
            </Link>
          </div>
        )}
        {onAction && (
          <div className="ops-row-actions">
            {(["edit", "swap", "cancel"] as const).map((action) => (
              <button
                key={action}
                onClick={() => {
                  close();
                  onAction(session, action);
                }}
              >
                {action === "edit"
                  ? "Edit session"
                  : action === "swap"
                    ? "Swap faculty / room"
                    : "Cancel session"}
              </button>
            ))}
          </div>
        )}
      </div>
    </dialog>
  );
}
