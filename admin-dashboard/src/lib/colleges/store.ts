import {
  ensureOperations,
  executeOperation,
  type Operations,
} from "./operations";
import {
  feeTotals,
  type FeeComponent,
  type TaxMode,
  type InstitutionDetails,
} from "./fees";
import { MockPaymentProvider, MockSMSProvider } from "./adapters";
import { collegeBySlug, type Role, permissions } from "@/data/colleges";
export type StudentProfile = {
  academicYear?: string;
  studyYear?: string;
  branch?: string;
  specialization?: string;
  semester?: string;
  section?: string;
  batch?: string;
  photo?: string;
  dob?: string;
  gender?: string;
  nationality?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  guardianPhone?: string;
  relationship?: string;
  emergencyContact?: string;
  previousSchool?: string;
  qualification?: string;
  remarks?: string;
};
export type Student = {
  profile?: StudentProfile;
  id: string;
  name: string;
  program: string;
  department: string;
  year: string;
  date: string;
  fee: number;
  scholarship: number;
  status: string;
  email: string;
  guardian: string;
};
export type RecordRow = {
  profile?: StudentProfile;
  email?: string;
  guardian?: string;
  paidBy?: string;
  paymentTax?: {
    mode: TaxMode;
    rate: number;
    base: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
  };
  components?: FeeComponent[];
  taxMode?: TaxMode;
  terms?: string;
  id: string;
  name: string;
  status: string;
  date: string;
  studentId?: string;
  amount?: number;
  program?: string;
  source?: string;
  method?: string;
  category?: string;
  note?: string;
  reference?: string;
  downloads?: number;
  version?: number;
  room?: string;
  capacity?: number;
  departure?: string;
  expectedReturn?: string;
  pickup?: string;
  relationship?: string;
  actor?: string;
  approvedAt?: string;
  actualReturn?: string;
  contact?: string;
};
export type CollegeState = {
  operations?: Operations;
  institution?: InstitutionDetails;
  version: 1;
  slug: string;
  students: Student[];
  applications: RecordRow[];
  payments: RecordRow[];
  expenses: RecordRow[];
  invoices: RecordRow[];
  scholarships: RecordRow[];
  certificates: RecordRow[];
  rooms: RecordRow[];
  allocations: RecordRow[];
  leaves: RecordRow[];
  staff: RecordRow[];
  notifications: RecordRow[];
  audit: RecordRow[];
  structures: RecordRow[];
};
const date = "2026-10-18";
const first = [
  "Aishwarya",
  "Rahul",
  "Kavya",
  "Nikhil",
  "Meera",
  "Arjun",
  "Priya",
  "Sanjay",
  "Ananya",
  "Rohan",
  "Diya",
  "Vikram",
  "Ishita",
  "Aditya",
  "Sana",
  "Dev",
];
const last = [
  "Sharma",
  "Reddy",
  "Patel",
  "Rao",
  "Nair",
  "Singh",
  "Verma",
  "Das",
  "Iyer",
  "Shah",
  "Kumar",
  "Joshi",
  "Menon",
];
function baseSeed(slug: string): CollegeState {
  const c = collegeBySlug(slug)!;
  const prefix = c.number;
  const students: Student[] = Array.from({ length: 600 }, (_, i) => {
    const p = c.programs[i % c.programs.length];
    return {
      id: `${prefix}-S${String(i + 1).padStart(4, "0")}`,
      name: `${first[i % 16]} ${last[Math.floor(i / 16) % 13]}`,
      program: p.name,
      department: p.department,
      profile: {
        academicYear: "2026-2027",
        studyYear: String((Math.floor(i / (c.programs.length * 2)) % 3) + 1),
        branch: p.name,
        specialization: p.specialization || "General",
        semester: String((Math.floor(i / (c.programs.length * 2)) % 3) * 2 + 1),
        section: Math.floor(i / c.programs.length) % 2 === 0 ? "A" : "B",
        batch: "Main",
      },
      year: `${2024 + (i % 3)}-${2025 + (i % 3)}`,
      date: `2026-0${(i % 9) + 1}-${String((i % 27) + 1).padStart(2, "0")}`,
      fee: p.fee,
      scholarship: i % 9 === 0 ? 500000 : 0,
      status: i > 0 && i % 37 === 0 ? "Graduated" : "Active",
      email: `student${i + 1}@${slug}.example`,
      guardian: `${last[i % 13]} (fictional guardian)`,
    };
  });
  const payments = students
    .filter((_, i) => i % 4 !== 0)
    .map((s, i) => ({
      id: `${prefix}-REC${i + 1}`,
      studentId: s.id,
      name: s.name,
      status: "Completed",
      date: `2026-${String((i % 9) + 1).padStart(2, "0")}-15`,
      amount: Math.floor((s.fee - s.scholarship) / 2),
      method: ["Cash", "UPI demo", "Bank Transfer demo"][i % 3],
      category: i % 5 ? "Tuition Fee" : "University Fee",
    }));
  const row = (i: number, name: string, status = "Pending"): RecordRow => ({
    id: `${prefix}-${name.slice(0, 3).toUpperCase()}${i + 1}`,
    name,
    status,
    date,
  });
  return {
    version: 1,
    slug,
    students,
    payments,
    applications: Array.from({ length: 120 }, (_, i) => ({
      ...row(i, `${first[i % 16]} ${last[i % 13]}`),
      id: `${prefix}-APP${i + 1}`,
      program: c.programs[i % c.programs.length].name,
      source: [
        "Website",
        "Walk-in",
        "Social Media",
        "Referral",
        "Campaign",
        "Education Fair",
        "Other",
      ][i % 7],
      status: i % 4 === 0 ? "Verification" : "Application",
      note: "Fictional application. Documents awaiting review.",
    })),
    expenses: Array.from({ length: 15 }, (_, i) => ({
      ...row(
        i,
        [
          "Library supplies",
          "Laboratory equipment",
          "Hostel utilities",
          "Staff salaries",
          "University remittance",
        ][i % 5],
        i % 3 === 0 ? "Paid" : "Submitted",
      ),
      amount: (i + 1) * 150000,
      category: ["Library", "Laboratory", "Hostel", "Salary", "External"][
        i % 5
      ],
      method: "Bank Transfer demo",
    })),
    invoices: [
      {
        ...row(0, "Academic equipment supplier"),
        amount: 4500000,
        reference: "DEMO-INV-001",
      },
    ],
    scholarships: [],
    certificates: [
      {
        ...row(0, "Bonafide Certificate", "Issued"),
        id: `${prefix}-CERT1`,
        studentId: students[0].id,
        reference: `${prefix}-CERT1`,
        downloads: 0,
        version: 1,
      },
      {
        ...row(1, "Study Certificate"),
        id: `${prefix}-CERT2`,
        studentId: students[1].id,
        downloads: 0,
        version: 1,
      },
    ],
    rooms: Array.from({ length: 24 }, (_, i) => ({
      ...row(i, `Block ${i < 12 ? "A" : "B"} / ${(i % 12) + 101}`, "Available"),
      id: `${prefix}-ROOM${i + 1}`,
      capacity: 4,
      note: "Warden: S. Rao",
    })),
    allocations: students.slice(0, 72).map((s, i) => ({
      ...row(i, s.name, "Allocated"),
      id: `${prefix}-BED${i + 1}`,
      studentId: s.id,
      room: `${prefix}-ROOM${Math.floor(i / 3) + 1}`,
    })),
    leaves: [
      {
        ...row(0, "Family visit"),
        id: `${prefix}-LEAVE1`,
        studentId: students[0].id,
        departure: "2026-10-20",
        expectedReturn: "2026-10-22",
        pickup: "Fictional guardian",
        relationship: "Parent",
        contact: "DEMO-CONTACT",
      },
    ],
    staff: Array.from({ length: 128 }, (_, i) => ({
      ...row(i, `Dr. ${first[i % 16]} ${last[i % 13]}`, "Active"),
      note: c.programs[i % c.programs.length].department,
      category:
        i >= 120 ? "Driver" : i % 4 === 0 ? "Admission Officer" : "Faculty",
    })),
    notifications: [
      {
        ...row(0, "Welcome to the campus portal", "Simulated"),
        note: "Explore your academic journey. Fictional data only.",
      },
    ],
    audit: [
      { ...row(0, "Demo dataset initialized", "Recorded"), actor: "System" },
    ],
    structures: c.programs.map((p, i) => ({
      ...row(i, p.name, "Active"),
      amount: p.fee,
      category: "Internal + external",
      note: "Tuition, admission, library, stationery, laboratory, hostel, transport, university, examination and other fees.",
    })),
  };
}
export const seed = (slug: string): CollegeState =>
  ensureOperations(baseSeed(slug));
