"use client";
/** Salary & payslips: each employee's salary structure and formatted monthly payslips (PDF). */
import { useEffect, useMemo, useState } from "react";
import { Download, FileText, RefreshCw, Wallet } from "lucide-react";
import SideDrawer from "./SideDrawer";
import SearchField from "./SearchField";
import WorkspaceSkeleton from "./WorkspaceSkeleton";
import { useErrorToast } from "./toast";
import { api, errorText } from "@/services/api";
import {
  payrollService,
  type Payslip,
  type SalaryEmployee,
  type SalaryLine,
  type SalaryStructure,
} from "@/services/api/modules/payroll/service";
import "./staff/staff.css";
import "./payslips.css";

const inr = (v?: string | number | null) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(Number(v || 0));

function Statement({
  earnings,
  deductions,
  gross,
  less,
}: {
  earnings: SalaryLine[];
  deductions: SalaryLine[];
  gross: string;
  less: string;
}) {
  const rows = Math.max(earnings.length, deductions.length, 1);
  return (
    <table className="pay-statement">
      <thead>
        <tr>
          <th>Earnings</th>
          <th className="num">Amount</th>
          <th>Deductions</th>
          <th className="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }, (_, i) => (
          <tr key={i}>
            <td>{earnings[i]?.component || ""}</td>
            <td className="num">
              {earnings[i] ? inr(earnings[i].amount) : ""}
            </td>
            <td>{deductions[i]?.component || ""}</td>
            <td className="num">
              {deductions[i] ? inr(deductions[i].amount) : ""}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th>Gross earnings</th>
          <th className="num">{inr(gross)}</th>
          <th>Total deductions</th>
          <th className="num">{inr(less)}</th>
        </tr>
      </tfoot>
    </table>
  );
}

