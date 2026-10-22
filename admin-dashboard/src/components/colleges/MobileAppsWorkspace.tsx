"use client";
import AdminFinanceMobile from "./AdminFinanceMobile";
import { useRouter } from "next/navigation";
import AcademicTimetableGrid from "./AcademicTimetableGrid";
import {
  sessionForStudent,
  studentScope,
  sessionScope,
  cohortKey,
  publishedSession,
} from "@/lib/colleges/academic-scope";
import MobileAttendanceManager from "./MobileAttendanceManager";
import MobileAcademicCalendar from "./MobileAcademicCalendar";
import { localDate, scheduleForDate } from "@/lib/colleges/mobile-schedule";
import PDFActions from "./PDFActions";
import { payslipReport } from "@/lib/colleges/operations-reports";
import { preciseMoney as money } from "@/lib/colleges/operations";
import Image from "next/image";
import { useId, useRef, useState } from "react";
import {
  Bell,
  Home,
  BookOpen,
  CalendarDays,
  User,
  Bus,
  Wallet,
  ClipboardList,
  Maximize,
  RotateCcw,
  Send,
  ArrowLeft,
  ArrowUpRight,
  CheckCheck,
  GraduationCap,
  ShieldCheck,
  Clock3,
} from "lucide-react";
import { useCollege } from "./CollegeStore";
import { opRows, due, type OperationRecord } from "@/lib/colleges/operations";
import { paid } from "@/lib/colleges/store";
import { colleges, type College } from "@/data/colleges";
import { professionalPdf } from "@/lib/colleges/download";
import { feeComponents, feeTotals, taxLabel } from "@/lib/colleges/fees";
import { receiptReport, structureReport } from "@/lib/colleges/reports";
import { OpsSheet, type OpsField } from "./OperationsUI";
export default function MobileAppsWorkspace({
  college,
  initialApp,
}: {
  college: College;
  initialApp?: string;
}) {
  const router = useRouter();
  const controlsId = useId();
  const [controlsOpen, setControlsOpen] = useState(false);
  const controlsToggle = useRef<HTMLButtonElement>(null);
  const { state, role, run, reset, logout } = useCollege(),
    admin = role === "Super Admin";
  const initial =
    initialApp ||
    (["Principal", "Accounts Manager"].includes(role || "")
      ? "Admin"
      : role === "Faculty"
        ? "Teacher"
        : role === "Student"
          ? "Student"
          : "Parent");
  const [app, setApp] = useState(initial),
    [tab, setTab] = useState("Home"),
    [personId, setPersonId] = useState(""),
    [childId, setChildId] = useState(""),
    [size, setSize] = useState("390"),
    [sheet, setSheet] = useState<{
      title: string;
      fields: OpsField[];
      save: (d: Record<string, string>) => boolean;
    } | null>(null),
    [notificationFilter, setNotificationFilter] = useState("All"),
    [notificationCategory, setNotificationCategory] = useState("All"),
    [assignmentFilter, setAssignmentFilter] = useState("All"),
    [classView, setClassView] = useState("Week timetable"),
    [studentSearch, setStudentSearch] = useState("");
  const frame = useRef<HTMLDivElement>(null);
  const rows = (key: string) => opRows(state, key),
    teachers = state.staff.filter(
      (x) => x.category === "Faculty" && x.status === "Active",
    );
  const users =
    app === "Parent"
      ? rows("accounts").filter(
          (a) => a.role === "Parent" && a.status === "Active",
        )
      : app === "Teacher"
        ? teachers
        : state.students.filter((s) => s.status === "Active");
  const selected = users.find((x) => x.id === personId) || users[0];
  const parent = app === "Parent" ? (selected as OperationRecord) : undefined;
  const linked = parent
    ? (JSON.parse(String(parent.studentIds || "[]")) as string[])
    : [];
  const student =
    app === "Student"
      ? state.students.find((x) => x.id === selected?.id)
      : app === "Parent"
        ? state.students.find(
            (x) => x.id === childId && linked.includes(x.id),
          ) || state.students.find((x) => linked.includes(x.id))
        : undefined;
  const teacher =
    app === "Teacher" ? teachers.find((x) => x.id === selected?.id) : undefined;
  const teacherClasses = rows("timetable").filter(
    (x) => x.employeeId === teacher?.id && publishedSession(x),
  );
  const teachingGroups = new Set(
    teacherClasses.map((x) => cohortKey(sessionScope(x))),
  );
  const classes = rows("timetable").filter(
    (x) =>
      publishedSession(x) &&
      (teacher
        ? x.employeeId === teacher.id ||
          (["Break", "Lunch"].includes(String(x.kind)) &&
            teachingGroups.has(cohortKey(sessionScope(x))))
        : !!student && sessionForStudent(x, student)),
  );
  const programs = new Set(classes.map((x) => x.program));
  const assignments = rows("assignments").filter(
    (x) =>
      (x.status === "Published" || (teacher && x.status === "Draft")) &&
      (teacher ? x.employeeId === teacher.id : x.program === student?.program),
  );
  const assessments = rows("assessments").filter((x) =>
    teacher ? programs.has(x.program) : x.program === student?.program,
  );
  const allocation = state.operations!.passengers.find(
      (x) => x.personId === (teacher?.id || student?.id),
    ),
    bus = state.operations!.buses.find((x) => x.id === allocation?.busId),
    route = state.operations!.routes.find((x) => x.id === allocation?.routeId);
  const account =
    app === "Parent"
      ? parent
      : rows("accounts").find(
          (a) =>
            a.personId === (student?.id || teacher?.id) &&
            a.status === "Active",
        );
  const notifications = state.notifications.filter((n) =>
    n.reference
      ? n.reference === account?.id
      : n.studentId
        ? n.studentId === student?.id
        : !n.name.toLowerCase().includes("payroll") || app === "Teacher",
  );
  const attendance = rows("attendance").filter((x) =>
      teacher
        ? state.students.some(
            (st) => st.id === x.studentId && programs.has(st.program),
          )
        : x.studentId === student?.id,
    ),
    present = attendance.filter((x) =>
      ["Present", "Late"].includes(String(x.attendance)),
    ).length;
  const submissions = rows("submissions").filter((x) =>
    teacher
      ? x.status !== "Draft" && assignments.some((a) => a.id === x.assignmentId)
      : x.studentId === student?.id,
  );
  const chooseApp = (next: string) => {
    setApp(next);
    setPersonId("");
    setChildId("");
    setTab("Home");
  };
  const input = (
    key: string,
    label: string,
    type = "text",
    value?: string,
  ): OpsField => ({ key, label, type, value });
  const select = (
    key: string,
    label: string,
    list: { id: string; name: string }[],
  ): OpsField => ({
    key,
    label,
    options: list.map((x) => ({ value: x.id, label: x.name })),
  });
  const createAssignment = () =>
    setSheet({
      title: "Publish class assignment",
      fields: [
        input("name", "Assignment title"),
        {
          key: "program",
          label: "Class program",
          options: Array.from(programs).map((p) => ({
            value: String(p),
            label: String(p),
          })),
        },
        input("subject", "Subject"),
        input("due", "Due date", "date"),
        input("maxMarks", "Maximum marks", "number", "100"),
        input("description", "Instructions", "textarea"),
        {
          key: "allowLate",
          label: "Allow late submissions",
          value: "No",
          options: [
            { value: "No", label: "Close at deadline" },
            { value: "Yes", label: "Accept and flag late work" },
          ],
        },
        { ...input("section", "Section", "text", "A"), required: false },
        {
          ...input("attachmentFile", "Attach learning material", "file"),
          required: false,
          help: "PDF, image or text; up to 200 KB. Stored in this browser only.",
        },
        {
          ...input("attachment", "Fictional attachment reference"),
          required: false,
        },
        {
          key: "saveAsDraft",
          label: "Save as draft",
          value: "No",
          options: [
            { value: "No", label: "Publish to class" },
            { value: "Yes", label: "Save unpublished draft" },
          ],
        },
      ],
      save: (d) =>
        run({
          type: "ops.record.save",
          data: { ...d, collection: "assignments", employeeId: teacher!.id },
        }),
    });
  const safeTabs = [
    "Home",
    "Classes",
    "Assignments",
    "Calendar",
    "Fees",
    "Transport",
    "Attendance",
    "Notifications",
    "Profile",
    "More",
    ...(teacher
      ? ["Students", "Payroll", "Assessments"]
      : ["Syllabus", "Assessments"]),
  ];
  const renderTransport = () => (
    <>
      <h3>Your college transport</h3>
      {allocation && bus && route ? (
        <>
          <div className="app-feature">
            <Bus size={28} />
            <h3>{bus.name}</h3>
            <p>{route.name}</p>
            <strong>Seat {allocation.seatId}</strong>
          </div>
          <div className="app-list">
            <p>
              Pickup:{" "}
              {route.stops.find((x) => x.id === allocation.pickup)?.name} ·{" "}
              {route.stops.find((x) => x.id === allocation.pickup)?.time}
            </p>
            <p>
              Drop: {route.stops.find((x) => x.id === allocation.drop)?.name}
            </p>
            <p>Vehicle: {bus.registration}</p>
            <p>
              Driver:{" "}
              {state.staff.find((x) => x.id === bus.driverId)?.name ||
                "Awaiting allocation"}
            </p>
            <p>Status: {bus.status}</p>
          </div>
          <div className="mobile-section-title">
            <h4>Seat location</h4>
            <small>
              {
                state.operations!.passengers.filter((p) => p.busId === bus.id)
                  .length
              }
              /{bus.seats.length} allocated
            </small>
          </div>
          <div
            className="mobile-seat-preview"
            aria-label="Assigned bus seat map"
          >
            {bus.seats
              .map((seat) => seat.id)
              .map((id) => (
                <span
                  key={id}
                  data-selected={id === allocation.seatId}
                  data-occupied={state.operations!.passengers.some(
                    (p) => p.busId === bus.id && p.seatId === id,
                  )}
                  aria-label={`Seat ${id}${id === allocation.seatId ? ", your seat" : ""}`}
                >
                  {id}
                </span>
              ))}
          </div>
          <p className="mobile-seat-legend">
            Blue: allocated · Green: available · Outline: your seat
          </p>
          <small>Illustrative transport schedule. No live GPS.</small>
        </>
      ) : (
        <p>
          No transport allocation. An administrator can assign a seat in
          Transport & Bus.
        </p>
      )}
    </>
  );
  const renderClasses = () => (
    <>
      <h3>{teacher ? "Your teaching schedule" : "Class timetable"}</h3>
      <div className="mobile-segments">
        {["Week timetable", "Today", "All subjects"].map((v) => (
          <button
            key={v}
            aria-pressed={classView === v}
            onClick={() => setClassView(v)}
          >
            {v}
          </button>
        ))}
      </div>
      {classView === "Week timetable" ? (
        <AcademicTimetableGrid
          college={college}
          sessions={classes}
          staff={state.staff}
          teacherView={!!teacher}
        />
      ) : (classView === "Today"
          ? classes.filter(
              (c) =>
                c.day ===
                new Date().toLocaleDateString("en-US", { weekday: "long" }),
            )
          : classes
        ).length ? (
        (classView === "Today"
          ? classes.filter(
              (c) =>
                c.day ===
                new Date().toLocaleDateString("en-US", { weekday: "long" }),
            )
          : classes
        ).map((c) => (
          <article className="app-card" key={c.id}>
            <small>
              {c.day} · {c.start}–{c.end}
            </small>
            <h4>{c.name}</h4>
            <p>
              {c.room} · {c.kind}
            </p>
            <p>{state.staff.find((x) => x.id === c.employeeId)?.name}</p>
            <span>{c.status}</span>
            {teacher &&
              !["Break", "Lunch"].includes(String(c.kind)) &&
              c.status === "Active" && (
                <button
                  onClick={() =>
                    run({
                      type: "ops.record.status",
                      id: c.id,
                      data: { collection: "timetable", status: "Completed" },
                    })
                  }
                >
                  Mark completed
                </button>
              )}
          </article>
        ))
      ) : (
        <p>No scheduled periods for this account.</p>
      )}
    </>
  );
  const renderFees = () =>
    student ? (
      <>
        <h3>Fees & payments</h3>
        <div className="app-feature">
          <small>Outstanding balance</small>
          <strong>{money(due(state, student.id))}</strong>
          <p>
            {student.name} · {student.year}
          </p>
        </div>
        <dl className="app-financials">
          <dt>Assigned fee</dt>
          <dd>{money(student.fee)}</dd>
          <dt>Scholarship</dt>
          <dd>{money(student.scholarship)}</dd>
          <dt>Net payable</dt>
          <dd>{money(student.fee - student.scholarship)}</dd>
          <dt>Completed payments</dt>
          <dd>{money(paid(state, student.id))}</dd>
        </dl>
        {app === "Student" && account?.canPayFees !== "Yes" && (
          <p>
            Payment actions are managed by your parent or the accounts team. You
            can view your balance and receipts.
          </p>
        )}
        {due(state, student.id) > 0 &&
          (app === "Parent" || account?.canPayFees === "Yes") && (
            <button
              className="erp-primary"
              onClick={() =>
                setSheet({
                  title: "Simulate fee payment",
                  fields: [
                    input(
                      "amount",
                      "Payment amount (INR)",
                      "number",
                      String(due(state, student.id) / 100),
                    ),
                    input(
                      "reference",
                      "Unique demo transaction reference",
                      "text",
                      `APP-${crypto.randomUUID().slice(0, 12)}`,
                    ),
                  ],
                  save: (d) =>
                    run({
                      type: "payment",
                      data: {
                        ...d,
                        studentId: student.id,
                        method: "UPI demo",
                        outcome: "success",
                        paidBy: parent?.name || student.name,
                        category: "Tuition Fee",
                      },
                    }),
                })
              }
            >
              Pay now (demo)
            </button>
          )}
        <p>No real money is transferred.</p>
        {state.structures
          .filter((r) => (r.program || r.name) === student.program)
          .slice(0, 1)
          .map((schedule) => {
            const totals = feeTotals(
              feeComponents(schedule),
              schedule.taxMode || "not-configured",
            );
            return (
              <details className="mobile-fee-breakdown" key={schedule.id}>
                <summary>Program fee component breakdown</summary>
                <p>
                  Published program schedule. Your assigned amount and
                  scholarship are shown above.
                </p>
                <dl className="app-financials">
                  {totals.lines.map((line) => (
                    <div key={line.id}>
                      <dt>
                        {line.name}
                        <small>{line.gstRate}% configured GST</small>
                      </dt>
                      <dd>{money(line.total)}</dd>
                    </div>
                  ))}
                </dl>
                <p>
                  {taxLabel(schedule.taxMode || "not-configured")} · Tax{" "}
                  {money(totals.gst)}
                </p>
                <PDFActions
                  onAction={(mode) =>
                    professionalPdf(
                      "Program-fee-schedule",
                      structureReport(college, state, schedule, role),
                      mode,
                    )
                  }
                >
                  Fee structure PDF
                </PDFActions>
              </details>
            );
          })}
        <h4>Payment history</h4>
        {state.payments
          .filter((p) => p.studentId === student.id)
          .map((p) => (
            <article className="app-card" key={p.id}>
              <strong>{money(p.amount || 0)}</strong>
              <p>
                {p.date} · {p.status}
              </p>
              <PDFActions
                onAction={(mode) =>
                  professionalPdf(
                    `Receipt-${p.id}`,
                    receiptReport(college, state, p),
                    mode,
                  )
                }
              >
                Download receipt PDF
              </PDFActions>
            </article>
          ))}
      </>
    ) : (
      <div className="mobile-restricted">
        <ShieldCheck size={38} />
        <h3>Finance access is restricted</h3>
        <p>
          Faculty accounts cannot access student financial records. Your own
          salary details are available in Payroll.
        </p>
        <button onClick={() => setTab("Payroll")}>View my payroll</button>
      </div>
    );
  const renderAssignments = () => (
    <>
      <div className="app-section-heading">
        <h3>Assignments</h3>
        {teacher && (
          <button aria-label="Create assignment" onClick={createAssignment}>
            ＋ Create
          </button>
        )}
      </div>
      <div className="mobile-filter-chips">
        {["All", "Pending", "Submitted", "Reviewed", "Overdue"].map((f) => (
          <button
            key={f}
            aria-pressed={assignmentFilter === f}
            onClick={() => setAssignmentFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      {assignments
        .filter((a) => {
          const sub = submissions.find((s) => s.assignmentId === a.id);
          const status =
            sub?.status ||
            (String(a.due) < localDate(new Date()) ? "Overdue" : "Pending");
          return assignmentFilter === "All" || status === assignmentFilter;
        })
        .slice(0, 30)
        .map((a) => {
          const own = submissions.find((s) => s.assignmentId === a.id);
          return (
            <article className="app-card" key={a.id}>
              <small>
                {a.subject} · Due {a.due}
              </small>
              <h4>{a.name}</h4>
              <p>{a.description}</p>
              {!!a.attachmentFile && (
                <LocalAttachment value={String(a.attachmentFile)} />
              )}
              {teacher && (
                <>
                  <small>{a.status}</small>
                  <button
                    onClick={() =>
                      setSheet({
                        title: "Edit class assignment",
                        fields: [
                          input("name", "Assignment title", "text", a.name),
                          input("due", "Due date", "date", String(a.due)),
                          input(
                            "description",
                            "Instructions",
                            "textarea",
                            String(a.description),
                          ),
                        ],
                        save: (d) =>
                          run({
                            type: "ops.record.save",
                            id: a.id,
                            data: {
                              ...Object.fromEntries(
                                Object.entries(a).map(([k, v]) => [
                                  k,
                                  String(v),
                                ]),
                              ),
                              ...d,
                              collection: "assignments",
                            },
                          }),
                      })
                    }
                  >
                    Edit assignment
                  </button>
                  {a.status === "Draft" && (
                    <button
                      onClick={() =>
                        run({
                          type: "ops.record.status",
                          id: a.id,
                          data: {
                            collection: "assignments",
                            status: "Published",
                          },
                        })
                      }
                    >
                      Publish assignment
                    </button>
                  )}
                </>
              )}
              {app === "Student" && (!own || own.status === "Draft") && (
                <button
                  onClick={() =>
                    setSheet({
                      title: "Submit assignment",
                      fields: [
                        input(
                          "answer",
                          "Your answer / fictional attachment reference",
                          "textarea",
                          String(own?.answer || ""),
                        ),
                        {
                          ...input(
                            "attachment",
                            "Fictional attachment reference",
                            "text",
                            String(own?.attachment || ""),
                          ),
                          required: false,
                        },
                        {
                          ...input(
                            "attachmentFile",
                            "Attach your work",
                            "file",
                          ),
                          required: false,
                          help: "PDF, image or text, up to 200 KB; stored locally in the demo.",
                        },
                        {
                          key: "saveDraft",
                          label: "Submission action",
                          value: "No",
                          options: [
                            { value: "No", label: "Submit for review" },
                            { value: "Yes", label: "Save draft" },
                          ],
                        },
                      ],
                      save: (d) =>
                        run({
                          type: "ops.assignment.submit",
                          data: {
                            ...d,
                            assignmentId: a.id,
                            studentId: student!.id,
                          },
                        }),
                    })
                  }
                >
                  Submit work
                </button>
              )}
              {own && !teacher && (
                <>
                  <span>
                    {own.status}
                    {own.marks !== undefined
                      ? ` · ${own.marks}/${a.maxMarks}`
                      : ""}
                  </span>
                  {!!own.attachmentFile && (
                    <LocalAttachment value={String(own.attachmentFile)} />
                  )}
                  {own.feedback && <p>Teacher feedback: {own.feedback}</p>}
                </>
              )}
              {teacher &&
                rows("submissions")
                  .filter(
                    (s) => s.assignmentId === a.id && s.status !== "Draft",
                  )
                  .map((sub) => (
                    <div className="app-submission" key={sub.id}>
                      <strong>
                        {
                          state.students.find((x) => x.id === sub.studentId)
                            ?.name
                        }
                      </strong>
                      <p>{sub.answer}</p>
                      {!!sub.attachmentFile && (
                        <LocalAttachment value={String(sub.attachmentFile)} />
                      )}
                      <small>
                        {sub.status} · Late: {sub.late}
                      </small>
                      {sub.status !== "Reviewed" ? (
                        <button
                          onClick={() =>
                            setSheet({
                              title: "Review submission",
                              fields: [
                                input("marks", "Marks", "number"),
                                input("feedback", "Feedback", "textarea"),
                              ],
                              save: (d) =>
                                run({
                                  type: "ops.assignment.review",
                                  id: sub.id,
                                  data: d,
                                }),
                            })
                          }
                        >
                          Review submission
                        </button>
                      ) : (
                        <p>
                          {sub.marks} marks · {sub.feedback}
                        </p>
                      )}
                    </div>
                  ))}
            </article>
          );
        })}
    </>
  );
  const calendarEvents = [
    ...rows("calendar").filter(
      (e) =>
        !e.program || e.program === student?.program || programs.has(e.program),
    ),
    ...assessments,
    ...assignments.map((a): OperationRecord => ({ ...a, date: String(a.due) })),
  ];
  const today = localDate(new Date());
  const todaysClasses = scheduleForDate(today, classes, []);
  const attendanceRate = attendance.length
    ? Math.round((present / attendance.length) * 100)
    : null;
  const reviewed = submissions.filter((s) => s.status === "Reviewed");
  const renderCalendar = () => (
    <MobileAcademicCalendar
      college={college}
      staff={state.staff}
      periods={classes}
      events={calendarEvents}
    />
  );
  const renderAttendance = () => (
    <>
      <h3>Attendance</h3>
      <div className="app-feature">
        <strong>
          {attendance.length
            ? `${Math.round((present / attendance.length) * 100)}%`
            : "Not recorded"}
        </strong>
        <p>
          {present} present / {attendance.length} recorded sessions
        </p>
      </div>
      {teacher && (
        <MobileAttendanceManager
          key={teacher.id}
          employeeId={teacher.id}
          programs={Array.from(programs).map(String)}
        />
      )}
      {teacher && (
        <button
          onClick={() =>
            setSheet({
              title: "Mark student attendance",
              fields: [
                select(
                  "studentId",
                  "Student",
                  state.students.filter((s) => programs.has(s.program)),
                ),
                input("subject", "Subject"),
                input("date", "Attendance date", "date", "2026-10-19"),
                {
                  key: "attendance",
                  label: "Attendance status",
                  options: ["Present", "Absent", "Late", "Excused"].map(
                    (x) => ({ value: x, label: x }),
                  ),
                },
                input("reason", "Reason / correction note"),
              ],
              save: (d) =>
                run({
                  type: "ops.record.save",
                  data: {
                    ...d,
                    name: `Attendance · ${d.date}`,
                    collection: "attendance",
                    employeeId: teacher.id,
                  },
                }),
            })
          }
        >
          Mark attendance
        </button>
      )}
      {!!attendance.length && (
        <>
          <div className="mobile-section-title">
            <h4>Attendance history</h4>
            <small>{attendance.length} recorded sessions</small>
          </div>
          <div className="mobile-attendance-heatmap">
            {attendance.map((a) => (
              <span
                key={a.id}
                data-status={a.attendance}
                title={`${a.date}: ${a.attendance}`}
                aria-label={`${a.date}: ${a.attendance}`}
              >
                {String(a.date).slice(-2)}
              </span>
            ))}
          </div>
          <div className="mobile-subject-attendance">
            {Array.from(new Set(attendance.map((a) => String(a.subject)))).map(
              (subject) => {
                const records = attendance.filter((a) => a.subject === subject);
                const percentage = Math.round(
                  (records.filter((a) =>
                    ["Present", "Late"].includes(String(a.attendance)),
                  ).length /
                    records.length) *
                    100,
                );
                return (
                  <div key={subject}>
                    <span>
                      {subject}
                      <strong>{percentage}%</strong>
                    </span>
                    <progress value={percentage} max={100} />
                  </div>
                );
              },
            )}
          </div>
        </>
      )}
      {attendance.map((a) => (
        <article className="app-card" key={a.id}>
          <strong>{a.attendance}</strong>
          <small>
            {a.date} · {a.subject}
          </small>
        </article>
      ))}
    </>
  );
  const categoryOf = (name: string) =>
    /fee|payment/i.test(name)
      ? "Payments"
      : /assignment|submission/i.test(name)
        ? "Assignments"
        : /attendance/i.test(name)
          ? "Attendance"
          : /bus|transport/i.test(name)
            ? "Transport"
            : /class|timetable|assessment/i.test(name)
              ? "Academics"
              : "General";
  const renderNotifications = () => (
    <>
      <h3>
        Notifications ·{" "}
        {notifications.filter((n) => n.status !== "Read").length} unread
      </h3>
      <select
        aria-label="App notification filter"
        value={notificationFilter}
        onChange={(e) => setNotificationFilter(e.target.value)}
      >
        <option>All</option>
        <option>Unread</option>
        <option>Read</option>
      </select>
      <select
        aria-label="Notification category"
        value={notificationCategory}
        onChange={(e) => setNotificationCategory(e.target.value)}
      >
        {[
          "All",
          "Payments",
          "Academics",
          "Attendance",
          "Transport",
          "Assignments",
          "General",
        ].map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      {notifications
        .filter(
          (n) =>
            notificationCategory === "All" ||
            categoryOf(n.name) === notificationCategory,
        )
        .filter(
          (n) =>
            notificationFilter === "All" ||
            (notificationFilter === "Read"
              ? n.status === "Read"
              : n.status !== "Read"),
        )
        .slice(0, 40)
        .map((n) => (
          <article className="app-card" key={n.id}>
            <small>
              {n.date} · {n.status}
            </small>
            <h4>{n.name}</h4>
            <p>{n.note}</p>
            <button
              onClick={() => {
                run({ type: "ops.notification.read", id: n.id });
                const name = n.name.toLowerCase();
                setTab(
                  name.includes("fee") || name.includes("payment")
                    ? teacher
                      ? "Payroll"
                      : "Fees"
                    : name.includes("assignment") || name.includes("submission")
                      ? "Assignments"
                      : name.includes("attendance")
                        ? "Attendance"
                        : name.includes("transport") || name.includes("bus")
                          ? "Transport"
                          : "Calendar",
                );
              }}
            >
              Open related screen
            </button>
            {n.status !== "Read" && (
              <button
                onClick={() => run({ type: "ops.notification.read", id: n.id })}
              >
                Mark read
              </button>
            )}
          </article>
        ))}
    </>
  );
  const renderProfile = () => (
    <>
      <h3>{app} profile</h3>
      <div className="app-feature">
        <User size={30} />
        <h3>{selected?.name}</h3>
        <small>{selected?.id}</small>
      </div>
      <p>{student?.program || teacher?.note || "Authorized family account"}</p>
      {student && (
        <dl className="app-financials">
          <dt>Academic year</dt>
          <dd>{studentScope(student).academicYear}</dd>
          <dt>Year / semester</dt>
          <dd>
            {studentScope(student).studyYear} / {studentScope(student).semester}
          </dd>
          <dt>Branch</dt>
          <dd>{studentScope(student).branch}</dd>
          <dt>Specialization</dt>
          <dd>{studentScope(student).specialization}</dd>
          <dt>Section / batch</dt>
          <dd>
            {studentScope(student).section} / {studentScope(student).batch}
          </dd>
        </dl>
      )}
      {parent && (
        <>
          <h4>Linked students</h4>
          {state.students
            .filter((x) => linked.includes(x.id))
            .map((st) => (
              <button
                key={st.id}
                onClick={() => {
                  setChildId(st.id);
                  setTab("Home");
                }}
              >
                {st.name} · {st.id}
              </button>
            ))}
        </>
      )}
      {account && (
        <>
          <dl className="app-financials">
            <dt>Email</dt>
            <dd>
              {String(
                rows("portal-profiles").find((p) => p.accountId === account.id)
                  ?.email || "Not provided",
              )}
            </dd>
            <dt>Notifications</dt>
            <dd>
              {String(
                rows("portal-profiles").find((p) => p.accountId === account.id)
                  ?.notificationPreference || "In-app",
              )}
            </dd>
          </dl>
          <button
            onClick={() => {
              const profile = rows("portal-profiles").find(
                (p) => p.accountId === account.id,
              );
              setSheet({
                title: "Edit contact & preferences",
                fields: [
                  input(
                    "email",
                    "Fictional email address",
                    "email",
                    String(profile?.email || "demo@example.invalid"),
                  ),
                  {
                    ...input(
                      "phone",
                      "Contact number",
                      "tel",
                      String(profile?.phone || ""),
                    ),
                    required: false,
                  },
                  {
                    key: "notificationPreference",
                    label: "Notification preference",
                    value: String(profile?.notificationPreference || "In-app"),
                    options: [
                      "In-app",
                      "In-app and email (simulated)",
                      "Essential only",
                    ].map((x) => ({ value: x, label: x })),
                  },
                ],
                save: (d) =>
                  run({
                    type: "ops.profile.save",
                    data: { ...d, accountId: account.id },
                  }),
              });
            }}
          >
            Edit contact & preferences
          </button>
        </>
      )}
      <p>
        Fictional account. Production identity and access checks require a
        backend.
      </p>
      <button onClick={logout}>Sign out of demo</button>
    </>
  );
  const renderPayroll = () => (
    <>
      <h3>My payroll</h3>
      {rows("payroll")
        .filter((p) => p.employeeId === teacher?.id)
        .map((p) => (
          <article className="app-card" key={p.id}>
            <small>
              {p.period} · {p.status}
            </small>
            <strong>{money(Number(p.net))}</strong>
            <p>
              Gross {money(Number(p.gross))} · Deductions{" "}
              {money(Number(p.deductions))}
            </p>
            <PDFActions
              onAction={(mode) =>
                professionalPdf(
                  `Payslip-${p.id}`,
                  payslipReport(college, state, p, role || "Demo"),
                  mode,
                )
              }
            >
              Payslip PDF
            </PDFActions>
          </article>
        ))}
      {!rows("payroll").some((p) => p.employeeId === teacher?.id) && (
        <p>No calculated payroll for this employee.</p>
      )}
    </>
  );
  const home = () => {
    const learningSessions = todaysClasses.filter(
      (c) => !["Break", "Lunch"].includes(c.kind),
    );
    const next =
      learningSessions.find((c) => c.status !== "Completed") ||
      learningSessions[0];
    const completed = learningSessions.filter(
      (c) => c.status === "Completed",
    ).length;
    return (
      <div className={`mobile-home mobile-home-${app.toLowerCase()}`}>
        <div className="mobile-greeting">
          <button
            className="mobile-avatar"
            aria-label="Open my profile"
            onClick={() => setTab("Profile")}
          >
            {student?.profile?.photo ? (
              <Image
                src={student.profile.photo}
                width={48}
                height={48}
                unoptimized
                alt=""
              />
            ) : (
              <Image
                src={`/assets/college-portals/shared/${app.toLowerCase()}-avatar.svg`}
                width={48}
                height={48}
                alt="Fictional demo avatar"
              />
            )}
          </button>
          <div>
            <small>
              {new Date(`${today}T12:00:00`).toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </small>
            <h3>
              Hello,{" "}
              {teacher
                ? selected?.name
                    .replace(/^(Dr\.?|Prof\.?)\s+/i, "")
                    .split(" ")[0]
                : selected?.name.split(" ")[0]}
            </h3>
            <p>
              {app === "Parent"
                ? `Parent of ${student?.name || "your student"}`
                : student?.program || "Faculty · Your teaching workspace"}
            </p>
          </div>
        </div>
        {teacher ? (
          <button
            className="mobile-teaching-summary"
            onClick={() => setTab("Classes")}
          >
            <span>
              <small>Today’s teaching</small>
              <strong>{learningSessions.length} sessions</strong>
            </span>
            <span
              className="mobile-ring"
              style={
                {
                  "--progress": `${learningSessions.length ? (completed / learningSessions.length) * 100 : 0}%`,
                } as React.CSSProperties
              }
            >
              <b>
                {completed}/{learningSessions.length}
              </b>
            </span>
            <small>
              {completed} completed · {learningSessions.length - completed}{" "}
              remaining
            </small>
          </button>
        ) : (
          <button
            className="mobile-attendance-summary"
            onClick={() => setTab("Attendance")}
          >
            <span>
              <small>Attendance overview</small>
              <strong>
                {attendanceRate === null ? "—" : `${attendanceRate}%`}
              </strong>
              <small>
                {present} present / {attendance.length} sessions
              </small>
            </span>
            <span
              className="mobile-ring"
              style={
                {
                  "--progress": `${attendanceRate || 0}%`,
                } as React.CSSProperties
              }
            >
              <CheckCheck size={24} />
            </span>
          </button>
        )}
        <div className="mobile-section-title">
          <h3>{teacher ? "Your next session" : "Next on your timetable"}</h3>
          <button
            aria-label="Open complete timetable"
            onClick={() => setTab("Calendar")}
          >
            <ArrowUpRight size={18} />
          </button>
        </div>
        {next ? (
          <button
            className="mobile-next-session"
            onClick={() => setTab("Calendar")}
          >
            <div className="mobile-session-time">
              <Clock3 size={16} />
              {next.start}–{next.end}
              <span>{next.kind}</span>
            </div>
            <h4>{next.name}</h4>
            <p>
              {next.room} ·{" "}
              {new Date(`${today}T12:00:00`).toLocaleDateString("en-US", {
                weekday: "long",
              })}
            </p>
            <span className="mobile-session-link">
              View your schedule <ArrowUpRight size={15} />
            </span>
          </button>
        ) : (
          <button
            className="mobile-next-session"
            onClick={() => setTab("Calendar")}
          >
            <h4>A little room to focus</h4>
            <p>
              No classes scheduled today. Explore upcoming dates in your
              calendar.
            </p>
            <span className="mobile-session-link">
              Open calendar <ArrowUpRight size={15} />
            </span>
          </button>
        )}
        <div className="mobile-action-strip">
          {[
            ["Classes", BookOpen],
            ["Attendance", CheckCheck],
            ["Transport", Bus],
            [teacher ? "Students" : "Syllabus", GraduationCap],
          ].map(([name, Icon]) => {
            const I = Icon as typeof Home;
            return (
              <button key={String(name)} onClick={() => setTab(String(name))}>
                <span>
                  <I size={21} />
                </span>
                {String(name)}
              </button>
            );
          })}
        </div>
        <div className="mobile-overview-pair">
          <button onClick={() => setTab(teacher ? "Payroll" : "Fees")}>
            <Wallet size={18} />
            <small>{teacher ? "My payslips" : "Fee balance"}</small>
            <strong>
              {teacher
                ? rows("payroll").filter((p) => p.employeeId === teacher.id)
                    .length
                : money(due(state, student?.id || ""))}
            </strong>
            <span>{teacher ? "View salary details" : "View breakdown"}</span>
          </button>
          <button onClick={() => setTab("Assignments")}>
            <ClipboardList size={18} />
            <small>{teacher ? "Awaiting review" : "Assignments"}</small>
            <strong>
              {teacher
                ? submissions.filter((s) => s.status === "Submitted").length
                : assignments.filter(
                    (a) =>
                      !submissions.some(
                        (s) => s.assignmentId === a.id && s.status !== "Draft",
                      ),
                  ).length}
            </strong>
            <span>{teacher ? "Open review queue" : "View pending work"}</span>
          </button>
        </div>
        <div className="mobile-section-title">
          <h3>{teacher ? "Faculty updates" : "Campus updates"}</h3>
          <button onClick={() => setTab("Notifications")}>View all</button>
        </div>
        <div className="mobile-news-list">
          {notifications.slice(0, 2).map((n) => (
            <button key={n.id} onClick={() => setTab("Notifications")}>
              <span className="mobile-news-icon">
                <Bell size={16} />
              </span>
              <span>
                <strong>{n.name}</strong>
                <small>
                  {n.date} · {n.status}
                </small>
              </span>
              <ArrowUpRight size={15} />
            </button>
          ))}
          {!notifications.length && <p>No new announcements.</p>}
        </div>
        {allocation && (
          <button
            className="mobile-transport-strip"
            onClick={() => setTab("Transport")}
          >
            <Bus size={22} />
            <span>
              <strong>
                {bus?.name} · Seat {allocation.seatId}
              </strong>
              <small>{route?.name} · View pickup details</small>
            </span>
            <ArrowUpRight size={16} />
          </button>
        )}
        {!!reviewed.length && (
          <button
            className="mobile-result-strip"
            onClick={() => setTab("Assignments")}
          >
            <ShieldCheck size={20} />
            {reviewed.length} reviewed submissions · View feedback
          </button>
        )}
      </div>
    );
  };
  let screen: React.ReactNode;
  switch (tab) {
    case "More":
      screen = (
        <>
          <div className="mobile-directory-intro">
            <GraduationCap size={30} />
            <h3>Your campus, within reach</h3>
            <p>Find the tools and services you need.</p>
          </div>
          {[
            [
              "Learning & academics",
              ["Classes", "Assignments", "Calendar", "Syllabus", "Assessments"],
            ],
            [
              "Campus services",
              ["Attendance", "Transport", ...(teacher ? ["Students"] : [])],
            ],
            [
              "Finance & account",
              [teacher ? "Payroll" : "Fees", "Notifications", "Profile"],
            ],
          ].map(([heading, tabs]) => (
            <section className="mobile-directory-group" key={String(heading)}>
              <h4>{String(heading)}</h4>
              <div className="app-more-menu">
                {(tabs as string[])
                  .filter((t) => safeTabs.includes(t))
                  .map((t) => (
                    <button key={t} onClick={() => setTab(t)}>
                      <span>{t}</span>
                      <ArrowUpRight size={16} />
                    </button>
                  ))}
              </div>
            </section>
          ))}
        </>
      );
      break;
    case "Classes":
      screen = renderClasses();
      break;
    case "Fees":
      screen = renderFees();
      break;
    case "Assignments":
      screen = renderAssignments();
      break;
    case "Calendar":
      screen = renderCalendar();
      break;
    case "Transport":
      screen = renderTransport();
      break;
    case "Attendance":
      screen = renderAttendance();
      break;
    case "Notifications":
      screen = renderNotifications();
      break;
    case "Profile":
      screen = renderProfile();
      break;
    case "Payroll":
      screen = renderPayroll();
      break;
    case "Students":
      screen = (
        <>
          <h3>My students</h3>
          <input
            aria-label="Search assigned students"
            placeholder="Search by name or student ID"
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
          />
          {state.students
            .filter(
              (s) =>
                programs.has(s.program) &&
                `${s.name} ${s.id}`
                  .toLowerCase()
                  .includes(studentSearch.toLowerCase()),
            )
            .slice(0, 100)
            .map((s) => (
              <article className="app-card" key={s.id}>
                <strong>{s.name}</strong>
                <small>
                  {s.id} · {s.program}
                </small>
              </article>
            ))}
          <button onClick={() => setTab("Attendance")}>
            Mark class attendance
          </button>
        </>
      );
      break;
    case "Syllabus":
      screen = (
        <>
          <h3>Syllabus & resources</h3>
          {rows("syllabus")
            .filter((x) =>
              teacher
                ? programs.has(x.program)
                : x.program === student?.program &&
                  (!x.semester ||
                    String(x.semester) ===
                      String(student?.profile?.semester || "1")),
            )
            .map((doc) => (
              <article className="app-card" key={doc.id}>
                <strong>{doc.name}</strong>
                <p>{doc.description}</p>
                <PDFActions
                  onAction={(mode) =>
                    professionalPdf(
                      doc.name,
                      {
                        title: doc.name,
                        context: { college },
                        sections: [
                          {
                            title: "Learning objectives and units",
                            paragraphs: [String(doc.description)],
                          },
                        ],
                      },
                      mode,
                    )
                  }
                >
                  Download syllabus PDF
                </PDFActions>
              </article>
            ))}
        </>
      );
      break;
    case "Assessments":
      screen = (
        <>
          <h3>Assessments & results</h3>
          {teacher && (
            <button
              onClick={() =>
                setSheet({
                  title: "Create assessment",
                  fields: [
                    input("name", "Assessment title"),
                    {
                      key: "program",
                      label: "Class program",
                      options: Array.from(programs).map((p) => ({
                        value: String(p),
                        label: String(p),
                      })),
                    },
                    input("subject", "Subject"),
                    input("date", "Assessment date", "date"),
                    input("maxMarks", "Maximum marks", "number", "100"),
                    input("start", "Start time", "time", "09:00"),
                    input("duration", "Duration in minutes", "number", "60"),
                    {
                      key: "kind",
                      label: "Assessment type",
                      value: "Examination",
                      options: [
                        "Examination",
                        "Quiz",
                        "Practical",
                        "Project",
                      ].map((x) => ({ value: x, label: x })),
                    },
                    {
                      ...input(
                        "description",
                        "Assessment instructions",
                        "textarea",
                      ),
                      required: false,
                    },
                  ],
                  save: (d) =>
                    run({
                      type: "ops.record.save",
                      data: {
                        ...d,
                        collection: "assessments",
                        employeeId: teacher.id,
                      },
                    }),
                })
              }
            >
              Create assessment
            </button>
          )}
          {assessments.map((a) => (
            <article className="app-card" key={a.id}>
              <strong>{a.name}</strong>
              <p>
                {a.subject} · {a.date}
              </p>
              <small>
                {a.status} · Maximum {a.maxMarks}
              </small>
              {rows("results")
                .filter(
                  (r) => r.assessmentId === a.id && r.studentId === student?.id,
                )
                .map((r) => (
                  <p key={r.id}>
                    <strong>
                      {r.marks} / {r.maxMarks}
                    </strong>{" "}
                    · {r.feedback}
                  </p>
                ))}
              {teacher && (
                <button
                  onClick={() =>
                    setSheet({
                      title: "Publish assessment result",
                      fields: [
                        select(
                          "studentId",
                          "Student",
                          state.students.filter(
                            (st) => st.program === a.program,
                          ),
                        ),
                        input("marks", "Marks", "number"),
                        input("feedback", "Feedback", "textarea"),
                      ],
                      save: (d) =>
                        run({
                          type: "ops.assessment.result",
                          data: { ...d, assessmentId: a.id },
                        }),
                    })
                  }
                >
                  Record marks
                </button>
              )}
            </article>
          ))}
        </>
      );
      break;
    default:
      screen = home();
  }
  if (app === "Admin")
    return (
      <div>
        <div className="en-admin-role-switch">
          {(admin ? ["Admin", "Parent", "Student", "Teacher"] : ["Admin"]).map(
            (a) => (
              <button
                key={a}
                aria-pressed={a === app}
                onClick={() => chooseApp(a)}
              >
                {a} app
              </button>
            ),
          )}
        </div>
        <AdminFinanceMobile college={college} />
      </div>
    );
  return (
    <section
      className="ops-emulator mobile-redesign"
      data-institution={college.slug}
      data-role={app}
      data-controls-open={controlsOpen}
    >
      <button
        ref={controlsToggle}
        className="mobile-emulator-toggle"
        aria-expanded={controlsOpen}
        aria-controls={controlsId}
        onClick={() => setControlsOpen(!controlsOpen)}
      >
        {controlsOpen
          ? "Hide preview controls"
          : "Preview controls · Role, account & screen"}
      </button>
      <aside id={controlsId} className="erp-panel ops-app-controls">
        <button
          className="mobile-emulator-close"
          onClick={() => {
            setControlsOpen(false);
            controlsToggle.current?.focus();
          }}
        >
          Close preview controls
        </button>
        <h2>Campus apps</h2>
        {admin && (
          <label>
            Institution
            <select
              aria-label="Emulator institution"
              value={college.slug}
              onChange={(e) =>
                router.push(
                  `/colleges-institutions/${e.target.value}/portal/admin/mobile-apps`,
                )
              }
            >
              {colleges.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <p>Explore your connected campus.</p>
        <small className="mobile-demo-note">
          Fictional records · Payments and authentication are simulated.
        </small>
        <a
          href={`/colleges-institutions/${college.slug}/portal/${app === "Teacher" ? "staff" : app.toLowerCase()}/${app === "Teacher" ? "teacher-app" : app === "Student" ? "student-app" : "parent-app"}`}
          target="_blank"
          rel="noreferrer"
        >
          Open standalone portal <ArrowUpRight size={14} />
        </a>
        <div
          className="ops-app-tabs"
          role="tablist"
          aria-label="Choose mobile app"
        >
          {(admin ? ["Admin", "Parent", "Student", "Teacher"] : [initial]).map(
            (a) => (
              <button
                key={a}
                role="tab"
                aria-selected={a === app}
                onClick={() => chooseApp(a)}
              >
                {a} app
              </button>
            ),
          )}
        </div>
        {admin && (
          <label>
            Demo account
            <select
              aria-label="Demo app account"
              value={selected?.id || ""}
              onChange={(e) => {
                setPersonId(e.target.value);
                setChildId("");
                setTab("Home");
              }}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.id}
                </option>
              ))}
            </select>
          </label>
        )}
        {parent && (
          <label>
            Linked student
            <select
              aria-label="Linked student"
              value={student?.id || ""}
              onChange={(e) => setChildId(e.target.value)}
            >
              {state.students
                .filter((x) => linked.includes(x.id))
                .map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label>
          Device width
          <select
            aria-label="Device width"
            value={size}
            onChange={(e) => setSize(e.target.value)}
          >
            <option value="320">Small · 320</option>
            <option value="360">Compact · 360</option>
            <option value="375">Classic · 375</option>
            <option value="390">Standard · 390</option>
            <option value="414">Wide · 414</option>
            <option value="430">Large · 430</option>
          </select>
        </label>
        <label>
          Open app screen
          <select
            aria-label="Open app screen"
            value={tab}
            onChange={(e) => setTab(e.target.value)}
          >
            {safeTabs.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <button onClick={() => setTab("Home")}>
          <RotateCcw size={15} /> Reset navigation
        </button>
        {admin && (
          <button
            onClick={() =>
              setSheet({
                title: "Reset fictional campus records",
                fields: [],
                save: () => {
                  reset();
                  setTab("Home");
                  return true;
                },
              })
            }
          >
            Reset demo data
          </button>
        )}
        <button onClick={() => frame.current?.requestFullscreen?.()}>
          <Maximize size={15} /> Full screen preview
        </button>
      </aside>
      <div className="ops-device-stage">
        <div
          ref={frame}
          className="ops-phone"
          data-screen={tab.toLowerCase()}
          style={{ maxWidth: Number(size) }}
        >
          <div className="app-statusbar">
            <span>9:41</span>
            <i />
            <span>● ▰</span>
          </div>
          <header className="app-header">
            {tab !== "Home" && (
              <button
                aria-label="Back to app home"
                onClick={() => setTab("Home")}
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <Image
              width={25}
              height={30}
              src={`/assets/colleges-institutions/${college.slug}/crest.svg`}
              alt=""
            />
            <strong>
              {tab === "Home"
                ? `${app} Portal`
                : tab === "Fees"
                  ? "Fees & payments"
                  : tab}
            </strong>
            <button
              aria-label="Open app notifications"
              onClick={() => setTab("Notifications")}
            >
              <Bell size={19} />
              <sup>
                {notifications.filter((n) => n.status !== "Read").length}
              </sup>
            </button>
          </header>
          {parent && student && (
            <div className="app-child-switch">
              <select
                aria-label="App selected child"
                value={student.id}
                onChange={(e) => setChildId(e.target.value)}
              >
                {state.students
                  .filter((x) => linked.includes(x.id))
                  .map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
          <main
            key={`${app}-${tab}-${selected?.id}`}
            className="app-screen"
            data-screen={tab.toLowerCase()}
            aria-label={`${app} app ${tab}`}
          >
            {screen}
          </main>
          <nav className="app-bottom-nav" aria-label="App navigation">
            {(app === "Teacher"
              ? [
                  ["Home", Home],
                  ["Classes", BookOpen],
                  ["Attendance", CheckCheck],
                  ["Calendar", CalendarDays],
                  ["More", User],
                ]
              : app === "Parent"
                ? [
                    ["Home", Home],
                    ["Classes", BookOpen],
                    ["Fees", Wallet],
                    ["Calendar", CalendarDays],
                    ["More", User],
                  ]
                : [
                    ["Home", Home],
                    ["Classes", BookOpen],
                    ["Assignments", ClipboardList],
                    ["Calendar", CalendarDays],
                    ["More", User],
                  ]
            ).map(([name, Icon]) => {
              const I = Icon as typeof Home;
              return (
                <button
                  key={String(name)}
                  aria-current={tab === name ? "page" : undefined}
                  onClick={() => setTab(String(name))}
                >
                  <I size={20} />
                  <span>
                    {app === "Parent" && name === "Classes"
                      ? "Academics"
                      : app === "Parent" && name === "Fees"
                        ? "Payments"
                        : String(name)}
                  </span>
                </button>
              );
            })}
          </nav>
          <div className="app-gesture" />
        </div>
      </div>
      <aside className="erp-panel ops-app-inspector">
        <h2>Connected activity</h2>
        <dl>
          <dt>Institution</dt>
          <dd>{college.name}</dd>
          <dt>App role</dt>
          <dd>{app}</dd>
          <dt>Linked record</dt>
          <dd>{student?.id || teacher?.id || selected?.id}</dd>
          <dt>Screen</dt>
          <dd>{tab}</dd>
          <dt>Transport seat</dt>
          <dd>
            {allocation
              ? `${bus?.name} / ${allocation.seatId}`
              : "Not assigned"}
          </dd>
          <dt>Unread notices</dt>
          <dd>{notifications.filter((n) => n.status !== "Read").length}</dd>
        </dl>
        <h3>Recent campus changes</h3>
        {state.audit.slice(0, 5).map((a) => (
          <p key={a.id}>
            <strong>{a.name.replaceAll("ops.", "")}</strong>
            <small>
              {a.actor} · {a.date.slice(0, 16).replace("T", " ")}
            </small>
          </p>
        ))}
        <p>
          Demo clock: 19 October 2026. Notifications, payments and account
          access are simulated.
        </p>
        {admin && (
          <button
            onClick={() =>
              setSheet({
                title: "Send app test notification",
                fields: [
                  input("name", "Title", "text", "Campus app test"),
                  input(
                    "message",
                    "Message",
                    "textarea",
                    "A fictional in-app notification from your college.",
                  ),
                ],
                save: (d) =>
                  run({
                    type: "ops.campaign.send",
                    data: {
                      ...d,
                      audience:
                        app === "Teacher"
                          ? "Teachers"
                          : app === "Parent"
                            ? "Parents"
                            : "Students",
                      studentId: student?.id || "",
                      channel: "In-App",
                    },
                  }),
              })
            }
          >
            <Send size={14} /> Send test notification
          </button>
        )}
      </aside>
      {sheet && (
        <OpsSheet
          title={sheet.title}
          fields={sheet.fields}
          onSave={sheet.save}
          onClose={() => setSheet(null)}
        />
      )}
    </section>
  );
}

type BrowserAttachment = {
  name: string;
  type: string;
  size: number;
  url: string;
};
function parseAttachment(value: string): BrowserAttachment | null {
  try {
    const file = JSON.parse(value) as BrowserAttachment;
    return typeof file.url === "string" &&
      /^data:(application\/pdf|image\/(png|jpeg|webp)|text\/plain);base64,/.test(
        file.url,
      )
      ? file
      : null;
  } catch {
    return null;
  }
}
function LocalAttachment({ value }: { value: string }) {
  const [open, setOpen] = useState(false);
  const file = parseAttachment(value);
  if (!file) return <p>Attachment preview is unavailable.</p>;
  return (
    <div className="mobile-attachment">
      <strong>{file.name}</strong>
      <small>{Math.ceil(file.size / 1024)} KB · Browser-only attachment</small>
      <div>
        <button onClick={() => setOpen(!open)}>
          {open ? "Close attachment" : "View attachment"}
        </button>
        <a href={file.url} download={file.name}>
          Download attachment
        </a>
      </div>
      {open &&
        (file.type.startsWith("image/") ? (
          <Image
            src={file.url}
            width={300}
            height={220}
            unoptimized
            alt={file.name}
          />
        ) : (
          <iframe title={file.name} src={file.url} sandbox="allow-downloads" />
        ))}
    </div>
  );
}
