"use client";
import Select from "./SearchSelect";
import { Component, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Bus, Users, MapPin, RotateCcw, Box, Grid2X2 } from "lucide-react";
import { useCollege } from "./CollegeStore";
import ERPTable from "./ERPTable";
import { OpsMetrics, OpsSheet, type OpsField } from "./OperationsUI";
import { occupancy, type Vehicle } from "@/lib/colleges/operations";
import type { College } from "@/data/colleges";
const Scene = dynamic(() => import("./BusScene"), {
  ssr: false,
  loading: () => (
    <p className="ops-empty">
      Loading the interactive bus… The seat grid remains available below.
    </p>
  ),
});
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="ops-empty">
        3D is unavailable on this device. Use the fully interactive seat grid
        below.
      </p>
    ) : (
      this.props.children
    );
  }
}
export default function TransportWorkspace({
  college,
  module,
}: {
  college: College;
  module: string;
}) {
  const { state, run, role } = useCollege(),
    o = state.operations!;
  const [busId, setBusId] = useState(o.buses[2]?.id || o.buses[0]?.id || "");
  const bus = o.buses.find((b) => b.id === busId) || o.buses[0];
  const [seatId, setSeatId] = useState("01"),
    [mode, setMode] = useState("3D"),
    [view, setView] = useState("Cutaway"),
    [cameraKey, setCameraKey] = useState(0),
    [roof, setRoof] = useState(false),
    [labels, setLabels] = useState(true),
    [rosterFilter, setRosterFilter] = useState("All"),
    [rosterQuery, setRosterQuery] = useState(""),
    [kind, setKind] = useState("Student"),
    [query, setQuery] = useState("");
  const [sheet, setSheet] = useState<{
    title: string;
    fields: OpsField[];
    save: (d: Record<string, string>) => boolean;
  } | null>(null);
  const writable = ["Super Admin", "Transport Manager"].includes(role || "");
  if (!bus) return <p>Add a bus to start transport allocation.</p>;
  const count = occupancy(state, bus.id),
    route = o.routes.find((x) => x.id === bus.routeId),
    passengers = o.passengers.filter((p) => p.busId === bus.id),
    passenger = passengers.find((p) => p.seatId === seatId),
    selected = bus.seats.find((s) => s.id === seatId);
  const selectedStudent = state.students.find(
    (p) => p.id === passenger?.personId,
  );
  const selectedFaculty = state.staff.find((p) => p.id === passenger?.personId);
  const selectedEmployee = o.records.employees?.find(
    (p) => p.personId === passenger?.personId,
  );

  const people =
    kind === "Student"
      ? state.students
      : state.staff.filter((x) =>
          kind === "Faculty"
            ? x.category === "Faculty"
            : !["Faculty", "Driver", "Transport Assistant"].includes(
                x.category || "",
              ),
        );
  const personName = (id: string) =>
    state.students.find((p) => p.id === id)?.name ||
    state.staff.find((p) => p.id === id)?.name ||
    id;
  const options = (rows: { id: string; name: string }[]) =>
    rows.map((x) => ({ value: x.id, label: `${x.name} · ${x.id}` }));
  const editBus = (b?: Vehicle) =>
    setSheet({
      title: b ? "Edit bus configuration" : "Add campus bus",
      fields: [
        { key: "name", label: "Vehicle name", value: b?.name },
        {
          key: "registration",
          label: "Fictional registration",
          value: b?.registration,
        },
        {
          key: "capacity",
          label: "Passenger capacity",
          type: "number",
          value: String(b?.seats.length || 60),
          help: "Crew are excluded from passenger capacity. Move passengers before reducing seats.",
        },
        {
          key: "columns",
          label: "Seats per row",
          options: [3, 4, 5].map((n) => ({
            value: String(n),
            label: String(n),
          })),
          value: String(b ? Math.max(...b.seats.map((x) => x.column)) + 1 : 4),
        },
        {
          key: "status",
          label: "Vehicle status",
          value: b?.status || "Active",
          options: ["Active", "Maintenance", "Archived"].map((x) => ({
            value: x,
            label: x,
          })),
        },
        {
          key: "insurance",
          label: "Insurance expiry",
          type: "date",
          value: b?.insurance,
          required: false,
        },
        {
          key: "fitness",
          label: "Fitness expiry",
          type: "date",
          value: b?.fitness,
          required: false,
        },
        {
          key: "permit",
          label: "Permit expiry",
          type: "date",
          value: b?.permit,
          required: false,
        },
      ],
      save: (d) => run({ type: "ops.bus.save", id: b?.id, data: d }),
    });
  const allocation = (move = false) =>
    setSheet({
      title: `${move ? "Move passenger to" : "Assign passenger to"} seat ${seatId}`,
      fields: [
        {
          key: "personId",
          label: "Passenger",
          value: move ? passenger?.personId : undefined,
          options: options(
            people.filter(
              (p) =>
                p.status === "Active" &&
                (!query ||
                  `${p.name} ${p.id}`
                    .toLowerCase()
                    .includes(query.toLowerCase())),
            ),
          ),
        },
        {
          key: "pickup",
          label: "Pickup stop",
          value: route?.stops[0]?.id,
          options: route?.stops.map((s) => ({
            value: s.id,
            label: `${s.name} · ${s.time}`,
          })),
        },
        {
          key: "drop",
          label: "Drop stop",
          value: route?.stops.at(-1)?.id,
          options: route?.stops.map((s) => ({ value: s.id, label: s.name })),
        },
      ],
      save: (d) =>
        run({
          type: "ops.seat.assign",
          data: { ...d, busId: bus.id, seatId, kind },
        }),
    });
  const tableRows = o.buses.map((b) => ({
    id: b.id,
    name: b.name,
    registration: b.registration,
    status: b.status,
    capacity: b.seats.length,
    occupied: occupancy(state, b.id).occupied,
    available: occupancy(state, b.id).available,
    route: o.routes.find((r) => r.id === b.routeId)?.name || "Unassigned",
    driver: personName(b.driverId) || "Unassigned",
  }));
  const isSeating = [
    "bus-seating",
    "student-allocation",
    "faculty-allocation",
    "transport",
  ].includes(module);
  return (
    <div className="ops-transport">
      <OpsMetrics
        items={[
          ["Buses", o.buses.length],
          [
            "Passenger capacity",
            o.buses.reduce((n, b) => n + b.seats.length, 0),
          ],
          ["Allocated passengers", o.passengers.length],
          [
            "Maintenance",
            o.buses.filter((b) => b.status === "Maintenance").length,
          ],
        ]}
      />
      <div className="ops-toolbar">
        <label>
          Selected vehicle
          <Select
            aria-label="Selected vehicle"
            value={bus.id}
            onChange={(e) => {
              setBusId(e.target.value);
              setSeatId("01");
            }}
          >
            {o.buses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · {occupancy(state, b.id).occupied}/{b.seats.length}
              </option>
            ))}
          </Select>
        </label>
        {writable && (
          <>
            <button className="erp-primary" onClick={() => editBus()}>
              Add bus
            </button>
            <button onClick={() => editBus(bus)}>Edit selected bus</button>
          </>
        )}
      </div>
      {isSeating && (
        <>
          <div className="ops-transport-grid">
            <section className="erp-panel ops-seat-view">
              <div className="erp-panel-title">
                <div>
                  <h2>
                    <Bus size={20} /> {bus.name}
                  </h2>
                  <p>
                    {bus.registration} · {route?.name || "Route unassigned"}
                  </p>
                </div>
                <div className="ops-segmented">
                  {["3D", "2D"].map((x) => (
                    <button
                      key={x}
                      aria-pressed={mode === x}
                      onClick={() => setMode(x)}
                    >
                      {x === "3D" ? <Box size={15} /> : <Grid2X2 size={15} />}{" "}
                      {x} view
                    </button>
                  ))}
                </div>
              </div>
              {mode === "3D" && (
                <>
                  <div className="ops-scene">
                    <SceneBoundary>
                      <Scene
                        key={cameraKey}
                        bus={bus}
                        passengers={passengers}
                        selected={seatId}
                        onSelect={setSeatId}
                        roof={roof}
                        labels={labels}
                        view={view}
                        gold={college.slug.startsWith("edu")}
                      />
                    </SceneBoundary>
                  </div>
                  <div className="ops-camera-controls">
                    <Select
                      aria-label="Camera view"
                      value={view}
                      onChange={(e) => setView(e.target.value)}
                    >
                      {[
                        "Cutaway",
                        "Exterior",
                        "Top",
                        "Front",
                        "Rear",
                        "Seat focus",
                      ].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </Select>
                    <button aria-pressed={roof} onClick={() => setRoof(!roof)}>
                      Toggle roof
                    </button>
                    <button
                      aria-pressed={labels}
                      onClick={() => setLabels(!labels)}
                    >
                      Seat labels
                    </button>
                    <button
                      onClick={() => {
                        setView("Cutaway");
                        setCameraKey((n) => n + 1);
                        setRoof(false);
                      }}
                    >
                      <RotateCcw size={14} /> Reset view
                    </button>
                  </div>
                </>
              )}
              <details open={mode === "2D"} className="ops-seat-grid-panel">
                <summary>
                  Accessible seat grid · {bus.seats.length} passenger seats
                </summary>
                <p>Front / driver cabin · crew excluded from capacity</p>
                <div
                  className="ops-seat-grid"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(...bus.seats.map((x) => x.column)) + 1},1fr)`,
                  }}
                >
                  {bus.seats.map((seat) => {
                    const p = passengers.find((x) => x.seatId === seat.id),
                      status = p?.kind || seat.status;
                    return (
                      <button
                        key={seat.id}
                        style={{
                          marginLeft:
                            seat.column ===
                            Math.floor(
                              (Math.max(...bus.seats.map((s) => s.column)) +
                                1) /
                                2,
                            )
                              ? 10
                              : 0,
                        }}
                        data-status={p ? "Occupied" : status}
                        data-selected={seat.id === seatId}
                        aria-label={`Seat ${seat.id}: ${p ? `${p.kind} ${personName(p.personId)}` : seat.status}`}
                        aria-pressed={seat.id === seatId}
                        onClick={() => setSeatId(seat.id)}
                      >
                        <span>{seat.id}</span>
                        <small>
                          {p
                            ? p.kind.slice(0, 1)
                            : seat.status === "Available"
                              ? "Free"
                              : seat.status === "Reserved"
                                ? "R"
                                : "×"}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </details>
              <div className="ops-seat-legend">
                {["Occupied", "Available", "Reserved", "Unavailable"].map(
                  (x) => (
                    <span key={x} data-status={x}>
                      {x}
                    </span>
                  ),
                )}
              </div>
            </section>
            <aside className="erp-panel ops-seat-details">
              <h2>Seat {seatId}</h2>
              <span className="ops-status">
                {passenger ? `Occupied · ${passenger.kind}` : selected?.status}
              </span>
              {passenger ? (
                <>
                  <div className="ops-passenger-profile">
                    {selectedStudent?.profile?.photo ? (
                      <Image
                        src={selectedStudent.profile.photo}
                        width={54}
                        height={54}
                        unoptimized
                        alt={`${selectedStudent.name} photograph`}
                      />
                    ) : (
                      <span className="ops-passenger-avatar" aria-hidden="true">
                        {personName(passenger.personId)
                          .split(" ")
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join("")}
                      </span>
                    )}
                    <div>
                      <h3>{personName(passenger.personId)}</h3>
                      <small>
                        {passenger.kind} · {passenger.personId}
                      </small>
                    </div>
                  </div>
                  <dl
                    className="ops-passenger-record"
                    aria-label="Allocated passenger details"
                  >
                    <dt>{selectedStudent ? "Program" : "Department"}</dt>
                    <dd>
                      {selectedStudent?.program ||
                        selectedFaculty?.note ||
                        "Not provided"}
                    </dd>
                    <dt>{selectedStudent ? "Academic year" : "Designation"}</dt>
                    <dd>
                      {selectedStudent?.year ||
                        String(
                          selectedEmployee?.designation ||
                            selectedFaculty?.category ||
                            "Not provided",
                        )}
                    </dd>
                    <dt>Assigned seat</dt>
                    <dd>{passenger.seatId}</dd>
                    <dt>Route</dt>
                    <dd>{route?.name || "Not assigned"}</dd>
                    <dt>Pickup time</dt>
                    <dd>
                      {route?.stops.find((x) => x.id === passenger.pickup)
                        ?.time || "Not provided"}
                    </dd>
                  </dl>
                  <p>
                    {route?.stops.find((x) => x.id === passenger.pickup)?.name}{" "}
                    → {route?.stops.find((x) => x.id === passenger.drop)?.name}
                  </p>
                  {writable && (
                    <>
                      <button
                        onClick={() =>
                          setSheet({
                            title: "Move passenger",
                            fields: [
                              {
                                key: "seatId",
                                label: "New seat",
                                options: bus.seats
                                  .filter(
                                    (x) =>
                                      x.status === "Available" &&
                                      !passengers.some(
                                        (p) => p.seatId === x.id,
                                      ),
                                  )
                                  .map((x) => ({
                                    value: x.id,
                                    label: `Seat ${x.id}`,
                                  })),
                              },
                            ],
                            save: (d) =>
                              run({
                                type: "ops.seat.assign",
                                id: passenger.id,
                                data: { ...passenger, ...d },
                              }),
                          })
                        }
                      >
                        Move to another seat
                      </button>
                      <button
                        onClick={() =>
                          setSheet({
                            title: "Swap passenger seats",
                            fields: [
                              {
                                key: "otherId",
                                label: "Other passenger",
                                options: passengers
                                  .filter((p) => p.id !== passenger.id)
                                  .map((p) => ({
                                    value: p.id,
                                    label: `Seat ${p.seatId} · ${personName(p.personId)}`,
                                  })),
                              },
                            ],
                            save: (d) =>
                              run({
                                type: "ops.seat.swap",
                                id: passenger.id,
                                data: d,
                              }),
                          })
                        }
                      >
                        Swap seats
                      </button>
                      <button
                        onClick={() =>
                          setSheet({
                            title: "Remove transport allocation",
                            fields: [],
                            save: () =>
                              run({
                                type: "ops.seat.remove",
                                id: passenger.id,
                              }),
                          })
                        }
                      >
                        Remove allocation
                      </button>
                    </>
                  )}
                </>
              ) : (
                writable && (
                  <>
                    <label>
                      Passenger type
                      <Select
                        aria-label="Passenger type"
                        value={kind}
                        onChange={(e) => setKind(e.target.value)}
                      >
                        {["Student", "Faculty", "Staff"].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </Select>
                    </label>
                    <label>
                      Find passenger
                      <input
                        aria-label="Find passenger"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Name or roll number"
                      />
                    </label>
                    <button
                      className="erp-primary"
                      disabled={
                        selected?.status !== "Available" ||
                        bus.status !== "Active"
                      }
                      onClick={() => allocation()}
                    >
                      Assign selected seat
                    </button>
                    <div className="ops-stack">
                      {["Available", "Reserved", "Unavailable"]
                        .filter((x) => x !== selected?.status)
                        .map((status) => (
                          <button
                            key={status}
                            onClick={() =>
                              run({
                                type: "ops.seat.status",
                                data: { busId: bus.id, seatId, status },
                              })
                            }
                          >
                            Mark {status.toLowerCase()}
                          </button>
                        ))}
                    </div>
                  </>
                )
              )}
              <section
                className="ops-occupied-panel"
                aria-labelledby="occupied-passengers-heading"
              >
                <h3 id="occupied-passengers-heading">
                  Occupied passengers ({passengers.length})
                </h3>
                <label>
                  Passenger list filter
                  <Select
                    aria-label="Passenger list filter"
                    value={rosterFilter}
                    onChange={(e) => setRosterFilter(e.target.value)}
                  >
                    {["All", "Student", "Faculty", "Staff"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </Select>
                </label>
                <label>
                  Search occupied passengers
                  <input
                    aria-label="Search occupied passengers"
                    value={rosterQuery}
                    onChange={(e) => setRosterQuery(e.target.value)}
                    placeholder="Name, ID or seat number"
                  />
                </label>
                <div
                  className="ops-occupied-list"
                  role="list"
                  aria-label="Occupied passenger list"
                >
                  {passengers
                    .filter(
                      (p) =>
                        (rosterFilter === "All" || p.kind === rosterFilter) &&
                        `${personName(p.personId)} ${p.personId} ${p.seatId}`
                          .toLowerCase()
                          .includes(rosterQuery.toLowerCase()),
                    )
                    .sort((a, b) =>
                      a.seatId.localeCompare(b.seatId, undefined, {
                        numeric: true,
                      }),
                    )
                    .map((p) => (
                      <div role="listitem" key={p.id}>
                        <button
                          aria-pressed={seatId === p.seatId}
                          onClick={() => {
                            setSeatId(p.seatId);
                            setRoof(false);
                          }}
                        >
                          <span className="ops-roster-seat">{p.seatId}</span>
                          <span>
                            <strong>{personName(p.personId)}</strong>
                            <small>
                              {p.kind} · {p.personId}
                            </small>
                          </span>
                        </button>
                      </div>
                    ))}
                </div>
                {!passengers.length && (
                  <p>No passengers allocated to this bus.</p>
                )}
                {passengers.length > 0 &&
                  !passengers.some(
                    (p) =>
                      (rosterFilter === "All" || p.kind === rosterFilter) &&
                      `${personName(p.personId)} ${p.personId} ${p.seatId}`
                        .toLowerCase()
                        .includes(rosterQuery.toLowerCase()),
                  ) && <p>No passengers match this filter.</p>}
              </section>
              <h3>Passenger occupancy</h3>
              <strong className="ops-big-number">
                {count.occupied}
                <small> / {count.capacity}</small>
              </strong>
              <progress
                value={count.occupied}
                max={count.capacity}
                aria-label="Bus occupancy"
              />
              <p>
                {count.percent}% occupied · {count.available} available
              </p>
              <dl>
                <dt>Students</dt>
                <dd>{count.students}</dd>
                <dt>Faculty</dt>
                <dd>{count.faculty}</dd>
                <dt>Other staff</dt>
                <dd>{count.staff}</dd>
                <dt>Reserved / unavailable</dt>
                <dd>
                  {count.reserved} / {count.unavailable}
                </dd>
                <dt>Driver / assistant</dt>
                <dd>
                  {bus.driverId ? "1" : "0"} / {bus.assistantId ? "1" : "0"}{" "}
                  crew
                </dd>
              </dl>
              {count.percent >= 80 && (
                <p role="status">
                  Capacity warning:{" "}
                  {count.percent >= 100
                    ? "full"
                    : count.percent >= 90
                      ? "above 90%"
                      : "above 80%"}
                  .
                </p>
              )}
              {bus.status !== "Active" && (
                <p role="alert">
                  Bus unavailable. Existing passengers need reassignment.
                </p>
              )}
            </aside>
          </div>
          {route && (
            <section className="erp-panel">
              <h2>
                <MapPin size={18} /> {route.name} pickup route
              </h2>
              <div className="ops-route-timeline">
                {route.stops.map((stop, i) => (
                  <div key={stop.id}>
                    <span>{i + 1}</span>
                    <strong>{stop.name}</strong>
                    <small>{stop.time}</small>
                  </div>
                ))}
              </div>
              <p>Illustrative schedule · no live GPS or verified boarding.</p>
            </section>
          )}
        </>
      )}
      {["buses", "transport", "transport-reports"].includes(module) && (
        <ERPTable
          title="Bus directory"
          rows={tableRows}
          columns={[
            "name",
            "registration",
            "status",
            "capacity",
            "occupied",
            "available",
            "route",
            "driver",
          ].map((key) => ({ key, label: key[0].toUpperCase() + key.slice(1) }))}
          actions={(r) => (
            <button
              onClick={() => {
                setBusId(r.id);
                editBus(o.buses.find((b) => b.id === r.id));
              }}
            >
              Configure bus
            </button>
          )}
        />
      )}
      {["routes", "route-stops"].includes(module) && (
        <>
          <button
            className="erp-primary"
            onClick={() =>
              setSheet({
                title: "Add route and ordered stops",
                fields: [
                  { key: "name", label: "Route name" },
                  {
                    key: "start",
                    label: "Departure",
                    type: "time",
                    value: "06:30",
                  },
                  {
                    key: "end",
                    label: "Arrival",
                    type: "time",
                    value: "08:00",
                  },
                  {
                    key: "distance",
                    label: "Illustrative distance (km)",
                    type: "number",
                    value: "12",
                  },
                  { key: "stop1", label: "Starting stop" },
                  {
                    key: "time1",
                    label: "First pickup",
                    type: "time",
                    value: "06:30",
                  },
                  { key: "stop2", label: "Intermediate stop" },
                  {
                    key: "time2",
                    label: "Second pickup",
                    type: "time",
                    value: "07:00",
                  },
                  { key: "stop3", label: "Destination", value: college.name },
                  {
                    key: "time3",
                    label: "Arrival time",
                    type: "time",
                    value: "07:40",
                  },
                ],
                save: (d) =>
                  run({
                    type: "ops.route.save",
                    data: {
                      ...d,
                      stops: JSON.stringify(
                        [1, 2, 3].map((i) => ({
                          name: d["stop" + i],
                          time: d["time" + i],
                        })),
                      ),
                    },
                  }),
              })
            }
          >
            Add route
          </button>
          <ERPTable
            title="Routes and stops"
            rows={o.routes.map((r) => ({
              ...r,
              stops: r.stops.map((x) => `${x.name} ${x.time}`).join(" → "),
            }))}
            columns={["name", "start", "end", "distance", "stops"].map(
              (key) => ({ key, label: key }),
            )}
          />
        </>
      )}
      {["drivers", "driver-allocation"].includes(module) && (
        <>
          <button
            className="erp-primary"
            onClick={() =>
              setSheet({
                title: "Allocate driver and route",
                fields: [
                  {
                    key: "busId",
                    label: "Bus",
                    options: options(o.buses),
                    value: bus.id,
                  },
                  {
                    key: "routeId",
                    label: "Route",
                    options: options(o.routes),
                    value: bus.routeId,
                  },
                  {
                    key: "employeeId",
                    label: "Driver",
                    options: options(
                      state.staff.filter(
                        (x) => x.category === "Driver" && x.status === "Active",
                      ),
                    ),
                  },
                ],
                save: (d) => run({ type: "ops.driver.assign", data: d }),
              })
            }
          >
            Assign driver
          </button>
          {writable && (
            <button
              onClick={() =>
                setSheet({
                  title: "Add fictional driver",
                  fields: [
                    { key: "name", label: "Driver name" },
                    { key: "phone", label: "Fictional contact" },
                    {
                      key: "licenseExpiry",
                      label: "License expiry",
                      type: "date",
                    },
                    {
                      key: "joining",
                      label: "Joining date",
                      type: "date",
                      value: "2026-10-19",
                    },
                  ],
                  save: (d) =>
                    run({
                      type: "ops.employee.save",
                      data: {
                        ...d,
                        category: "Driver",
                        department: "Transport",
                        designation: "Campus driver",
                        basic: "0",
                        allowances: "0",
                        deductions: "0",
                        unpaidRate: "0",
                      },
                    }),
                })
              }
            >
              Add driver
            </button>
          )}
          <ERPTable
            title="Driver directory"
            rows={state.staff
              .filter((x) => x.category === "Driver")
              .map((e) => ({
                ...e,
                bus:
                  o.buses.find((b) => b.driverId === e.id)?.name ||
                  "Unassigned",
                route:
                  o.routes.find(
                    (r) =>
                      r.id ===
                      o.buses.find((b) => b.driverId === e.id)?.routeId,
                  )?.name || "Unassigned",
              }))}
            columns={["id", "name", "status", "bus", "route"].map((key) => ({
              key,
              label: key,
            }))}
          />
        </>
      )}
      {[
        "manifest",
        "student-allocation",
        "faculty-allocation",
        "transport-reports",
      ].includes(module) && (
        <ERPTable
          title="Passenger manifest"
          rows={o.passengers
            .filter(
              (p) =>
                (module !== "faculty-allocation" || p.kind === "Faculty") &&
                (module !== "student-allocation" || p.kind === "Student"),
            )
            .map((p) => ({
              ...p,
              name: personName(p.personId),
              bus: o.buses.find((b) => b.id === p.busId)?.name,
              route: o.routes.find((r) => r.id === p.routeId)?.name,
            }))}
          columns={[
            "name",
            "personId",
            "kind",
            "bus",
            "route",
            "seatId",
            "pickup",
            "drop",
          ].map((key) => ({ key, label: key }))}
        />
      )}
      {sheet && (
        <OpsSheet
          {...sheet}
          onSave={sheet.save}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
