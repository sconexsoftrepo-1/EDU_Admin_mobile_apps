import { academicRooms, validateAcademicSession } from "./academic-engine";
import { cohortKey, sessionScope } from "./academic-scope";
import { upgradeLegacyTimetable } from "./timetable-migration";
import { sessionForStudent } from "./academic-scope";
import { referenceTimetable } from "./reference-timetable";
import { validateTimetableSession } from "./timetable";
import type { CollegeState, Command, RecordRow } from "./store";
export type Seat = {
  id: string;
  row: number;
  column: number;
  status: "Available" | "Reserved" | "Unavailable";
};
export type Vehicle = {
  id: string;
  name: string;
  registration: string;
  status: string;
  seats: Seat[];
  routeId: string;
  driverId: string;
  assistantId: string;
  insurance: string;
  fitness: string;
  permit: string;
};
export type Route = {
  id: string;
  name: string;
  start: string;
  end: string;
  distance: number;
  stops: {
    id: string;
    name: string;
    time: string;
  }[];
};
export type Passenger = {
  id: string;
  personId: string;
  kind: "Student" | "Faculty" | "Staff";
  busId: string;
  routeId: string;
  seatId: string;
  pickup: string;
  drop: string;
  date: string;
};
export type OperationRecord = {
  id: string;
  name: string;
  status: string;
  date: string;
  [key: string]: string | number;
};
export type Operations = {
  version: 1;
  buses: Vehicle[];
  routes: Route[];
  passengers: Passenger[];
  records: Record<string, OperationRecord[]>;
};
export function seatLayout(capacity: number, columns = 4): Seat[] {
  if (
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    capacity > 80 ||
    ![3, 4, 5].includes(columns)
  )
    throw Error("Choose 1–80 passenger seats and 3, 4 or 5 seats per row.");
  return Array.from({ length: capacity }, (_, i) => ({
    id: String(i + 1).padStart(2, "0"),
    row: Math.floor(i / columns),
    column: i % columns,
    status: "Available",
  }));
}
export const operationLabels: Record<string, string> = {
  "campus-analytics": "Campus analytics",
  employees: "Employee directory",
  "employee-attendance": "Employee attendance",
  "employee-leave": "Leave management",
  "salary-structures": "Salary structures",
  payroll: "Payroll processing",
  payslips: "Payslips",
  bonuses: "Bonuses & incentives",
  reimbursements: "Reimbursements",
  "payroll-reports": "Payroll reports",
  "expense-dashboard": "Expense dashboard",
  "purchase-requests": "Purchase requests",
  "purchase-orders": "Purchase orders",
  vendors: "Vendors",
  equipment: "Equipment purchases",
  utilities: "Utilities",
  maintenance: "Maintenance",
  travel: "Travel expenses",
  "transport-expenses": "Transport expenses",
  "additional-expenses": "Additional expenses",
  inventory: "Inventory",
  assets: "Asset register",
  transport: "Transport dashboard",
  buses: "Bus management",
  routes: "Bus routes",
  "route-stops": "Route stops",
  drivers: "Driver management",
  "driver-allocation": "Driver allocation",
  "student-allocation": "Student allocation",
  "faculty-allocation": "Faculty allocation",
  "bus-seating": "3D bus seating",
  trips: "Daily trips",
  manifest: "Passenger manifest",
  "transport-attendance": "Transport attendance",
  "vehicle-maintenance": "Vehicle maintenance",
  fuel: "Fuel records",
  "transport-reports": "Transport reports",
  "mobile-apps": "Mobile apps emulator",
  "admin-app": "Admin app preview",
  "parent-app": "Parent app preview",
  "student-app": "Student app preview",
  "teacher-app": "Teacher app preview",
  accounts: "User accounts",
  credentials: "Credential provisioning",
  campaigns: "Notification campaigns",
  "payment-reminders": "Payment reminders",
  announcements: "Announcements",
  "notification-templates": "Notification templates",
  timetable: "Timetable",
  assignments: "Assignments",
  assessments: "Assessments",
  attendance: "Student attendance",
  syllabus: "Syllabus & resources",
  calendar: "Academic calendar",
};
const day = "2026-10-19";
export function ensureOperations(s: CollegeState): CollegeState {
  if (s.operations?.version === 1) {
    const existing = s.operations.records.employees || [];
    const employees = s.staff.map((person, i) => {
      const profile = existing.find((e) => e.personId === person.id);
      return {
        ...(profile || {
          id: person.id + "-PROFILE",
          date: person.date,
          personId: person.id,
          basic: 3000000,
          allowances: 0,
          deductions: 0,
          unpaidRate: 0,
          joining: person.date,
          email: `employee${i + 1}@${s.slug}.example`,
        }),
        name: person.name,
        status: person.status,
        department: person.note || "General",
        category: person.category || "Staff",
        ...{},
      };
    });
    return {
      ...s,
      operations: {
        ...s.operations,
        records: { ...upgradeLegacyTimetable(s), employees },
      },
    };
  }
  const prefix = s.slug.startsWith("edu") ? "21" : "22";
  const id = (tag: string, i: number) => `${prefix}-${tag}${i + 1}`;
  const routes: Route[] = Array.from({ length: 8 }, (_, i) => ({
    id: id("ROUTE", i),
    name:
      ["Main City", "East Zone", "West Zone", "North Zone"][i % 4] +
      ` ${i + 1}`,
    start: "06:30",
    end: "08:00",
    distance: 12 + i * 3,
    stops: ["Main Gate", "City Centre", "Railway Station", "College"].map(
      (name, j) => ({
        id: id(`STOP${i}-`, j),
        name,
        time: ["06:30", "06:50", "07:10", "07:40"][j],
      }),
    ),
  }));
  const drivers = s.staff.filter((e) => e.category === "Driver");
  const buses: Vehicle[] = Array.from({ length: 8 }, (_, i) => ({
    id: id("BUS", i),
    name: `Campus Bus ${i + 1}`,
    registration: `DEMO-${prefix}-${String(i + 1).padStart(3, "0")}`,
    status: i === 7 ? "Maintenance" : "Active",
    seats: seatLayout(i === 6 ? 40 : 60),
    routeId: routes[i].id,
    driverId: drivers[i]?.id || "",
    assistantId: "",
    insurance: "2027-12-31",
    fitness: "2027-12-31",
    permit: "2027-12-31",
  }));
  const passengers: Passenger[] = buses
    .filter((b) => b.status === "Active")
    .flatMap((bus, i) =>
      Array.from(
        { length: i === 2 ? 38 : Math.min(26 + i * 3, bus.seats.length) },
        (_, j) => {
          const faculty = i === 2 && j >= 32;
          const person = faculty
            ? s.staff.filter((e) => e.category === "Faculty")[
                (j - 32 + i) %
                  Math.max(
                    1,
                    s.staff.filter((e) => e.category === "Faculty").length,
                  )
              ]
            : s.students[i * 65 + j];
          return person
            ? {
                id: id(`P${i}-`, j),
                personId: person.id,
                kind: faculty ? ("Faculty" as const) : ("Student" as const),
                busId: bus.id,
                routeId: bus.routeId,
                seatId: bus.seats[j].id,
                pickup: routes[i].stops[j % 3].id,
                drop: routes[i].stops[3].id,
                date: day,
              }
            : null;
        },
      ).filter((p) => p !== null),
    );
  const records: Operations["records"] = {};
  const rec = (
    tag: string,
    i: number,
    name: string,
    extra: Partial<OperationRecord> = {},
  ): OperationRecord => ({
    id: id(tag, i),
    name,
    status: "Active",
    date: day,
    ...extra,
  });
  records.employees = s.staff.map((e, i) =>
    rec("EMP", i, e.name, {
      personId: e.id,
      department: e.note || "Administration",
      designation: e.category || "Staff",
      category: e.category || "Staff",
      basic: (30000 + i * 1000) * 100,
      allowances: 800000,
      deductions: 200000,
      unpaidRate: 100000,
      joining: "2024-06-01",
      email: `employee${i + 1}@${s.slug}.example`,
      phone: "DEMO-CONTACT",
    }),
  );
  records.payroll = records.employees.map((e, i) =>
    rec("PAYROLL", i, e.name, {
      status: "Calculated",
      employeeId: e.personId,
      department: e.department,
      period: "2026-10",
      basic: e.basic,
      allowances: e.allowances,
      bonus: 0,
      deductions: e.deductions,
      gross: Number(e.basic) + Number(e.allowances),
      net: Number(e.basic) + Number(e.allowances) - Number(e.deductions),
      unpaidDays: 0,
      extraIds: "[]",
    }),
  );
  records["salary-structures"] = [
    rec("SAL", 0, "Teaching standard", {
      basic: 5000000,
      allowances: 1200000,
      deductions: 500000,
      unpaidRate: 150000,
    }),
    rec("SAL", 1, "Administrative standard", {
      basic: 3500000,
      allowances: 800000,
      deductions: 300000,
      unpaidRate: 100000,
    }),
  ];
  records.guardians = s.students.reduce<OperationRecord[]>((rows, st, i) => {
    if (i % 2 === 0)
      rows.push(
        rec("GUARD", i, st.guardian, {
          studentIds: JSON.stringify(
            s.students.slice(i, i + 2).map((x) => x.id),
          ),
        }),
      );
    return rows;
  }, []);
  records.accounts = [
    ...records.guardians.map((g, i) =>
      rec("ACC-P", i, g.name, {
        personId: g.id,
        role: "Parent",
        username: `parent${i + 1}@${s.slug}.example`,
        studentIds: g.studentIds,
        resetRequired: "Yes",
      }),
    ),
    ...s.students.slice(0, 30).map((st, i) =>
      rec("ACC-S", i, st.name, {
        personId: st.id,
        role: "Student",
        username: st.email,
        resetRequired: "Yes",
      }),
    ),
    ...s.staff
      .filter((e) => e.category === "Faculty")
      .map((e, i) =>
        rec("ACC-T", i, e.name, {
          personId: e.id,
          role: "Faculty",
          username: `teacher${i + 1}@${s.slug}.example`,
          resetRequired: "Yes",
        }),
      ),
  ];
  records.inventory = Array.from({ length: 100 }, (_, i) =>
    rec(
      "ITEM",
      i,
      [
        "Laboratory consumables",
        "A4 paper",
        "Computer accessories",
        "Cleaning supplies",
      ][i % 4] + ` ${i + 1}`,
      {
        category: ["Laboratory", "Stationery", "IT", "Facilities"][i % 4],
        quantity: i % 9 === 0 ? 2 : 20 + i,
        minimum: 5,
        unit: "units",
        unitCost: 25000,
        location: `Store ${(i % 4) + 1}`,
      },
    ),
  );
  records.assets = Array.from({ length: 100 }, (_, i) =>
    rec(
      "ASSET",
      i,
      ["Computer", "Projector", "Lab equipment", "Library furniture"][i % 4] +
        ` ${i + 1}`,
      {
        category: ["IT", "Classroom", "Laboratory", "Furniture"][i % 4],
        amount: 4500000,
        department: s.students[i]?.department || "General",
        location: `Room ${i + 100}`,
        assignedTo: "Unassigned",
        warranty: "2028-06-01",
        condition: "Good",
      },
    ),
  );
  records.vendors = Array.from({ length: 8 }, (_, i) =>
    rec("VENDOR", i, `Fictional Campus Supplier ${i + 1}`, {
      email: `supplier${i + 1}@example.invalid`,
      contact: "DEMO-CONTACT",
      category: "Equipment",
    }),
  );
  const teachers = s.staff.filter((e) => e.category === "Faculty");
  records.timetable = referenceTimetable(s);
  records.assignments = Array.from({ length: 100 }, (_, i) =>
    rec("ASSIGN", i, `Learning exercise ${i + 1}`, {
      status: "Published",
      program: s.students[i % 6]?.program || "",
      employeeId: teachers[i % Math.max(1, teachers.length)]?.id || "",
      subject: ["Mathematics", "Computing", "Communication"][i % 3],
      due: "2026-11-15",
      description:
        "Prepare a short explanation with a worked example. Fictional classroom exercise.",
      maxMarks: 100,
    }),
  );
  records.assessments = Array.from({ length: 50 }, (_, i) =>
    rec("ASSESS", i, `Internal assessment ${i + 1}`, {
      status: "Scheduled",
      program: s.students[i % 6]?.program || "",
      subject: ["Mathematics", "Computing"][i % 2],
      date: "2026-11-20",
      maxMarks: 100,
    }),
  );
  records.syllabus = [
    rec("DOC", 0, "Foundations learning guide", {
      program: s.students[0]?.program || "",
      description:
        "Unit 1: Principles. Unit 2: Worked examples. Unit 3: Independent practice. Learning objective: apply core concepts to a fictional case study.",
    }),
  ];
  records.calendar = [
    rec("EVENT", 0, "Campus open day", {
      date: "2026-11-06",
      description: "Fictional campus academic event.",
    }),
  ];
  records.trips = buses
    .filter((b) => b.status === "Active")
    .map((b, i) =>
      rec("TRIP", i, `${routes[i].name} morning`, {
        status: "Scheduled",
        busId: b.id,
        routeId: b.routeId,
        driverId: b.driverId,
        start: "06:30",
        end: "08:00",
      }),
    );
  records["notification-templates"] = [
    rec("TPL", 0, "Fee reminder", {
      message:
        "Please review the outstanding fee balance in the college portal.",
      category: "Fee Reminder",
    }),
  ];
  records["purchase-requests"] = [
    rec("PR", 0, "Laboratory microscopes", {
      status: "Submitted",
      quantity: 4,
      unitCost: 2500000,
      department: "Science",
      vendorId: records.vendors[0].id,
      itemId: records.inventory[0].id,
      reason: "Teaching laboratory replenishment",
    }),
  ];
  records["employee-leave"] = [
    rec("EL", 0, "Personal leave", {
      status: "Requested",
      employeeId: s.staff[0]?.id || "",
      start: "2026-10-20",
      end: "2026-10-21",
      kind: "Unpaid",
      reason: "Fictional leave request",
    }),
  ];
  return {
    ...s,
    operations: { version: 1, buses, routes, passengers, records },
  };
}
export const opRows = (s: CollegeState, key: string) =>
  s.operations?.records[key] || [];
