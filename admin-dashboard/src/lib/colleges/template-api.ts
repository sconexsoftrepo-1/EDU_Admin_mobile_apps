/** Read adapter only: preserves the original template view models, without demo seeding or local mutations. */
import { api, type Row, type ScreenSummary } from "@/services/api";
import type { CollegeState, RecordRow, Student } from "./store";
import { operationLabels, type OperationRecord } from "./operations";
export function emptyTemplateState(slug: string): CollegeState {
  return {
    version: 1,
    slug,
    students: [],
    applications: [],
    payments: [],
    expenses: [],
    invoices: [],
    scholarships: [],
    certificates: [],
    rooms: [],
    allocations: [],
    leaves: [],
    staff: [],
    notifications: [],
    audit: [],
    structures: [],
    operations: {
      version: 1,
      buses: [],
      routes: [],
      passengers: [],
      records: Object.fromEntries(
        Object.keys(operationLabels).map((k) => [k, []]),
      ),
    },
  };
}
const str = (v: unknown) => (v == null ? "" : String(v));
const cents = (v: unknown) => Math.round(Number(v || 0) * 100);
const title = (v: unknown) =>
  str(v)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (x) => x.toUpperCase());
const name = (r: Row) =>
  str(
    r.name ||
      r.subject ||
      r.message ||
      [r.first_name, r.last_name].filter(Boolean).join(" ") ||
      r.title ||
      r.code,
  );
