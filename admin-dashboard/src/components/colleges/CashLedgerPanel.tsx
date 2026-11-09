"use client";
/**
 * Cash ledger & receipts register: receipts count, amount received by mode of payment, payments
 * out and running balance — grouped by day, week, month or year, with the formatted PDF.
 * Backend: app/core/finance_ledger.py (GET finance/ledger, finance/ledger/pdf).
 */
import { useEffect, useState } from "react";
import { api, errorText } from "@/services/api";
import { apiRequest } from "@/services/api/client";
import PDFActions from "./PDFActions";
import WorkspaceSkeleton from "./WorkspaceSkeleton";
import { useErrorToast } from "./toast";
import "./staff/staff.css";
import "./cash-ledger.css";
import { formatDate } from "@/lib/colleges/dates";

type Period = "day" | "week" | "month" | "year";
type Group = {
  key: string;
  label: string;
  receipts: number;
  received: string;
  payments: number;
  paid_out: string;
  net: string;
  closing: string;
  count_by_mode: Record<string, number>;
};
type Entry = {
  date: string;
  voucher: string;
  particulars: string;
  mode: string;
  reference: string;
  in: string;
  out: string;
  balance: string;
};
type Ledger = {
  period: Period;
  start: string;
  end: string;
  groups: Group[];
  by_mode: { mode: string; label: string; count: number; amount: string }[];
  totals: {
    receipts: number;
    received: string;
    payments: number;
    paid_out: string;
    opening: string;
    closing: string;
  };
  entries: Entry[];
};
const MODES: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank transfer",
  card: "Card",
  cheque: "Cheque",
};
const inr = (v?: string | number | null) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(Number(v || 0));

export default function CashLedgerPanel({
  defaultMode = "all",
}: {
  defaultMode?: "all" | "cash";
}) {
  const [period, setPeriod] = useState<Period>("month");
  const [mode, setMode] = useState<"all" | "cash">(defaultMode);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [data, setData] = useState<Ledger | null>(null);
  const [error, setError] = useState("");
  useErrorToast(error);

  useEffect(() => {
    let live = true;
    apiRequest<Ledger>("finance/ledger", {
      query: { period, mode, start, end, entries_limit: 60 },
    })
      .then((r) => live && setData(r))
      .catch((e) => live && setError(errorText(e)));
    return () => {
      live = false;
    };
  }, [period, mode, start, end]);

  const query = new URLSearchParams({
    period,
    mode,
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
  }).toString();
  const t = data?.totals;
  return (
    <section
      className="stf-card cl-panel"
      aria-label="Cash ledger and receipts"
    >
      <header className="cl-head">
        <div>
          <h3>{mode === "cash" ? "Cash ledger" : "Receipts & cash ledger"}</h3>
          <p>
            Receipts count, money in by mode of payment, money out and running
            balance — {period}-wise.
          </p>
        </div>
        <PDFActions
          viewLabel="View ledger"
          onAction={(m) =>
            api.documents.openPath(
              `finance/ledger/pdf?${query}`,
              `${mode === "cash" ? "cash" : "receipts"}-ledger-${period}.pdf`,
              m,
            )
          }
        >
          Download PDF
        </PDFActions>
      </header>
      <div className="cl-controls">
        <div className="cl-tabs" role="tablist" aria-label="Group by">
          {(["day", "week", "month", "year"] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              className={period === p ? "on" : ""}
              onClick={() => setPeriod(p)}
            >
              {p === "day"
                ? "Daily"
                : p === "week"
                  ? "Weekly"
                  : p === "month"
                    ? "Monthly"
                    : "Yearly"}
            </button>
          ))}
        </div>
        <div className="cl-tabs" role="tablist" aria-label="Mode">
          {(
            [
              ["all", "All receipts"],
              ["cash", "Cash only"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={mode === k}
              className={mode === k ? "on" : ""}
              onClick={() => setMode(k)}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          <span>From</span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          <span>To</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      {!data || !t ? (
        <WorkspaceSkeleton compact label="Loading ledger" />
      ) : (
        <>
          <dl className="cl-tiles">
            <div>
              <dt>Opening balance</dt>
              <dd>{inr(t.opening)}</dd>
              <small>{data.start}</small>
            </div>
            <div>
              <dt>Received</dt>
              <dd>{inr(t.received)}</dd>
              <small>{t.receipts} receipts</small>
            </div>
            <div>
              <dt>Paid out</dt>
              <dd>{inr(t.paid_out)}</dd>
              <small>{t.payments} payments</small>
            </div>
            <div className="cl-strong">
              <dt>Closing balance</dt>
              <dd>{inr(t.closing)}</dd>
              <small>{data.end}</small>
            </div>
          </dl>
          {data.by_mode.length > 0 && (
            <ul className="cl-modes" aria-label="Receipts by mode">
              {data.by_mode.map((m) => (
                <li key={m.mode}>
                  <strong>{m.label}</strong>
                  <span>
                    {m.count} · {inr(m.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="stf-table-wrap">
            <table className="stf-table cl-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th className="num">Receipts</th>
                  <th className="num">Received</th>
                  <th>By mode</th>
                  <th className="num">Payments</th>
                  <th className="num">Paid out</th>
                  <th className="num">Net</th>
                  <th className="num">Closing balance</th>
                </tr>
              </thead>
              <tbody>
                {[...data.groups].reverse().map((g) => (
                  <tr key={g.key}>
                    <td>{g.label}</td>
                    <td className="num">{g.receipts}</td>
                    <td className="num">{inr(g.received)}</td>
                    <td>
                      <small>
                        {Object.entries(g.count_by_mode)
                          .map(([k, n]) => `${MODES[k] || k} ${n}`)
                          .join(" · ") || "—"}
                      </small>
                    </td>
                    <td className="num">{g.payments}</td>
                    <td className="num">{inr(g.paid_out)}</td>
                    <td className="num">{inr(g.net)}</td>
                    <td className="num">
                      <strong>{inr(g.closing)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.groups.length && (
              <p className="stf-empty">
                No receipts or payments in this range.
              </p>
            )}
          </div>
          {data.entries.length > 0 && (
            <details className="cl-entries">
              <summary>Latest entries ({data.entries.length})</summary>
              <div className="stf-table-wrap">
                <table className="stf-table cl-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Receipt / voucher</th>
                      <th>Particulars</th>
                      <th>Mode</th>
                      <th>Transaction no.</th>
                      <th className="num">In</th>
                      <th className="num">Out</th>
                      <th className="num">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.entries.map((e) => (
                      <tr key={`${e.date}-${e.voucher}`}>
                        <td>{formatDate(e.date)}</td>
                        <td>
                          <code className="stf-code">{e.voucher}</code>
                        </td>
                        <td>{e.particulars}</td>
                        <td>{MODES[e.mode] || e.mode}</td>
                        <td>{e.reference || "—"}</td>
                        <td className="num">{Number(e.in) ? inr(e.in) : ""}</td>
                        <td className="num">
                          {Number(e.out) ? inr(e.out) : ""}
                        </td>
                        <td className="num">{inr(e.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}
