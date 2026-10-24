export type College = {
  slug: string;
  number: string;
  name: string;
  short: string;
  motto: string;
  headline: string;
  description: string;
  accent: string;
  programs: {
    slug: string;
    name: string;
    department: string;
    duration: string;
    fee: number;
    type?: "Diploma" | "B.Tech" | "M.Tech";
    years?: number;
    semesters?: number;
    branch?: string;
    specialization?: string;
    lateralEntry?: boolean;
  }[];
};
export const colleges: College[] = [
  {
    slug: "edunexa-college",
    number: "21",
    name: "EduNexa College",
    short: "EduNexa",
    motto: "Learn Today. Lead Tomorrow.",
    headline: "Shaping Brighter Futures.",
    description:
      "A place to discover your potential, challenge your thinking, and build a life of purpose.",
    accent: "#a77524",
    programs: [
      ["science", "B.Sc. Applied Sciences", "Science"],
      ["commerce", "B.Com. Accounting & Finance", "Commerce"],
      ["arts", "B.A. Humanities", "Arts"],
      ["computer-applications", "BCA Computer Applications", "Computing"],
      ["business", "BBA Business Administration", "Business"],
      ["economics", "B.A. Economics", "Commerce"],
    ].map(([slug, name, department]) => ({
      slug,
      name,
      department,
      duration: "3 years",
      fee: 7500000,
    })),
  },
];
export const collegeBySlug = (slug: string) =>
  colleges.find((c) => c.slug === slug);
export const collegeRoot = (c: College) => `/colleges-institutions/${c.slug}`;
export const publicRoutes = [
  "",
  "about",
  "leadership",
  "academics",
  "departments",
  "faculty",
  "admissions",
  "admissions/apply",
  "campus",
  "facilities",
  "student-life",
  "achievements",
  "placements",
  "gallery",
  "contact",
  "faq",
];
// Operational screens; keys match backend screen contracts.
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
export const modules = [
  ...Object.keys(operationLabels),
  "dashboard",
  "students",
  "admissions",
  "fees",
  "fee-structures",
  "payments",
  "receipts",
  "cashbook",
  "expenses",
  "invoices",
  "scholarships",
  "certificates",
  "certificate-requests",
  "hostels",
  "hostel-permissions",
  "academics",
  "staff",
  "roles",
  "notifications",
  "reports",
  "audit-logs",
  "settings",
  "forms",
  "imports",
  "documents",
  "student-enrollment",
  "teaching-staff",
  "non-teaching-staff",
  "daily-labour",
  "course-setup",
];
export const roles = [
  "Master Data Entry",
  "Super Admin",
  "Principal",
  "Accounts Manager",
  "Admission Officer",
  "Certificate Officer",
  "Hostel Warden",
  "Faculty",
  "Student",
  "Parent",
  "HR Manager",
  "Payroll Officer",
  "Procurement Officer",
  "Inventory Manager",
  "Transport Manager",
  "Driver",
] as const;
export type Role = (typeof roles)[number];
export const roleHome: Record<Role, string> = {
  "Master Data Entry": "master-data-entry",
  "Super Admin": "admin",
  Principal: "principal",
  "Accounts Manager": "accounts",
  "Admission Officer": "staff",
  "Certificate Officer": "certificates",
  "Hostel Warden": "hostel",
  Faculty: "staff",
  Student: "student",
  Parent: "parent",
  "HR Manager": "hr",
  "Payroll Officer": "payroll",
  "Procurement Officer": "procurement",
  "Inventory Manager": "inventory",
  "Transport Manager": "transport",
  Driver: "driver",
};
export const permissions: Record<Role, string[]> = {
  "Master Data Entry": [
    "course-setup",
    "fee-structures",
    "student-enrollment",
    "teaching-staff",
    "non-teaching-staff",
    "daily-labour",
    "imports",
  ],
  "Super Admin": modules,
  Parent: ["dashboard", "parent-app", "timetable"],
  "HR Manager": [
    "dashboard",
    "employees",
    "employee-attendance",
    "employee-leave",
    "salary-structures",
    "payroll",
    "payslips",
    "bonuses",
    "reimbursements",
    "payroll-reports",
  ],
  "Payroll Officer": ["dashboard", "payroll", "payslips", "payroll-reports"],
  "Procurement Officer": [
    "dashboard",
    "expense-dashboard",
    "purchase-requests",
    "purchase-orders",
    "vendors",
    "inventory",
    "assets",
  ],
  "Inventory Manager": [
    "dashboard",
    "inventory",
    "assets",
    "purchase-orders",
    "vendors",
    "purchase-requests",
  ],
  "Transport Manager": [
    "dashboard",
    ...Object.keys(operationLabels).filter((x) =>
      [
        "transport",
        "buses",
        "routes",
        "route-stops",
        "drivers",
        "driver-allocation",
        "student-allocation",
        "faculty-allocation",
        "bus-seating",
        "trips",
        "manifest",
        "transport-attendance",
        "vehicle-maintenance",
        "fuel",
        "transport-expenses",
        "transport-reports",
      ].includes(x),
    ),
  ],
  Driver: ["dashboard", "trips", "manifest", "transport-attendance"],
  Principal: [
    "dashboard",
    "admin-app",
    "timetable",
    "students",
    "admissions",
    "reports",
    "certificates",
    "expenses",
    "scholarships",
    "hostels",
    "notifications",
    "staff",
  ],
  "Accounts Manager": [
    "dashboard",
    "admin-app",
    "fees",
    "fee-structures",
    "payments",
    "receipts",
    "cashbook",
    "expenses",
    "invoices",
    "scholarships",
    "reports",
    "notifications",
  ],
  "Admission Officer": ["dashboard", "admissions", "students", "notifications"],
  "Certificate Officer": [
    "dashboard",
    "certificates",
    "certificate-requests",
    "notifications",
  ],
  "Hostel Warden": [
    "dashboard",
    "hostels",
    "hostel-permissions",
    "notifications",
  ],
  Faculty: [
    "dashboard",
    "academics",
    "students",
    "notifications",
    "teacher-app",
    "assignments",
    "assessments",
    "attendance",
    "timetable",
  ],
  Student: [
    "student-app",
    "timetable",
    "dashboard",
    "fees",
    "payments",
    "receipts",
    "certificates",
    "hostel-permissions",
    "notifications",
  ],
};
export function validCollegePath(c: College, parts: string[]) {
  const p = parts.join("/");
  if (publicRoutes.includes(p)) return true;
  if (parts[0] === "academics" && parts.length === 2)
    return c.programs.some((x) => x.slug === parts[1]);
  if (parts[0] === "verify-certificate")
    return parts.length === 2 && /^[A-Za-z0-9_-]{1,100}$/.test(parts[1]);
  if (parts[0] !== "portal") return false;
  const safeArea = (area: string) => /^[a-z0-9][a-z0-9-]{0,63}$/.test(area);
  if (parts.length === 2)
    return (
      safeArea(parts[1]) ||
      [
        ...Object.values(roleHome),
        "login",
        "admin",
        "principal",
        "accounts",
        "staff",
        "student",
        "certificates",
        "hostel",
      ].includes(parts[1])
    );
  if (parts.length === 3)
    return safeArea(parts[1]) && /^[a-z0-9][a-z0-9-]{0,79}$/.test(parts[2]);
  return (
    parts.length === 4 &&
    safeArea(parts[1]) &&
    ["students", "admissions"].includes(parts[2]) &&
    /^[A-Za-z0-9-]{1,60}$/.test(parts[3])
  );
}
export const money = (cents: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
