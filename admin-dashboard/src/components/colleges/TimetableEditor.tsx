"use client";
import Select from "./SearchSelect";
import { useErrorToast } from "./toast";
import { useEffect, useRef, useState } from "react";
import type { College } from "@/data/colleges";
import type { OperationRecord } from "@/lib/colleges/operations";
import { opRows } from "@/lib/colleges/operations";
import { useCollege } from "./CollegeStore";
import {
  academicRooms,
  scheduleConfiguration,
  teachingLoad,
  validateAcademicSession,
  type ScheduleConfiguration,
} from "@/lib/colleges/academic-engine";
import { studentScope, timetableDays } from "@/lib/colleges/academic-scope";
import { courseOfferings } from "@/data/colleges/subjects";
import DateInput from "./DateInput";
export default function TimetableEditor({
  college,
  session,
  action = "edit",
  close,
}: {
  college: College;
  session?: OperationRecord;
  action?: string;
  close: () => void;
}) {
  const { state, run, message } = useCollege();
  const dialog = useRef<HTMLDialogElement>(null);
  const initial = studentScope(
    state.students.find((s) => s.program === session?.program) ||
      state.students[0],
  );
  const [data, setData] = useState<Record<string, string>>(() => ({
    ...initial,
    name: "",
    day: "Monday",
    start: "09:20",
    end: "10:20",
    kind: "Class",
    employeeId: "",
    room: "",
    date: new Date().toISOString().slice(0, 10),
    ...Object.fromEntries(
      Object.entries(session || {}).map(([k, v]) => [k, String(v)]),
    ),
  }));
  const [stage, setStage] = useState(0);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  useErrorToast(error);
  const [config, setConfig] = useState<ScheduleConfiguration>(() =>
    scheduleConfiguration(state),
  );
  const [roomForm, setRoomForm] = useState(false);
  const rooms = academicRooms(state);
  const faculty = state.staff.filter(
    (f) => f.category === "Faculty" && f.status === "Active",
  );
  const courses = courseOfferings(data.program, Number(data.semester));
  const set = (key: string, value: string) => {
    setSaved("");
    setData((old) => {
      if (key === "program") {
        const p = college.programs.find((p) => p.name === value);
        return {
          ...old,
          program: value,
          branch: value,
          specialization: p?.specialization || "General",
          semester: "1",
          studyYear: "1",
        };
      }
      return { ...old, [key]: value };
    });
  };
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, []);
  const validate = () => {
    try {
      const records = opRows(state, "timetable").filter(
        (s) => s.id !== session?.id,
      );
      validateAcademicSession(state, data, records);
      setError("");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid session");
      return false;
    }
  };
  const save = () => {
    if (!data.name || !data.program) {
      setError("Select the academic group and course name.");
      return;
    }
    const success = run({
      type: "ops.record.save",
      id: session?.status === "Draft" ? session.id : undefined,
      data: {
        ...data,
        collection: "timetable",
        saveAsDraft: "Yes",
        replacesId: String(session?.replacesId || session?.id || ""),
      },
    });
    if (success) {
      setSaved("Draft saved. Review and publish from the timetable workspace.");
      setStage(3);
    }
  };
  const field = (
    label: string,
    key: string,
    options?: { value: string; label: string }[],
    type = "text",
  ) => (
    <label key={key}>
      {label}
      {options ? (
        <Select
          aria-label={label}
          required
          value={data[key] || ""}
          onChange={(e) => set(key, e.target.value)}
        >
          <option value="">Choose {label.toLowerCase()}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ) : type === "date" ? (
        <DateInput
          aria-label={label}
          required
          value={data[key] || ""}
          onChange={(e) => set(key, e.target.value)}
        />
      ) : (
        <input
          aria-label={label}
          required
          type={type}
          value={data[key] || ""}
          onChange={(e) => set(key, e.target.value)}
        />
      )}
    </label>
  );
  const values = (items: string[]) =>
    [...new Set(items)].map((value) => ({ value, label: value }));
  return (
    <dialog
      ref={dialog}
      className="ops-sheet academic-editor"
      data-panel-size="medium"
      aria-label="Timetable workflow"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <header>
        <div>
          <small>{college.name} · Academic operations</small>
          <h2>
            {action === "cancel"
              ? "Cancel / reschedule session"
              : action === "swap"
                ? "Reassign faculty & classroom"
                : session
                  ? "Revise timetable session"
                  : "Create academic timetable"}
          </h2>
          <p>
            Published sessions stay live until their replacement is reviewed and
            published.
          </p>
        </div>
        <button onClick={close} aria-label="Close timetable workflow">
          Close
        </button>
      </header>
      <div className="ops-sheet-body">
        <nav
          className="academic-editor-steps"
          aria-label="Timetable workflow steps"
        >
          {[
            "Academic group",
            "Teaching allocation",
            "Schedule & resources",
            "Review & publish",
          ].map((s, i) => (
            <button
              key={s}
              aria-current={stage === i ? "step" : undefined}
              onClick={() => setStage(i)}
            >
              {i + 1}. {s}
            </button>
          ))}
        </nav>
        {action === "cancel" && session ? (
          <section>
            <h3>Cancel {session.name}?</h3>
            <p>
              This removes the session from published mobile schedules and
              retains the audit trail.
            </p>
            <button
              onClick={() => {
                if (
                  run({
                    type: "ops.record.status",
                    id: session.id,
                    data: {
                      collection: "timetable",
                      status:
                        session.status === "Scheduled"
                          ? "Cancelled"
                          : "Inactive",
                    },
                  })
                )
                  close();
              }}
            >
              Confirm cancellation
            </button>
          </section>
        ) : (
          <>
            {stage === 0 && (
              <section>
                <h3>1 · Academic group</h3>
                <div className="academic-editor-fields">
                  {field(
                    "Program",
                    "program",
                    college.programs.map((p) => ({
                      value: p.name,
                      label: p.name,
                    })),
                  )}
                  {field("Academic year", "academicYear")}
                  {field(
                    "Year of study",
                    "studyYear",
                    values(["1", "2", "3", "4"]),
                  )}
                  {field(
                    "Semester",
                    "semester",
                    values(
                      Array.from(
                        {
                          length:
                            college.programs.find(
                              (p) => p.name === data.program,
                            )?.semesters || 6,
                        },
                        (_, i) => String(i + 1),
                      ),
                    ),
                  )}
                  {field("Branch / department", "branch")}
                  {field("Specialization", "specialization")}
                  {field("Section", "section", values(["A", "B", "C"]))}
                  {field("Academic batch", "batch")}
                </div>
                <p>
                  Group changes affect only matching enrolled students and
                  linked parents.
                </p>
              </section>
            )}
            {stage === 1 && (
              <section>
                <h3>2 · Course and faculty</h3>
                <div className="academic-editor-fields">
                  {courses.length > 0 && (
                    <label>
                      Semester course
                      <Select
                        value={data.name}
                        onChange={(e) => {
                          const c = courses.find(
                            (c) => c.name === e.target.value,
                          );
                          if (c)
                            setData((old) => ({
                              ...old,
                              name: c.name,
                              subjectCode: c.code,
                              kind: c.kind,
                            }));
                        }}
                      >
                        <option value="">Choose semester course</option>
                        {courses.map((c) => (
                          <option key={c.id}>{c.name}</option>
                        ))}
                      </Select>
                    </label>
                  )}
                  {field("Course / activity name", "name")}
                  {field("Course code", "subjectCode")}
                  {field(
                    "Session type",
                    "kind",
                    values([
                      "Class",
                      "Lab",
                      "Sports",
                      "Library",
                      "Counselling",
                      "Seminar",
                      "Project",
                    ]),
                  )}
                  {field(
                    "Faculty member",
                    "employeeId",
                    faculty.map((f) => ({
                      value: f.id,
                      label: `${f.name} · ${f.note} · ${teachingLoad(state, f.id).toFixed(1)}h/week`,
                    })),
                  )}
                  {field(
                    "Classroom / laboratory",
                    "room",
                    rooms.map((r) => ({
                      value: r.name,
                      label: `${r.name} · ${r.kind} · ${r.capacity} seats`,
                    })),
                  )}
                  {field("Effective date", "date", undefined, "date")}
                </div>
                <button onClick={() => setRoomForm(!roomForm)}>
                  Add classroom / laboratory
                </button>
                {roomForm && (
                  <form
                    className="academic-editor-fields"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      if (
                        run({
                          type: "ops.timetable.room",
                          data: Object.fromEntries(fd) as Record<
                            string,
                            string
                          >,
                        })
                      )
                        setRoomForm(false);
                    }}
                  >
                    <label>
                      Resource name
                      <input name="name" required />
                    </label>
                    <label>
                      Type
                      <Select name="kind">
                        <option>Classroom</option>
                        <option>Lab</option>
                      </Select>
                    </label>
                    <label>
                      Capacity
                      <input
                        name="capacity"
                        type="number"
                        min="1"
                        max="500"
                        required
                      />
                    </label>
                    <label>
                      Equipment
                      <input name="equipment" />
                    </label>
                    <button type="submit" className="erp-primary">
                      Save resource
                    </button>
                  </form>
                )}
              </section>
            )}
            {stage === 2 && (
              <section>
                <h3>3 · Place the session</h3>
                <div className="academic-editor-fields">
                  {field("Working day", "day", values(config.workingDays))}
                  {field("Start time", "start", undefined, "time")}
                  {field("End time", "end", undefined, "time")}
                </div>
                <div className="academic-slot-options">
                  {config.slots.map((slot) => (
                    <button
                      key={slot.start}
                      disabled={slot.kind !== "Teaching"}
                      onClick={() =>
                        setData((old) => ({
                          ...old,
                          start: slot.start,
                          end: slot.end,
                        }))
                      }
                    >
                      {slot.start}–{slot.end}
                      <small>{slot.label}</small>
                    </button>
                  ))}
                </div>
                <details>
                  <summary>
                    Institution working days and time configuration
                  </summary>
                  <p>
                    Configuration changes do not silently move existing classes.
                    Edit the ordered slots, validate, then save.
                  </p>
                  <label>
                    Working days
                    <div className="academic-day-options">
                      {timetableDays.map((day) => (
                        <label key={day}>
                          <input
                            type="checkbox"
                            checked={config.workingDays.includes(day)}
                            onChange={(e) =>
                              setConfig((c) => ({
                                ...c,
                                workingDays: e.target.checked
                                  ? [...c.workingDays, day]
                                  : c.workingDays.filter((d) => d !== day),
                              }))
                            }
                          />
                          {day}
                        </label>
                      ))}
                    </div>
                  </label>
                  {config.slots.map((slot, i) => (
                    <div className="academic-slot-config" key={i}>
                      <input
                        aria-label={`Slot ${i + 1} label`}
                        value={slot.label}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            slots: c.slots.map((s, j) =>
                              i === j ? { ...s, label: e.target.value } : s,
                            ),
                          }))
                        }
                      />
                      <input
                        type="time"
                        aria-label={`Slot ${i + 1} start`}
                        value={slot.start}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            slots: c.slots.map((s, j) =>
                              i === j ? { ...s, start: e.target.value } : s,
                            ),
                          }))
                        }
                      />
                      <input
                        type="time"
                        aria-label={`Slot ${i + 1} end`}
                        value={slot.end}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            slots: c.slots.map((s, j) =>
                              i === j ? { ...s, end: e.target.value } : s,
                            ),
                          }))
                        }
                      />
                      <Select
                        aria-label={`Slot ${i + 1} type`}
                        value={slot.kind}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            slots: c.slots.map((s, j) =>
                              i === j
                                ? {
                                    ...s,
                                    kind: e.target.value as
                                      "Teaching" | "Break" | "Lunch",
                                  }
                                : s,
                            ),
                          }))
                        }
                      >
                        <option>Teaching</option>
                        <option>Break</option>
                        <option>Lunch</option>
                      </Select>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      run({
                        type: "ops.timetable.configure",
                        data: { configuration: JSON.stringify(config) },
                      })
                    }
                  >
                    Save institution configuration
                  </button>
                </details>
              </section>
            )}
            {stage === 3 && (
              <section>
                <h3>4 · Preview and validate</h3>
                <dl className="academic-editor-review">
                  {[
                    "program",
                    "academicYear",
                    "studyYear",
                    "semester",
                    "section",
                    "name",
                    "subjectCode",
                    "day",
                    "start",
                    "end",
                    "kind",
                    "room",
                  ].map((k) => (
                    <div key={k}>
                      <dt>{k.replace(/([A-Z])/g, " $1")}</dt>
                      <dd>{data[k] || "—"}</dd>
                    </div>
                  ))}
                  <div>
                    <dt>Faculty</dt>
                    <dd>
                      {faculty.find((f) => f.id === data.employeeId)?.name ||
                        "Not allocated"}
                    </dd>
                  </div>
                </dl>
                <button
                  onClick={() => {
                    if (validate())
                      setError("No conflicts found. Ready to save as draft.");
                  }}
                >
                  Validate faculty, room & section
                </button>
                <p>
                  Publication checks faculty availability, working hours,
                  capacity, room type and overlapping assignments. Drafts remain
                  private until published.
                </p>
              </section>
            )}
            <div className="academic-editor-footer">
              {stage > 0 && (
                <button onClick={() => setStage(stage - 1)}>Back</button>
              )}
              {stage < 3 && (
                <button onClick={() => setStage(stage + 1)}>Continue</button>
              )}
              <button onClick={save}>Save draft</button>
            </div>
          </>
        )}
        <p role="status">{saved || error || message}</p>
      </div>
    </dialog>
  );
}
