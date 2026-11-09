"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  BookOpen,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  Landmark,
  Pencil,
  Printer,
  Receipt,
  X,
  Search,
  Smartphone,
  Wallet,
} from "lucide-react";
import { api, errorText, type PaymentEdit, type PaymentOptions, type PaymentRow, type PaymentStudent } from "@/services/api";
import { apiUrl } from "@/services/api/config";
import { excelTable } from "@/lib/colleges/export-table";
import { Empty, FilterDate, LoadFailed, Panel, rupees, shortDate, Stat } from "./AnalyticsParts";
import PDFActions from "./PDFActions";
import YearPicker from "./YearPicker";
import SideDrawer from "./SideDrawer";
import { toast } from "./toast";
import "./fee-cash.css";

const EMPTY_TYPED = { roll: "", admission: "", level: "", branch: "", from: null as number | null, to: null as number | null };
const SEMESTERS = Array.from({ length: 8 }, (_, i) => i + 1);

function SemesterSelect({ value, onChange, required }: { value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <select required={required} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select semester</option>
      {SEMESTERS.map((n) => (
        <option key={n} value={n}>
          Semester {n}
        </option>
      ))}
    </select>
  );
}

const METHODS = [
  ["cash", "Cash", Wallet],
  ["upi", "UPI", Smartphone],
  ["bank_transfer", "Bank transfer", Landmark],
] as const;
const OTHER = "__other__";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/** Receipt PDF; payments recorded without a receipt record print from the payment itself. */
const receiptPdf = (row: { code: string; receipt_code: string | null; receipt_number: string | null }, mode: "view" | "download") =>
  api.documents.open("receipt", row.receipt_code || row.code, `${row.receipt_number || row.code}.pdf`, mode);

type Mode = "linked" | "manual";

/**
 * Payments and their receipts. "linked" records fees of enrolled students (picked from the
 * register); "manual" records fees with the student's details typed in, before enrollment.
 */
export default function FeePaymentsWorkspace({
  initialTab = "record",
  mode = "linked",
}: {
  initialTab?: "record" | "history" | "students";
  mode?: Mode;
}) {
  const [tab, setTab] = useState(initialTab);
  const manual = mode === "manual";
  return (
    <div className="fcw">
      <header className="fcw-head">
        <div>
          <h1>{manual ? "Manual payments screen" : "Payments & receipts"}</h1>
          <p>
            {manual
              ? "Record fees with the student's details typed in. Each payment gets a receipt, counts in the dashboard and cashbook, and builds the student list for enrollment."
              : "Record a fee for an enrolled student; every payment gets a receipt and enters the cashbook of its method."}
          </p>
        </div>
        <div className="fcw-tabs" role="tablist" aria-label="Payments">
          <button role="tab" aria-selected={tab === "record"} onClick={() => setTab("record")}>
            Record payment
          </button>
          <button role="tab" aria-selected={tab === "history"} onClick={() => setTab("history")}>
            {manual ? "Manual receipts" : "Payments & receipts"}
          </button>
          {manual && (
            <button role="tab" aria-selected={tab === "students"} onClick={() => setTab("students")}>
              Collected student details
            </button>
          )}
        </div>
      </header>
      {tab === "record" ? (
        <RecordPayment key={mode} manual={manual} />
      ) : tab === "history" ? (
        <PaymentHistory source={manual ? "manual" : "linked"} />
      ) : (
        <CollectedStudents />
      )}
    </div>
  );
}

