"use client";
import Link from "next/link";
import {
  GraduationCap,
  Wallet,
  FileCheck,
  Building2,
  ArrowUpRight,
  BookOpen,
  Calendar,
  ShieldCheck,
} from "lucide-react";
import { useCollege } from "./CollegeStore";
import { balance, paid } from "@/lib/colleges/store";
import { money, type College, type Role } from "@/data/colleges";
export default function RoleWorkspace({
  college: c,
  role,
  nav,
}: {
  college: College;
  role: Role;
  nav: (module: string) => string;
}) {
  const { state: s, run } = useCollege();
  const self = s.students.find((st) => st.id === `${c.number}-S0001`)!;
  if (role === "Super Admin") return null;
  if (role === "Student") {
    const allocation = s.allocations.find(
      (a) => a.studentId === self.id && a.status === "Allocated",
    );
    return (
      <section className="erp-student-home">
        <div className="erp-student-id">
          <GraduationCap size={36} />
          <span>Digital student profile</span>
          <h2>{self.name}</h2>
          <p>{self.program}</p>
          <dl>
            <div>
              <dt>Roll number</dt>
              <dd>{self.id}</dd>
            </div>
            <div>
              <dt>Academic year</dt>
              <dd>{self.year}</dd>
            </div>
            <div>
              <dt>Hostel</dt>
              <dd>
                {allocation
                  ? s.rooms.find((r) => r.id === allocation.room)?.name
                  : "Day scholar"}
              </dd>
            </div>
          </dl>
          <small>Fictional identity / Demo only</small>
        </div>
        <div className="erp-student-summary">
          <h2>Your academic essentials</h2>
          <p>A simple view of your fees, documents, and campus requests.</p>
          <div>
            {[
              [Wallet, "Fee balance", money(balance(s, self)), "fees"],
              [
                FileCheck,
                "Your certificates",
                String(
                  s.certificates.filter(
                    (r) => r.studentId === self.id && r.status === "Issued",
                  ).length,
                ) + " issued",
                "certificates",
              ],
              [
                Building2,
                "Residential life",
                allocation ? "Hostel resident" : "Day scholar",
                "hostel-permissions",
              ],
              [
                BookOpen,
                "Payment history",
                money(paid(s, self.id)) + " paid",
                "receipts",
              ],
            ].map(([I, label, value, path]) => {
              const Icon = I as typeof Wallet;
              return (
                <Link href={nav(String(path))} key={String(path)}>
                  <Icon size={20} />
                  <span>
                    <strong>{String(label)}</strong>
                    <small>{String(value)}</small>
                  </span>
                  <ArrowUpRight size={15} />
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    );
  }
  if (role === "Principal")
    return (
      <section className="erp-principal-overview">
        <div className="erp-leadership-note">
          <ShieldCheck size={28} />
          <span>Institutional oversight</span>
          <h2>Lead with clarity.</h2>
          <p>
            Review enrollment, financial performance, and requests that need
            your attention.
          </p>
          <Link href={nav("reports")}>
            Open institutional reports <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="erp-decision-queue">
          <h2>Approval desk</h2>
          {s.expenses
            .filter((e) => e.status === "Submitted")
            .slice(0, 2)
            .map((e) => (
              <div key={e.id}>
                <span>
                  <strong>{e.name}</strong>
                  <small>
                    {money(e.amount || 0)} / {e.id}
                  </small>
                </span>
                <button
                  onClick={() =>
                    run({
                      type: "expense.status",
                      id: e.id,
                      data: { status: "Approved" },
                    })
                  }
                >
                  Approve expense
                </button>
              </div>
            ))}
          {s.scholarships
            .filter((e) => e.status === "Pending")
            .slice(0, 2)
            .map((e) => (
              <div key={e.id}>
                <span>
                  <strong>{e.name} award</strong>
                  <small>
                    {money(e.amount || 0)} / {e.studentId}
                  </small>
                </span>
                <button
                  onClick={() => run({ type: "scholarship.approve", id: e.id })}
                >
                  Approve scholarship
                </button>
              </div>
            ))}
          <Link href={nav("admissions")}>
            Review admission decisions <ArrowUpRight size={14} />
          </Link>
        </div>
      </section>
    );
  if (role === "Accounts Manager") {
    const total = s.payments.reduce((n, p) => n + (p.amount || 0), 0),
      external = s.payments
        .filter((p) =>
          ["University Fee", "Examination Fee"].includes(p.category || ""),
        )
        .reduce((n, p) => n + (p.amount || 0), 0),
      out = [
        ...s.expenses,
        ...s.invoices.filter(
          (i) =>
            !s.operations?.records["purchase-orders"]?.some(
              (p) => p.id === i.reference,
            ),
        ),
      ]
        .filter((e) => e.status === "Paid")
        .reduce((n, p) => n + (p.amount || 0), 0);
    return (
      <section className="erp-finance-overview">
        <div>
          <Wallet size={25} />
          <h2>Finance control center</h2>
          <p>
            Reconcile collections and external payables from a single ledger.
          </p>
          <Link href={nav("cashbook")}>
            Review cashbook <ArrowUpRight size={14} />
          </Link>
        </div>
        <dl>
          {[
            ["Internal collections", total - external],
            ["External collections", external],
            ["Paid expenditures", out],
            ["Net cash movement", total - out],
          ].map(([label, n]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{money(Number(n))}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }
  const config: Record<
    string,
    {
      title: string;
      description: string;
      module: string;
      items: { id: string; name: string; status: string }[];
    }
  > = {
    "Admission Officer": {
      title: "Your admissions desk",
      description:
        "Review applications, follow up on documents, and welcome the next cohort.",
      module: "admissions",
      items: s.applications
        .filter((x) => !["Enrolled", "Rejected"].includes(x.status))
        .slice(0, 3),
    },
    "Certificate Officer": {
      title: "Document processing desk",
      description:
        "Validate fictional enrollment records before issuing academic documents.",
      module: "certificates",
      items: s.certificates
        .filter((x) => !["Issued", "Rejected"].includes(x.status))
        .slice(0, 3),
    },
    "Hostel Warden": {
      title: "Your residential community",
      description:
        "Review pickup details, approve leave, and track safe returns.",
      module: "hostel-permissions",
      items: s.leaves
        .filter((x) => !["Returned", "Rejected"].includes(x.status))
        .slice(0, 3),
    },
    Faculty: {
      title: "Teaching & mentoring",
      description:
        "Your assigned academic responsibilities and student support workspace.",
      module: "academics",
      items: c.programs.slice(0, 3).map((p) => ({
        id: p.slug,
        name: p.name,
        status: "Faculty-guided learning",
      })),
    },
  };
  const info = config[role];
  if (!info) return null;
  return (
    <section className="erp-staff-overview">
      <div>
        <Calendar size={27} />
        <h2>{info.title}</h2>
        <p>{info.description}</p>
        <Link href={nav(info.module)}>
          Open your work queue <ArrowUpRight size={14} />
        </Link>
      </div>
      <div>
        {info.items.length ? (
          info.items.map((item) => (
            <Link href={nav(info.module)} key={item.id}>
              <span>
                <strong>{item.name}</strong>
                <small>
                  {item.status} / {item.id}
                </small>
              </span>
              <ArrowUpRight size={15} />
            </Link>
          ))
        ) : (
          <p>Your work queue is clear.</p>
        )}
      </div>
    </section>
  );
}