export async function loadTemplateState(
  slug: string,
  screens: ScreenSummary[],
  active: string,
) {
  const state = emptyTemplateState(slug),
    errors: string[] = [],
    tables: Record<string, Row[]> = {};
  const keys = new Set([
    "dashboard",
    active,
    "employees",
    "hostels",
    "payments",
    "fees",
    "students",
    "certificates",
    "certificate-requests",
    "hostel-permissions",
    "expenses",
  ]);
  const selected = screens.filter((s) => keys.has(s.key));
  const specs = await Promise.all(
    selected.map(async (s) => {
      try {
        const spec = await api.workspace.screen(s.key);
        return {
          ...spec,
          resources: spec.resources.filter((r) => s.resources.includes(r.name)),
        };
      } catch (e) {
        errors.push(s.title);
        return null;
      }
    }),
  );
  const resources = new Map(
    specs.flatMap((s) => s?.resources || []).map((r) => [r.name, r]),
  );
  const queue = [...resources.values()];
  await Promise.all(
    Array.from({ length: Math.min(5, queue.length) }, async () => {
      while (queue.length) {
        const r = queue.shift()!;
        try {
          const rows: Row[] = [];
          let offset = 0;
          while (true) {
            const page = await api.workspace.list(r.path, offset, 100);
            rows.push(...page.items);
            if (rows.length >= page.total || !page.items.length) break;
            offset = rows.length;
          }
          tables[r.name] = rows;
        } catch {
          errors.push(r.title);
        }
      }
    }),
  );
  const rows = (key: string) => tables[key] || [];
  const by = (key: string, code: unknown) =>
    rows(key).find((r) => r.code === code);
  const normalize = (r: Row): RecordRow => ({
    id: str(r.code),
    name: name(r),
    status: title(r.status || "active"),
    date: str(
      r.created_at ||
        r.date ||
        r.admission_date ||
        r.payment_date ||
        r.paid_on ||
        r.issue_date ||
        r.start_date ||
        r.join_date,
    ),
    amount: cents(r.amount || r.total_amount || r.net_amount),
    studentId: str(r.student_code),
    category: str(r.category || r.fee_head_code || r.expense_category_code),
    method: title(r.method),
    note: str(r.note || r.description || r.remarks),
    reference: str(r.reference || r.reference_number),
  });
  state.students = rows("students").map((r) => {
    const e = rows("student_enrollments").find(
      (e) => e.student_code === r.code,
    );
    const charges = rows("student_fee_charges").filter(
      (x) => x.student_code === r.code,
    );
    return {
      id: str(r.code),
      name: name(r),
      status: title(r.status),
      date: str(r.admission_date || r.created_at),
      email: str(r.email),
      guardian: str(r.guardian_name),
      program: str(
        by("programs", e?.program_code)?.name ||
          e?.program_code ||
          r.program_code,
      ),
      department: str(r.department_code),
      year: str(e?.academic_year_code || r.academic_year_code),
      fee: charges.reduce(
        (n, x) => n + cents(x.amount || x.gross_amount) + cents(x.tax_amount),
        0,
      ),
      scholarship: charges.reduce(
        (n, x) =>
          n +
          rows("fee_adjustments")
            .filter((a) => a.charge_code === x.code)
            .reduce((v, a) => v + cents(a.amount), 0) +
          rows("charge_scholarship_allocations")
            .filter((a) => a.charge_code === x.code)
            .reduce((v, a) => v + cents(a.amount), 0),
        0,
      ),
      profile: {
        phone: str(r.phone),
        dob: str(r.date_of_birth),
        gender: title(r.gender),
        address: str(r.address),
        section: str(e?.section_code),
        semester: str(e?.semester_code),
      },
    } as Student;
  });
  const fields: Record<string, string> = {
    applications: "admission_applications",
    payments: "payments",
    expenses: "expenses",
    invoices: "college_invoices",
    scholarships: "student_scholarships",
    certificates: "certificates",
    rooms: "hostel_rooms",
    allocations: "hostel_allocations",
    leaves: "hostel_permissions",
    staff: "employees",
    notifications: "notifications",
    structures: "fee_structures",
  };
  for (const [key, table] of Object.entries(fields))
    (state as unknown as Record<string, unknown>)[key] = rows(table).map(
      (r) => ({
        ...normalize(r),
        name: name(r),
        capacity: Number(r.capacity || 0),
        room: str(r.room_code || r.room_number),
        program: str(r.program_code),
        source: str(r.source_code),
        downloads: Number(r.download_count || 0),
      }),
    );
  state.payments = state.payments.map((r) => ({
    ...r,
    status: ["Settled", "Posted", "Completed", "Success", "Paid"].includes(
      r.status,
    )
      ? "Completed"
      : r.status,
  }));
  for (const screen of screens) {
    const table = screen.resources[0];
    state.operations!.records[screen.key] = rows(table).map((r) => {
      const primitive = Object.fromEntries(
        Object.entries(r).filter(
          ([, v]) => typeof v === "string" || typeof v === "number",
        ),
      );
      return {
        ...primitive,
        ...normalize(r),
        personId: str(r.employee_code || r.person_code || r.code),
        studentId: str(r.student_code),
        department: str(r.department_code),
        category: title(r.employee_type || r.category),
        subject: str(r.subject_code),
        teacherId: str(r.teacher_code),
        basic: cents(r.basic_amount),
        net: cents(r.net_amount),
        gross: cents(r.gross_amount),
        amount: cents(r.amount),
        start: str(r.start_time),
        end: str(r.end_time),
      } as unknown as OperationRecord;
    });
  }
  state.operations!.routes = rows("transport_routes").map((r) => ({
    id: str(r.code),
    name: name(r),
    start: str(r.start_time),
    end: str(r.end_time),
    distance: Number(r.distance_km || 0),
    stops: rows("transport_stops")
      .filter((x) => x.route_code === r.code)
      .map((x) => ({
        id: str(x.code),
        name: name(x),
        time: str(x.pickup_time),
      })),
  }));
  state.operations!.buses = rows("vehicles").map((r) => ({
    id: str(r.code),
    name: name(r),
    registration: str(r.registration_number),
    status: title(r.status),
    routeId: str(r.route_code),
    driverId: str(r.driver_code),
    assistantId: str(r.assistant_code),
    insurance: str(r.insurance_expiry),
    fitness: str(r.fitness_expiry),
    permit: str(r.permit_expiry),
    seats: rows("vehicle_seats")
      .filter((x) => x.vehicle_code === r.code)
      .map((x, i) => ({
        id: str(x.code),
        row: Number(x.row_number || Math.floor(i / 4)),
        column: Number(x.column_number || i % 4),
        status: title(x.status || "available") as
          "Available" | "Reserved" | "Unavailable",
      })),
  }));
  state.students = state.students.map((st) => {
    const link = rows("student_parents").find((r) => r.student_code === st.id);
    const parent = by("parents", link?.parent_code);
    return { ...st, guardian: parent ? name(parent) : st.guardian };
  });
  state.staff = state.staff.map((r) => ({
    ...r,
    category: r.category === "teacher" ? "Faculty" : title(r.category),
  }));
  state.allocations = state.allocations.map((r) => {
    const raw = by("hostel_allocations", r.id);
    const bed = by("hostel_beds", raw?.bed_code);
    return {
      ...r,
      room: str(bed?.room_code),
      status: raw?.end_date ? "Released" : "Allocated",
    };
  });
  state.rooms = state.rooms.map((r) => ({
    ...r,
    name: str(by("hostel_rooms", r.id)?.room_number) || r.name,
  }));
  state.certificates = state.certificates.map((r) => ({
    ...r,
    status: "Issued",
    downloads: rows("certificate_download_events").filter(
      (e) => e.certificate_code === r.id,
    ).length,
  }));
  const requests = rows("certificate_requests")
    .filter((r) => !rows("certificates").some((c) => c.request_code === r.code))
    .map(normalize);
  state.certificates.push(...requests);
  state.payments = state.payments.map((r) => ({
    ...r,
    date: str(by("payments", r.id)?.paid_on) || r.date,
    name: state.students.find((st) => st.id === r.studentId)?.name || r.name,
    reference: str(rows("receipts").find((x) => x.payment_code === r.id)?.code),
  }));
  return { state, errors };
}