export const paid = (s: CollegeState, id: string) =>
  s.payments
    .filter((p) => p.studentId === id && p.status === "Completed")
    .reduce((n, p) => n + (p.amount || 0), 0);
export const balance = (s: CollegeState, student: Student) =>
  Math.max(0, student.fee - student.scholarship - paid(s, student.id));
export type Command = {
  type: string;
  data?: Record<string, string>;
  id?: string;
  role: Role;
};
export function execute(s: CollegeState, cmd: Command): CollegeState {
  if (cmd.type.startsWith("ops.")) return executeOperation(s, cmd);
  const d = cmd.data || {},
    role = cmd.role,
    now = new Date().toISOString(),
    next = structuredClone(s),
    uid = (tag: string) =>
      `${s.slug.startsWith("edu") ? "21" : "22"}-${tag}-${crypto.randomUUID().slice(0, 12)}`;
  const requireRole = (allowed: Role[]) => {
    if (!allowed.includes(role))
      throw Error("This demo role cannot perform this action.");
  };
  const amount = () => {
    const n = Math.round(Number(d.amount) * 100);
    if (!Number.isSafeInteger(n) || n <= 0)
      throw Error("Enter a positive amount.");
    return n;
  };
  const student = () => {
    const st = next.students.find((x) => x.id === (d.studentId || cmd.id));
    if (!st) throw Error("Student not found in this institution.");
    if (
      role === "Student" &&
      st.id !== `${collegeBySlug(s.slug)!.number}-S0001`
    )
      throw Error("You can only access your own records.");
    return st;
  };
  const base = (name: string, status = "Pending"): RecordRow => ({
    id: uid("R"),
    name,
    status,
    date: now.slice(0, 10),
    actor: role,
  });
  const notify = (name: string, studentId?: string) =>
    next.notifications.unshift({
      ...base(name, "Simulated"),
      studentId,
      note: "Demo notification. No real message was sent.",
    });
  const profile = (): StudentProfile => {
    const result: Record<string, string> = {};
    for (const key of [
      "academicYear",
      "studyYear",
      "branch",
      "specialization",
      "semester",
      "section",
      "batch",
      "photo",
      "dob",
      "gender",
      "nationality",
      "phone",
      "address",
      "city",
      "state",
      "postalCode",
      "guardianPhone",
      "relationship",
      "emergencyContact",
      "previousSchool",
      "qualification",
      "remarks",
    ])
      if (d[key] !== undefined)
        result[key] = d[key].trim().slice(0, key === "photo" ? 250000 : 1200);
    if (
      result.photo &&
      (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(
        result.photo,
      ) ||
        d.photo.length > 250000)
    )
      throw Error("Upload a valid PNG, JPG, or WebP student photo.");
    if (
      result.studyYear &&
      (!/^\d+$/.test(result.studyYear) ||
        Number(result.studyYear) < 1 ||
        Number(result.studyYear) > 8)
    )
      throw Error("Choose a year of study from 1 to 8.");
    if (
      result.semester &&
      (!/^\d+$/.test(result.semester) ||
        Number(result.semester) < 1 ||
        Number(result.semester) > 16)
    )
      throw Error("Choose a semester from 1 to 16.");
    if (result.dob && !/^\d{4}-\d{2}-\d{2}$/.test(result.dob))
      throw Error("Choose a valid date of birth.");
    return result;
  };
  switch (cmd.type) {
    case "student.save": {
      requireRole(["Super Admin", "Admission Officer"]);
      if (!d.name?.trim()) throw Error("Student name is required.");
      if (d.year && !["2024-2025", "2025-2026", "2026-2027"].includes(d.year))
        throw Error("Choose a valid academic year.");
      if (
        d.program &&
        !collegeBySlug(s.slug)!.programs.some((p) => p.name === d.program)
      )
        throw Error("Choose a program offered by this institution.");
      if (cmd.id) {
        const st = student();
        Object.assign(st, {
          name: d.name,
          email: d.email || st.email,
          program: d.program || st.program,
          status: d.status || st.status,
          guardian: d.guardian ?? st.guardian,
          year: d.year || st.year,
          profile: { ...st.profile, ...profile() },
        });
        st.department = collegeBySlug(s.slug)!.programs.find(
          (p) => p.name === st.program,
        )!.department;
      } else {
        const p =
          collegeBySlug(s.slug)!.programs.find((p) => p.name === d.program) ||
          collegeBySlug(s.slug)!.programs[0];
        next.students.unshift({
          id: uid("S"),
          name: d.name,
          program: p.name,
          department: p.department,
          fee:
            next.structures.find((row) => row.name === p.name)?.amount ?? p.fee,
          scholarship: 0,
          year: d.year || "2026-2027",
          profile: profile(),
          date: now.slice(0, 10),
          status: "Active",
          email: d.email || "demo@student.example",
          guardian: d.guardian || "Demo guardian",
        });
      }
      break;
    }
    case "student.archive":
      requireRole(["Super Admin", "Admission Officer"]);
      student().status = "Relieved";
      break;
    case "admission.create":
      if (!d.name?.trim() || !d.email?.includes("@"))
        throw Error("Enter a name and valid demo email.");
      next.applications.unshift({
        ...base(d.name, "Application"),
        id: uid("APP"),
        program: d.program,
        source: d.source || "Website",
        email: d.email,
        guardian: d.guardian,
        profile: profile(),
        note: `${d.email}; ${d.guardian || "Guardian pending"}; ${d.note || ""}`,
      });
      break;
    case "admission.edit": {
      requireRole(["Super Admin", "Admission Officer"]);
      const app = next.applications.find((a) => a.id === cmd.id);
      if (!app || app.status === "Enrolled")
        throw Error("Only unenrolled applications can be edited.");
      if (!d.name) throw Error("Applicant name is required.");
      Object.assign(app, {
        name: d.name,
        program: d.program || app.program,
        source: d.source || app.source,
        note: d.note || app.note,
        email: d.email || app.email,
        guardian: d.guardian ?? app.guardian,
        profile: { ...app.profile, ...profile() },
      });
      break;
    }
    case "admission.status": {
      requireRole(["Super Admin", "Principal", "Admission Officer"]);
      const a = next.applications.find((x) => x.id === cmd.id);
      if (!a) throw Error("Application not found.");
      if (a.status === "Enrolled") throw Error("Application already enrolled.");
      a.status = d.status;
      if (d.status === "Enrolled") {
        const p = collegeBySlug(s.slug)!.programs.find(
          (p) => p.name === a.program,
        )!;
        next.students.unshift({
          id: uid("S"),
          name: a.name,
          program: p.name,
          department: p.department,
          year: "2026-2027",
          date: now.slice(0, 10),
          fee:
            next.structures.find((row) => row.name === p.name)?.amount ?? p.fee,
          scholarship: 0,
          status: "Active",
          email: a.email || "admitted@demo.example",
          guardian: a.guardian || "Demo guardian",
          profile: a.profile,
        });
      }
      notify(`Admission ${a.status}: ${a.name}`);
      break;
    }
    case "payment": {
      requireRole(["Super Admin", "Accounts Manager", "Student", "Parent"]);
      if (role === "Student" && d.studentId !== s.students[0]?.id)
        throw Error("This is another student's fee account.");
      if (
        role === "Student" &&
        !s.operations?.records.accounts?.some(
          (a) =>
            a.role === "Student" &&
            a.personId === d.studentId &&
            a.canPayFees === "Yes",
        )
      )
        throw Error(
          "Student payment permission has not been enabled by an administrator.",
        );
      if (role === "Parent") {
        const account = s.operations?.records.accounts?.find(
          (a) => a.role === "Parent" && a.status === "Active",
        );
        const linked = JSON.parse(
          String(account?.studentIds || "[]"),
        ) as string[];
        if (!linked.includes(d.studentId))
          throw Error(
            "This student is not linked to your demo parent account.",
          );
      }
      const st = student(),
        n = amount();
      if (n > balance(next, st))
        throw Error("Payment exceeds the outstanding balance.");
      new MockPaymentProvider().confirm({
        amount: n,
        reference: d.reference,
        outcome: d.outcome,
      });
      if (
        !d.reference ||
        next.payments.some((p) => p.reference === d.reference)
      )
        throw Error("This payment has already been recorded.");
      const mode = (d.paymentTaxMode || "not-configured") as TaxMode;
      if (
        !["not-configured", "no-tax", "intra-state", "inter-state"].includes(
          mode,
        )
      )
        throw Error("Select a valid payment GST treatment.");
      const rate = Number(d.paymentGstRate || 0);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100)
        throw Error("Enter a GST percentage between 0 and 100.");
      const baseAmount = ["intra-state", "inter-state"].includes(mode)
        ? Math.round(n / (1 + rate / 100))
        : n;
      const tax = n - baseAmount,
        cgst = mode === "intra-state" ? Math.floor(tax / 2) : 0;
      if (d.paymentDate && !/^\d{4}-\d{2}-\d{2}$/.test(d.paymentDate))
        throw Error("Choose a valid payment date.");
      next.payments.unshift({
        ...base(st.name, "Completed"),
        id: uid("REC"),
        studentId: st.id,
        amount: n,
        method: d.method,
        category: d.category || "Tuition Fee",
        reference: d.reference,
        date: d.paymentDate || now.slice(0, 10),
        paidBy: d.paidBy || undefined,
        note: d.note || undefined,
        paymentTax:
          mode === "not-configured"
            ? undefined
            : {
                mode,
                rate,
                base: baseAmount,
                cgst,
                sgst: mode === "intra-state" ? tax - cgst : 0,
                igst: mode === "inter-state" ? tax : 0,
                total: n,
              },
      });
      notify(`Payment receipt for ${st.name}`, st.id);
      break;
    }
    case "certificate.request": {
      requireRole([
        "Super Admin",
        "Principal",
        "Certificate Officer",
        "Student",
      ]);
      const st = student();
      if (!d.name || !d.note)
        throw Error("Choose a certificate and enter its purpose.");
      next.certificates.unshift({
        ...base(d.name),
        id: uid("CERT"),
        studentId: st.id,
        note: d.note,
        downloads: 0,
        version: 1,
      });
      break;
    }
    case "certificate.status": {
      requireRole(["Super Admin", "Principal", "Certificate Officer"]);
      const c = next.certificates.find((x) => x.id === cmd.id);
      if (!c) throw Error("Certificate not found.");
      if (c.status === "Issued") throw Error("Certificate already issued.");
      if (
        d.status === "Issued" &&
        !next.students.some(
          (x) =>
            x.id === c.studentId && ["Active", "Graduated"].includes(x.status),
        )
      )
        throw Error("Student is not eligible.");
      c.status = d.status;
      c.note = d.note || c.note;
      c.reference = c.id;
      c.approvedAt = now;
      c.actor = role;
      notify(`Certificate ${c.status}`, c.studentId);
      break;
    }
    case "certificate.download": {
      const c = next.certificates.find((x) => x.id === cmd.id);
      if (!c || c.status !== "Issued")
        throw Error("Only issued certificates can be downloaded.");
      if (
        role === "Student" &&
        c.studentId !== `${collegeBySlug(s.slug)!.number}-S0001`
      )
        throw Error("Access denied.");
      c.downloads = (c.downloads || 0) + 1;
      break;
    }
    case "room.create":
      requireRole(["Super Admin", "Hostel Warden"]);
      if (
        !d.name ||
        !Number.isInteger(Number(d.capacity)) ||
        Number(d.capacity) < 1 ||
        Number(d.capacity) > 20
      )
        throw Error("Enter a room name and capacity from 1 to 20.");
      next.rooms.push({
        ...base(d.name, "Available"),
        id: uid("ROOM"),
        capacity: Number(d.capacity),
      });
      break;
    case "room.update": {
      requireRole(["Super Admin", "Hostel Warden"]);
      const room = next.rooms.find((r) => r.id === cmd.id);
      if (!room) throw Error("Room not found.");
      const occupied = next.allocations.filter(
          (a) => a.room === room.id && a.status === "Allocated",
        ).length,
        capacity = Number(d.capacity);
      if (
        !Number.isInteger(capacity) ||
        capacity < occupied ||
        capacity < 1 ||
        capacity > 20
      )
        throw Error(
          "Capacity must fit current occupants and remain between 1 and 20.",
        );
      if (d.status === "Archived" && occupied)
        throw Error("Release current bed allocations before archiving a room.");
      Object.assign(room, {
        name: d.name || room.name,
        capacity,
        status: d.status || room.status,
        note: d.note || room.note,
      });
      break;
    }
    case "room.allocate": {
      requireRole(["Super Admin", "Hostel Warden"]);
      const st = student(),
        r = next.rooms.find((x) => x.id === d.room);
      if (!r || r.status === "Archived")
        throw Error("Choose an available room.");
      if (
        next.allocations.some(
          (x) => x.studentId === st.id && x.status === "Allocated",
        )
      )
        throw Error("Student already has an active bed.");
      if (
        next.allocations.filter(
          (x) => x.room === r.id && x.status === "Allocated",
        ).length >= (r.capacity || 0)
      )
        throw Error("Room is full.");
      next.allocations.push({
        ...base(st.name, "Allocated"),
        studentId: st.id,
        room: r.id,
      });
      break;
    }
    case "room.release":
      requireRole(["Super Admin", "Hostel Warden"]);
      {
        const a = next.allocations.find((x) => x.id === cmd.id);
        if (a) a.status = "Released";
      }
      break;
    case "leave.request": {
      requireRole(["Super Admin", "Hostel Warden", "Student"]);
      const st = student();
      if (
        !next.allocations.some(
          (x) => x.studentId === st.id && x.status === "Allocated",
        )
      )
        throw Error("Only allocated hostel students can request leave.");
      if (
        !d.departure ||
        !d.expectedReturn ||
        d.expectedReturn < d.departure ||
        !d.pickup ||
        !d.relationship
      )
        throw Error("Provide valid dates and pickup details.");
      next.leaves.unshift({
        ...base(d.name || "Home permission"),
        studentId: st.id,
        departure: d.departure,
        expectedReturn: d.expectedReturn,
        pickup: d.pickup,
        relationship: d.relationship,
        contact: d.contact,
      });
      break;
    }
    case "leave.status": {
      requireRole(["Super Admin", "Hostel Warden"]);
      const l = next.leaves.find((x) => x.id === cmd.id);
      if (!l) throw Error("Request not found.");
      const transitions: Record<string, string[]> = {
        Pending: ["Under Review", "Approved", "Rejected"],
        "Under Review": ["Approved", "Rejected"],
        Approved: ["Checked Out"],
        "Checked Out": ["Returned"],
      };
      if (!transitions[l.status]?.includes(d.status))
        throw Error("Invalid permission transition.");
      l.status = d.status;
      l.actor = role;
      l.approvedAt = now;
      if (d.status === "Returned") l.actualReturn = now;
      notify(`Hostel permission ${l.status}`, l.studentId);
      break;
    }
    case "expense.edit":
    case "invoice.edit": {
      requireRole(["Super Admin", "Accounts Manager"]);
      const entry = (
        cmd.type === "expense.edit" ? next.expenses : next.invoices
      ).find((e) => e.id === cmd.id);
      if (!entry || entry.status !== "Draft")
        throw Error("Only draft entries can be edited.");
      if (!d.name) throw Error("Payee required.");
      Object.assign(entry, {
        name: d.name,
        amount: amount(),
        category: d.category || entry.category,
        note: d.note || entry.note,
      });
      break;
    }
    case "expense.create":
    case "invoice.create": {
      requireRole(["Super Admin", "Accounts Manager"]);
      const list =
        cmd.type === "expense.create" ? next.expenses : next.invoices;
      if (!d.name) throw Error("Payee is required.");
      list.unshift({
        ...base(d.name, "Draft"),
        amount: amount(),
        category: d.category || "Operations",
        method: d.method || "Bank Transfer demo",
        note: d.note,
      });
      break;
    }
    case "expense.status":
    case "invoice.status": {
      requireRole(["Super Admin", "Principal", "Accounts Manager"]);
      const e = (
        cmd.type === "expense.status" ? next.expenses : next.invoices
      ).find((x) => x.id === cmd.id);
      if (!e) throw Error("Record not found.");
      const trans: Record<string, string[]> = {
        Draft: ["Submitted"],
        Pending: ["Submitted"],
        Submitted: ["Approved"],
        Approved: ["Paid"],
      };
      if (!trans[e.status]?.includes(d.status))
        throw Error("Invalid approval transition.");
      if (d.status === "Approved") requireRole(["Super Admin", "Principal"]);
      e.status = d.status;
      e.actor = role;
      break;
    }
    case "scholarship.create":
      requireRole(["Super Admin", "Accounts Manager"]);
      {
        const st = student();
        if (
          d.category === "Percentage" &&
          (!Number.isFinite(Number(d.amount)) ||
            Number(d.amount) <= 0 ||
            Number(d.amount) > 100)
        )
          throw Error("Percentage must be greater than zero and at most 100.");
        next.scholarships.push({
          ...base(d.name || "Merit"),
          studentId: st.id,
          amount:
            d.category === "Percentage"
              ? Math.round((st.fee * Number(d.amount)) / 100)
              : amount(),
          category: d.category || "Fixed amount",
          note: d.note,
        });
      }
      break;
    case "scholarship.approve": {
      requireRole(["Super Admin", "Principal"]);
      const r = next.scholarships.find((x) => x.id === cmd.id);
      if (!r || r.status !== "Pending") throw Error("No pending scholarship.");
      const st = next.students.find((x) => x.id === r.studentId)!;
      if ((r.amount || 0) > balance(next, st))
        throw Error("Scholarship exceeds unpaid fees.");
      st.scholarship += r.amount || 0;
      r.status = "Approved";
      r.actor = role;
      break;
    }
    case "staff.save":
      requireRole(["Super Admin"]);
      if (!d.name) throw Error("Name required.");
      {
        const st = next.staff.find((x) => x.id === cmd.id);
        if (st)
          Object.assign(st, {
            name: d.name,
            category: d.category,
            status: d.status || st.status,
          });
        else
          next.staff.push({
            ...base(d.name, "Active"),
            category: d.category || "Faculty",
          });
      }
      break;
    case "notification":
      requireRole([
        "Super Admin",
        "Principal",
        "Accounts Manager",
        "Admission Officer",
        "Certificate Officer",
        "Hostel Warden",
        "Faculty",
      ]);
      new MockSMSProvider().send({
        subject: d.name,
        message: d.note,
        scheduled: d.status === "Scheduled",
      });
      next.notifications.unshift({
        ...base(d.name, d.status || "Simulated"),
        studentId: d.studentId || undefined,
        note: d.note,
        expectedReturn: d.expectedReturn,
      });
      break;
    case "structure.save":
      requireRole(["Super Admin", "Accounts Manager"]);
      {
        const st = next.structures.find((x) => x.id === cmd.id);
        if (st) {
          if (d.components) {
            const components: unknown = JSON.parse(d.components);
            const mode = d.taxMode as TaxMode;
            if (
              ![
                "not-configured",
                "no-tax",
                "intra-state",
                "inter-state",
              ].includes(mode)
            )
              throw Error("Choose a valid GST treatment.");
            if (
              !Array.isArray(components) ||
              !components.length ||
              components.length > 40
            )
              throw Error("Provide between 1 and 40 fee components.");
            for (const line of components) {
              if (
                !line ||
                typeof line.id !== "string" ||
                typeof line.name !== "string" ||
                !line.name.trim() ||
                line.name.length > 100 ||
                !Number.isSafeInteger(line.amount) ||
                line.amount < 0 ||
                typeof line.gstRate !== "number" ||
                !Number.isFinite(line.gstRate) ||
                line.gstRate < 0 ||
                line.gstRate > 100 ||
                Math.abs(line.gstRate * 100 - Math.round(line.gstRate * 100)) >
                  0.000001
              )
                throw Error(
                  "Each fee head needs a name, a valid amount, and a GST percentage with at most two decimals.",
                );
            }
            if (
              new Set(components.map((line) => line.id)).size !==
              components.length
            )
              throw Error("Fee components need unique references.");
            const totals = feeTotals(components, mode);
            if (!Number.isSafeInteger(totals.total) || totals.total <= 0)
              throw Error("The fee structure total must be positive.");
            st.components = components.map((line) => ({
              ...line,
              name: line.name.trim(),
            }));
            st.taxMode = mode;
            st.amount = totals.total;
            st.terms = d.terms || "";
          } else {
            st.amount = amount();
            st.components = undefined;
            st.taxMode = "not-configured";
          }
          st.note = d.note || st.note;
        }
      }
      break;
    case "institution.save":
      requireRole(["Super Admin"]);
      next.institution = Object.fromEntries(
        [
          "address",
          "email",
          "phone",
          "website",
          "gstin",
          "registration",
          "state",
        ].map((key) => [key, (d[key] || "").trim().slice(0, 500)]),
      );
      break;
    case "fee.assign":
      requireRole(["Super Admin", "Accounts Manager"]);
      {
        const st = student(),
          n = amount();
        if (n < paid(next, st.id) + st.scholarship)
          throw Error("Assigned fee cannot be below payments and scholarship.");
        st.fee = n;
      }
      break;
    case "login":
      break;
    default:
      throw Error("Unknown operation.");
  }
  next.audit.unshift({
    id: uid("AUD"),
    name: cmd.type,
    status: "Recorded",
    date: now,
    actor: role,
    reference: cmd.id,
    note: JSON.stringify({
      before: cmd.id
        ? s.students.find((x) => x.id === cmd.id) ||
          s.leaves.find((x) => x.id === cmd.id)
        : undefined,
      after: d,
    }),
  });
  return ensureOperations(next);
}
export const canRead = (role: Role, module: string) =>
  permissions[role].includes(module);