export default function PayslipsWorkspace() {
  const [people, setPeople] = useState<SalaryEmployee[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<{
    employee: SalaryEmployee;
    structure: SalaryStructure;
    payslips: Payslip[];
  } | null>(null);
  const [open, setOpen] = useState<Payslip | null>(null);
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useErrorToast(error);

  useEffect(() => {
    let active = true;
    payrollService
      .employees()
      .then((r) => {
        if (!active) return;
        setPeople(r.items);
        setCanManage(r.can_manage);
        setSelected((current) => current || r.items[0]?.code || "");
      })
      .catch((e) => active && setError(errorText(e)));
    return () => {
      active = false;
    };
  }, [version]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    payrollService
      .employee(selected)
      .then((r) => active && setDetail(r))
      .catch((e) => active && setError(errorText(e)));
    return () => {
      active = false;
    };
  }, [selected, version]);

  const visible = useMemo(
    () =>
      (people || []).filter((p) =>
        `${p.name} ${p.code} ${p.designation || ""} ${p.department || ""}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    [people, query],
  );

  async function downloadPdf(slip: Payslip) {
    setBusy(true);
    try {
      await api.documents.download(
        "payslip",
        slip.code,
        `payslip-${(detail?.employee.name || slip.code).replaceAll(" ", "-")}-${slip.period.replaceAll(" ", "-")}.pdf`,
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const structure = detail?.structure;
  const loadingDetail = !!selected && detail?.employee.code !== selected;
  return (
    <section className="stf-dir" aria-label="Salary and payslips">
      <header className="stf-dir-heading">
        <div>
          <p>HR &amp; payroll</p>
          <h1>Salary &amp; payslips</h1>
        </div>
        <button
          className="stf-refresh"
          type="button"
          onClick={() => setVersion((n) => n + 1)}
          aria-label="Refresh salary details"
          title="Refresh"
        >
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </header>
      {!people ? (
        <WorkspaceSkeleton label="Loading salary details" />
      ) : (
        <div className={canManage ? "pay-layout" : "pay-layout pay-single"}>
          {canManage && (
            <aside className="stf-card pay-people" aria-label="Employees">
              <div className="pay-people-search">
                <SearchField
                  aria-label="Search employees"
                  placeholder="Search employee"
                  value={query}
                  onValueChange={setQuery}
                />
              </div>
              <ul>
                {visible.map((p) => (
                  <li key={p.code}>
                    <button
                      type="button"
                      aria-pressed={p.code === selected}
                      onClick={() => setSelected(p.code)}
                    >
                      <strong>{p.name}</strong>
                      <small>
                        {[p.designation, p.department]
                          .filter(Boolean)
                          .join(" · ") || p.code}
                      </small>
                      <span>
                        {inr(p.net_monthly)} / month · {p.payslips || 0} payslip
                        {p.payslips === 1 ? "" : "s"}
                      </span>
                    </button>
                  </li>
                ))}
                {!visible.length && (
                  <li className="stf-empty">No one matches.</li>
                )}
              </ul>
            </aside>
          )}
          <div className="pay-detail">
            {!selected ? (
              <p className="stf-empty">No employee records yet.</p>
            ) : loadingDetail || !detail || !structure ? (
              <WorkspaceSkeleton compact label="Loading salary" />
            ) : (
              <>
                <section className="stf-card pay-summary">
                  <div className="pay-person">
                    <span className="pay-avatar" aria-hidden="true">
                      <Wallet size={20} />
                    </span>
                    <div>
                      <h2>{detail.employee.name}</h2>
                      <p>
                        {[
                          detail.employee.code,
                          detail.employee.designation,
                          detail.employee.department,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                  <dl className="pay-figures">
                    <div>
                      <dt>Gross / month</dt>
                      <dd>{inr(structure.gross_monthly)}</dd>
                    </div>
                    <div>
                      <dt>Deductions / month</dt>
                      <dd>{inr(structure.deductions_monthly)}</dd>
                    </div>
                    <div className="pay-net">
                      <dt>Take-home / month</dt>
                      <dd>
                        {inr(
                          structure.in_hand_monthly || structure.net_monthly,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Annual CTC</dt>
                      <dd>{inr(structure.ctc_annual)}</dd>
                    </div>
                  </dl>
                </section>
                <section className="stf-card pay-section">
                  <h3>Salary structure</h3>
                  <p className="pay-muted">
                    Monthly
                    {structure.effective_from
                      ? ` · effective ${structure.effective_from.slice(0, 10)}`
                      : ""}
                  </p>
                  <Statement
                    earnings={structure.earnings}
                    deductions={structure.deductions}
                    gross={structure.gross_monthly}
                    less={structure.deductions_monthly}
                  />
                </section>
                <section className="stf-card pay-section">
                  <h3>Monthly payslips</h3>
                  {!detail.payslips.length ? (
                    <p className="stf-empty">
                      No payslips yet. They appear here after each payroll run
                      is published.
                    </p>
                  ) : (
                    <div className="pay-slips">
                      {detail.payslips.map((slip) => (
                        <article key={slip.code} className="pay-slip">
                          <header>
                            <strong>{slip.period}</strong>
                            {slip.run_status && (
                              <span
                                className={`stf-docs-badge ${["published", "paid"].includes(slip.run_status) ? "done" : ""}`}
                              >
                                {slip.run_status}
                              </span>
                            )}
                          </header>
                          <p className="pay-slip-net">{inr(slip.net_amount)}</p>
                          <p className="pay-muted">
                            Gross {inr(slip.gross_amount)} · Deductions{" "}
                            {inr(slip.deduction_amount)}
                          </p>
                          <div className="stf-directory-actions">
                            <button type="button" onClick={() => setOpen(slip)}>
                              <FileText size={14} aria-hidden="true" />
                              View
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void downloadPdf(slip)}
                            >
                              <Download size={14} aria-hidden="true" />
                              PDF
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      )}
      {open && detail && (
        <SideDrawer
          title={`Payslip · ${open.period}`}
          subtitle={`${detail.employee.name} · ${detail.employee.code}`}
          onClose={() => setOpen(null)}
          actions={
            <button
              type="button"
              disabled={busy}
              onClick={() => void downloadPdf(open)}
            >
              <Download size={15} aria-hidden="true" />
              Download PDF
            </button>
          }
        >
          <div className="pay-sheet">
            <dl className="pay-meta">
              <div>
                <dt>Designation</dt>
                <dd>{detail.employee.designation || "—"}</dd>
              </div>
              <div>
                <dt>Department</dt>
                <dd>{detail.employee.department || "—"}</dd>
              </div>
              <div>
                <dt>PAN</dt>
                <dd>{detail.employee.pan || "—"}</dd>
              </div>
              <div>
                <dt>Bank account</dt>
                <dd>{detail.employee.bank || "—"}</dd>
              </div>
            </dl>
            <Statement
              earnings={open.earnings}
              deductions={open.deductions}
              gross={open.gross_amount}
              less={open.deduction_amount}
            />
            <div className="pay-net-box">
              <span>Net pay</span>
              <strong>{inr(open.net_amount)}</strong>
              <small>{open.net_in_words}</small>
            </div>
          </div>
        </SideDrawer>
      )}
    </section>
  );
}