export const due = (s: CollegeState, id: string) => {
  const st = s.students.find((x) => x.id === id);
  return st
    ? Math.max(
        0,
        st.fee -
          st.scholarship -
          s.payments
            .filter((p) => p.studentId === id && p.status === "Completed")
            .reduce((a, p) => a + (p.amount || 0), 0),
      )
    : 0;
};
export const occupancy = (s: CollegeState, busId: string) => {
  const bus = s.operations?.buses.find((b) => b.id === busId);
  const rows = s.operations?.passengers.filter((p) => p.busId === busId) || [];
  const reserved =
    bus?.seats.filter((x) => x.status === "Reserved").length || 0;
  const unavailable =
    bus?.seats.filter((x) => x.status === "Unavailable").length || 0;
  return {
    capacity: bus?.seats.length || 0,
    occupied: rows.length,
    students: rows.filter((p) => p.kind === "Student").length,
    faculty: rows.filter((p) => p.kind === "Faculty").length,
    staff: rows.filter((p) => p.kind === "Staff").length,
    reserved,
    unavailable,
    available: (bus?.seats.length || 0) - rows.length - reserved - unavailable,
    percent: bus ? Math.round((rows.length / bus.seats.length) * 1000) / 10 : 0,
  };
};
export function operationMetrics(s: CollegeState) {
  const o = s.operations;
  const entries = opRows(s, "payroll");
  return {
    employees: opRows(s, "employees").filter((x) => x.status === "Active")
      .length,
    faculty: s.staff.filter(
      (x) => x.status === "Active" && x.category === "Faculty",
    ).length,
    capacity: o?.buses.reduce((a, b) => a + b.seats.length, 0) || 0,
    occupied: o?.passengers.length || 0,
    buses: o?.buses.length || 0,
    maintenance: o?.buses.filter((b) => b.status === "Maintenance").length || 0,
    payroll: entries.reduce((a, r) => a + Number(r.net || 0), 0),
    payrollPending: entries.filter((r) => r.status !== "Paid").length,
    purchases: opRows(s, "purchase-requests").filter(
      (x) => x.status === "Submitted",
    ).length,
    lowStock: opRows(s, "inventory").filter(
      (x) => Number(x.quantity) <= Number(x.minimum),
    ).length,
    expenses: s.expenses
      .filter((x) => x.date.startsWith(day.slice(0, 7)))
      .reduce((a, x) => a + (x.amount || 0), 0),
  };
}
const moneyInput = (v: string | undefined, allowZero = false) => {
  const n = Math.round(Number(v) * 100);
  if (
    !v?.trim() ||
    !Number.isSafeInteger(n) ||
    n < (allowZero ? 0 : 1) ||
    n > 1e12
  )
    throw Error("Enter a valid amount in INR.");
  return n;
};
const integer = (v: string, min = 1, max = 100000) => {
  const n = Number(v);
  if (!v.trim() || !Number.isInteger(n) || n < min || n > max)
    throw Error(`Enter a whole number from ${min} to ${max}.`);
  return n;
};
const required = (v: string | undefined, label: string) => {
  if (!v?.trim()) throw Error(`${label} is required.`);
  return v.trim().slice(0, 2000);
};
const validDate = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const hr = ["Super Admin", "HR Manager", "Payroll Officer"];
const transport = ["Super Admin", "Transport Manager"];
const purchase = ["Super Admin", "Procurement Officer", "Inventory Manager"];
export function executeOperation(
  state: CollegeState,
  cmd: Command,
): CollegeState {
  const s = structuredClone(ensureOperations(state)),
    o = s.operations!,
    d = cmd.data || {},
    now = new Date().toISOString(),
    today = now.slice(0, 10);
  const uid = (tag: string) =>
    `${s.slug.startsWith("edu") ? "21" : "22"}-${tag}-${crypto.randomUUID().slice(0, 10)}`;
  const allow = (roles: string[]) => {
    if (!roles.includes(cmd.role))
      throw Error("This demo role cannot perform this action.");
  };
  const rows = (key: string) => o.records[key] ?? (o.records[key] = []);
  const find = (key: string, id = cmd.id) => {
    const r = rows(key).find((x) => x.id === id);
    if (!r) throw Error("Record not found in this institution.");
    return r;
  };
  const person = (id: string, kind: string) => {
    const p =
      kind === "Student"
        ? s.students.find((x) => x.id === id)
        : s.staff.find((x) => x.id === id);
    if (!p || p.status !== "Active")
      throw Error("Choose an active person from this institution.");
    if (
      kind !== "Student" &&
      ["Driver", "Transport Assistant"].includes(
        (p as RecordRow).category || "",
      )
    )
      throw Error("Crew must use crew allocation, not passenger seats.");
    return p;
  };
  const notify = (name: string, studentId?: string, accountId?: string) =>
    s.notifications.unshift({
      id: uid("NOTE"),
      name,
      status: "Unread",
      date: today,
      studentId,
      reference: accountId,
      note: d.message || "Simulated in-app event. No external message sent.",
    });
  const financial = (
    name: string,
    amount: number,
    reference: string,
    category: string,
    status = "Paid",
  ) => {
    if (s.expenses.some((e) => e.reference === reference))
      throw Error("This financial transaction has already been posted.");
    s.expenses.unshift({
      id: uid("EXP"),
      name,
      amount,
      reference,
      category,
      status,
      date: today,
      method: "Bank Transfer demo",
    });
  };
  const newRow = (
    name: string,
    status = "Active",
    extra: Record<string, string | number> = {},
  ): OperationRecord => ({
    id: uid("OP"),
    name,
    status,
    date: today,
    ...extra,
  });
  switch (cmd.type) {
    case "ops.timetable.configure": {
      allow(["Super Admin"]);
      const config = JSON.parse(d.configuration);
      if (
        !Array.isArray(config.workingDays) ||
        !config.workingDays.length ||
        config.workingDays.some(
          (day: string) =>
            ![
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday",
            ].includes(day),
        )
      )
        throw Error("Choose valid working days.");
      if (
        !Array.isArray(config.slots) ||
        !config.slots.length ||
        config.slots.length > 24
      )
        throw Error("Configure 1–24 valid time slots.");
      let end = "00:00";
      for (const slot of config.slots) {
        if (
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.start) ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.end) ||
          slot.start < end ||
          slot.end <= slot.start
        )
          throw Error("Time slots must be ordered, valid and non-overlapping.");
        end = slot.end;
      }
      if (
        rows("timetable").some(
          (p) =>
            !["Draft", "Archived", "Cancelled"].includes(p.status) &&
            (!config.workingDays.includes(p.day) ||
              p.start < config.open ||
              p.end > config.close),
        )
      )
        throw Error(
          "Existing published sessions fall outside these hours. Reschedule them before changing working hours.",
        );
      o.records["schedule-configuration"] = [
        newRow("Institution working schedule", "Active", {
          configuration: JSON.stringify(config),
        }),
      ];
      break;
    }
    case "ops.timetable.publish": {
      allow(["Super Admin"]);
      const ids = JSON.parse(d.ids || "[]") as string[];
      if (!ids.length) throw Error("Select draft sessions to publish.");
      const drafts = ids.map((id) => find("timetable", id));
      if (drafts.some((p) => p.status !== "Draft"))
        throw Error("Only draft sessions can be published.");
      const replacements = new Set(
        drafts.map((p) => String(p.replacesId || "")),
      );
      const existing = rows("timetable").filter(
        (p) => !replacements.has(p.id) && !ids.includes(p.id),
      );
      const candidates = drafts.map((p) => ({ ...p, status: "Active" }));
      for (const p of candidates)
        validateAcademicSession(
          s,
          Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])),
          [...existing, ...candidates],
          p.id,
        );
      const version = rows("timetable-versions").length + 1;
      const affectedGroups = new Set(
        [
          ...drafts,
          ...rows("timetable").filter((p) => replacements.has(p.id)),
        ].map((p) => cohortKey(sessionScope(p))),
      );
      const snapshot = JSON.stringify(
        rows("timetable").filter(
          (p) =>
            affectedGroups.has(cohortKey(sessionScope(p))) &&
            !["Draft", "Archived"].includes(p.status),
        ),
      );
      rows("timetable-versions").unshift(
        newRow(`Timetable publication ${version}`, "Published", {
          sequence: version,
          snapshot,
          scope: JSON.stringify([...affectedGroups]),
        }),
      );
      rows("timetable")
        .filter((p) => replacements.has(p.id))
        .forEach((p) => (p.status = "Archived"));
      drafts.forEach((p) => {
        p.status = "Active";
        p.publishedAt = now;
        p.publication = version;
      });
      const students = s.students.filter((st) =>
        drafts.some((p) => sessionForStudent(p, st)),
      );
      students.forEach((st) =>
        notify(`Academic timetable updated · version ${version}`, st.id),
      );
      const teachers = new Set(drafts.map((p) => p.employeeId));
      rows("accounts")
        .filter((a) => a.role === "Faculty" && teachers.has(a.personId))
        .forEach((a) =>
          notify(
            `Teaching timetable updated · version ${version}`,
            undefined,
            a.id,
          ),
        );
      break;
    }
    case "ops.timetable.restore": {
      allow(["Super Admin"]);
      const version = find("timetable-versions");
      const snapshot = JSON.parse(
        String(version.snapshot),
      ) as OperationRecord[];
      let groups: string[] | null = null;
      try {
        const parsed = JSON.parse(String(version.scope));
        if (Array.isArray(parsed)) groups = parsed;
      } catch {}
      const applies = (p: OperationRecord) =>
        !groups || groups.includes(cohortKey(sessionScope(p)));
      const current = rows("timetable").filter(
        (p) => applies(p) && !["Draft", "Archived"].includes(p.status),
      );
      const retained = rows("timetable").filter(
        (p) => !applies(p) || p.status === "Draft",
      );
      for (const p of snapshot.filter(
        (p) => !["Inactive", "Cancelled"].includes(p.status),
      ))
        validateTimetableSession(
          Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])),
          [...retained, ...snapshot],
          p.id,
        );
      rows("timetable-versions").unshift(
        newRow("Snapshot before restore", "Published", {
          sequence: rows("timetable-versions").length + 1,
          snapshot: JSON.stringify(current),
          scope: String(version.scope),
        }),
      );
      o.records.timetable = [
        ...retained.filter((p) => !snapshot.some((s) => s.id === p.id)),
        ...snapshot,
      ];
      notify(`Timetable restored from ${version.name}`);
      break;
    }
    case "ops.timetable.room": {
      allow(["Super Admin"]);
      if (!rows("academic-rooms").length)
        o.records["academic-rooms"] = academicRooms(s).map((r) => ({
          ...r,
          status: "Active",
          date: today,
        }));
      const room = {
        id: cmd.id || uid("ROOM"),
        name: required(d.name, "Room name"),
        status: "Active",
        date: today,
        kind: d.kind === "Lab" ? "Lab" : "Classroom",
        capacity: integer(d.capacity, 1, 500),
        equipment: d.equipment || "",
      };
      if (
        rows("academic-rooms").some(
          (r) => r.id !== room.id && r.name === room.name,
        )
      )
        throw Error("Room name already exists.");
      const old = rows("academic-rooms").findIndex((r) => r.id === room.id);
      if (old >= 0) rows("academic-rooms")[old] = room;
      else rows("academic-rooms").push(room);
      break;
    }
    case "ops.bus.save": {
      allow(transport);
      const old = o.buses.find((b) => b.id === cmd.id);
      const seats = seatLayout(
        integer(d.capacity, 1, 80),
        integer(d.columns || "4", 3, 5),
      );
      if (
        old &&
        o.passengers.some(
          (p) => p.busId === old.id && !seats.some((x) => x.id === p.seatId),
        )
      )
        throw Error("Move allocated passengers before reducing capacity.");
      if (old) {
        old.name = required(d.name, "Vehicle name");
        old.registration = required(d.registration, "Registration");
        old.status = d.status || old.status;
        old.seats = seats.map((x) => ({
          ...x,
          status: old.seats.find((y) => y.id === x.id)?.status || "Available",
        }));
        old.insurance = d.insurance || old.insurance;
        old.fitness = d.fitness || old.fitness;
        old.permit = d.permit || old.permit;
      } else
        o.buses.push({
          id: uid("BUS"),
          name: required(d.name, "Vehicle name"),
          registration: required(d.registration, "Registration"),
          status: "Active",
          seats,
          routeId: "",
          driverId: "",
          assistantId: "",
          insurance: d.insurance || "",
          fitness: d.fitness || "",
          permit: d.permit || "",
        });
      break;
    }
    case "ops.route.save": {
      allow(transport);
      const stops = JSON.parse(d.stops || "[]") as Route["stops"];
      if (
        !Array.isArray(stops) ||
        stops.length < 2 ||
        stops.some((x) => !x.name || !/^\d{2}:\d{2}$/.test(x.time))
      )
        throw Error("Add at least two named stops with pickup times.");
      const r = {
        id: cmd.id || uid("ROUTE"),
        name: required(d.name, "Route name"),
        start: d.start || "06:30",
        end: d.end || "08:00",
        distance: integer(d.distance || "0", 0, 1000),
        stops: stops.map((x, i) => ({
          id: x.id || uid("STOP" + i),
          name: x.name.slice(0, 100),
          time: x.time,
        })),
      };
      const old = o.routes.findIndex((x) => x.id === r.id);
      if (old >= 0) {
        const used = o.passengers.filter((p) => p.routeId === r.id);
        if (
          used.some(
            (p) =>
              !r.stops.some((x) => x.id === p.pickup) ||
              !r.stops.some((x) => x.id === p.drop),
          )
        )
          throw Error("Reassign passengers before removing their stops.");
        o.routes[old] = r;
      } else o.routes.push(r);
      break;
    }
    case "ops.driver.assign": {
      allow(transport);
      const b = o.buses.find((x) => x.id === d.busId),
        r = o.routes.find((x) => x.id === d.routeId),
        e = s.staff.find((x) => x.id === d.employeeId);
      if (!b || !r || !e || e.category !== "Driver" || e.status !== "Active")
        throw Error("Select an active bus, route and driver.");
      if (b.status !== "Active") throw Error("The bus is unavailable.");
      if (
        o.buses.some(
          (x) =>
            x.id !== b.id &&
            x.status === "Active" &&
            (x.driverId === e.id || x.routeId === r.id),
        )
      )
        throw Error(
          "Driver or route already assigned to another active bus in this schedule.",
        );
      if (
        rows("employee-leave").some(
          (x) =>
            x.employeeId === e.id &&
            x.status === "Approved" &&
            String(x.start) <= today &&
            String(x.end) >= today,
        )
      )
        throw Error("Driver is on approved leave.");
      const emp = rows("employees").find((x) => x.personId === e.id);
      if (emp?.licenseExpiry && String(emp.licenseExpiry) < today)
        throw Error("Driver license is expired.");
      if (o.passengers.some((p) => p.busId === b.id) && b.routeId !== r.id)
        throw Error("Reassign passengers before changing the bus route.");
      b.driverId = e.id;
      b.routeId = r.id;
      b.assistantId = d.assistantId || "";
      break;
    }
    case "ops.seat.assign": {
      allow(transport);
      const b = o.buses.find((x) => x.id === d.busId);
      if (!b || b.status !== "Active")
        throw Error("The bus is unavailable for allocation.");
      const route = o.routes.find((x) => x.id === b.routeId);
      if (!route) throw Error("Assign a route before allocating seats.");
      const seat = b.seats.find((x) => x.id === d.seatId);
      if (!seat || seat.status !== "Available")
        throw Error("Seat is reserved or unavailable.");
      if (
        o.passengers.some(
          (p) => p.busId === b.id && p.seatId === seat.id && p.id !== cmd.id,
        )
      )
        throw Error("This seat is already occupied.");
      if (
        o.passengers.some((p) => p.personId === d.personId && p.id !== cmd.id)
      )
        throw Error(
          "Passenger already has an active allocation. Move or remove it first.",
        );
      const kind = d.kind as Passenger["kind"];
      if (!["Student", "Faculty", "Staff"].includes(kind))
        throw Error("Choose a passenger type.");
      const p = person(d.personId, kind);
      if (kind === "Faculty" && (p as RecordRow).category !== "Faculty")
        throw Error("Select a faculty member.");
      const pickup = route.stops.findIndex((x) => x.id === d.pickup),
        drop = route.stops.findIndex((x) => x.id === d.drop);
      if (pickup < 0 || drop <= pickup)
        throw Error("Drop stop must follow the pickup stop.");
      const allocation: Passenger = {
        id: cmd.id || uid("PASS"),
        personId: p.id,
        kind,
        busId: b.id,
        routeId: route.id,
        seatId: seat.id,
        pickup: d.pickup,
        drop: d.drop,
        date: today,
      };
      o.passengers = o.passengers.filter((x) => x.id !== allocation.id);
      o.passengers.push(allocation);
      notify(
        "Transport seat allocation updated",
        kind === "Student" ? p.id : undefined,
        kind !== "Student"
          ? String(
              rows("accounts").find((a) => a.personId === p.id)?.id ||
                "EMPLOYEE:" + p.id,
            )
          : undefined,
      );
      break;
    }
    case "ops.seat.remove":
      allow(transport);
      o.passengers = o.passengers.filter((p) => p.id !== cmd.id);
      break;
    case "ops.seat.swap": {
      allow(transport);
      const a = o.passengers.find((p) => p.id === cmd.id),
        b = o.passengers.find((p) => p.id === d.otherId);
      if (!a || !b || a.busId !== b.busId)
        throw Error("Choose two occupied seats on the same bus.");
      [a.seatId, b.seatId] = [b.seatId, a.seatId];
      break;
    }
    case "ops.seat.status": {
      allow(transport);
      const b = o.buses.find((x) => x.id === d.busId),
        seat = b?.seats.find((x) => x.id === d.seatId);
      if (
        !seat ||
        o.passengers.some((p) => p.busId === b?.id && p.seatId === seat.id)
      )
        throw Error("Only empty seats can be reserved or blocked.");
      if (!["Available", "Reserved", "Unavailable"].includes(d.status))
        throw Error("Invalid seat status.");
      seat.status = d.status as Seat["status"];
      break;
    }
    case "ops.employee.save": {
      allow(d.category === "Driver" ? [...hr, ...transport] : hr);
      const name = required(d.name, "Employee name");
      let staff = s.staff.find((e) => e.id === cmd.id);
      if (!staff) {
        staff = { id: uid("STAFF"), name, status: "Active", date: today };
        s.staff.push(staff);
      }
      Object.assign(staff, {
        name,
        category: d.category || "Faculty",
        note: d.department || "General",
        status: d.status || "Active",
      });
      const data = {
        personId: staff.id,
        department: d.department || "General",
        designation: d.designation || "Employee",
        category: staff.category || "Faculty",
        basic: moneyInput(d.basic, d.category === "Driver"),
        allowances: moneyInput(d.allowances || "0", true),
        deductions: moneyInput(d.deductions || "0", true),
        unpaidRate: moneyInput(d.unpaidRate || "0", true),
        joining: d.joining || today,
        email: d.email || "",
        phone: d.phone || "",
        licenseExpiry: d.licenseExpiry || "",
      };
      const record = rows("employees").find((x) => x.personId === staff.id);
      if (record)
        Object.assign(record, { name, status: staff.status, ...data });
      else rows("employees").push(newRow(name, "Active", data));
      break;
    }
    case "ops.salary.assign": {
      allow(hr);
      const e = find("employees"),
        salary = find("salary-structures", d.salaryId);
      Object.assign(e, {
        basic: salary.basic,
        allowances: salary.allowances,
        deductions: salary.deductions,
        unpaidRate: salary.unpaidRate,
        salaryId: salary.id,
      });
      break;
    }
    case "ops.payroll.calculate": {
      allow(hr);
      if (!/^\d{4}-\d{2}$/.test(d.period)) throw Error("Choose a pay period.");
      const existing = rows("payroll").filter((x) => x.period === d.period);
      if (existing.some((x) => ["Approved", "Paid"].includes(x.status)))
        throw Error(
          "Finalized payroll cannot be recalculated. Create a later adjustment.",
        );
      o.records.payroll = rows("payroll").filter((x) => x.period !== d.period);
      for (const e of rows("employees").filter(
        (x) => x.status === "Active" && Number(x.basic) > 0,
      )) {
        const employeeId = String(e.personId);
        const days = rows("employee-leave")
          .filter(
            (l) =>
              l.employeeId === employeeId &&
              l.status === "Approved" &&
              l.kind === "Unpaid",
          )
          .reduce((n, l) => {
            const start =
              String(l.start) > d.period + "-01"
                ? String(l.start)
                : d.period + "-01";
            const endDate = new Date(
              Date.UTC(
                Number(d.period.slice(0, 4)),
                Number(d.period.slice(5, 7)),
                0,
              ),
            )
              .toISOString()
              .slice(0, 10);
            const end = String(l.end) < endDate ? String(l.end) : endDate;
            return (
              n +
              Math.max(
                0,
                Math.floor((Date.parse(end) - Date.parse(start)) / 86400000) +
                  1,
              )
            );
          }, 0);
        const extras = ["bonuses", "reimbursements"].flatMap((k) =>
          rows(k).filter(
            (x) =>
              x.employeeId === employeeId &&
              x.period === d.period &&
              x.status === "Approved",
          ),
        );
        const bonus = extras.reduce((n, x) => n + Number(x.amount), 0),
          gross = Number(e.basic) + Number(e.allowances) + bonus,
          deductions = Number(e.deductions) + days * Number(e.unpaidRate);
        if (!Number.isSafeInteger(gross) || deductions > gross)
          throw Error(
            "Payroll deductions exceed earnings. Review salary or leave.",
          );
        rows("payroll").push(
          newRow(e.name, "Calculated", {
            employeeId,
            department: e.department,
            period: d.period,
            basic: e.basic,
            allowances: e.allowances,
            bonus,
            deductions,
            gross,
            net: gross - deductions,
            unpaidDays: days,
            extraIds: JSON.stringify(extras.map((x) => x.id)),
          }),
        );
      }
      break;
    }
    case "ops.payroll.approve": {
      allow(["Super Admin", "HR Manager"]);
      const entries = rows("payroll").filter((x) => x.period === d.period);
      if (!entries.length || entries.some((x) => x.status !== "Calculated"))
        throw Error("Calculate this period before approval.");
      entries.forEach((x) => (x.status = "Approved"));
      break;
    }
    case "ops.payroll.pay": {
      allow(["Super Admin", "Payroll Officer", "Accounts Manager"]);
      const entries = rows("payroll").filter((x) => x.period === d.period);
      if (!entries.length || entries.some((x) => x.status !== "Approved"))
        throw Error("Only a fully approved period can be paid once.");
      for (const e of entries) {
        financial(
          `Payroll · ${e.name} · ${e.period}`,
          Number(e.net),
          e.id,
          "Salary",
        );
        e.status = "Paid";
        e.paidAt = today;
        const ids = JSON.parse(String(e.extraIds || "[]")) as string[];
        for (const key of ["bonuses", "reimbursements"])
          rows(key)
            .filter((x) => ids.includes(x.id))
            .forEach((x) => (x.status = "Included in Payroll"));
        notify(
          "Payslip available",
          undefined,
          String(
            rows("accounts").find((a) => a.personId === e.employeeId)?.id ||
              "EMPLOYEE:" + e.employeeId,
          ),
        );
      }
      break;
    }
    case "ops.purchase.order": {
      allow(purchase);
      const r = find("purchase-requests");
      if (r.status !== "Approved")
        throw Error("Approve the purchase request before ordering.");
      if (!rows("vendors").some((x) => x.id === r.vendorId))
        throw Error("Choose a valid vendor.");
      const baseAmount = Number(r.quantity) * Number(r.unitCost),
        gstRate = Number(r.gstRate || 0),
        taxMode = String(r.taxMode || "No GST"),
        tax =
          taxMode === "No GST" ? 0 : Math.round((baseAmount * gstRate) / 100),
        charges = Number(r.additionalCharges || 0);
      if (!Number.isSafeInteger(baseAmount + tax + charges))
        throw Error("Purchase total exceeds the supported amount.");
      rows("purchase-orders").push(
        newRow(r.name, "Ordered", {
          requestId: r.id,
          vendorId: r.vendorId,
          itemId: r.itemId,
          quantity: r.quantity,
          unitCost: r.unitCost,
          amount: baseAmount + tax + charges,
          baseAmount,
          gstRate,
          taxMode,
          tax,
          additionalCharges: charges,
          cgst: taxMode === "Intra-state" ? Math.floor(tax / 2) : 0,
          sgst: taxMode === "Intra-state" ? tax - Math.floor(tax / 2) : 0,
          igst: taxMode === "Inter-state" ? tax : 0,
          received: 0,
          paid: 0,
          department: r.department || "General",
        }),
      );
      r.status = "Ordered";
      break;
    }
    case "ops.purchase.receive": {
      allow(purchase);
      const p = find("purchase-orders");
      if (
        Number(p.received) >= Number(p.quantity) ||
        !["Ordered", "Partially received", "Partially paid"].includes(p.status)
      )
        throw Error("This order cannot receive more goods.");
      const qty = integer(d.quantity),
        damaged = integer(d.damaged || "0", 0);
      if (damaged > qty || Number(p.received) + qty > Number(p.quantity))
        throw Error(
          "Receipt exceeds ordered quantity or damaged quantity is invalid.",
        );
      const ref = required(d.reference, "Unique delivery reference");
      if (rows("goods-receipts").some((x) => x.reference === ref))
        throw Error("Delivery reference already received.");
      const item = find("inventory", String(p.itemId));
      item.quantity = Number(item.quantity) + qty - damaged;
      p.received = Number(p.received) + qty;
      p.status =
        Number(p.received) === Number(p.quantity)
          ? "Received"
          : "Partially received";
      rows("goods-receipts").push(
        newRow(p.name, "Received", {
          orderId: p.id,
          quantity: qty,
          damaged,
          accepted: qty - damaged,
          reference: ref,
        }),
      );
      rows("inventory-movements").push(
        newRow(item.name, "Received", {
          itemId: item.id,
          quantity: qty - damaged,
          reference: p.id,
        }),
      );
      if (!s.invoices.some((x) => x.reference === p.id))
        s.invoices.unshift({
          id: uid("INV"),
          name: p.name,
          status: "Pending",
          date: today,
          reference: p.id,
          amount: Number(p.amount),
        });
      break;
    }
    case "ops.purchase.pay": {
      allow(["Super Admin", "Accounts Manager"]);
      const p = find("purchase-orders");
      if (
        !["Partially received", "Received", "Partially paid"].includes(p.status)
      )
        throw Error("Record a goods receipt before payment.");
      const amount = moneyInput(d.amount);
      if (Number(p.paid) + amount > Number(p.amount))
        throw Error("Payment exceeds order balance.");
      const reference = required(d.reference, "Unique payment reference");
      financial(
        `Purchase · ${p.name}`,
        amount,
        `${p.id}:${reference}`,
        "Equipment",
      );
      p.paid = Number(p.paid) + amount;
      if (Number(p.paid) === Number(p.amount)) {
        p.status = "Paid";
        const inv = s.invoices.find((x) => x.reference === p.id);
        if (inv) inv.status = "Paid";
      } else p.status = "Partially paid";
      break;
    }
    case "ops.inventory.move": {
      allow(purchase);
      const r = find("inventory"),
        qty = integer(d.quantity, d.kind === "Adjust" ? 0 : 1);
      required(d.reason, "Movement reason");
      if (!["Receive", "Issue", "Transfer", "Adjust"].includes(d.kind))
        throw Error("Choose a stock movement.");
      if (["Issue", "Transfer"].includes(d.kind) && qty > Number(r.quantity))
        throw Error("Insufficient stock.");
      if (d.kind === "Transfer") {
        const location = required(d.location, "Destination");
        if (location === r.location)
          throw Error("Choose a different destination store.");
        if (qty === Number(r.quantity)) r.location = location;
        else {
          r.quantity = Number(r.quantity) - qty;
          rows("inventory").push({
            ...r,
            id: uid("ITEM"),
            quantity: qty,
            location,
          });
        }
      } else
        r.quantity =
          d.kind === "Adjust"
            ? qty
            : Number(r.quantity) + (d.kind === "Issue" ? -qty : qty);
      rows("inventory-movements").push(
        newRow(r.name, d.kind, {
          itemId: r.id,
          quantity: qty,
          reason: d.reason,
          location: d.location || String(r.location),
        }),
      );
      break;
    }
    case "ops.campaign.send": {
      allow(["Super Admin", "Principal", "Accounts Manager"]);
      required(d.message, "Message");
      const accounts = rows("accounts").filter((a) => a.status === "Active");
      const eligible = s.students.filter(
        (st) =>
          (!d.program || st.program === d.program) &&
          (!d.year || st.year === d.year) &&
          (!d.department || st.department === d.department) &&
          (!d.studentId || st.id === d.studentId) &&
          (!d.minimum || due(s, st.id) >= moneyInput(d.minimum)) &&
          (!d.audience?.includes("Pending") || due(s, st.id) > 0),
      );
      const ids = new Set(eligible.map((x) => x.id));
      const recipients = accounts.filter((a) => {
        if (d.audience?.includes("Parents"))
          return (
            a.role === "Parent" &&
            (JSON.parse(String(a.studentIds || "[]")) as string[]).some((x) =>
              ids.has(x),
            )
          );
        if (d.audience === "Teachers") return a.role === "Faculty";
        return a.role === "Student" && ids.has(String(a.personId));
      });
      if (!recipients.length)
        throw Error("No eligible active accounts match this audience.");
      for (const a of recipients)
        notify(
          d.name || "College announcement",
          a.role === "Student" ? String(a.personId) : undefined,
          a.id,
        );
      rows("campaigns").unshift(
        newRow(d.name || "College announcement", "Simulated", {
          message: d.message,
          audience: d.audience || "Students",
          recipients: recipients.length,
          recipientIds: JSON.stringify(recipients.map((x) => x.id)),
          channel: d.channel || "In-App",
          program: d.program || "",
          year: d.year || "",
        }),
      );
      break;
    }
    case "ops.attendance.batch": {
      allow(["Super Admin", "Faculty"]);
      const teacher = s.staff.find(
        (e) =>
          e.id === d.employeeId &&
          e.category === "Faculty" &&
          e.status === "Active",
      );
      if (
        !teacher ||
        !rows("timetable").some(
          (p) => p.employeeId === teacher.id && p.program === d.program,
        )
      )
        throw Error("Choose an assigned class.");
      if (
        cmd.role === "Faculty" &&
        teacher.id !==
          s.staff.find((e) => e.category === "Faculty" && e.status === "Active")
            ?.id
      )
        throw Error("This is another teacher’s class.");
      required(d.subject, "Subject");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date))
        throw Error("Choose an attendance date.");
      const marks = JSON.parse(d.marks) as Record<string, string>;
      const roster = s.students.filter(
        (st) => st.program === d.program && st.status === "Active",
      );
      if (
        Object.keys(marks).length !== roster.length ||
        roster.some(
          (st) =>
            !["Present", "Absent", "Late", "Excused"].includes(marks[st.id]),
        )
      )
        throw Error("Mark every student in the assigned class.");
      const drafts = (o.records["attendance-drafts"] ||= []);
      const old = drafts.find(
        (x) =>
          x.employeeId === teacher.id &&
          x.program === d.program &&
          x.date === d.date &&
          x.subject === d.subject,
      );
      if (d.mode === "Draft") {
        const draft = old || newRow("Class attendance draft", "Draft");
        Object.assign(draft, {
          employeeId: teacher.id,
          program: d.program,
          date: d.date,
          subject: d.subject,
          marks: JSON.stringify(marks),
        });
        if (!old) drafts.push(draft);
        break;
      }
      if (d.mode !== "Finalize")
        throw Error("Choose draft or finalized attendance.");
      for (const st of roster) {
        const old = rows("attendance").find(
          (a) =>
            a.studentId === st.id &&
            a.date === d.date &&
            a.subject === d.subject,
        );
        const entry = old || newRow(`Attendance · ${d.date}`);
        Object.assign(entry, {
          studentId: st.id,
          employeeId: teacher.id,
          program: d.program,
          date: d.date,
          subject: d.subject,
          attendance: marks[st.id],
          reason: old
            ? "Faculty finalized class register correction"
            : "Faculty finalized class register",
        });
        if (!old) rows("attendance").push(entry);
      }
      if (old) drafts.splice(drafts.indexOf(old), 1);
      break;
    }
    case "ops.profile.save": {
      allow(["Super Admin", "Student", "Parent", "Faculty"]);
      const account = rows("accounts").find(
        (a) => a.id === d.accountId && a.status === "Active",
      );
      if (!account) throw Error("Choose an active campus account.");
      if (cmd.role !== "Super Admin" && account.role !== cmd.role)
        throw Error("This account belongs to another portal role.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email || ""))
        throw Error("Enter a valid fictional email address.");
      const profiles = (o.records["portal-profiles"] ||= []);
      const current = profiles.find((p) => p.accountId === account.id);
      const profile = current || newRow(account.name, "Active");
      Object.assign(profile, {
        accountId: account.id,
        email: d.email,
        phone: d.phone || "",
        notificationPreference: d.notificationPreference || "In-app",
      });
      if (!current) profiles.push(profile);
      break;
    }
    case "ops.notification.read": {
      const n = s.notifications.find((x) => x.id === cmd.id);
      if (n) n.status = "Read";
      break;
    }
    case "ops.assignment.submit": {
      allow(["Super Admin", "Student"]);
      const a = find("assignments", d.assignmentId);
      const st = person(d.studentId, "Student");
      if (cmd.role === "Student" && st.id !== s.students[0]?.id)
        throw Error("Only your own submission is allowed.");
      if (
        today > String(a.due) &&
        a.allowLate !== "Yes" &&
        d.saveDraft !== "Yes"
      )
        throw Error(
          "The submission deadline has passed. Ask your teacher to enable late submissions.",
        );
      if (a.program !== st.program || a.status !== "Published")
        throw Error("Assignment unavailable for this class.");
      const existing = rows("submissions").find(
        (x) => x.assignmentId === a.id && x.studentId === st.id,
      );
      if (existing && existing.status !== "Draft")
        throw Error("Assignment already submitted.");
      const submission = existing || newRow(a.name, "Draft");
      Object.assign(submission, {
        status: d.saveDraft === "Yes" ? "Draft" : "Submitted",
        assignmentId: a.id,
        studentId: st.id,
        answer: required(d.answer, "Submission"),
        attachment: d.attachment || "",
        attachmentFile: d.attachmentFile || existing?.attachmentFile || "",
        submittedAt: now,
        late: today > String(a.due) ? "Yes" : "No",
      });
      if (!existing) rows("submissions").push(submission);
      if (submission.status === "Draft") break;
      notify("Assignment submitted", st.id);
      notify(
        "New assignment submission",
        undefined,
        String(
          rows("accounts").find((x) => x.personId === a.employeeId)?.id ||
            "EMPLOYEE:" + a.employeeId,
        ),
      );
      break;
    }
    case "ops.assignment.review": {
      allow(["Super Admin", "Faculty"]);
      const r = find("submissions");
      const a = find("assignments", String(r.assignmentId));
      if (
        cmd.role === "Faculty" &&
        a.employeeId !==
          s.staff.find((e) => e.category === "Faculty" && e.status === "Active")
            ?.id
      )
        throw Error("This submission belongs to another teacher.");
      const marks = integer(d.marks, 0, Number(a.maxMarks || 100));
      Object.assign(r, {
        status: "Reviewed",
        marks,
        feedback: required(d.feedback, "Feedback"),
      });
      notify("Assignment feedback published", String(r.studentId));
      break;
    }
    case "ops.account.reset":
      allow(["Super Admin"]);
      find("accounts").resetRequired = "Yes";
      break;
    case "ops.assessment.result": {
      allow(["Super Admin", "Faculty"]);
      const assessment = find("assessments", d.assessmentId),
        st = s.students.find((x) => x.id === d.studentId);
      if (!st || st.program !== assessment.program)
        throw Error("Choose a student in the assessment class.");
      const marks = integer(d.marks, 0, Number(assessment.maxMarks || 100));
      const old = rows("results").find(
        (x) => x.assessmentId === assessment.id && x.studentId === st.id,
      );
      const result = old || newRow(assessment.name, "Published");
      Object.assign(result, {
        assessmentId: assessment.id,
        studentId: st.id,
        marks,
        maxMarks: assessment.maxMarks,
        feedback: required(d.feedback, "Feedback"),
      });
      if (!old) rows("results").push(result);
      notify("Assessment marks published", st.id);
      break;
    }
    case "ops.record.save": {
      const key = required(d.collection, "Record collection");
      const academic = [
        "timetable",
        "assignments",
        "assessments",
        "attendance",
        "submissions",
        "syllabus",
        "calendar",
      ];
      const people = [
        "employee-attendance",
        "employee-leave",
        "salary-structures",
        "bonuses",
        "reimbursements",
      ];
      const logistical = [
        "trips",
        "transport-attendance",
        "fuel",
        "vehicle-maintenance",
      ];
      const purchasing = [
        "purchase-requests",
        "vendors",
        "inventory",
        "assets",
      ];
      const communications = ["notification-templates"];
      if (["accounts", "guardians"].includes(key)) allow(["Super Admin"]);
      else if (academic.includes(key)) allow(["Super Admin", "Faculty"]);
      else if (people.includes(key)) allow(hr);
      else if (logistical.includes(key)) allow([...transport, "Driver"]);
      else if (purchasing.includes(key)) allow(purchase);
      else if (communications.includes(key))
        allow(["Super Admin", "Principal"]);
      else throw Error("Unsupported record collection.");
      const extra: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(d))
        if (
          ![
            "collection",
            "name",
            "id",
            "status",
            "received",
            "paid",
            "resetRequired",
            "studentIds",
          ].includes(k)
        )
          extra[k] = v.slice(0, k === "attachmentFile" ? 300000 : 5000);
      for (const k of [
        "amount",
        "basic",
        "allowances",
        "deductions",
        "unpaidRate",
        "unitCost",
        "additionalCharges",
      ])
        if (d[k] !== undefined) extra[k] = moneyInput(d[k], k !== "amount");
      if (d.gstRate !== undefined) {
        const rate = Number(d.gstRate);
        if (
          !Number.isFinite(rate) ||
          rate < 0 ||
          rate > 100 ||
          Math.abs(rate * 100 - Math.round(rate * 100)) > 1e-8
        )
          throw Error(
            "Choose a GST rate between 0 and 100 with up to two decimals.",
          );
        extra.gstRate = rate;
      }
      if (
        d.taxMode &&
        !["No GST", "Intra-state", "Inter-state"].includes(d.taxMode)
      )
        throw Error("Choose a valid tax mode.");
      for (const k of ["quantity", "minimum", "maxMarks"])
        if (d[k] !== undefined)
          extra[k] = integer(d[k], k === "minimum" ? 0 : 1);
      if (
        d.employeeId &&
        !s.staff.some((x) => x.id === d.employeeId && x.status === "Active")
      )
        throw Error("Employee not found.");
      if (d.studentId && !s.students.some((x) => x.id === d.studentId))
        throw Error("Student not found.");
      if (d.busId && !o.buses.some((x) => x.id === d.busId))
        throw Error("Bus not found.");
      if (d.vendorId && !rows("vendors").some((x) => x.id === d.vendorId))
        throw Error("Vendor not found.");
      if (d.itemId && !rows("inventory").some((x) => x.id === d.itemId))
        throw Error("Inventory item not found.");
      for (const k of ["date", "start", "end", "due"])
        if (d[k] && k !== "start" && k !== "end" && !validDate(d[k]))
          throw Error("Choose a valid date.");
      if (key === "employee-leave") {
        if (!validDate(d.start) || !validDate(d.end) || d.end < d.start)
          throw Error("Leave end must follow start.");
        if (
          rows(key).some(
            (x) =>
              x.id !== cmd.id &&
              x.employeeId === d.employeeId &&
              x.status !== "Rejected" &&
              String(x.start) <= d.end &&
              String(x.end) >= d.start,
          )
        )
          throw Error("Leave dates overlap an existing request.");
      }
      if (key === "guardians") {
        const ids = JSON.parse(d.studentIds || "[]") as string[];
        if (
          !Array.isArray(ids) ||
          !ids.length ||
          ids.some((id) => !s.students.some((st) => st.id === id))
        )
          throw Error("Link at least one student from this institution.");
        extra.studentIds = JSON.stringify(Array.from(new Set(ids)));
      }
      if (key === "accounts") {
        if (
          ![
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
          ].includes(d.role)
        )
          throw Error("Choose a supported role.");
        if (rows(key).some((x) => x.id !== cmd.id && x.username === d.username))
          throw Error("Username already exists.");
        if (d.role === "Parent") {
          const g = find("guardians", d.personId);
          extra.studentIds = g.studentIds;
        } else if (d.role === "Student") person(d.personId, "Student");
        else if (!s.staff.some((x) => x.id === d.personId))
          throw Error("Link an employee from this institution.");
        extra.resetRequired = "Yes";
      }
      if (key === "timetable") {
        if (
          d.studyYear !== undefined &&
          (!/^\d+$/.test(d.studyYear) ||
            Number(d.studyYear) < 1 ||
            Number(d.studyYear) > 8)
        )
          throw Error("Choose a year of study from 1 to 8.");
        if (
          d.semester !== undefined &&
          (!/^\d+$/.test(d.semester) ||
            Number(d.semester) < 1 ||
            Number(d.semester) > 16)
        )
          throw Error("Choose a semester from 1 to 16.");
      }
      if (key === "timetable" && d.saveAsDraft !== "Yes")
        validateTimetableSession(d, rows(key), cmd.id);
      if (
        ["attendance", "employee-attendance", "transport-attendance"].includes(
          key,
        )
      ) {
        const identity =
          key === "attendance"
            ? "studentId"
            : key === "employee-attendance"
              ? "employeeId"
              : "allocationId";
        const duplicate = rows(key).find(
          (x) =>
            x.id !== cmd.id &&
            x[identity] === d[identity] &&
            x.date === d.date &&
            (key !== "attendance" || x.subject === d.subject) &&
            (key !== "transport-attendance" || x.tripId === d.tripId),
        );
        if (duplicate)
          throw Error(
            "Attendance is already recorded. Edit the existing record with a correction reason.",
          );
        if (
          key === "transport-attendance" &&
          (!o.passengers.some((p) => p.id === d.allocationId) ||
            !rows("trips").some(
              (t) =>
                t.id === d.tripId &&
                t.busId ===
                  o.passengers.find((p) => p.id === d.allocationId)?.busId,
            ))
        )
          throw Error("Select a passenger and trip on the same bus.");
      }
      if (key === "trips") {
        const b = o.buses.find((x) => x.id === d.busId);
        if (!b || b.status !== "Active" || !b.driverId)
          throw Error("Choose an active bus with an assigned driver.");
        if (!d.start || !d.end || d.end <= d.start)
          throw Error("Trip arrival must follow departure.");
        if (
          rows(key).some(
            (x) =>
              x.id !== cmd.id &&
              x.date === d.date &&
              x.status !== "Cancelled" &&
              String(x.start) < d.end &&
              String(x.end) > d.start &&
              (x.busId === b.id || x.driverId === b.driverId),
          )
        )
          throw Error("Bus or driver has an overlapping trip.");
        extra.driverId = b.driverId;
        extra.routeId = b.routeId;
      }
      if (cmd.role === "Faculty") {
        const self = s.staff.find(
          (x) => x.category === "Faculty" && x.status === "Active",
        );
        const programs = new Set(
          rows("timetable")
            .filter((x) => x.employeeId === self?.id)
            .map((x) => x.program),
        );
        if (d.employeeId && d.employeeId !== self?.id)
          throw Error("This is another teacher’s record.");
        if (d.program && !programs.has(d.program))
          throw Error("Choose one of your assigned classes.");
        if (
          d.studentId &&
          !programs.has(
            s.students.find((x) => x.id === d.studentId)?.program || "",
          )
        )
          throw Error("This student is not in your assigned classes.");
      }
      const old = cmd.id ? find(key) : undefined;
      if (
        old &&
        key === "inventory" &&
        Number(d.quantity) !== Number(old.quantity)
      )
        throw Error("Use Stock movement to change quantities with a reason.");
      if (old && ["Paid", "Included in Payroll"].includes(old.status))
        throw Error("Finalized records cannot be edited.");
      const status =
        (d.saveAsDraft === "Yes" && ["timetable", "assignments"].includes(key)
          ? "Draft"
          : old?.status) ||
        (["bonuses", "reimbursements", "purchase-requests"].includes(key)
          ? "Submitted"
          : key === "employee-leave"
            ? "Requested"
            : key === "assignments"
              ? "Published"
              : key === "assessments"
                ? "Scheduled"
                : key === "trips"
                  ? "Scheduled"
                  : "Active");
      const r = old || newRow(required(d.name, "Name"), status);
      Object.assign(r, extra, { name: required(d.name, "Name") });
      if (!old) rows(key).unshift(r);
      if (key === "assignments" && r.status !== "Draft")
        s.students
          .filter((x) => x.program === r.program)
          .forEach((st) => notify(`Assignment published: ${r.name}`, st.id));
      if (key === "timetable" && r.status !== "Draft" && r.employeeId)
        notify(
          `Timetable updated: ${r.name}`,
          undefined,
          String(
            rows("accounts").find((a) => a.personId === r.employeeId)?.id ||
              "EMPLOYEE:" + r.employeeId,
          ),
        );
      if (key === "timetable" && r.status !== "Draft")
        s.students
          .filter((x) => x.program === r.program)
          .forEach((st) => notify(`Timetable updated: ${r.name}`, st.id));
      if (
        ["fuel", "vehicle-maintenance"].includes(key) &&
        Number(r.amount) > 0
      ) {
        const linked = s.expenses.find((e) => e.reference === r.id);
        if (linked) {
          if (
            ["Approved", "Paid"].includes(linked.status) &&
            linked.amount !== Number(r.amount)
          )
            throw Error("Finalized expense amounts cannot be edited.");
          linked.name = r.name;
          linked.amount = Number(r.amount);
        } else
          financial(
            r.name,
            Number(r.amount),
            r.id,
            key === "fuel" ? "Fuel" : "Vehicle Maintenance",
            "Submitted",
          );
      }
      break;
    }
    case "ops.record.status": {
      const key = required(d.collection, "Collection"),
        r = find(key),
        status = d.status;
      const academic = ["assignments", "assessments", "timetable"];
      if (cmd.role === "Faculty" && academic.includes(key)) {
        const self = s.staff.find(
          (e) => e.category === "Faculty" && e.status === "Active",
        );
        if (r.employeeId && r.employeeId !== self?.id)
          throw Error("This is another teacher’s record.");
      }
      if (["accounts", "guardians"].includes(key)) allow(["Super Admin"]);
      else if (["employee-leave", "bonuses", "reimbursements"].includes(key))
        allow(hr);
      else if (["purchase-requests", "assets"].includes(key)) allow(purchase);
      else if (academic.includes(key)) allow(["Super Admin", "Faculty"]);
      else if (key === "trips") allow([...transport, "Driver"]);
      else throw Error("Unsupported status transition.");
      const transitions: Record<string, string[]> = {
        Submitted: ["Approved", "Rejected"],
        Requested: ["Approved", "Rejected"],
        Approved: ["Rejected"],
        Active: ["Inactive", "Maintenance", "Retired", "Completed"],
        Inactive: ["Active"],
        Maintenance: ["Active"],
        Scheduled: ["Ready", "Cancelled", "Published"],
        Ready: ["Departed", "Cancelled"],
        Departed: ["In Progress (Demo)", "Arrived"],
        "In Progress (Demo)": ["Arrived"],
        Arrived: ["Completed"],
        Draft: ["Active", "Published"],
        Published: ["Closed"],
        Calculated: ["Approved"],
      };
      if (key === "timetable" && ["Inactive", "Cancelled"].includes(status))
        s.students
          .filter((st) => sessionForStudent(r, st))
          .forEach((st) =>
            notify(`Timetable session cancelled: ${r.name}`, st.id),
          );
      if (r.status === "Draft" && key === "timetable" && status === "Active") {
        validateTimetableSession(
          Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)])),
          rows(key),
          r.id,
        );
        s.students
          .filter((st) => sessionForStudent(r, st))
          .forEach((st) => notify(`Timetable published: ${r.name}`, st.id));
      }
      if (
        key === "assignments" &&
        r.status === "Draft" &&
        status === "Published"
      )
        s.students
          .filter((st) => st.program === r.program)
          .forEach((st) => notify(`Assignment published: ${r.name}`, st.id));
      if (!transitions[r.status]?.includes(status))
        throw Error("This status transition is not allowed.");
      if (
        key === "employee-leave" &&
        status === "Approved" &&
        rows("payroll").some(
          (x) =>
            x.employeeId === r.employeeId &&
            ["Approved", "Paid"].includes(x.status) &&
            String(x.period) >= String(r.start).slice(0, 7) &&
            String(x.period) <= String(r.end).slice(0, 7),
        )
      )
        throw Error(
          "Leave overlaps finalized payroll. Use a later authorized adjustment.",
        );
      if (
        ["bonuses", "reimbursements"].includes(key) &&
        rows("payroll").some(
          (p) =>
            ["Approved", "Paid"].includes(p.status) &&
            (JSON.parse(String(p.extraIds || "[]")) as string[]).includes(r.id),
        )
      )
        throw Error(
          "This item is included in finalized payroll. Use a later adjustment.",
        );
      if (key === "trips" && status === "Ready") {
        const b = o.buses.find((x) => x.id === r.busId);
        if (!b || b.status !== "Active")
          throw Error("The assigned bus is unavailable.");
        if (
          rows("employee-leave").some(
            (l) =>
              l.employeeId === r.driverId &&
              l.status === "Approved" &&
              String(l.start) <= r.date &&
              String(l.end) >= r.date,
          )
        )
          throw Error("The assigned driver is on approved leave.");
      }
      r.status = status;
      if (key === "timetable" && status === "Completed") r.completedAt = now;
      break;
    }
    default:
      throw Error("Unknown college operation.");
  }
  s.audit.unshift({
    id: uid("AUD"),
    name: cmd.type,
    status: "Recorded",
    date: now,
    actor: cmd.role,
    reference: cmd.id,
    note: JSON.stringify({
      ...d,
      message: d.message ? "[message recorded in campaign]" : undefined,
    }),
  });
  return s;
}
export const preciseMoney = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
export function visibleNotices(s: CollegeState, role: string | null) {
  if (!role) return [];
  if (!["Parent", "Student", "Faculty"].includes(role)) return s.notifications;
  const account = opRows(s, "accounts").find(
    (a) =>
      a.status === "Active" &&
      (role === "Parent"
        ? a.role === "Parent"
        : a.role === role &&
          a.personId ===
            (role === "Student"
              ? s.students[0]?.id
              : s.staff.find(
                  (e) => e.category === "Faculty" && e.status === "Active",
                )?.id)),
  );
  const studentIds =
    role === "Parent"
      ? (JSON.parse(String(account?.studentIds || "[]")) as string[])
      : role === "Student"
        ? [s.students[0]?.id]
        : [];
  return s.notifications.filter((n) =>
    n.reference
      ? n.reference === account?.id
      : n.studentId
        ? studentIds.includes(n.studentId)
        : true,
  );
}
