"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Plus,
  RefreshCw,
  FileText,
  Paperclip,
  CheckCheck,
  Search,
} from "lucide-react";
import {
  assignments,
  type Assignment,
  type AssignmentFile,
  type AssignmentList,
  type AssignmentOptions,
  type Submission,
} from "@/services/api/modules/assignments/service";
import { ApiError, errorText } from "@/services/api";
import { useOptionalCollege } from "./CollegeStore";
import SideDrawer from "./SideDrawer";
import Image from "next/image";
import Select from "./SearchSelect";
import { toast } from "./toast";
import "./assignment-workspace.css";

const date = (value: string) =>
  new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const tabs = [
  ["all", "All"],
  ["today", "Today"],
  ["upcoming", "Upcoming"],
  ["overdue", "Overdue"],
  ["completed", "Completed"],
];
function Files({
  files,
  onOpen,
}: {
  files: AssignmentFile[];
  onOpen: (file: AssignmentFile) => void;
}) {
  return (
    <div className="as-files">
      {files.map((file) => (
        <button type="button" key={file.code} onClick={() => onOpen(file)}>
          <FileText size={15} />
          <span>{file.filename}</span>
          <small>{Math.ceil(file.size_bytes / 1024)} KB</small>
        </button>
      ))}
    </div>
  );
}
function Upload({
  files,
  setFiles,
  disabled,
}: {
  files: File[];
  setFiles: (files: File[]) => void;
  disabled: boolean;
}) {
  return (
    <label className="as-upload">
      <span>
        <Paperclip size={16} /> Attach PDF or images
      </span>
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        multiple
        disabled={disabled}
        onChange={(e) => {
          const picked = Array.from(e.target.files || []);
          if (
            picked.length > 10 ||
            picked.some((f) => f.size > 10 * 1024 * 1024)
          ) {
            toast.error("Choose up to 10 files, each no larger than 10 MB.");
            e.target.value = "";
            return;
          }
          setFiles(picked);
        }}
      />
      <small>
        {files.length
          ? files.map((f) => f.name).join(", ")
          : "Up to 10 files · 10 MB per file. Uploads stay private."}
      </small>
    </label>
  );
}
export default function AssignmentWorkspace({
  studentCode,
  allowCreate,
}: {
  studentCode?: string;
  allowCreate?: boolean;
}) {
  const session = useOptionalCollege();
  const role = session?.activeRole;
  const sessionCanCreate =
    !!session?.account &&
    !["parent", "student"].includes(session.account.person_type) &&
    !!role &&
    (role.system_admin ||
      role.scope === "teaching" ||
      role.permissions.assignments?.includes("create"));
  const [activeStudent, setActiveStudent] = useState(studentCode || "");
  const [data, setData] = useState<AssignmentList | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true);
  const [tab, setTab] = useState("all"),
    [mine, setMine] = useState(false),
    [query, setQuery] = useState(""),
    [creating, setCreating] = useState(false),
    [detail, setDetail] = useState<Assignment | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(
    null,
  );
  const load = useCallback(async () => {
    try {
      const result = await assignments.list(activeStudent);
      setData(result);
      if (
        !activeStudent &&
        result.role === "parent" &&
        result.students.length > 1
      )
        setActiveStudent(result.students[0].code);
      setError("");
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 404
          ? "The assignment service needs the latest backend update. The creation form is available, but saving requires that update."
          : errorText(e),
      );
    } finally {
      setBusy(false);
    }
  }, [activeStudent]);
  useEffect(() => {
    let active = true;
    void assignments
      .list(activeStudent)
      .then((result) => {
        if (!active) return;
        setData(result);
        setError("");
        if (
          !activeStudent &&
          result.role === "parent" &&
          result.students.length > 1
        )
          setActiveStudent(result.students[0].code);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof ApiError && e.status === 404
              ? "The assignment service needs the latest backend update. The creation form is available, but saving requires that update."
              : errorText(e),
          );
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [activeStudent]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  async function open(file: AssignmentFile) {
    try {
      const blob = await assignments.bytes(file);
      if (file.mime_type === "application/pdf")
        window.dispatchEvent(
          new CustomEvent("college:pdf-preview", {
            detail: { name: file.filename, blob },
          }),
        );
      else setPreview({ url: URL.createObjectURL(blob), name: file.filename });
    } catch (e) {
      toast.error("Could not preview attachment", errorText(e));
    }
  }
  async function inspect(record: Assignment) {
    try {
      setDetail(await assignments.detail(record.code, activeStudent));
    } catch (e) {
      setError(errorText(e));
    }
  }
  const canCreate = data?.can_create ?? allowCreate ?? sessionCanCreate;
  const items = (data?.items || []).filter(
    (a) =>
      (tab === "all" || a.bucket === tab) &&
      (!mine || a.created_by === data?.account_code) &&
      `${a.title} ${a.course_name} ${a.batch_name} ${a.teacher_name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const totals = (data?.items || []).reduce(
    (v, a) => ({
      assigned: v.assigned + (a.counts?.assigned || 0),
      submitted: v.submitted + (a.counts?.submitted || 0),
      reviewed: v.reviewed + (a.counts?.reviewed || 0),
    }),
    { assigned: 0, submitted: 0, reviewed: 0 },
  );
  return (
    <div className="as-workspace">
      {data?.role === "parent" && data.students.length > 1 && (
        <label className="as-child">
          Student
          <Select
            aria-label="Student"
            value={activeStudent}
            onChange={(e) => {
              setActiveStudent(e.target.value);
              setDetail(null);
            }}
          >
            {data.students.map((s) => (
              <option value={s.code} key={s.code}>
                {s.name}
              </option>
            ))}
          </Select>
        </label>
      )}
      <header className="as-heading">
        <div>
          <h1>Assignments</h1>
          <p>
            {data?.can_review
              ? "Set focused work. Follow submissions. Review and mark in one place."
              : "Your coursework, submission files and teacher feedback."}
          </p>
        </div>
        <div className="as-actions">
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            aria-label="Refresh assignments"
          >
            <RefreshCw size={16} />
          </button>
          {canCreate && (
            <button
              className="edu-primary"
              type="button"
              onClick={() => setCreating(true)}
            >
              <Plus size={16} /> Add assignment
            </button>
          )}
        </div>
      </header>
      {error && (
        <p role="alert" className="edu-error">
          {error} <button onClick={() => void load()}>Retry</button>
        </p>
      )}
      {data?.can_review && (
        <div className="as-summary" aria-label="Assignment progress">
          <span>
            <strong>{data.items.length}</strong> assignments
          </span>
          <span>
            <strong>
              {totals.submitted} / {totals.assigned}
            </strong>{" "}
            uploads received
          </span>
          <span>
            <strong>{totals.reviewed}</strong> students reviewed
          </span>
        </div>
      )}
      <div className="as-toolbar">
        <div
          className="as-tabs"
          role="tablist"
          aria-label="Assignment due dates"
        >
          {tabs.map(([key, label]) => (
            <button
              type="button"
              role="tab"
              aria-selected={key === tab}
              key={key}
              onClick={() => setTab(key)}
            >
              {label}{" "}
              <small>
                {
                  (data?.items || []).filter(
                    (a) => key === "all" || a.bucket === key,
                  ).length
                }
              </small>
            </button>
          ))}
        </div>
        <label className="as-search">
          <Search size={16} />
          <input
            aria-label="Search assignments"
            placeholder="Search assignments"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {data?.can_review && (
          <label className="as-check">
            <input
              type="checkbox"
              checked={mine}
              onChange={(e) => setMine(e.target.checked)}
            />{" "}
            Created by me
          </label>
        )}
      </div>
      {busy && !data ? (
        <p role="status">Loading assignments…</p>
      ) : (
        <div className="as-register">
          {!items.length && (
            <p className="as-empty">
              {canCreate
                ? "No assignments in this view. Add an assignment or choose another tab."
                : "No assignments in this view."}
            </p>
          )}
          {items.map((a) => (
            <article key={a.code} className="as-record">
              <div>
                <span className={`as-badge as-${a.bucket}`}>{a.bucket}</span>
                <h2>{a.title}</h2>
                <p>
                  {a.course_name} · {a.batch_name}
                  {a.teacher_name ? ` · ${a.teacher_name}` : ""}
                </p>
                <p>
                  Due {date(a.due_at)} · {a.max_marks} marks
                </p>
                {a.counts ? (
                  <div className="as-progress">
                    <progress
                      value={a.counts.reviewed}
                      max={Math.max(1, a.counts.assigned)}
                      aria-label="Students reviewed"
                    />
                    <small>
                      {a.counts.submitted} submitted · {a.counts.pending}{" "}
                      awaiting upload · {a.counts.reviewed} reviewed
                    </small>
                  </div>
                ) : (
                  <p>
                    {a.my_submission?.completed
                      ? `Reviewed${a.my_submission.marks != null ? ` · ${a.my_submission.marks} / ${a.max_marks}` : ""}`
                      : a.my_submission?.submitted_at
                        ? "Submitted · awaiting review"
                        : "Awaiting your submission"}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => void inspect(a)}>
                {a.can_review ? "Review students" : "Open assignment"}
              </button>
            </article>
          ))}
        </div>
      )}
      {creating && (
        <AssignmentCreate
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await load();
          }}
        />
      )}
      {detail && (
        <AssignmentDetail
          key={detail.code}
          assignment={detail}
          onClose={() => setDetail(null)}
          onChanged={async () => {
            setDetail(await assignments.detail(detail.code, activeStudent));
            await load();
          }}
          onOpen={open}
        />
      )}
      {preview && (
        <SideDrawer
          title={preview.name}
          expanded
          onClose={() => setPreview(null)}
        >
          <Image
            unoptimized
            width={1400}
            height={1000}
            className="as-image"
            src={preview.url}
            alt={preview.name}
          />
        </SideDrawer>
      )}
    </div>
  );
}
function AssignmentCreate({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [options, setOptions] = useState<AssignmentOptions | null>(null),
    [level, setLevel] = useState("intermediate"),
    [program, setProgram] = useState(""),
    [year, setYear] = useState(""),
    [section, setSection] = useState(""),
    [teacher, setTeacher] = useState("");
  const [selected, setSelected] = useState<string[]>([]),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [due, setDue] = useState(""),
    [marks, setMarks] = useState("100"),
    [late, setLate] = useState(true),
    [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [progress, setProgress] = useState("");
  const uploaded = useRef(new Map<File, AssignmentFile>());
  useEffect(() => {
    const control = new AbortController();
    void assignments
      .options(
        program || undefined,
        year || undefined,
        section || undefined,
        control.signal,
      )
      .then((value) => {
        setOptions(value);
        setError("");
        setSelected(value.students.map((s) => s.code));
        if (value.teacher_locked) setTeacher(value.teachers[0]?.code || "");
      })
      .catch((e) => {
        if (!control.signal.aborted)
          setError(
            e instanceof ApiError && e.status === 404
              ? "Assignment setup is not deployed on the backend yet. Update and restart the backend to load courses, students and teachers."
              : errorText(e),
          );
      })
      .finally(() => {
        if (!control.signal.aborted) setLoading(false);
      });
    return () => control.abort();
  }, [program, year, section]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!selected.length) {
      setError("Select at least one student from this academic batch.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const attached: AssignmentFile[] = [];
      for (const file of files) {
        setProgress(`Uploading ${file.name}…`);
        const value =
          uploaded.current.get(file) || (await assignments.upload(file));
        uploaded.current.set(file, value);
        attached.push(value);
      }
      setProgress("Creating assignment and notifying students and parents…");
      await assignments.create({
        course_level: level,
        program_code: program,
        academic_year_code: year,
        section_code: section || null,
        teacher_code: teacher,
        title,
        description,
        due_at: new Date(due).toISOString(),
        max_marks: marks,
        recipient_student_codes: selected,
        attachments: attached.map((f) => f.code),
        allow_late: late,
      });
      toast.success(
        "Assignment created",
        "Selected students and their linked parents have been notified.",
      );
      await onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  return (
    <SideDrawer
      className="as-drawer"
      title="Add assignment"
      subtitle="Choose the academic batch, select the students, then set their work."
      expanded
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className="as-form" onSubmit={save}>
        <fieldset disabled={busy}>
          <legend>Class and audience</legend>
          <div className="as-form-grid">
            <label>
              Inter or Degree *
              <Select
                aria-label="Course level"
                required
                value={level}
                onChange={(e) => {
                  setLoading(true);
                  setLevel(e.target.value);
                  setProgram("");
                  setYear("");
                  setSection("");
                  setSelected([]);
                }}
              >
                <option value="intermediate">Intermediate</option>
                <option value="degree">Degree</option>
              </Select>
            </label>
            <label>
              Course *
              <Select
                aria-label="Course"
                required
                value={program}
                onChange={(e) => {
                  setLoading(true);
                  setProgram(e.target.value);
                  setYear("");
                  setSection("");
                  setSelected([]);
                }}
              >
                <option value="">Select course</option>
                {options?.courses
                  .filter((c) => c.course_level === level)
                  .map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
              </Select>
            </label>
            <label>
              Academic batch *
              <Select
                aria-label="Academic batch"
                required
                disabled={!program}
                value={year}
                onChange={(e) => {
                  setLoading(true);
                  setYear(e.target.value);
                  setSection("");
                  setSelected([]);
                }}
              >
                <option value="">Select academic batch</option>
                {options?.academic_years
                  .filter((y) => y.program_code === program)
                  .map((y) => (
                    <option value={y.code} key={y.code}>
                      {y.name}
                    </option>
                  ))}
              </Select>
            </label>
            <label>
              Section
              <Select
                aria-label="Section"
                disabled={!year || loading}
                value={section || "__all__"}
                onChange={(e) => {
                  setLoading(true);
                  setSection(
                    e.target.value === "__all__" ? "" : e.target.value,
                  );
                  setSelected([]);
                }}
              >
                <option value="__all__">All eligible sections</option>
                {options?.sections.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              {options?.teacher_locked ? "Teacher" : "Teacher *"}
              {options?.teacher_locked ? (
                <input
                  aria-label="Assigned teacher"
                  readOnly
                  value={
                    options.teachers[0]?.name || "Teacher profile unavailable"
                  }
                />
              ) : (
                <Select
                  required
                  aria-label="Teacher"
                  value={teacher}
                  onChange={(e) => setTeacher(e.target.value)}
                >
                  <option value="">Select teacher</option>
                  {options?.teachers.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              )}
            </label>
          </div>
          {year && (
            <section className="as-audience">
              <header>
                <h3>
                  Students{" "}
                  <small>
                    {selected.length} / {options?.students.length || 0} selected
                  </small>
                </h3>
                <label className="as-check">
                  <input
                    type="checkbox"
                    checked={
                      !!options?.students.length &&
                      selected.length === options.students.length
                    }
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? (options?.students || []).map((s) => s.code)
                          : [],
                      )
                    }
                  />{" "}
                  Select all
                </label>
              </header>
              {loading ? (
                <p role="status">Loading eligible students…</p>
              ) : !options?.students.length ? (
                <p>
                  No active students are enrolled in this batch or selected
                  section.
                </p>
              ) : (
                <div className="as-student-picker">
                  {options.students.map((s) => (
                    <label className="as-check" key={s.code}>
                      <input
                        type="checkbox"
                        checked={selected.includes(s.code)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, s.code]
                              : selected.filter((code) => code !== s.code),
                          )
                        }
                      />
                      <span>
                        {s.name}
                        <small>{s.admission_number}</small>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <p>
                Only selected students and their linked parents receive this
                assignment.
              </p>
            </section>
          )}
        </fieldset>
        <fieldset disabled={busy}>
          <legend>Assignment details</legend>
          <label>
            Name *
            <input
              aria-label="Assignment name"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Description / instructions
            <textarea
              aria-label="Assignment description"
              rows={4}
              maxLength={10000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="as-form-grid">
            <label>
              Due date and time *
              <input
                aria-label="Due date and time"
                type="datetime-local"
                required
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
            <label>
              Maximum marks *
              <input
                aria-label="Maximum marks"
                type="number"
                min="0.01"
                max="10000"
                step="0.01"
                required
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
              />
            </label>
          </div>
          <label className="as-check">
            <input
              type="checkbox"
              checked={late}
              onChange={(e) => setLate(e.target.checked)}
            />{" "}
            Accept late submissions and label them late
          </label>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>Attachments</legend>
          <p className="as-field-note">
            Add reference material for the selected students. PDF and image
            previews stay private.
          </p>
          <Upload files={files} setFiles={setFiles} disabled={busy} />
        </fieldset>
        {error && (
          <p className="edu-error" role="alert">
            {error}
          </p>
        )}
        {progress && <p role="status">{progress}</p>}
        <footer className="as-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            className="edu-primary"
            disabled={
              busy || loading || !selected.length || !options?.can_create
            }
          >
            {busy ? "Saving…" : "Create assignment"}
          </button>
        </footer>
      </form>
    </SideDrawer>
  );
}
function AssignmentDetail({
  assignment: a,
  onClose,
  onChanged,
  onOpen,
}: {
  assignment: Assignment;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onOpen: (file: AssignmentFile) => void;
}) {
  const [filter, setFilter] = useState("all"),
    [files, setFiles] = useState<File[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [edits, setEdits] = useState<
    Record<string, { completed: boolean; marks: string; feedback: string }>
  >({});
  const uploaded = useRef(new Map<File, AssignmentFile>());
  function current(code: string, submission: Submission | null) {
    return (
      edits[code] || {
        completed: !!submission?.completed,
        marks: submission?.marks ?? "",
        feedback: submission?.feedback || "",
      }
    );
  }
  async function saveReview() {
    setBusy(true);
    setError("");
    try {
      await assignments.review(
        a.code,
        Object.entries(edits).map(([student_code, value]) => ({
          ...value,
          marks: value.marks === "" ? null : value.marks,
          student_code,
          revision:
            a.students?.find((s) => s.code === student_code)?.submission
              ?.revision || 0,
        })),
      );
      setEdits({});
      await onChanged();
      toast.success(
        "Review saved",
        "Marks and feedback are visible in student academics.",
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const values: AssignmentFile[] = [];
      for (const file of files) {
        const value =
          uploaded.current.get(file) ||
          (await assignments.upload(file, a.code));
        uploaded.current.set(file, value);
        values.push(value);
      }
      await assignments.submit(
        a.code,
        values.map((f) => f.code),
        a.my_submission?.revision || 0,
      );
      setFiles([]);
      await onChanged();
      toast.success("Assignment submitted");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const students = (a.students || []).filter(
    (s) =>
      filter === "all" ||
      (filter === "submitted" && s.submission?.submitted_at) ||
      (filter === "pending" && !s.submission?.submitted_at) ||
      (filter === "completed" && s.submission?.completed) ||
      (filter === "incomplete" && !s.submission?.completed),
  );
  return (
    <SideDrawer
      className="as-drawer"
      title={a.title}
      expanded
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="as-detail">
        <div className="as-detail-meta">
          <span>
            {a.course_name} · {a.batch_name}
          </span>
          <span>Due {date(a.due_at)}</span>
          <span>
            {a.teacher_name} · Maximum {a.max_marks} marks
          </span>
        </div>
        <p className="as-description">
          {a.description || "No additional instructions."}
        </p>
        <Files files={a.attachments} onOpen={onOpen} />
        {a.can_review ? (
          <>
            <div className="as-toolbar">
              <h3>Student review</h3>
              <select
                aria-label="Review status"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All students</option>
                <option value="submitted">Submitted</option>
                <option value="pending">Awaiting upload</option>
                <option value="completed">Completed</option>
                <option value="incomplete">Not completed</option>
              </select>
            </div>
            <p>
              Check completed work, including work handed in on paper. Marks are
              published when you save the review.
            </p>
            <div className="as-review-table">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Submission</th>
                    <th>Completed</th>
                    <th>Marks / {a.max_marks}</th>
                    <th>Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const value = current(s.code, s.submission);
                    return (
                      <tr key={s.code}>
                        <td>
                          <strong>{s.name}</strong>
                          <small>{s.admission_number}</small>
                        </td>
                        <td>
                          {s.submission?.submitted_at ? (
                            <>
                              <small>
                                {date(s.submission.submitted_at)}
                                {s.submission.late ? " · Late" : ""}
                              </small>
                              <Files
                                files={s.submission.attachments}
                                onOpen={onOpen}
                              />
                            </>
                          ) : (
                            <small>Not uploaded</small>
                          )}
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Completed: ${s.name}`}
                            disabled={busy || !a.can_grade}
                            checked={value.completed}
                            onChange={(e) =>
                              setEdits({
                                ...edits,
                                [s.code]: {
                                  ...value,
                                  completed: e.target.checked,
                                  marks: e.target.checked ? value.marks : "",
                                },
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            aria-label={`Marks: ${s.name}`}
                            min="0"
                            max={a.max_marks}
                            step="0.01"
                            disabled={busy || !a.can_grade || !value.completed}
                            value={value.marks}
                            onChange={(e) =>
                              setEdits({
                                ...edits,
                                [s.code]: { ...value, marks: e.target.value },
                              })
                            }
                          />
                        </td>
                        <td>
                          <textarea
                            aria-label={`Feedback: ${s.name}`}
                            rows={2}
                            maxLength={2000}
                            disabled={busy || !a.can_grade}
                            value={value.feedback}
                            onChange={(e) =>
                              setEdits({
                                ...edits,
                                [s.code]: {
                                  ...value,
                                  feedback: e.target.value,
                                },
                              })
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {a.can_grade && (
              <button
                type="button"
                className="edu-primary"
                disabled={busy || !Object.keys(edits).length}
                onClick={() => void saveReview()}
              >
                <CheckCheck size={16} />{" "}
                {busy ? "Saving…" : "Save review and marks"}
              </button>
            )}
          </>
        ) : (
          <section className="as-my-work">
            <h3>Your submission</h3>
            {a.my_submission?.submitted_at && (
              <p>
                Submitted {date(a.my_submission.submitted_at)}
                {a.my_submission.late ? " · Late submission" : ""}
              </p>
            )}
            <Files files={a.my_submission?.attachments || []} onOpen={onOpen} />
            {a.my_submission?.completed && (
              <div className="as-grade">
                <strong>
                  {a.my_submission.marks != null
                    ? `${a.my_submission.marks} / ${a.max_marks}`
                    : "Completed"}
                </strong>
                <p>
                  {a.my_submission.feedback ||
                    "Your teacher has reviewed this work."}
                </p>
              </div>
            )}
            {a.can_submit &&
              !a.my_submission?.completed &&
              a.my_submission?.marks == null && (
                <>
                  <Upload files={files} setFiles={setFiles} disabled={busy} />
                  <button
                    className="edu-primary"
                    type="button"
                    disabled={busy || !files.length}
                    onClick={() => void submit()}
                  >
                    {busy
                      ? "Uploading…"
                      : a.my_submission?.submitted_at
                        ? "Replace submission"
                        : "Submit assignment"}
                  </button>
                </>
              )}
          </section>
        )}
        {error && (
          <p role="alert" className="edu-error">
            {error}
          </p>
        )}
      </div>
    </SideDrawer>
  );
}
