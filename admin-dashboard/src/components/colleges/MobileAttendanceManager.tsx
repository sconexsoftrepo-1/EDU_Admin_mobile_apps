"use client";
import { useState } from "react";
import { useCollege } from "./CollegeStore";
import { opRows } from "@/lib/colleges/operations";
import { localDate } from "@/lib/colleges/mobile-schedule";
export default function MobileAttendanceManager({
  employeeId,
  programs,
}: {
  employeeId: string;
  programs: string[];
}) {
  const { state, run } = useCollege();
  const [program, setProgram] = useState(programs[0] || "");
  const [date, setDate] = useState(localDate(new Date()));
  const [subject, setSubject] = useState("");
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const roster = state.students.filter(
    (s) => s.program === program && s.status === "Active",
  );
  const save = (draft: boolean) => {
    const ok = run({
      type: "ops.attendance.batch",
      data: {
        employeeId,
        program,
        date,
        subject,
        mode: draft ? "Draft" : "Finalize",
        marks: JSON.stringify(
          Object.fromEntries(
            roster.map((s) => [s.id, marks[s.id] || "Present"]),
          ),
        ),
      },
    });
    if (ok) {
      setMessage(
        draft
          ? "Attendance draft saved. Student records are unchanged."
          : "Attendance finalized. Student and parent analytics are updated.",
      );
      setConfirm(false);
    }
  };
  const draft = opRows(state, "attendance-drafts").find(
    (d) =>
      d.employeeId === employeeId &&
      d.program === program &&
      d.date === date &&
      d.subject === subject,
  );
  return (
    <section className="mobile-attendance-manager">
      <h4>Class attendance register</h4>
      <label>
        Assigned class
        <select
          value={program}
          onChange={(e) => {
            setProgram(e.target.value);
            setMarks({});
          }}
        >
          {programs.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      <label>
        Attendance date
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setMarks({});
          }}
        />
      </label>
      <label>
        Subject
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Enter the taught subject"
        />
      </label>
      <div className="mobile-filter-chips">
        <button
          onClick={() =>
            setMarks(Object.fromEntries(roster.map((s) => [s.id, "Present"])))
          }
        >
          All present
        </button>
        <button
          onClick={() =>
            setMarks(Object.fromEntries(roster.map((s) => [s.id, "Absent"])))
          }
        >
          All absent
        </button>
        {draft && (
          <button onClick={() => setMarks(JSON.parse(String(draft.marks)))}>
            Restore saved draft
          </button>
        )}
      </div>
      <div className="mobile-attendance-roster">
        {roster.map((s) => (
          <label key={s.id}>
            <span>
              {s.name}
              <small>{s.id}</small>
            </span>
            <select
              aria-label={`Attendance for ${s.name}`}
              value={marks[s.id] || "Present"}
              onChange={(e) => setMarks({ ...marks, [s.id]: e.target.value })}
            >
              {["Present", "Absent", "Late", "Excused"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="mobile-filter-chips">
        <button onClick={() => save(true)}>Save attendance draft</button>
        <button onClick={() => setConfirm(true)}>Finalize attendance</button>
      </div>
      {confirm && (
        <div role="group" aria-label="Confirm class attendance">
          <p>
            Finalize {roster.length} students for {date}? Existing entries for
            this subject and date will be corrected with an audit record.
          </p>
          <button onClick={() => save(false)}>Confirm class attendance</button>
          <button onClick={() => setConfirm(false)}>Keep editing</button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