function RecordPayment({ manual }: { manual: boolean }) {
  const [options, setOptions] = useState<PaymentOptions | null>(null);
  const [error, setError] = useState("");
  // Linked: filters that narrow the student search. Manual: the student's details as typed.
  const [filters, setFilters] = useState({ level: "", program: "", year: "" });
  const [typed, setTyped] = useState(EMPTY_TYPED);
  const [semester, setSemester] = useState("");
  const [otherBranch, setOtherBranch] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<PaymentStudent[]>([]);
  const [student, setStudent] = useState<PaymentStudent | null>(null);
  const [head, setHead] = useState("");
  const [customHead, setCustomHead] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number][0]>("cash");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(today());
  const [transactionDate, setTransactionDate] = useState(today());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ code: string; receipt_code: string; receipt_number: string; amount: string; student: string } | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const searchId = useRef(0);

  const loadOptions = useCallback((code?: string) => {
    api.feePayments
      .options(code)
      .then(setOptions)
      .catch((e) => setError(errorText(e)));
  }, []);
  useEffect(() => {
    void Promise.resolve().then(() => loadOptions());
  }, [loadOptions]);
  useEffect(() => {
    if (manual || student) return;
    const id = ++searchId.current;
    // Suggestions appear only once something is typed in the student field.
    if (!query.trim()) {
      const clear = window.setTimeout(() => setMatches([]), 0);
      return () => window.clearTimeout(clear);
    }
    const timer = window.setTimeout(() => {
      api.feePayments
        .students({ q: query, course_level: filters.level, program_code: filters.program, academic_year_code: filters.year })
        .then((r) => id === searchId.current && setMatches(r.items))
        .catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [manual, query, filters, student]);

  const programs = (options?.programs || []).filter((p) => !(manual ? typed.level : filters.level) || p.level === (manual ? typed.level : filters.level));
  const years = (options?.academic_years || []).filter((y) => !filters.program || y.program_code === filters.program);
  const chosenHead = options?.fee_heads.find((h) => h.code === head);
  const groups = useMemo(() => {
    const heads = options?.fee_heads || [];
    const certificate = heads.filter((h) => /certificate/i.test(h.category) || h.code.startsWith("certificate:"));
    return { fees: heads.filter((h) => !certificate.includes(h)), certificate };
  }, [options]);
  const [cursor, setCursor] = useState(0);

  function pick(found: PaymentStudent) {
    setStudent(found);
    setQuery(found.name);
    setMatches([]);
    setFilters({ level: found.course_level || "", program: found.program_code || "", year: found.academic_year_code || "" });
    loadOptions(found.code);
  }
  function reset() {
    setStudent(null);
    setQuery("");
    setTyped(EMPTY_TYPED);
    setOtherBranch(false);
    setSemester("");
    setFilters({ level: "", program: "", year: "" });
    setHead("");
    setCustomHead("");
    setAmount("");
    setReference("");
    setNote("");
    setMethod("cash");
    setPaidOn(today());
    setTransactionDate(today());
    loadOptions();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!manual && !student) return toast.warning("Choose the student from the list");
    if (manual && typed.to !== null && typed.from !== null && typed.to <= typed.from)
      return toast.warning("The academic year must end after it starts");
    setSaving(true);
    try {
      const result = await api.feePayments.record({
        student_code: manual ? null : student!.code,
        payer: manual
          ? {
              name: query.trim(),
              roll_or_reference: typed.roll.trim() || null,
              admission_number: typed.admission.trim() || null,
              course_level: typed.level,
              course_branch: typed.branch.trim(),
              academic_year: `${typed.from}-${typed.to}`,
            }
          : null,
        fee_head_code: head === OTHER ? null : head,
        custom_fee_head: head === OTHER ? customHead.trim() : null,
        amount: Number(amount).toFixed(2),
        method,
        transaction_reference: reference.trim() || null,
        transaction_date: method === "cash" ? null : transactionDate,
        paid_on: method === "cash" ? today() : paidOn,
        note: note.trim() || null,
        semester: semester ? Number(semester) : null,
      });
      setSaved({
        code: String(result.payment.code),
        receipt_code: result.receipt.code,
        receipt_number: result.receipt.receipt_number,
        amount: String(result.payment.amount),
        student: manual ? query.trim() : student!.name,
      });
      setSavedCount((n) => n + 1);
      reset();
      toast.success("Payment recorded", `Receipt ${result.receipt.receipt_number}`);
    } catch (e) {
      toast.error("Payment not recorded", errorText(e));
    } finally {
      setSaving(false);
    }
  }

  if (error && !options) return <LoadFailed message="The payment form could not be loaded." retry={() => loadOptions()} />;
  return (
    <>
    <form className="fcw-card fcw-form" onSubmit={submit}>
      <h2>Student</h2>
      {manual ? (
        <div className="fcw-grid">
          <label className="fcw-wide">
            Student name *
            <input
              required
              minLength={2}
              maxLength={200}
              autoComplete="off"
              placeholder="Full name of the student"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            Student roll / reference no.
            <input maxLength={60} autoComplete="off" value={typed.roll} onChange={(e) => setTyped({ ...typed, roll: e.target.value })} />
          </label>
          <label>
            Student admission number
            <input
              maxLength={60}
              autoComplete="off"
              placeholder="If already assigned"
              value={typed.admission}
              onChange={(e) => setTyped({ ...typed, admission: e.target.value })}
            />
          </label>
          <label>
            Course level *
            <select required value={typed.level} onChange={(e) => setTyped({ ...typed, level: e.target.value, branch: otherBranch ? typed.branch : "" })}>
              <option value="">Select level</option>
              {options?.levels.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Course branch *
            {/* Same dropdown as the other fields; "Other" types a branch not set up as a course. */}
            <select
              required
              value={otherBranch ? OTHER : typed.branch}
              onChange={(e) => {
                const other = e.target.value === OTHER;
                setOtherBranch(other);
                setTyped({ ...typed, branch: other ? "" : e.target.value });
              }}
            >
              <option value="">Select branch</option>
              {programs.map((p) => (
                <option key={p.code} value={p.name}>
                  {p.name}
                </option>
              ))}
              <option value={OTHER}>Other (type the branch)</option>
            </select>
          </label>
          {otherBranch && (
            <label>
              Branch name *
              <input
                required
                maxLength={150}
                autoComplete="off"
                placeholder="e.g. Diploma Automobile"
                value={typed.branch}
                onChange={(e) => setTyped({ ...typed, branch: e.target.value })}
              />
            </label>
          )}
          <fieldset className="fcw-years">
            <legend>Academic year *</legend>
            <YearPicker
              label="Academic year from"
              placeholder="From year"
              required
              value={typed.from}
              onChange={(from) => setTyped({ ...typed, from, to: typed.to && typed.to > from ? typed.to : null })}
            />
            <span aria-hidden="true">to</span>
            <YearPicker
              label="Academic year to"
              placeholder="To year"
              required
              min={(typed.from ?? 1989) + 1}
              value={typed.to}
              onChange={(to) => setTyped({ ...typed, to })}
            />
          </fieldset>
          <label>
            Current semester *
            <SemesterSelect required value={semester} onChange={setSemester} />
          </label>
        </div>
      ) : (
        <>
          <div className="fcw-grid">
            <label className="fcw-wide fcw-student">
              Student name *
              <span className="fcw-search">
                <Search size={15} />
                <input
                  required
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={!student && matches.length > 0}
                  aria-controls="fcw-student-list"
                  placeholder="Type a name, roll, reference or admission number…"
                  value={query}
                  onChange={(e) => {
                    setStudent(null);
                    setQuery(e.target.value);
                    setCursor(0);
                  }}
                  onKeyDown={(e) => {
                    if (student || !matches.length) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setCursor((i) => Math.min(matches.length - 1, i + 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setCursor((i) => Math.max(0, i - 1));
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      pick(matches[cursor]);
                    } else if (e.key === "Escape") setMatches([]);
                  }}
                />
              </span>
              {!student && matches.length > 0 && (
                <ul className="fcw-matches" role="listbox" id="fcw-student-list" aria-label="Matching students">
                  {matches.map((m, i) => (
                    <li key={m.code}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={i === cursor}
                        className={i === cursor ? "is-active" : undefined}
                        onPointerEnter={() => setCursor(i)}
                        onClick={() => pick(m)}
                      >
                        <span className="fcw-avatar" aria-hidden="true">
                          {m.name
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join("")
                            .toUpperCase()}
                        </span>
                        <span className="fcw-match-text">
                          <strong>{m.name}</strong>
                          <small>
                            {[m.admission_number, m.reference_number || m.roll_number].filter(Boolean).join(" · ") || "No admission number"}
                          </small>
                        </span>
                        <span className="fcw-match-course">
                          <BookOpen size={13} aria-hidden="true" />
                          {[m.course_name, m.academic_year].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </label>
            <label>
              Student roll / reference no.
              <input readOnly value={student ? student.roll_number || student.reference_number || "—" : ""} placeholder="Filled from the student" />
            </label>
            <label>
              Student admission number
              <input readOnly value={student?.admission_number || ""} placeholder="Filled from the student" />
            </label>
            <label>
              Course level
              <select value={filters.level} disabled={!!student} onChange={(e) => setFilters({ level: e.target.value, program: "", year: "" })}>
                <option value="">All levels</option>
                {options?.levels.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Course branch
              <select value={filters.program} disabled={!!student} onChange={(e) => setFilters({ ...filters, program: e.target.value, year: "" })}>
                <option value="">All courses</option>
                {programs.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Academic year
              <select value={filters.year} disabled={!!student} onChange={(e) => setFilters({ ...filters, year: e.target.value })}>
                <option value="">{student?.academic_year || "All years"}</option>
                {years.map((y) => (
                  <option key={y.code} value={y.code}>
                    {y.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {student && (
            <button type="button" className="fcw-link" onClick={reset}>
              Change student
            </button>
          )}
        </>
      )}

      <h2>Payment</h2>
      <div className="fcw-grid">
        {!manual && (
          <label>
            Current semester
            <SemesterSelect value={semester} onChange={setSemester} />
          </label>
        )}
        <label>
          Fee paid for *
          <select required value={head} onChange={(e) => setHead(e.target.value)}>
            <option value="">Select fee head</option>
            <optgroup label="Fees">
              {groups.fees.map((h) => (
                <option key={h.code} value={h.code}>
                  {h.name}
                  {!manual && Number(h.outstanding) > 0 ? ` · due ${rupees(Number(h.outstanding))}` : ""}
                </option>
              ))}
            </optgroup>
            <optgroup label="Certificates">
              {groups.certificate.map((h) => (
                <option key={h.code} value={h.code}>
                  {h.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Other">
              <option value={OTHER}>Other (new fee head)…</option>
            </optgroup>
          </select>
        </label>
        {head === OTHER && (
          <label>
            Name of the fee *
            <input required minLength={2} maxLength={150} value={customHead} onChange={(e) => setCustomHead(e.target.value)} />
          </label>
        )}
        <label>
          Amount (₹) *
          <input
            required
            inputMode="decimal"
            pattern="[0-9]+(\.[0-9]{1,2})?"
            title="Amount in rupees, e.g. 1500 or 1500.50"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          />
          {!manual && chosenHead && Number(chosenHead.outstanding) > 0 && (
            <small>Outstanding for this fee: {rupees(Number(chosenHead.outstanding))}</small>
          )}
        </label>
        {method === "cash" ? (
          <label className="anw-filter">
            Payment date *
            <input type="date" value={today()} readOnly aria-readonly="true" title="Cash is recorded on today's date" />
            <small className="fcw-hint">Cash is recorded on today&apos;s date.</small>
          </label>
        ) : (
          <FilterDate label="Payment date *" value={paidOn} onChange={setPaidOn} />
        )}
      </div>
      <fieldset className="fcw-methods">
        <legend>Fee payment method *</legend>
        {METHODS.map(([key, label, Icon]) => (
          <label key={key} className={method === key ? "is-on" : ""}>
            <input type="radio" name="method" value={key} checked={method === key} onChange={() => setMethod(key)} />
            <Icon size={17} /> {label}
          </label>
        ))}
      </fieldset>
      <div className="fcw-grid">
        {method !== "cash" && (
          <label>
            Transaction date *
            <input
              type="date"
              required
              max={paidOn || today()}
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
            />
          </label>
        )}
        {method !== "cash" && (
          <label>
            {method === "bank_transfer" ? "Transaction number *" : "UPI transaction ID"}
            <input
              required={method === "bank_transfer"}
              maxLength={100}
              autoComplete="off"
              spellCheck={false}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
        )}
        {method !== "cash" && (
          <small className="fcw-wide fcw-hint">
            Transaction date is when the money was transferred; the receipt shows it as proof of the transfer date.
          </small>
        )}
        <label className="fcw-wide">
          Note
          <input maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      <footer className="fcw-actions">
        <span>Cash goes to the cash ledger, UPI to the UPI ledger and bank transfers to the bank ledger.</span>
        <button className="fcw-primary" disabled={saving || (!manual && !student)}>
          <CreditCard size={15} /> {saving ? "Saving…" : "Save payment"}
        </button>
      </footer>
    </form>
    <TodayCollection refresh={savedCount} />
    {saved && <ReceiptPrintDialog receipt={saved} onClose={() => setSaved(null)} />}
    </>
  );
}

/** Today's collections across both payment screens, shown under the form and refreshed on each save. */
function TodayCollection({ refresh }: { refresh: number }) {
  const [data, setData] = useState<{ cash: number; digital: number; total: number; payments: number } | null>(null);
  useEffect(() => {
    const day = today();
    api.feePayments
      .analytics({ start: day, end: day })
      .then((r) => {
        const sum = (keys: string[]) =>
          r.by_method.filter((m) => keys.includes(m.method)).reduce((n, m) => n + Number(m.amount), 0);
        setData({ cash: sum(["cash"]), digital: sum(["upi", "bank_transfer"]), total: Number(r.summary.amount), payments: r.summary.payments });
      })
      .catch(() => setData(null));
  }, [refresh]);
  return (
    <section className="fcw-today" aria-label="Today's collection">
      <h2>Today&apos;s collection</h2>
      <div className="fcw-stats">
        <Stat icon={Wallet} label="Cash today" value={data ? rupees(data.cash) : "—"} hint="In the cash ledger" />
        <Stat icon={Smartphone} label="UPI & bank transfer today" value={data ? rupees(data.digital) : "—"} hint="In the UPI and bank ledgers" />
        <Stat
          icon={Receipt}
          label="Total amount today"
          value={data ? rupees(data.total) : "—"}
          hint={data ? `${data.payments} payment${data.payments === 1 ? "" : "s"} recorded` : undefined}
        />
      </div>
    </section>
  );
}

/**
 * Shown when a payment is saved: the receipt in two copies (admin / staff and student), sent to
 * the printer as soon as it loads; it can be printed again or saved as a PDF.
 */
function ReceiptPrintDialog({
  receipt,
  onClose,
}: {
  receipt: { code: string; receipt_code: string; receipt_number: string; amount: string; student: string };
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const printed = useRef(false);
  const filename = `${receipt.receipt_number || receipt.code}-receipt.pdf`;
  useEffect(() => {
    dialog.current?.showModal();
    let link = "";
    fetch(apiUrl(`documents/receipt/${encodeURIComponent(receipt.receipt_code || receipt.code)}/view?copies=2`), { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("The receipt could not be prepared.");
        link = URL.createObjectURL(new Blob([await r.blob()], { type: "application/pdf" }));
        setUrl(link);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "The receipt could not be prepared."));
    return () => {
      if (link) URL.revokeObjectURL(link);
    };
  }, [receipt]);
  const print = () => {
    try {
      frame.current?.contentWindow?.focus();
      frame.current?.contentWindow?.print();
    } catch {
      toast.warning("Use Print in the preview", "Your browser did not allow printing from here.");
    }
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };
  return (
    <dialog ref={dialog} className="fcw-print" aria-labelledby="fcw-print-title" onClose={onClose} onCancel={onClose}>
      <header>
        <CheckCircle2 size={26} aria-hidden="true" />
        <div>
          <h2 id="fcw-print-title">
            {rupees(Number(receipt.amount))} received from {receipt.student}
          </h2>
          <p>Receipt {receipt.receipt_number} · two copies: admin / staff copy and student copy</p>
        </div>
        <button type="button" className="fcw-icon" aria-label="Close" onClick={() => dialog.current?.close()}>
          <X size={18} />
        </button>
      </header>
      <div className="fcw-print-body">
        {error ? (
          <p className="fcw-print-note" role="alert">{error}</p>
        ) : url ? (
          <iframe
            ref={frame}
            src={url}
            title={`Receipt ${receipt.receipt_number}`}
            onLoad={() => {
              if (printed.current) return;
              printed.current = true;
              window.setTimeout(print, 400);
            }}
          />
        ) : (
          <p className="fcw-print-note" role="status">Preparing the receipt…</p>
        )}
      </div>
      <footer className="fcw-actions">
        <span>Give the student copy to the student or parent; keep the admin / staff copy with the accounts office.</span>
        <button type="button" className="fcw-secondary" disabled={!url} onClick={download}>
          <Download size={15} /> Save as PDF
        </button>
        <button type="button" className="fcw-primary" disabled={!url} onClick={print}>
          <Printer size={15} /> Print both copies
        </button>
      </footer>
    </dialog>
  );
}

export function PaymentHistory({ fixedMethod, source = "all" }: { fixedMethod?: string; source?: "all" | "manual" | "linked" }) {
  const [rows, setRows] = useState<PaymentRow[] | null>(null);
  const [totals, setTotals] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [method, setMethod] = useState(fixedMethod || "");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<PaymentRow | null>(null);
  const [editing, setEditing] = useState<PaymentRow | null>(null);
  const load = useCallback(() => {
    setError("");
    api.feePayments
      .history({ method: fixedMethod || method, start, end, q: query, source })
      .then((r) => {
        setRows(r.items);
        setTotals(r.totals_by_method);
      })
      .catch((e) => setError(errorText(e)));
  }, [fixedMethod, method, start, end, query, source]);
  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);
  const days = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const r of rows || []) {
      if (r.status !== "settled") continue;
      // UPI and bank ledgers follow the day the money actually moved.
      const day = r.transaction_date || r.paid_on;
      const item = map.get(day) || { total: 0, count: 0 };
      item.total += Number(r.amount);
      item.count += 1;
      map.set(day, item);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, 10);
  }, [rows]);
  if (error && !rows) return <LoadFailed message="Payments could not be loaded." retry={load} />;
  return (
    <div className="fcw-stack">
      <div className="fcw-filters">
        {!fixedMethod && (
          <div className="fcw-chips" role="group" aria-label="Payment method">
            {[["", "All methods"], ...METHODS.map(([k, l]) => [k, l])].map(([key, label]) => (
              <button key={key} aria-pressed={method === key} onClick={() => setMethod(key)}>
                {label}
              </button>
            ))}
          </div>
        )}
        <FilterDate label="From" value={start} onChange={setStart} />
        <FilterDate label="To" value={end} onChange={setEnd} />
        <label className="fcw-search">
          <Search size={15} />
          <input aria-label="Search payments" placeholder="Student, receipt or transaction…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>
      <div className="fcw-stats">
        {METHODS.filter(([key]) => !fixedMethod || key === fixedMethod).map(([key, label, Icon]) => (
          <Stat key={key} icon={Icon} label={`${label} collected`} value={rupees(Number(totals[key] || 0))} hint="Selected period" />
        ))}
      </div>
      {fixedMethod && (
        <Panel title="Day-wise collection">
          {days.length ? (
            <div className="anw-table">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Payments</th>
                    <th>Collected</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map(([day, item]) => (
                    <tr key={day}>
                      <td>{shortDate(day)}</td>
                      <td>{item.count}</td>
                      <td>{rupees(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No payments in this period.</Empty>
          )}
        </Panel>
      )}
      <Panel title={`Payments${rows ? ` (${rows.length})` : ""}`}>
        {!rows ? (
          <div className="anw-skeleton" />
        ) : rows.length ? (
          <div className="anw-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Receipt no.</th>
                  <th>Student</th>
                  <th>Paid for</th>
                  <th>Method</th>
                  <th>Transaction</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code}>
                    <td>{shortDate(r.paid_on)}</td>
                    <td>{r.receipt_number || "—"}</td>
                    <td>
                      {r.student_name}
                      {r.admission_number ? <small className="fcw-sub">{r.admission_number}</small> : null}
                    </td>
                    <td>{r.purpose}</td>
                    <td>{r.method_label}</td>
                    <td>
                      {r.transaction_reference || "—"}
                      {r.transaction_date && r.transaction_date !== r.paid_on ? (
                        <small className="fcw-sub">Paid {shortDate(r.transaction_date)}</small>
                      ) : null}
                    </td>
                    <td>{rupees(Number(r.amount))}</td>
                    <td>
                      <span className="fcw-row-actions">
                        <button
                          type="button"
                          className="fcw-icon"
                          aria-label={`View payment ${r.receipt_number || r.code}`}
                          title="View payment and receipt"
                          onClick={() => setOpen(r)}
                        >
                          <Eye size={16} />
                        </button>
                        {source === "manual" && (
                          <button
                            type="button"
                            className="fcw-icon"
                            aria-label={`Edit payment ${r.receipt_number || r.code}`}
                            title="Edit payment"
                            onClick={() => setEditing(r)}
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No payments match these filters.</Empty>
        )}
      </Panel>
      {open && (
        <PaymentDetails
          row={open}
          onClose={() => setOpen(null)}
          onEdit={
            source === "manual"
              ? () => {
                  setEditing(open);
                  setOpen(null);
                }
              : undefined
          }
        />
      )}
      {editing && (
        <EditPayment
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function wordsBelow1000(n: number): string {
  const two = (x: number) => (x < 20 ? ONES[x] : `${TENS[Math.floor(x / 10)]}${x % 10 ? ` ${ONES[x % 10]}` : ""}`);
  return n >= 100 ? `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${two(n % 100)}` : ""}` : two(n);
}
function wholeWords(n: number): string {
  const parts: string[] = [];
  for (const [size, name] of [[1e7, "crore"], [1e5, "lakh"], [1e3, "thousand"]] as const) {
    if (n >= size) {
      parts.push(`${size === 1e7 ? wholeWords(Math.floor(n / size)) : wordsBelow1000(Math.floor(n / size))} ${name}`);
      n %= size;
    }
  }
  if (n) parts.push(wordsBelow1000(n));
  return parts.join(" ");
}
/** Indian-style amount in words, as printed on the receipt: "Twelve thousand five hundred rupees only". */
function amountInWords(value: number) {
  const rupeesPart = Math.floor(value);
  const paise = Math.round((value - rupeesPart) * 100);
  const text = `${wholeWords(rupeesPart) || "zero"} rupees${paise ? ` and ${wholeWords(paise)} paise` : ""} only`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Payment overview laid out like the printed receipt (same blocks, labels and order as the PDF). */
function PaymentDetails({ row, onClose, onEdit }: { row: PaymentRow; onClose: () => void; onEdit?: () => void }) {
  const manualRow = !row.student_code;
  const number = row.receipt_number || row.code;
  const amount = rupees(Number(row.amount));
  const student: [string, string | null | undefined][] = [
    ["Name", row.student_name],
    ["Admission no.", row.admission_number || (manualRow ? "Not assigned yet" : null)],
    ["Course", row.course_branch],
    ["Academic year", row.academic_year],
    [manualRow ? "Course level" : "Section", row.course_level],
    ["Current semester", row.semester ? `Semester ${row.semester}` : null],
    [manualRow ? "Roll / reference no." : "Student ID", manualRow ? row.roll_or_reference : row.student_code],
  ];
  const payment: [string, string | null | undefined][] = [
    ["Receipt no.", number],
    ["Payment date", shortDate(row.paid_on)],
    ["Mode of payment", row.method_label],
    ["Transaction date", row.transaction_date ? shortDate(row.transaction_date) : null],
    ["Transaction no.", row.transaction_reference || (row.method === "cash" ? "Cash — no reference" : "—")],
    ["Status", row.status ? row.status.charAt(0).toUpperCase() + row.status.slice(1) : "—"],
  ];
  const list = (items: [string, string | null | undefined][]) => (
    <dl>
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
  return (
    <SideDrawer title={`Receipt ${number}`} subtitle={`${row.student_name} · ${row.purpose}`} onClose={onClose} expanded>
      <div className="fcw-drawer-form rcp">
        <header className="rcp-band">
          <div>
            <strong>FEE RECEIPT</strong>
            <span>No. {number}</span>
          </div>
          <small>Issued {shortDate(row.paid_on)}</small>
        </header>
        <div className="rcp-tiles">
          <div>
            <small>Fee paid for</small>
            <strong>{row.purpose}</strong>
            <em>{row.semester ? `Semester ${row.semester}` : "—"}</em>
          </div>
          <div>
            <small>Mode of payment</small>
            <strong>{row.method_label}</strong>
            <em>{row.transaction_reference || (row.method === "cash" ? "No reference" : "—")}</em>
          </div>
          <div>
            <small>Payment date</small>
            <strong>{shortDate(row.paid_on)}</strong>
            <em>{manualRow ? "Recorded before enrollment" : "On the student's fee account"}</em>
          </div>
          <div className="is-dark">
            <small>Amount received</small>
            <strong>{amount}</strong>
            <em>
              {row.method_label} · {shortDate(row.paid_on)}
            </em>
          </div>
        </div>
        <div className="rcp-panels">
          <section>
            <h3>Student</h3>
            {list(student)}
          </section>
          <section>
            <h3>Payment</h3>
            {list(payment)}
          </section>
        </div>
        <h3 className="rcp-section">What this payment was for</h3>
        <table className="rcp-table">
          <thead>
            <tr>
              <th>Fee head</th>
              <th>Term</th>
              <th>Paid now (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{row.purpose}</td>
              <td>{row.semester ? `Semester ${row.semester}` : "—"}</td>
              <td>{Number(row.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>Total received</td>
              <td />
              <td>{Number(row.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>
        <div className="rcp-highlight">
          <div>
            <strong>Amount received</strong>
            <span>{amountInWords(Number(row.amount))}</span>
          </div>
          <span className={`rcp-stamp ${row.status === "settled" ? "" : "is-alert"}`}>
            {row.status === "settled" ? "PAID" : (row.status || "received").toUpperCase()}
          </span>
          <b>{amount}</b>
        </div>
        {row.note && <p className="rcp-note">Note: {row.note}</p>}
        {row.edited_at && <p className="rcp-note">Corrected on {shortDate(row.edited_at)}.</p>}
        <footer className="fcw-actions">
          {onEdit && (
            <button type="button" className="fcw-secondary" onClick={onEdit}>
              <Pencil size={15} /> Edit payment
            </button>
          )}
          <PDFActions viewLabel="View receipt PDF" onAction={(mode) => receiptPdf(row, mode)}>
            <Receipt size={15} /> Download receipt PDF
          </PDFActions>
        </footer>
      </div>
    </SideDrawer>
  );
}

const LEVEL_OPTIONS = [
  ["intermediate", "Intermediate"],
  ["degree", "Degree"],
  ["polytechnic", "Polytechnic"],
  ["bped", "B.P.Ed"],
  ["mped", "M.P.Ed"],
] as const;

/**
 * Correct a manual payment. The admin's save applies at once; for any other role the change goes
 * to the admin as a change request and the payment stays as it is until the admin approves it.
 */
function EditPayment({ row, onClose, onSaved }: { row: PaymentRow; onClose: () => void; onSaved: () => void }) {
  const [from, to] = String(row.academic_year || "").split("-").map((y) => Number(y) || null);
  const [form, setForm] = useState({
    name: row.student_name || "",
    roll: row.roll_or_reference || "",
    admission: row.admission_number || "",
    level: row.course_level_code || "",
    branch: row.course_branch || "",
    from: from ?? null,
    to: to ?? null,
    semester: row.semester ? String(row.semester) : "",
    amount: String(Number(row.amount)),
    method: row.method,
    reference: row.transaction_reference || "",
    transactionDate: row.transaction_date || row.paid_on,
    paidOn: row.paid_on,
    note: row.note || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  async function save(event: FormEvent) {
    event.preventDefault();
    if (form.from === null || form.to === null || form.to <= form.from)
      return toast.warning("The academic year must end after it starts");
    const body: PaymentEdit = {
      payer: {
        name: form.name.trim(),
        roll_or_reference: form.roll.trim() || null,
        admission_number: form.admission.trim() || null,
        course_level: form.level,
        course_branch: form.branch.trim(),
        academic_year: `${form.from}-${form.to}`,
      },
      semester: Number(form.semester),
      amount: Number(form.amount).toFixed(2),
      method: form.method,
      transaction_reference: form.method === "cash" ? null : form.reference.trim() || null,
      transaction_date: form.method === "cash" ? null : form.transactionDate,
      paid_on: form.paidOn,
      note: form.note.trim() || null,
    };
    setSaving(true);
    try {
      const result = await api.feePayments.edit(row.code, body);
      if (result.pending_approval) toast.success("Sent for approval", "The payment changes once the admin approves it.");
      else if (result.unchanged) toast.info("Nothing changed");
      else toast.success("Payment updated", `Receipt ${row.receipt_number || row.code}`);
      onSaved();
    } catch (e) {
      toast.error("Payment not updated", errorText(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <SideDrawer title={`Edit payment · ${row.receipt_number || row.code}`} subtitle={row.student_name} onClose={onClose}>
      <form className="fcw-drawer-form fcw-form" onSubmit={save}>
        <p className="fcw-hint rcp-edit-hint">
          The receipt number stays the same. Changes made by roles other than the admin are sent to the admin and apply only
          after approval.
        </p>
        <div className="fcw-grid">
          <label className="fcw-wide">
            Student name *
            <input required minLength={2} maxLength={200} value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label>
            Roll / reference no.
            <input maxLength={60} value={form.roll} onChange={(e) => set({ roll: e.target.value })} />
          </label>
          <label>
            Admission number
            <input maxLength={60} value={form.admission} onChange={(e) => set({ admission: e.target.value })} />
          </label>
          <label>
            Course level *
            <select required value={form.level} onChange={(e) => set({ level: e.target.value })}>
              <option value="">Select level</option>
              {LEVEL_OPTIONS.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Course branch *
            <input required maxLength={150} value={form.branch} onChange={(e) => set({ branch: e.target.value })} />
          </label>
          <fieldset className="fcw-years fcw-wide">
            <legend>Academic year *</legend>
            <YearPicker label="From year" placeholder="From year" required value={form.from} onChange={(y) => set({ from: y })} />
            <span>to</span>
            <YearPicker
              label="To year"
              placeholder="To year"
              required
              min={form.from ? form.from + 1 : undefined}
              value={form.to}
              onChange={(y) => set({ to: y })}
            />
          </fieldset>
          <label>
            Current semester *
            <SemesterSelect required value={form.semester} onChange={(v) => set({ semester: v })} />
          </label>
          <label>
            Amount (₹) *
            <input
              required
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => set({ amount: e.target.value.replace(/[^0-9.]/g, "") })}
            />
          </label>
          <label>
            Payment date *
            <input type="date" required max={today()} value={form.paidOn} onChange={(e) => set({ paidOn: e.target.value })} />
          </label>
          <label>
            Payment method *
            <select value={form.method} onChange={(e) => set({ method: e.target.value })}>
              {METHODS.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {form.method !== "cash" && (
            <>
              <label>
                Transaction date *
                <input
                  type="date"
                  required
                  max={form.paidOn}
                  value={form.transactionDate}
                  onChange={(e) => set({ transactionDate: e.target.value })}
                />
              </label>
              <label>
                {form.method === "bank_transfer" ? "Transaction number *" : "UPI transaction ID"}
                <input
                  required={form.method === "bank_transfer"}
                  maxLength={100}
                  value={form.reference}
                  onChange={(e) => set({ reference: e.target.value })}
                />
              </label>
            </>
          )}
          <label className="fcw-wide">
            Note
            <input maxLength={300} value={form.note} onChange={(e) => set({ note: e.target.value })} />
          </label>
        </div>
        <footer className="fcw-actions">
          <button type="button" className="fcw-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="fcw-primary" disabled={saving}>
            <Pencil size={15} /> {saving ? "Saving…" : "Save changes"}
          </button>
        </footer>
      </form>
    </SideDrawer>
  );
}

type Collected = {
  name: string;
  roll_or_reference: string | null;
  admission_number: string | null;
  course_level: string | null;
  course_branch: string | null;
  academic_year: string | null;
  semester?: number | null;
  payments: number;
  total_paid: string;
  first_paid_on: string | null;
  last_paid_on: string | null;
};
const COLLECTED: [string, (c: Collected) => string][] = [
  ["Student name", (c) => c.name],
  ["Roll / reference no.", (c) => c.roll_or_reference || "—"],
  ["Admission number", (c) => c.admission_number || "—"],
  ["Course level", (c) => c.course_level || "—"],
  ["Course branch", (c) => c.course_branch || "—"],
  ["Academic year", (c) => c.academic_year || "—"],
  ["Current semester", (c) => (c.semester ? `Semester ${c.semester}` : "—")],
  ["Payments", (c) => String(c.payments)],
  ["Total paid", (c) => rupees(Number(c.total_paid))],
  ["Last paid", (c) => shortDate(c.last_paid_on)],
];

/** Students captured from manual payments, ready to enroll later. */
function CollectedStudents() {
  const [rows, setRows] = useState<Collected[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const load = useCallback(() => {
    setError("");
    api.feePayments
      .collectedStudents()
      .then((r) => setRows(r.items as Collected[]))
      .catch((e) => setError(errorText(e)));
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  if (error && !rows) return <LoadFailed message="Collected student details could not be loaded." retry={load} />;
  const shown = (rows || []).filter((r) => COLLECTED.map(([, v]) => v(r)).join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className="fcw-stack">
      <div className="fcw-filters">
        <label className="fcw-search">
          <Search size={15} />
          <input aria-label="Search students" placeholder="Name, roll, admission number or course…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button
          className="fcw-primary"
          disabled={!shown.length}
          onClick={() =>
            excelTable(
              `collected-students-${today()}`,
              "Student details collected from manual payments",
              COLLECTED.map(([label]) => label),
              shown.map((r) => COLLECTED.map(([, value]) => value(r))),
            )
          }
        >
          <Download size={15} /> Export to Excel
        </button>
      </div>
      <Panel title={`Students${rows ? ` (${shown.length})` : ""}`}>
        {!rows ? (
          <div className="anw-skeleton" />
        ) : shown.length ? (
          <div className="anw-table">
            <table>
              <thead>
                <tr>
                  {COLLECTED.map(([label]) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => (
                  <tr key={`${r.name}-${r.admission_number || r.roll_or_reference || i}`}>
                    {COLLECTED.map(([label, value]) => (
                      <td key={label}>{value(r)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No student details collected yet. They appear here as manual payments are recorded.</Empty>
        )}
      </Panel>
    </div>
  );
}
