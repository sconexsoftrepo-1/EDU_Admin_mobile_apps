"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, CalendarDays, LoaderCircle } from "lucide-react";
import {
  api,
  errorText,
  type Field,
  type LookupOption,
  type Row,
} from "@/services/api";
import { CurriculumSummary } from "./CourseCurriculum";
import SideDrawer from "./SideDrawer";
import Select from "./SearchSelect";
import DateInput from "./DateInput";
import "./academic-year-form.css";

function defaultEndDate(start: string, years = 1) {
  if (!start) return "";
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  date.setUTCDate(date.getUTCDate() - 1);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export default function AcademicYearForm({
  initial = {},
  fields = [],
  onSave,
  onClose,
}: {
  title: string;
  initial?: Row;
  fields?: Field[];
  onSave: (values: Row) => Promise<void>;
  onClose: () => void;
}) {
  const editing = Boolean(initial.code);
  const [courseLevel, setCourseLevel] = useState("");
  const [courses, setCourses] = useState<
    (LookupOption & { years: number; level: string })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [programCode, setProgramCode] = useState(
    String(initial.program_code || ""),
  );
  const [startDate, setStartDate] = useState(
    String(initial.start_date || "").slice(0, 10),
  );
  const [endDate, setEndDate] = useState(
    String(initial.end_date || "").slice(0, 10),
  );
  const [endEdited, setEndEdited] = useState(Boolean(initial.end_date));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
      api.workspace.lookup("programs"),
      api.masterData.enrollmentOptions(),
    ])
      .then(([registered, options]) => {
        const programs = [
          ...options.courses.intermediate,
          ...options.courses.degree,
        ];
        const values = registered.map((course) => ({
          ...course,
          level: options.courses.intermediate.some(
            (p) => p.code === course.value,
          )
            ? "intermediate"
            : "degree",
          years: Math.max(
            1,
            Math.ceil(
              (programs.find((program) => program.code === course.value)
                ?.duration_semesters || 2) / 2,
            ),
          ),
        }));
        if (active) {
          setCourses(values.toSorted((a, b) => a.label.localeCompare(b.label)));
          setCourseLevel(
            values.find((c) => c.value === String(initial.program_code || ""))
              ?.level || "",
          );
        }
      })
      .catch((e) => {
        if (active)
          setError(`Could not load registered courses: ${errorText(e)}`);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initial.program_code]);
  const complete = programCode && startDate && endDate;
  const yearRange = complete
    ? `${startDate.slice(0, 4)}-${endDate.slice(0, 4)}`
    : "";
  const code = yearRange ? `${programCode}-${yearRange}` : "";
  const name = yearRange
    ? `${programCode} ${startDate.slice(0, 4)}–${endDate.slice(0, 4)}`
    : "";
  const selectedCourse = courses.find((course) => course.value === programCode);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !complete) return;
    setError("");
    if (endDate <= startDate) {
      setError("The end date must be after the start date.");
      return;
    }
    if (code.length > 100) {
      setError("This course code is too long to generate an batch code.");
      return;
    }
    if (editing && code !== initial.code) {
      setError(
        "Changing the year range would change this record’s code. Create a new batch for the new range.",
      );
      return;
    }
    setBusy(true);
    try {
      const retained = Object.fromEntries(
        fields.flatMap((field) => {
          const key = field.key || field.name;
          return key && key in initial ? [[key, initial[key]]] : [];
        }),
      );
      await onSave({
        ...retained,
        program_code: programCode,
        code,
        name,
        start_date: startDate,
        end_date: endDate,
      });
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SideDrawer
      title={editing ? "Edit batch" : "Create batch"}
      subtitle="Choose a registered course and its batch start and end dates. Required fields are marked *."
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className="edu-academic-year-form" onSubmit={save}>
        <div className="edu-academic-year-content">
          {initial.dates_need_review === true && (
            <p role="status" className="edu-error">
              This batch was imported with its original start and end years.
              Confirm the actual day and month before saving.
            </p>
          )}
          <section className="edu-academic-year-section">
            <h3>Registered course</h3>
            <label>
              <span>Course level *</span>
              <Select
                aria-label="Course level"
                required
                value={courseLevel}
                disabled={loading || busy || editing}
                onChange={(e) => {
                  setCourseLevel(e.target.value);
                  setProgramCode("");
                }}
              >
                <option value="">Select course level</option>
                <option value="intermediate">Intermediate</option>
                <option value="degree">Degree</option>
              </Select>
            </label>
            <label>
              <span>Course *</span>
              <Select
                name="program_code"
                aria-label="Course"
                required
                value={programCode}
                disabled={loading || busy || editing}
                onChange={(event) => {
                  setProgramCode(event.target.value);
                  if (!endEdited)
                    setEndDate(
                      defaultEndDate(
                        startDate,
                        courses.find(
                          (course) => course.value === event.target.value,
                        )?.years,
                      ),
                    );
                }}
              >
                <option value="">
                  {loading
                    ? "Loading registered courses…"
                    : "Select a registered course"}
                </option>
                {courses
                  .filter((c) => c.level === courseLevel)
                  .map((course) => (
                    <option key={course.value} value={course.value}>
                      {course.label} ({course.value})
                    </option>
                  ))}
                {programCode && !selectedCourse && (
                  <option value={programCode}>{programCode}</option>
                )}
              </Select>
            </label>
            <p>
              {editing
                ? "The course is fixed for an existing batch."
                : "Choose from the courses already registered in Courses & enrollment."}
            </p>
            {!loading && !courses.length && (
              <p className="edu-error">
                Register a course before creating its batch.
              </p>
            )}
          </section>
          <section className="edu-academic-year-section">
            <h3>Batch dates</h3>
            <div className="edu-academic-year-grid">
              <label>
                <span>Start date *</span>
                <DateInput
                  name="start_date"
                  aria-label="Start date"
                  required
                  value={startDate}
                  disabled={!programCode || busy}
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    if (!endEdited)
                      setEndDate(
                        defaultEndDate(
                          event.target.value,
                          selectedCourse?.years,
                        ),
                      );
                  }}
                />
              </label>
              <label>
                <span>End date *</span>
                <DateInput
                  name="end_date"
                  aria-label="End date"
                  required
                  min={startDate || undefined}
                  value={endDate}
                  disabled={!programCode || busy}
                  onChange={(event) => {
                    setEndDate(event.target.value);
                    setEndEdited(Boolean(event.target.value));
                  }}
                />
              </label>
            </div>
            <p>
              The end date follows the registered course duration. Adjust it to
              the batch’s actual completion date.
            </p>
          </section>
          {programCode && (
            <section className="edu-academic-year-section">
              <h3>Semester subjects & labs</h3>
              <CurriculumSummary key={programCode} program={programCode} />
              <p>
                Edit this course’s semester plan in Courses & enrollment →
                Subjects & labs.
              </p>
            </section>
          )}
          <section className="edu-academic-year-section edu-academic-year-generated">
            <div className="edu-academic-year-section-title">
              <h3>Generated details</h3>
              <CalendarDays size={18} aria-hidden="true" />
            </div>
            <div className="edu-academic-year-grid">
              <label>
                <span>Batch code</span>
                <input
                  name="code"
                  aria-label="Batch code"
                  readOnly
                  value={code}
                  placeholder="Select a course and dates"
                />
              </label>
              <label>
                <span>Batch name</span>
                <input
                  name="name"
                  aria-label="Batch name"
                  readOnly
                  value={name}
                  placeholder="Generated automatically"
                />
              </label>
            </div>
            <p role="status">
              {code
                ? `${selectedCourse?.label || programCode} · ${yearRange}`
                : "The code and name update automatically as you choose the course and dates."}
            </p>
          </section>
          {error && (
            <p role="alert" className="edu-error">
              {error}
            </p>
          )}
        </div>
        <footer className="edu-academic-year-footer">
          <span>
            {editing
              ? "Update the batch dates."
              : "Save this batch for the selected course."}
          </span>
          <div>
            <button type="button" disabled={busy} onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="edu-primary"
              disabled={busy || loading || !complete}
            >
              {busy ? (
                <LoaderCircle size={16} className="edu-spin" />
              ) : (
                <Check size={16} />
              )}{" "}
              {busy ? "Saving…" : editing ? "Save changes" : "Create batch"}
            </button>
          </div>
        </footer>
      </form>
    </SideDrawer>
  );
}
