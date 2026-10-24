"use client";
import TimetableOverview from "./TimetableOverview";
import MobileAcademicCalendar from "./MobileAcademicCalendar";
import PDFActions from "./PDFActions";
import { payslipReport } from "@/lib/colleges/operations-reports";
import { preciseMoney as money } from "@/lib/colleges/operations";
import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Plus, FileText, ArrowUpRight } from "lucide-react";
import { useCollege } from "./CollegeStore";
import ERPTable, { type TableRecord } from "./ERPTable";
import { OpsMetrics, OpsSheet, type OpsField } from "./OperationsUI";
import {
  opRows,
  operationLabels,
  operationMetrics,
  due,
  type OperationRecord,
} from "@/lib/colleges/operations";
import {
  collegeRoot,
  roleHome,
  permissions,
  type College,
} from "@/data/colleges";
import { professionalPdf, download } from "@/lib/colleges/download";
import IconAction from "./IconAction";
const Transport = dynamic(() => import("./TransportWorkspace"));
const Mobile = dynamic(() => import("./MobileAppsWorkspace"));
const Charts = dynamic(() => import("./OperationsCharts"));
const transportModules = [
  "transport",
  "buses",
  "routes",
  "route-stops",
  "drivers",
  "driver-allocation",
  "student-allocation",
  "faculty-allocation",
  "bus-seating",
  "manifest",
  "transport-reports",
];
const financialModules = [
  "expense-dashboard",
  "equipment",
  "utilities",
  "maintenance",
  "travel",
  "transport-expenses",
  "additional-expenses",
];
export function OperationsSummary({ college }: { college: College }) {
  const { state, role } = useCollege();
  const m = operationMetrics(state);
  if (
    ![
      "Super Admin",
      "Principal",
      "Accounts Manager",
      "HR Manager",
      "Transport Manager",
    ].includes(role || "")
  )
    return null;
  return (
    <section className="ops-summary">
      <OpsMetrics
        items={[
          ["Total employees", m.employees],
          ["Faculty", m.faculty],
          ["Payroll net", money(m.payroll)],
          ["Passengers", `${m.occupied} / ${m.capacity}`],
          ["Purchase approvals", m.purchases],
          ["Low stock", m.lowStock],
        ]}
      />
      <div className="ops-module-links">
        {["payroll", "expense-dashboard", "transport", "mobile-apps"]
          .filter((key) => permissions[role!].includes(key))
          .map((key) => (
            <Link
              key={key}
              href={`${collegeRoot(college)}/portal/${roleHome[role!]}/${key}`}
            >
              {operationLabels[key]}
              <ArrowUpRight size={15} />
            </Link>
          ))}
      </div>
    </section>
  );
}
export default function OperationsWorkspace({
  college,
  module,
}: {
  college: College;
  module: string;
}) {
  const { state, role, run, importDataset } = useCollege();
  const [sheet, setSheet] = useState<{
    title: string;
    fields: OpsField[];
    save: (d: Record<string, string>) => boolean;
  } | null>(null);
  const [period, setPeriod] = useState("2026-10"),
    [department, setDepartment] = useState(""),
    [audience, setAudience] = useState("Pending Parents"),
    [program, setProgram] = useState(""),
    [year, setYear] = useState("");
  const rows = (key: string) => opRows(state, key);
  const m = operationMetrics(state);
  const opt = (list: { id: string; name: string }[]) =>
    list.map((x) => ({ value: x.id, label: `${x.name} · ${x.id}` }));
  const select = (
    key: string,
    label: string,
    options: { value: string; label: string }[],
    value?: string,
  ): OpsField => ({ key, label, options, value });
  const choices = (...names: string[]) =>
    names.map((x) => ({ value: x, label: x }));
  const f = (
    key: string,
    label: string,
    type = "text",
    value?: string,
  ): OpsField => ({ key, label, type, value });
  const name = f("name", "Name / description"),
    employee = select("employeeId", "Employee", opt(state.staff)),
    student = select("studentId", "Student", opt(state.students)),
    bus = select("busId", "Vehicle", opt(state.operations!.buses)),
    date = f("date", "Date", "date", "2026-10-19"),
    amount = f("amount", "Amount (INR)", "number"),
    reason = f("reason", "Reason / supporting notes", "textarea");
  const programField = select(
      "program",
      "Program",
      college.programs.map((p) => ({ value: p.name, label: p.name })),
    ),
    teacher = select(
      "employeeId",
      "Teacher",
      opt(state.staff.filter((x) => x.category === "Faculty")),
    );
  const schema: Record<string, OpsField[]> = {
    employees: [
      f("name", "Employee name"),
      f("department", "Department"),
      f("designation", "Designation"),
      select(
        "category",
        "Employee category",
        choices(
          "Faculty",
          "Administrative Staff",
          "Accounts Staff",
          "Admission Officer",
          "Hostel Warden",
          "Driver",
          "Transport Assistant",
          "Laboratory Assistant",
          "Library Staff",
          "Maintenance Staff",
          "Security Staff",
        ),
      ),
      f("joining", "Joining date", "date", "2026-10-19"),
      f("email", "Demo email", "email"),
      f("phone", "Fictional contact"),
      f("basic", "Basic salary (INR)", "number"),
      f("allowances", "Allowances (INR)", "number", "0"),
      f("deductions", "Configured deductions (INR)", "number", "0"),
      f("unpaidRate", "Unpaid leave deduction per day (INR)", "number", "0"),
      {
        ...f("licenseExpiry", "Driver license expiry", "date"),
        required: false,
      },
      select("status", "Employment status", choices("Active", "Inactive")),
    ],
    "employee-attendance": [
      name,
      employee,
      date,
      select(
        "attendance",
        "Attendance status",
        choices(
          "Present",
          "Absent",
          "Half Day",
          "Paid Leave",
          "Unpaid Leave",
          "Holiday",
          "Late Arrival",
          "Work From Home",
        ),
      ),
    ],
    "employee-leave": [
      name,
      employee,
      select("kind", "Leave type", choices("Paid", "Unpaid")),
      f("start", "Leave start", "date"),
      f("end", "Leave end", "date"),
      reason,
    ],
    "salary-structures": [
      name,
      f("basic", "Basic salary (INR)", "number"),
      f("allowances", "Allowances (INR)", "number", "0"),
      f("deductions", "Configured deductions (INR)", "number", "0"),
      f("unpaidRate", "Unpaid leave rate per day (INR)", "number", "0"),
    ],
    bonuses: [
      name,
      employee,
      f("period", "Pay period", "month", period),
      amount,
      select(
        "category",
        "Bonus category",
        choices(
          "Festival Bonus",
          "Performance Bonus",
          "Academic Achievement Incentive",
          "Special Allowance",
          "Other Bonus",
        ),
      ),
      reason,
    ],
    reimbursements: [
      name,
      employee,
      f("period", "Pay period", "month", period),
      amount,
      select(
        "category",
        "Expense category",
        choices(
          "Travel",
          "Teaching Materials",
          "Fuel",
          "Accommodation",
          "Official Purchases",
          "Other",
        ),
      ),
      reason,
    ],
    "purchase-requests": [
      name,
      f("department", "Department"),
      select("vendorId", "Vendor", opt(rows("vendors"))),
      select("itemId", "Inventory item", opt(rows("inventory"))),
      f("quantity", "Quantity", "number", "1"),
      f("unitCost", "Unit cost (INR)", "number"),
      select(
        "taxMode",
        "GST treatment",
        choices("No GST", "Intra-state", "Inter-state"),
      ),
      f("gstRate", "Configured GST rate (%)", "number", "0"),
      f("additionalCharges", "Additional charges (INR)", "number", "0"),
      select("priority", "Priority", choices("Normal", "High", "Urgent")),
      reason,
    ],
    vendors: [
      name,
      f("email", "Demo email", "email"),
      f("contact", "Fictional contact"),
      f("category", "Supplier category"),
      { ...f("taxReference", "Tax reference (demo)"), required: false },
    ],
    inventory: [
      name,
      f("category", "Category"),
      f("unit", "Unit", "text", "units"),
      f("quantity", "Opening stock", "number", "1"),
      f("minimum", "Minimum stock", "number", "5"),
      f("unitCost", "Unit cost (INR)", "number"),
      f("location", "Store location"),
    ],
    assets: [
      name,
      select(
        "category",
        "Asset category",
        choices(
          "Computer",
          "Projector",
          "Smart Board",
          "Lab Equipment",
          "Furniture",
          "Air Conditioner",
          "Vehicle",
          "Other",
        ),
      ),
      amount,
      date,
      f("department", "Department"),
      f("location", "Location"),
      f("assignedTo", "Assigned to", "text", "Unassigned"),
      f("warranty", "Warranty expiry", "date"),
      select(
        "condition",
        "Condition",
        choices("Good", "Needs repair", "Damaged"),
      ),
    ],
    trips: [
      name,
      bus,
      date,
      f("start", "Departure time", "time", "06:30"),
      f("end", "Arrival time", "time", "08:00"),
    ],
    "transport-attendance": [
      name,
      select("tripId", "Trip", opt(rows("trips"))),
      select(
        "allocationId",
        "Passenger",
        state.operations!.passengers.map((p) => ({
          value: p.id,
          label: `${state.students.find((x) => x.id === p.personId)?.name || state.staff.find((x) => x.id === p.personId)?.name} · Seat ${p.seatId}`,
        })),
      ),
      date,
      select(
        "attendance",
        "Boarding event",
        choices("Boarded", "Not Boarded", "Dropped Off", "Absent"),
      ),
    ],
    fuel: [
      name,
      bus,
      date,
      f("quantity", "Fuel quantity (litres)", "number"),
      amount,
      f("odometer", "Odometer reading", "number"),
      f("vendor", "Fictional vendor"),
      reason,
    ],
    "vehicle-maintenance": [
      name,
      bus,
      date,
      amount,
      f("vendor", "Fictional service vendor"),
      f("nextService", "Next service date", "date"),
      reason,
    ],
    timetable: [
      name,
      programField,
      teacher,
      f("academicYear", "Academic year", "text", "2026-2027"),
      f("studyYear", "Year of study", "number", "1"),
      {
        ...f("branch", "Branch / discipline"),
        required: false,
        help: "Leave blank to use the program name.",
      },
      f("specialization", "Specialization", "text", "General"),
      { ...f("subjectCode", "Course code"), required: false },
      { ...f("coordinator", "Class coordinator"), required: false },
      f("semester", "Semester", "number", "1"),
      f("section", "Section", "text", "A"),
      f("batch", "Batch", "text", "Main"),
      select("saveAsDraft", "Publication", choices("No", "Yes")),
      select(
        "day",
        "Weekday",
        choices(
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ),
      ),
      f("start", "Start time", "time", "09:00"),
      f("end", "End time", "time", "10:00"),
      f("room", "Classroom / laboratory"),
      select(
        "kind",
        "Session type",
        choices(
          "Class",
          "Lab",
          "Practical",
          "Break",
          "Lunch",
          "Examination",
          "Sports",
          "Meeting",
        ),
      ),
    ],
    assignments: [
      name,
      programField,
      teacher,
      f("subject", "Subject"),
      f("due", "Due date", "date"),
      f("maxMarks", "Maximum marks", "number", "100"),
      f("description", "Instructions", "textarea"),
    ],
    assessments: [
      name,
      programField,
      f("subject", "Subject"),
      date,
      f("maxMarks", "Maximum marks", "number", "100"),
      f("description", "Assessment guidance", "textarea"),
    ],
    attendance: [
      name,
      student,
      programField,
      f("subject", "Subject"),
      date,
      select(
        "attendance",
        "Attendance",
        choices("Present", "Absent", "Late", "Excused"),
      ),
      reason,
    ],
    syllabus: [
      name,
      programField,
      f("description", "Units, topics and learning objectives", "textarea"),
    ],
    calendar: [name, date, f("description", "Event details", "textarea")],
    "notification-templates": [
      name,
      f("category", "Category"),
      f("message", "Message template", "textarea"),
    ],
    accounts: [
      name,
      select(
        "canPayFees",
        "Student payment permission",
        choices("No", "Yes"),
        "No",
      ),
      select(
        "role",
        "Account role",
        choices(
          "Parent",
          "Student",
          "Faculty",
          "Principal",
          "Accounts Manager",
          "HR Manager",
          "Transport Manager",
          "Driver",
          "Super Admin",
          "Admission Officer",
          "Certificate Officer",
          "Hostel Warden",
          "Payroll Officer",
          "Procurement Officer",
          "Inventory Manager",
        ),
      ),
      select(
        "personId",
        "Linked person",
        opt([...rows("guardians"), ...state.students, ...state.staff]),
      ),
      f("username", "Unique demo username", "email"),
    ],
  };
  const edit = (collection: string, r?: OperationRecord) =>
    setSheet({
      title: `${r ? "Edit" : "Add"} ${operationLabels[collection]?.toLowerCase() || collection}`,
      fields: (schema[collection] || []).map((field) => ({
        ...field,
        value:
          r?.[field.key] !== undefined
            ? String(
                [
                  "amount",
                  "basic",
                  "allowances",
                  "deductions",
                  "unpaidRate",
                  "unitCost",
                  "additionalCharges",
                ].includes(field.key)
                  ? Number(r[field.key]) / 100
                  : r[field.key],
              )
            : field.value,
      })),
      save: (d) =>
        run({
          type:
            collection === "employees"
              ? "ops.employee.save"
              : "ops.record.save",
          id:
            collection === "employees"
              ? String(r?.personId || "") || undefined
              : r?.id,
          data: { ...d, collection },
        }),
    });
  const status = (key: string, r: OperationRecord, next: string) =>
    run({
      type: "ops.record.status",
      id: r.id,
      data: { collection: key, status: next },
    });
  const payslip = (
    r: OperationRecord,
    mode: "view" | "download" = "download",
  ) =>
    professionalPdf(
      `Payslip-${r.id}`,
      payslipReport(college, state, r, role || "Demo"),
      mode,
    );
  const cols = (data: OperationRecord[]) =>
    Array.from(new Set(data.slice(0, 10).flatMap(Object.keys)))
      .filter(
        (k) =>
          ![
            "id",
            "extraIds",
            "studentIds",
            "recipientIds",
            "resetRequired",
          ].includes(k),
      )
      .slice(0, 11)
      .map((key) => ({
        key,
        label: key.replace(/([A-Z])/g, " $1"),
        render: (r: TableRecord) =>
          [
            "amount",
            "basic",
            "allowances",
            "deductions",
            "gross",
            "net",
            "unitCost",
            "paid",
            "bonus",
          ].includes(key)
            ? money(Number(r[key] || 0))
            : String(r[key] ?? "—"),
      }));
  const table = (key: string, data = rows(key), actions = true) => (
    <ERPTable
      key={key}
      title={operationLabels[key] || key}
      rows={data}
      columns={
        data.length
          ? cols(data)
          : [
              { key: "name", label: "Name" },
              { key: "status", label: "Status" },
            ]
      }
      actions={(r0) => {
        const r = r0 as OperationRecord;
        return (
          <div className="ops-row-actions">
            {actions && schema[key] && (
              <IconAction
                kind="edit"
                label="Edit details"
                onClick={() => edit(key, r)}
              />
            )}
            {key === "employees" && (
              <button
                onClick={() =>
                  setSheet({
                    title: "Assign salary structure",
                    fields: [
                      select(
                        "salaryId",
                        "Salary structure",
                        opt(rows("salary-structures")),
                      ),
                    ],
                    save: (d) =>
                      run({ type: "ops.salary.assign", id: r.id, data: d }),
                  })
                }
              >
                Assign salary
              </button>
            )}
            {[
              "employee-leave",
              "bonuses",
              "reimbursements",
              "purchase-requests",
            ].includes(key) &&
              ["Requested", "Submitted"].includes(r.status) && (
                <>
                  <button onClick={() => status(key, r, "Approved")}>
                    Approve
                  </button>
                  <button onClick={() => status(key, r, "Rejected")}>
                    Reject
                  </button>
                </>
              )}
            {key === "purchase-requests" && r.status === "Approved" && (
              <button
                onClick={() => run({ type: "ops.purchase.order", id: r.id })}
              >
                Create purchase order
              </button>
            )}
            {key === "purchase-orders" && (
              <>
                <PDFActions
                  onAction={(mode) =>
                    professionalPdf(
                      `Purchase-order-${r.id}`,
                      {
                        title: "Purchase order and financial reconciliation",
                        context: {
                          college,
                          institution: state.institution,
                          reference: r.id,
                          preparedBy: role || "Demo",
                        },
                        sections: [
                          {
                            title: "Order and supplier",
                            fields: [
                              ["Order", r.name],
                              [
                                "Vendor",
                                rows("vendors").find((v) => v.id === r.vendorId)
                                  ?.name || "Not configured",
                              ],
                              ["Status", r.status],
                              ["Quantity", String(r.quantity)],
                              ["Unit cost", money(Number(r.unitCost))],
                            ],
                          },
                          {
                            title: "Detailed cost breakdown",
                            fields: [
                              [
                                "Base amount",
                                money(Number(r.baseAmount || r.amount)),
                              ],
                              ["GST treatment", String(r.taxMode || "No GST")],
                              ["Configured rate", String(r.gstRate || 0) + "%"],
                              ["CGST", money(Number(r.cgst || 0))],
                              ["SGST", money(Number(r.sgst || 0))],
                              ["IGST", money(Number(r.igst || 0))],
                              [
                                "Additional charges",
                                money(Number(r.additionalCharges || 0)),
                              ],
                              ["Order total", money(Number(r.amount))],
                              ["Paid", money(Number(r.paid))],
                              [
                                "Outstanding",
                                money(Number(r.amount) - Number(r.paid)),
                              ],
                            ],
                          },
                          {
                            title: "Delivery and payment history",
                            columns: [
                              "Date",
                              "Event",
                              "Reference",
                              "Amount / quantity",
                            ],
                            rows: [
                              ...rows("goods-receipts")
                                .filter((g) => g.orderId === r.id)
                                .map((g) => [
                                  g.date,
                                  "Goods received",
                                  String(g.reference),
                                  String(g.accepted) +
                                    " accepted / " +
                                    String(g.damaged) +
                                    " damaged",
                                ]),
                              ...state.expenses
                                .filter((e) =>
                                  e.reference?.startsWith(r.id + ":"),
                                )
                                .map((e) => [
                                  e.date,
                                  "Demo payment",
                                  e.reference || "",
                                  money(e.amount || 0),
                                ]),
                            ],
                            paragraphs: [
                              "Fictional procurement demonstration. Tax rates are explicitly configured; this is not a statutory tax invoice.",
                            ],
                          },
                        ],
                      },
                      mode,
                    )
                  }
                >
                  Purchase order PDF
                </PDFActions>
                <button
                  onClick={() =>
                    setSheet({
                      title: "Receive delivery",
                      fields: [
                        f("quantity", "Delivered quantity", "number"),
                        f("damaged", "Damaged quantity", "number", "0"),
                        f("reference", "Unique delivery reference"),
                      ],
                      save: (d) =>
                        run({
                          type: "ops.purchase.receive",
                          id: r.id,
                          data: d,
                        }),
                    })
                  }
                >
                  Receive goods
                </button>
                <button
                  onClick={() =>
                    setSheet({
                      title: "Record demo purchase payment",
                      fields: [
                        amount,
                        f("reference", "Unique payment reference"),
                      ],
                      save: (d) =>
                        run({ type: "ops.purchase.pay", id: r.id, data: d }),
                    })
                  }
                >
                  Record payment
                </button>
              </>
            )}
            {key === "inventory" && (
              <button
                onClick={() =>
                  setSheet({
                    title: "Stock movement",
                    fields: [
                      select(
                        "kind",
                        "Movement type",
                        choices("Receive", "Issue", "Transfer", "Adjust"),
                      ),
                      f("quantity", "Quantity", "number"),
                      {
                        ...f("location", "Destination location"),
                        required: false,
                      },
                      reason,
                    ],
                    save: (d) =>
                      run({ type: "ops.inventory.move", id: r.id, data: d }),
                  })
                }
              >
                Move stock
              </button>
            )}
            {key === "assets" && r.status === "Active" && (
              <>
                <button onClick={() => status(key, r, "Maintenance")}>
                  Send for maintenance
                </button>
                <button onClick={() => status(key, r, "Retired")}>
                  Retire asset
                </button>
              </>
            )}
            {key === "assets" && r.status === "Maintenance" && (
              <button onClick={() => status(key, r, "Active")}>
                Return to service
              </button>
            )}
            {key === "accounts" && (
              <>
                <button
                  onClick={() =>
                    status(
                      key,
                      r,
                      r.status === "Active" ? "Inactive" : "Active",
                    )
                  }
                >
                  {r.status === "Active" ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() =>
                    setSheet({
                      title: "Reset fictional demo credentials",
                      fields: [],
                      save: () => {
                        const ok = run({ type: "ops.account.reset", id: r.id });
                        if (ok)
                          download(
                            `temporary-demo-${r.id}.txt`,
                            `FICTIONAL TEMPORARY CREDENTIAL\nUsername: ${r.username}\nOne-time demonstration token: DEMO-${crypto.randomUUID()}\nThis token is not persisted and does not authenticate against a backend.`,
                            "text/plain",
                          );
                        return ok;
                      },
                    })
                  }
                >
                  Reset demo credentials
                </button>
              </>
            )}
            {key === "payroll" && (
              <PDFActions onAction={(mode) => payslip(r, mode)}>
                <FileText size={13} /> Payslip PDF
              </PDFActions>
            )}
            {key === "trips" &&
              {
                Scheduled: "Ready",
                Ready: "Departed",
                Departed: "Arrived",
                Arrived: "Completed",
              }[r.status] && (
                <button
                  onClick={() =>
                    status(
                      key,
                      r,
                      (
                        {
                          Scheduled: "Ready",
                          Ready: "Departed",
                          Departed: "Arrived",
                          Arrived: "Completed",
                        } as Record<string, string>
                      )[r.status],
                    )
                  }
                >
                  Advance trip
                </button>
              )}
            {key === "timetable" && r.status === "Draft" && (
              <button onClick={() => status(key, r, "Active")}>
                Publish timetable session
              </button>
            )}
            {key === "timetable" && r.status === "Active" && (
              <button onClick={() => status(key, r, "Completed")}>
                Mark class completed
              </button>
            )}
            {key === "assessments" && (
              <button
                onClick={() =>
                  setSheet({
                    title: "Publish student assessment result",
                    fields: [
                      select(
                        "studentId",
                        "Student",
                        opt(
                          state.students.filter(
                            (st) => st.program === r.program,
                          ),
                        ),
                      ),
                      f("marks", "Obtained marks", "number"),
                      f("feedback", "Teacher feedback", "textarea"),
                    ],
                    save: (d) =>
                      run({
                        type: "ops.assessment.result",
                        data: { ...d, assessmentId: r.id },
                      }),
                  })
                }
              >
                Record marks
              </button>
            )}
            {key === "submissions" && r.status === "Submitted" && (
              <button
                onClick={() =>
                  setSheet({
                    title: "Review assignment submission",
                    fields: [
                      f("marks", "Marks", "number"),
                      f("feedback", "Feedback", "textarea"),
                    ],
                    save: (d) =>
                      run({ type: "ops.assignment.review", id: r.id, data: d }),
                  })
                }
              >
                Review submission
              </button>
            )}
            {key === "assessments" && r.status === "Scheduled" && (
              <button onClick={() => status(key, r, "Published")}>
                Publish assessment
              </button>
            )}
            {key === "syllabus" && (
              <PDFActions
                onAction={(mode) =>
                  professionalPdf(
                    r.name,
                    {
                      title: r.name,
                      context: { college },
                      sections: [
                        {
                          title: "Learning guide",
                          paragraphs: [String(r.description)],
                        },
                      ],
                    },
                    mode,
                  )
                }
              >
                Download guide PDF
              </PDFActions>
            )}
          </div>
        );
      }}
    />
  );
  if (transportModules.includes(module))
    return <Transport college={college} module={module} />;
  if (
    [
      "mobile-apps",
      "admin-app",
      "parent-app",
      "student-app",
      "teacher-app",
    ].includes(module)
  )
    return (
      <Mobile
        college={college}
        initialApp={
          module === "admin-app"
            ? "Admin"
            : module === "parent-app"
              ? "Parent"
              : module === "student-app"
                ? "Student"
                : module === "teacher-app"
                  ? "Teacher"
                  : undefined
        }
      />
    );
  if (module === "timetable" && role !== "Super Admin")
    return <TimetableOverview college={college} />;
  const payrollModules = ["payroll", "payslips", "payroll-reports"];
  const key =
    module === "credentials"
      ? "accounts"
      : module === "announcements"
        ? "campaigns"
        : module;
  const payroll = rows("payroll").filter(
    (r) => r.period === period && (!department || r.department === department),
  );
  const campaign = () => {
    const eligible = state.students.filter(
      (st) =>
        (!program || st.program === program) &&
        (!year || st.year === year) &&
        (!audience.includes("Pending") || due(state, st.id) > 0),
    );
    const ids = new Set(eligible.map((x) => x.id));
    const recipients = rows("accounts").filter(
      (a) =>
        a.status === "Active" &&
        (audience.includes("Parents")
          ? a.role === "Parent" &&
            (JSON.parse(String(a.studentIds || "[]")) as string[]).some((id) =>
              ids.has(id),
            )
          : audience === "Teachers"
            ? a.role === "Faculty"
            : a.role === "Student" && ids.has(String(a.personId))),
    );
    setSheet({
      title: "Send simulated notification",
      fields: [
        f("name", "Notification title"),
        f("message", "Message", "textarea"),
        select(
          "channel",
          "Delivery channel (simulated)",
          choices("In-App", "SMS Demo", "Email Demo", "Push Demo"),
        ),
      ],
      save: (d) =>
        run({
          type: "ops.campaign.send",
          data: { ...d, audience, program, year },
        }),
    });
    return recipients.length;
  };
  let body;
  if (payrollModules.includes(module))
    body = (
      <>
        <OpsMetrics
          items={[
            ["Eligible employees", m.employees],
            [
              "Gross payroll",
              money(payroll.reduce((n, r) => n + Number(r.gross), 0)),
            ],
            [
              "Deductions",
              money(payroll.reduce((n, r) => n + Number(r.deductions), 0)),
            ],
            [
              "Net payroll",
              money(payroll.reduce((n, r) => n + Number(r.net), 0)),
            ],
            ["Paid", payroll.filter((r) => r.status === "Paid").length],
            ["Pending", payroll.filter((r) => r.status !== "Paid").length],
          ]}
        />
        <div className="ops-toolbar">
          <label>
            Pay period
            <input
              type="month"
              aria-label="Pay period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </label>
          <label>
            Department
            <select
              aria-label="Payroll department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">All departments</option>
              {Array.from(
                new Set(rows("employees").map((r) => String(r.department))),
              ).map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          {module === "payroll" && (
            <>
              <button
                onClick={() =>
                  run({ type: "ops.payroll.calculate", data: { period } })
                }
              >
                Calculate payroll
              </button>
              <button
                onClick={() =>
                  run({ type: "ops.payroll.approve", data: { period } })
                }
              >
                Approve payroll
              </button>
              <button
                className="erp-primary"
                onClick={() =>
                  setSheet({
                    title: "Pay approved payroll (demo)",
                    fields: [],
                    save: () =>
                      run({ type: "ops.payroll.pay", data: { period } }),
                  })
                }
              >
                Mark period paid (demo)
              </button>
            </>
          )}
        </div>
        <p>
          Amounts use integer paise. Deductions and unpaid leave rates are
          configured per employee. Finalized periods cannot be recalculated.
        </p>
        {table("payroll", payroll, false)}
        <Charts kind="payroll" />
      </>
    );
  else if (financialModules.includes(module)) {
    const categories: Record<string, string[] | undefined> = {
      equipment: ["Equipment", "Laboratory"],
      utilities: ["Utilities", "Electricity", "Water", "Internet"],
      maintenance: ["Maintenance", "Vehicle Maintenance"],
      travel: ["Travel"],
      "transport-expenses": ["Fuel", "Transport", "Vehicle Maintenance"],
      "additional-expenses": ["Additional", "Bonus"],
    };
    const data = state.expenses.filter(
      (e) =>
        !categories[module] || categories[module]!.includes(e.category || ""),
    );
    body = (
      <>
        <OpsMetrics
          items={[
            ["Expenses", money(data.reduce((n, r) => n + (r.amount || 0), 0))],
            [
              "Paid",
              money(
                data
                  .filter((r) => r.status === "Paid")
                  .reduce((n, r) => n + (r.amount || 0), 0),
              ),
            ],
            ["Pending", data.filter((r) => r.status !== "Paid").length],
          ]}
        />
        <button
          className="erp-primary"
          onClick={() =>
            setSheet({
              title: "Create expense",
              fields: [
                name,
                amount,
                select(
                  "category",
                  "Expense category",
                  choices(
                    "Equipment",
                    "Laboratory",
                    "Utilities",
                    "Electricity",
                    "Water",
                    "Internet",
                    "Maintenance",
                    "Vehicle Maintenance",
                    "Fuel",
                    "Transport",
                    "Travel",
                    "Bonus",
                    "Additional",
                  ),
                ),
                f("note", "Invoice and supporting details", "textarea"),
              ],
              save: (d) => run({ type: "expense.create", data: d }),
            })
          }
        >
          Add expense
        </button>
        <Charts kind="expenses" />
        <ERPTable
          title="Operating expenses"
          rows={data}
          columns={[
            "name",
            "date",
            "category",
            "amount",
            "status",
            "reference",
          ].map((key) => ({
            key,
            label: key,
            render:
              key === "amount" ? (r) => money(Number(r.amount)) : undefined,
          }))}
          actions={(r) => {
            const next = (
              {
                Draft: "Submitted",
                Submitted: "Approved",
                Approved: "Paid",
              } as Record<string, string>
            )[String(r.status)];
            return next ? (
              <button
                onClick={() =>
                  run({
                    type: "expense.status",
                    id: r.id,
                    data: { status: next },
                  })
                }
              >
                {next === "Submitted"
                  ? "Submit"
                  : next === "Approved"
                    ? "Approve"
                    : "Mark paid (demo)"}
              </button>
            ) : null;
          }}
        />
      </>
    );
  } else if (
    ["campaigns", "payment-reminders", "announcements"].includes(module)
  ) {
    const eligible = state.students.filter(
      (st) =>
        (!program || st.program === program) &&
        (!year || st.year === year) &&
        (!audience.includes("Pending") || due(state, st.id) > 0),
    );
    const ids = new Set(eligible.map((x) => x.id));
    const recipients = rows("accounts").filter(
      (a) =>
        a.status === "Active" &&
        (audience.includes("Parents")
          ? a.role === "Parent" &&
            (JSON.parse(String(a.studentIds || "[]")) as string[]).some((id) =>
              ids.has(id),
            )
          : audience === "Teachers"
            ? a.role === "Faculty"
            : a.role === "Student" && ids.has(String(a.personId))),
    );
    body = (
      <>
        <div className="erp-panel ops-composer">
          <h2>Targeted notification preview</h2>
          <div className="ops-toolbar">
            <label>
              Audience
              <select
                aria-label="Notification audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              >
                {[
                  "Pending Parents",
                  "Parents",
                  "Pending Students",
                  "Students",
                  "Teachers",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Program
              <select
                aria-label="Notification program"
                value={program}
                onChange={(e) => setProgram(e.target.value)}
              >
                <option value="">All programs</option>
                {college.programs.map((p) => (
                  <option key={p.slug}>{p.name}</option>
                ))}
              </select>
            </label>
            <label>
              Academic year
              <select
                aria-label="Notification year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              >
                <option value="">All years</option>
                {Array.from(new Set(state.students.map((x) => x.year))).map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
            </label>
          </div>
          <strong>{recipients.length} eligible active accounts</strong>
          <p>
            {recipients
              .slice(0, 4)
              .map((r) => r.name)
              .join(", ")}
            {recipients.length > 4 ? "…" : ""}
          </p>
          <p>
            Pending audiences are derived from the current fee ledger. Delivery
            is simulated.
          </p>
          <button
            className="erp-primary"
            disabled={!recipients.length}
            onClick={campaign}
          >
            Compose notification
          </button>
        </div>
        {table("campaigns", rows("campaigns"), false)}
      </>
    );
  } else if (module === "campus-analytics")
    body = (
      <>
        <OperationsSummary college={college} />
        <Charts kind="expenses" />
        <Charts kind="payroll" />
        <Charts kind="transport" />
      </>
    );
  else
    body = (
      <>
        {key === "accounts" && role === "Super Admin" && (
          <div className="ops-toolbar">
            <button
              onClick={() =>
                setSheet({
                  title: "Link a fictional guardian to students",
                  fields: [
                    f("name", "Guardian name"),
                    select(
                      "student1",
                      "First linked student",
                      opt(state.students),
                    ),
                    {
                      ...select(
                        "student2",
                        "Second linked student",
                        opt(state.students),
                      ),
                      required: false,
                    },
                  ],
                  save: (d) =>
                    run({
                      type: "ops.record.save",
                      data: {
                        collection: "guardians",
                        name: d.name,
                        studentIds: JSON.stringify(
                          [d.student1, d.student2].filter(Boolean),
                        ),
                      },
                    }),
                })
              }
            >
              Add guardian relationship
            </button>
            <button
              onClick={() =>
                download(
                  `${state.slug}-demo-dataset.json`,
                  JSON.stringify(state, null, 2),
                  "application/json",
                )
              }
            >
              Export demo dataset
            </button>
            <button
              onClick={() =>
                setSheet({
                  title: "Import this institution’s fictional dataset",
                  fields: [f("dataset", "Dataset JSON", "textarea")],
                  save: (d) => {
                    try {
                      return importDataset(JSON.parse(d.dataset));
                    } catch {
                      throw Error(
                        "Enter valid JSON from a demo dataset export.",
                      );
                    }
                  },
                })
              }
            >
              Import demo dataset
            </button>
          </div>
        )}
        {schema[key] && (
          <div className="ops-toolbar">
            <button className="erp-primary" onClick={() => edit(key)}>
              <Plus size={16} /> Add {operationLabels[key]?.toLowerCase()}
            </button>
            <span>{rows(key).length} records · institution-scoped demo</span>
          </div>
        )}
        {key === "inventory" && (
          <OpsMetrics
            items={[
              ["Items", rows(key).length],
              ["Low stock", m.lowStock],
              [
                "Stock value",
                money(
                  rows(key).reduce(
                    (n, r) => n + Number(r.quantity) * Number(r.unitCost),
                    0,
                  ),
                ),
              ],
            ]}
          />
        )}{" "}
        {key === "calendar" && (
          <div
            className="erp-panel admin-academic-calendar mobile-redesign"
            data-institution={college.slug}
          >
            <h3>Shared academic calendar</h3>
            <p>
              Published sessions and institution events. Changes update the
              connected mobile portals.
            </p>
            <MobileAcademicCalendar
              periods={rows("timetable")}
              events={[...rows("calendar"), ...rows("assessments")]}
            />
          </div>
        )}
        {table(key)}
        {key === "assignments" &&
          table("submissions", rows("submissions"), false)}
        {key === "assessments" && table("results", rows("results"), false)}
        {key === "inventory" &&
          table("inventory-movements", rows("inventory-movements"), false)}
      </>
    );
  return (
    <div className="ops-workspace">
      {module === "timetable" ? (
        <TimetableOverview college={college} />
      ) : (
        <div className="ops-page-intro">
          <div>
            <h2>{operationLabels[module]}</h2>
            <p>Connected campus operations · {college.name}</p>
          </div>
        </div>
      )}
      {module === "timetable" ? (
        <details className="academic-advanced-records">
          <summary>Advanced session records & exports</summary>
          {body}
        </details>
      ) : (
        body
      )}
      {sheet && (
        <OpsSheet
          title={sheet.title}
          fields={sheet.fields}
          onSave={sheet.save}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
