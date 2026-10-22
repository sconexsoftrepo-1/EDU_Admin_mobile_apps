"use client";
import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Bell,
  Building2,
  ChevronRight,
  FileText,
  Home,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import type { College } from "@/data/colleges";
import { money } from "@/data/colleges";
import { adminFinance, type AdminPeriod } from "@/lib/colleges/admin-finance";
import { professionalPdf } from "@/lib/colleges/download";
import { useCollege } from "./CollegeStore";
import "@/styles/college-admin-mobile.css";

type Tab = "Overview" | "Outstanding" | "Reports" | "Activity";
export default function AdminFinanceMobile({ college }: { college: College }) {
  const { state, role, ready } = useCollege();
  const [tab, setTab] = useState<Tab>("Overview");
  const [period, setPeriod] = useState<AdminPeriod>("All records");
  const [query, setQuery] = useState("");
  const [asOf, setAsOf] = useState(() =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
      new Date(),
    ),
  );
  const [notice, setNotice] = useState("");
  const f = adminFinance(state, period, asOf);
  if (!ready) return <p role="status">Loading management overview…</p>;
  if (!role || !["Super Admin", "Principal", "Accounts Manager"].includes(role))
    return (
      <p role="alert">
        Admin finance is available only to authorized management roles in this
        demo.
      </p>
    );
  const debtors = f.debtors.filter(
    (s) =>
      s.outstanding > 0 &&
      `${s.name} ${s.id} ${s.program}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const exportReport = (
    kind: "Outstanding" | "Collections" | "Expenses",
    format: "PDF" | "CSV",
  ) => {
    const columns =
      kind === "Outstanding"
        ? [
            "Student ID",
            "Student",
            "Course",
            "Gross fee (INR)",
            "Scholarship (INR)",
            "Paid (INR)",
            "Outstanding (INR)",
          ]
        : ["Reference", "Date", "Description", "Category", "Amount (INR)"];
    const rows =
      kind === "Outstanding"
        ? f.debtors
            .filter((s) => s.outstanding > 0)
            .map((s) => [
              s.id,
              s.name,
              s.program,
              (s.fee / 100).toFixed(2),
              (s.scholarship / 100).toFixed(2),
              (s.paid / 100).toFixed(2),
              (s.outstanding / 100).toFixed(2),
            ])
        : (kind === "Collections" ? f.payments : f.expenses).map((r) => [
            r.id,
            r.date,
            r.name,
            r.category || "",
            ((r.amount || 0) / 100).toFixed(2),
          ]);
    if (format === "PDF")
      professionalPdf(`Admin-${kind}`, {
        title: `Management ${kind.toLowerCase()} report`,
        context: {
          college,
          preparedBy: role,
          filters:
            kind === "Outstanding"
              ? `Lifetime balances as of ${asOf}`
              : `${period}, through ${asOf}`,
        },
        sections: [
          {
            title: kind,
            columns,
            rows,
            paragraphs: [
              "Fictional browser records. This report is not a bank balance or an audited financial statement.",
            ],
          },
        ],
      });
    else {
      const escape = (v: string) =>
        `"${(/^[=+\-@\t\r]/.test(v) ? "'" : "") + v.replaceAll('"', '""')}"`;
      const url = URL.createObjectURL(
        new Blob(
          [
            "\uFEFF" +
              [columns, ...rows]
                .map((r) => r.map(escape).join(","))
                .join("\r\n"),
          ],
          { type: "text/csv;charset=utf-8" },
        ),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `EduNexa-${kind}-${asOf}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setNotice(`${kind} ${format} report prepared.`);
  };
  const nav = (name: Tab) => {
    setTab(name);
    setNotice("");
  };
  return (
    <section className="en-admin-mobile" aria-label="Admin mobile app preview">
      <div className="en-admin-device">
        <header className="en-admin-header">
          <div className="en-admin-brand">
            <Building2 size={22} />
            <span>
              {college.short}
              <small>Management</small>
            </span>
          </div>
          <button
            aria-label="View admin activity"
            onClick={() => nav("Activity")}
          >
            <Bell size={21} />
          </button>
        </header>
        <div className="en-admin-intro">
          <span>Admin mobile preview</span>
          <h2>{tab === "Overview" ? "Your college, in focus." : tab}</h2>
          <p>Fictional browser data. No live banking or SMS.</p>
        </div>
        <div className="en-admin-filters">
          <label>
            Collection period
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as AdminPeriod)}
            >
              {(["All records", "This month", "Last 7 days"] as const).map(
                (p) => (
                  <option key={p}>{p}</option>
                ),
              )}
            </select>
          </label>
          <label>
            As of
            <input
              type="date"
              value={asOf}
              onChange={(e) => {
                if (e.target.value) setAsOf(e.target.value);
              }}
            />
          </label>
        </div>
        <div className="en-admin-content" aria-live="polite">
          {tab === "Overview" && (
            <>
              <article className="en-admin-collection">
                <div>
                  <Wallet size={20} />
                  <span>Collected in selected period</span>
                </div>
                <strong data-testid="admin-collected">
                  {money(f.collected)}
                </strong>
                <p>
                  {f.receiptCount} completed receipts through {asOf}
                </p>
                <button onClick={() => nav("Reports")}>
                  View collection report <ArrowUpRight size={16} />
                </button>
              </article>
              <div className="en-admin-balance">
                <button onClick={() => nav("Outstanding")}>
                  <span>Outstanding fees</span>
                  <strong data-testid="admin-outstanding">
                    {money(f.outstanding)}
                  </strong>
                  <small>All student balances as of date</small>
                  <ChevronRight size={18} />
                </button>
                <div>
                  <span>Students with dues</span>
                  <strong>{f.dueStudents}</strong>
                  <small>Across all recorded courses</small>
                </div>
              </div>
              <section className="en-admin-ledger">
                <h3>Where the money goes</h3>
                {[
                  ["Paid expenses", f.spent],
                  ["Paid to external parties", f.external],
                  ["Net cash movement", f.netMovement],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{money(Number(value))}</strong>
                  </div>
                ))}
                <p>
                  External payments are part of paid expenses. Net movement
                  excludes opening balances and is not a bank balance.
                </p>
              </section>
              <div className="en-admin-mini">
                <div>
                  <span>Total recorded fees</span>
                  <strong>{money(f.feeTotal)}</strong>
                </div>
                <div>
                  <span>Recorded scholarships</span>
                  <strong>{money(f.scholarship)}</strong>
                </div>
              </div>
              <button className="en-admin-link" onClick={() => nav("Reports")}>
                Open management reports <ChevronRight size={18} />
              </button>
            </>
          )}
          {tab === "Outstanding" && (
            <>
              <div className="en-admin-section-title">
                <h3>{f.dueStudents} students with dues</h3>
                <span>Lifetime balances</span>
              </div>
              <label className="en-admin-search">
                <Search size={17} />
                <input
                  aria-label="Search outstanding students"
                  placeholder="Search name, ID or course"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              {debtors.slice(0, 30).map((s) => (
                <article className="en-admin-debtor" key={s.id}>
                  <div>
                    <strong>{s.name}</strong>
                    <span>
                      {s.id} · {s.program}
                    </span>
                  </div>
                  <b>{money(s.outstanding)}</b>
                  <small>
                    Paid {money(s.paid)} of {money(s.payable)} payable
                  </small>
                </article>
              ))}
              {debtors.length === 0 && <p>No matching outstanding balances.</p>}
              {debtors.length > 30 && (
                <p>
                  Showing 30 of {debtors.length}. Export the report for the
                  complete list.
                </p>
              )}
              <p className="en-admin-footnote">
                Due dates are not stored per charge in this legacy demo. These
                balances must not be presented as overdue amounts.
              </p>
            </>
          )}
          {tab === "Reports" && (
            <>
              <p className="en-admin-footnote">
                Collection and expense reports use the selected period.
                Outstanding uses lifetime balances through the selected date.
              </p>
              {(["Collections", "Outstanding", "Expenses"] as const).map(
                (kind) => (
                  <article className="en-admin-report" key={kind}>
                    <FileText size={22} />
                    <div>
                      <h3>{kind}</h3>
                      <p>
                        {kind === "Outstanding"
                          ? "Student-wise fees, scholarships, paid and remaining amounts."
                          : kind === "Collections"
                            ? "Completed receipts and payment methods."
                            : "Paid expenditures, including external remittances."}
                      </p>
                      <div>
                        <button onClick={() => exportReport(kind, "PDF")}>
                          View / download PDF
                        </button>
                        <button onClick={() => exportReport(kind, "CSV")}>
                          <ArrowDownToLine size={14} /> CSV
                        </button>
                      </div>
                    </div>
                  </article>
                ),
              )}
              <p className="en-admin-footnote">
                Downloads reflect browser records only. Auditor formats and
                secure report distribution require the backend.
              </p>
            </>
          )}
          {tab === "Activity" && (
            <>
              <h3>Management follow-up</h3>
              {[
                [
                  "Admission applications",
                  state.applications.filter(
                    (a) => !["Admitted", "Rejected"].includes(a.status),
                  ).length,
                ],
                [
                  "Certificate requests",
                  state.certificates.filter((c) => c.status !== "Issued")
                    .length,
                ],
                [
                  "Pending hostel permissions",
                  state.leaves.filter((l) => l.status === "Pending").length,
                ],
              ].map(([label, count]) => (
                <div className="en-admin-activity" key={label}>
                  <span>{label}</span>
                  <strong>{count}</strong>
                </div>
              ))}
              <h3>Recent recorded actions</h3>
              {state.audit.slice(0, 8).map((a) => (
                <article className="en-admin-audit" key={a.id}>
                  <strong>{a.name}</strong>
                  <span>
                    {a.date} · {a.actor || "Demo user"}
                  </span>
                </article>
              ))}
              {state.audit.length === 0 && <p>No recorded actions yet.</p>}
              <div className="en-admin-security">
                <ShieldCheck size={20} />
                <p>
                  Management-only demo view. Production authorization, private
                  report storage and push alerts require server enforcement.
                </p>
              </div>
            </>
          )}
          {notice && (
            <p role="status" className="en-admin-notice">
              {notice}
            </p>
          )}
        </div>
        <nav className="en-admin-nav" aria-label="Admin mobile navigation">
          {(
            [
              { name: "Overview", Icon: Home },
              { name: "Outstanding", Icon: Wallet },
              { name: "Reports", Icon: FileText },
              { name: "Activity", Icon: Bell },
            ] as const
          ).map(({ name, Icon }) => (
            <button
              key={name}
              aria-current={tab === name ? "page" : undefined}
              onClick={() => nav(name)}
            >
              <Icon size={19} />
              <span>{name === "Outstanding" ? "Dues" : name}</span>
            </button>
          ))}
        </nav>
      </div>
    </section>
  );
}
