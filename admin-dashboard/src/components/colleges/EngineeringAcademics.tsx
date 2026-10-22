"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  engineeringPrograms,
  engineeringCourses,
} from "@/data/colleges/engineering";
import { academicRooms, teachingLoad } from "@/lib/colleges/academic-engine";
import { useCollege } from "./CollegeStore";
import { opRows } from "@/lib/colleges/operations";
import { publishedSession } from "@/lib/colleges/academic-scope";
import { professionalPdf } from "@/lib/colleges/download";
import { collegeBySlug } from "@/data/colleges";
import PDFActions from "./PDFActions";
export default function EngineeringAcademics() {
  const { state } = useCollege();
  const [type, setType] = useState("B.Tech");
  const [program, setProgram] = useState(engineeringPrograms[0].name);
  const [semester, setSemester] = useState("1");
  const selected = engineeringPrograms.find((p) => p.name === program)!;
  const courses = engineeringCourses(program, Number(semester));
  const teachers = state.staff.filter(
    (f) => f.category === "Faculty" && f.note === selected.department,
  );
  const rooms = academicRooms(state);
  return (
    <section className="engineering-admin">
      <header>
        <span className="skyline-eyebrow">
          ACADEMIC STRUCTURE / FICTIONAL CURRICULUM
        </span>
        <h1>Programs & branches</h1>
        <p>
          Engineering departments, semester offerings and actual teaching
          allocations in one workspace.
        </p>
      </header>
      <div className="ops-toolbar">
        <label>
          Program type
          <select
            aria-label="Program type"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setProgram(
                engineeringPrograms.find((p) => p.type === e.target.value)!
                  .name,
              );
              setSemester("1");
            }}
          >
            {["Diploma", "B.Tech", "M.Tech"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Engineering program
          <select
            aria-label="Engineering program"
            value={program}
            onChange={(e) => {
              setProgram(e.target.value);
              setSemester("1");
            }}
          >
            {engineeringPrograms
              .filter((p) => p.type === type)
              .map((p) => (
                <option key={p.slug}>{p.name}</option>
              ))}
          </select>
        </label>
        <label>
          Curriculum semester
          <select
            aria-label="Curriculum semester"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
          >
            {Array.from({ length: selected.semesters }, (_, i) => (
              <option key={i} value={String(i + 1)}>
                Semester {i + 1}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="skyline-academic-pulse">
        <span>
          <b>{selected.years}</b> years
        </span>
        <span>
          <b>{selected.semesters}</b> semesters
        </span>
        <span>
          <b>{courses.reduce((n, c) => n + c.credits, 0)}</b> semester credits
        </span>
        <span>
          <b>{state.students.filter((st) => st.program === program).length}</b>{" "}
          enrolled records
        </span>
        <span>
          <b>{teachers.length}</b> department faculty
        </span>
        <span>
          <b>{selected.lateralEntry ? "Yes" : "No"}</b> lateral entry
        </span>
      </div>
      <section className="skyline-panel">
        <header>
          <h2>Semester {semester} · course offerings</h2>
          <PDFActions
            onAction={(mode) =>
              professionalPdf(
                "Semester-curriculum",
                {
                  title: `${selected.name} · Semester ${semester}`,
                  context: {
                    college: collegeBySlug(state.slug)!,
                    institution: state.institution,
                  },
                  sections: [
                    {
                      title:
                        "Illustrative curriculum · not an official university syllabus",
                      columns: [
                        "Code",
                        "Course",
                        "Type",
                        "Credits",
                        "Hours/week",
                      ],
                      rows: courses.map((c) => [
                        c.code,
                        c.name,
                        c.kind,
                        String(c.credits),
                        String(c.weeklyHours),
                      ]),
                    },
                  ],
                },
                mode,
              )
            }
          >
            Curriculum PDF
          </PDFActions>
        </header>
        <div className="engineering-course-list">
          {courses.map((c) => (
            <details key={c.id}>
              <summary>
                <span>{c.code}</span>
                <strong>{c.name}</strong>
                <small>
                  {c.kind === "Lab" ? "Laboratory" : "Theory"} · {c.credits}{" "}
                  credits · {c.weeklyHours} hours/week
                </small>
              </summary>
              <h3>Course outline</h3>
              <ol>
                {c.units.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ol>
              {c.experiments.length > 0 && (
                <>
                  <h3>Laboratory practice</h3>
                  <ol>
                    {c.experiments.map((u) => (
                      <li key={u}>{u}</li>
                    ))}
                  </ol>
                </>
              )}
              <p>
                Assignment: document a worked application and explain the design
                choices. Internal assessment: problem solving, practical
                demonstration and review.
              </p>
              <Link
                href={`/colleges-institutions/${state.slug}/portal/admin/timetable`}
              >
                Allocate faculty & schedule ↗
              </Link>
            </details>
          ))}
        </div>
      </section>
      <div className="skyline-chart-grid">
        <section className="skyline-panel">
          <header>
            <h2>Faculty allocation & workload</h2>
          </header>
          {teachers.slice(0, 12).map((f) => (
            <details key={f.id}>
              <summary>
                {f.name} · {teachingLoad(state, f.id).toFixed(1)} hours/week
              </summary>
              <p>
                Engineering faculty · {f.note} · {f.status}
              </p>
              <p>
                {f.email || `${f.id.toLowerCase()}@skyline-institute.example`}
              </p>
              <ul>
                {opRows(state, "timetable")
                  .filter((s) => s.employeeId === f.id && publishedSession(s))
                  .slice(0, 8)
                  .map((s) => (
                    <li key={s.id}>
                      {s.name} · {s.day} {s.start}–{s.end} · Section {s.section}{" "}
                      · {s.room}
                    </li>
                  ))}
              </ul>
            </details>
          ))}
        </section>
        <section className="skyline-panel">
          <header>
            <h2>Classrooms & laboratories</h2>
            <span>{rooms.length} configured resources</span>
          </header>
          <Image
            src="/assets/colleges/skyline/dashboard/laboratory.svg"
            width={160}
            height={120}
            alt="Laboratory allocation illustration"
          />
          {rooms.slice(0, 8).map((r) => (
            <p key={r.id}>
              <strong>{r.name}</strong> · {r.kind} · {r.capacity} seats
              <br />
              <small>{r.equipment}</small>
            </p>
          ))}
        </section>
      </div>
    </section>
  );
}
