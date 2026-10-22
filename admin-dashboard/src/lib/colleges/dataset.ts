import type { CollegeState } from "./store";
import { ensureOperations } from "./operations";
/** Browser demo import only. The backend must enforce its own schema and authorization. */
export function validateDataset(value: unknown, slug: string): CollegeState {
  if (!value || typeof value !== "object")
    throw Error("Choose a college demo JSON dataset.");
  const s = value as CollegeState;
  if (s.version !== 1 || s.slug !== slug)
    throw Error("Dataset version or institution does not match this portal.");
  const collections = [
    "students",
    "staff",
    "payments",
    "expenses",
    "invoices",
    "applications",
    "scholarships",
    "certificates",
    "rooms",
    "allocations",
    "leaves",
    "notifications",
    "audit",
    "structures",
  ] as const;
  for (const k of collections) {
    const list = s[k];
    if (!Array.isArray(list) || list.length > 20000)
      throw Error(`Invalid ${k} collection.`);
    const ids = new Set<string>();
    for (const r of list) {
      if (
        !r ||
        typeof r.id !== "string" ||
        typeof r.name !== "string" ||
        typeof r.status !== "string" ||
        typeof r.date !== "string" ||
        ids.has(r.id)
      )
        throw Error(`Invalid or duplicate ${k} record.`);
      ids.add(r.id);
      if (
        "amount" in r &&
        r.amount !== undefined &&
        (!Number.isSafeInteger(r.amount) || Number(r.amount) < 0)
      )
        throw Error("Invalid monetary amount.");
    }
  }
  const ids = new Set(s.students.map((x) => x.id));
  for (const st of s.students)
    if (
      ![st.fee, st.scholarship].every(
        (x) => Number.isSafeInteger(x) && x >= 0,
      ) ||
      st.scholarship > st.fee
    )
      throw Error("Invalid student financial record.");
  for (const p of s.payments)
    if (!ids.has(p.studentId || ""))
      throw Error("Payment references an unknown student.");
  const n = ensureOperations(s),
    o = n.operations!;
  if (
    !Array.isArray(o.buses) ||
    !Array.isArray(o.routes) ||
    !Array.isArray(o.passengers) ||
    !o.records ||
    typeof o.records !== "object"
  )
    throw Error("Invalid operations data.");
  const people = new Set([...s.students, ...s.staff].map((x) => x.id)),
    buses = new Set<string>(),
    routes = new Set(o.routes.map((x) => x.id));
  for (const bus of o.buses) {
    if (
      buses.has(bus.id) ||
      !Array.isArray(bus.seats) ||
      bus.seats.length < 1 ||
      bus.seats.length > 80 ||
      new Set(bus.seats.map((x) => x.id)).size !== bus.seats.length
    )
      throw Error("Invalid bus seat layout.");
    buses.add(bus.id);
    if (bus.routeId && !routes.has(bus.routeId))
      throw Error("Unknown bus route.");
  }
  const seats = new Set<string>(),
    persons = new Set<string>();
  for (const p of o.passengers) {
    const b = o.buses.find((x) => x.id === p.busId),
      r = o.routes.find((x) => x.id === p.routeId);
    if (
      !b ||
      !r ||
      !people.has(p.personId) ||
      !b.seats.some((x) => x.id === p.seatId && x.status === "Available") ||
      b.routeId !== r.id ||
      !r.stops.some((x) => x.id === p.pickup) ||
      !r.stops.some((x) => x.id === p.drop) ||
      seats.has(p.busId + ":" + p.seatId) ||
      persons.has(p.personId)
    )
      throw Error("Invalid or conflicting passenger allocation.");
    seats.add(p.busId + ":" + p.seatId);
    persons.add(p.personId);
  }
  for (const [key, list] of Object.entries(o.records)) {
    if (
      !Array.isArray(list) ||
      list.length > 20000 ||
      list.some(
        (x) =>
          !x ||
          typeof x.id !== "string" ||
          typeof x.name !== "string" ||
          typeof x.status !== "string",
      )
    )
      throw Error(`Invalid ${key} records.`);
    if (new Set(list.map((x) => x.id)).size !== list.length)
      throw Error(`Duplicate ${key} IDs.`);
  }
  return n;
}
