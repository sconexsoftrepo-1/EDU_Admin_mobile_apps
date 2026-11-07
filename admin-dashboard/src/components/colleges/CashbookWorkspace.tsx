"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowRightLeft, Banknote, BarChart3, Check, Clock, Landmark, Smartphone, Users, Wallet, X } from "lucide-react";
import { api, errorText, type CashDeposit, type CashOverview, type CashTransfer } from "@/services/api";
import { Empty, LoadFailed, Panel, rupees, shortDate, Stat } from "./AnalyticsParts";
import FeeCollectionAnalytics from "./FeeCollectionAnalytics";
import { PaymentHistory } from "./FeePaymentsWorkspace";
import SideDrawer from "./SideDrawer";
import { toast } from "./toast";
import "./fee-cash.css";

const STATUS: Record<CashTransfer["status"], string> = {
  assigned: "Waiting for clerk",
  collected: "Collected by clerk",
  deposited: "Deposited · slip pending",
  awaiting_review: "Slip to review",
  settled: "Completed",
  cancelled: "Cancelled",
};
const DEPOSIT: Record<CashDeposit["status"], string> = {
  awaiting_proof: "Deposited, not confirmed",
  awaiting_review: "Slip uploaded",
  accepted: "Accepted",
  rejected: "Rejected",
};
const today = () => new Date().toISOString().slice(0, 10);

/** Cash, UPI and bank ledgers, the daily cash book and cash handed to clerks for deposit. */
export default function CashbookWorkspace() {
  const [data, setData] = useState<CashOverview | null>(null);
  const [error, setError] = useState("");
  const [ledger, setLedger] = useState<"cash" | "upi" | "bank_transfer" | "analytics">("cash");
  const [assigning, setAssigning] = useState(false);
  const [reviewing, setReviewing] = useState<{ transfer: CashTransfer; deposit: CashDeposit } | null>(null);
  const load = useCallback(() => {
    setError("");
    return api.feePayments
      .cash()
      .then(setData)
      .catch((e) => setError(errorText(e)));
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  const act = async (work: Promise<unknown>, done: string) => {
    try {
      await work;
      toast.success(done);
      await load();
    } catch (e) {
      toast.error("Not saved", errorText(e));
    }
  };

  if (error && !data) return <LoadFailed message="The cashbook could not be loaded." retry={load} />;
  if (!data)
    return (
      <div className="anw-loading" role="status" aria-label="Loading cashbook…">
        <div className="anw-skeleton" />
        <div className="anw-skeleton anw-skeleton-tall" />
      </div>
    );
  const open = data.transfers.filter((t) => !["settled", "cancelled"].includes(t.status));
  const done = data.transfers.filter((t) => ["settled", "cancelled"].includes(t.status));
  const toReview = data.transfers.flatMap((t) => t.deposits.filter((d) => d.status === "awaiting_review").map((d) => ({ transfer: t, deposit: d })));
  return (
    <div className="fcw">
      <header className="fcw-head">
        <div>
          <h1>Cashbook</h1>
          <p>Daily cash book with clerk deposits, and separate UPI and bank transfer ledgers.</p>
        </div>
        {data.can_manage && (
          <button className="fcw-primary" onClick={() => setAssigning(true)}>
            <ArrowRightLeft size={15} /> Transfer cash
          </button>
        )}
      </header>
      <div className="fcw-stats">
        <Stat icon={Wallet} label="Cash in hand (college)" value={rupees(Number(data.cash_in_hand))} hint="Closing cash today" />
        <Stat icon={Banknote} label="With admin" value={rupees(Number(data.with_admin))} hint="Available to hand over" />
        <Stat icon={Users} label="With clerks" value={rupees(Number(data.with_clerks))} hint="Not yet deposited" />
        <Stat icon={Clock} label="Waiting for clerk" value={rupees(Number(data.awaiting_collection))} hint="Assigned, not collected" />
      </div>
      {toReview.length > 0 && (
        <Panel title={`Deposit slips to review (${toReview.length})`} className="fcw-alert">
          <ul className="fcw-list">
            {toReview.map(({ transfer, deposit }) => (
              <li key={deposit.code}>
                <div>
                  <strong>
                    {transfer.clerk_name} deposited {rupees(Number(deposit.amount))}
                  </strong>
                  <small>
                    On {shortDate(deposit.deposited_on)} of {rupees(Number(transfer.amount))} handed over
                  </small>
                </div>
                <button className="fcw-primary" onClick={() => setReviewing({ transfer, deposit })}>
                  Review slip
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <div className="fcw-tabs" role="tablist" aria-label="Ledger">
        {(
          [
            ["cash", "Cash ledger", Wallet],
            ["upi", "UPI ledger", Smartphone],
            ["bank_transfer", "Bank transfer ledger", Landmark],
            ["analytics", "Collection analytics", BarChart3],
          ] as const
        ).map(([key, label, Icon]) => (
          <button key={key} role="tab" aria-selected={ledger === key} onClick={() => setLedger(key)}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      {ledger === "cash" ? (
        <>
          <Panel title="Daily cash book">
            {data.ledger.length ? (
              <div className="anw-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Opening</th>
                      <th>Cash received</th>
                      <th>Cash paid out</th>
                      <th>Deposited to bank</th>
                      <th>Closing</th>
                      <th>With admin</th>
                      <th>With clerks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.ledger].reverse().map((row) => (
                      <tr key={row.date}>
                        <td>{shortDate(row.date)}</td>
                        <td>{rupees(Number(row.opening))}</td>
                        <td>{rupees(Number(row.received))}</td>
                        <td>{rupees(Number(row.paid))}</td>
                        <td>{rupees(Number(row.deposited))}</td>
                        <td>
                          <strong>{rupees(Number(row.closing))}</strong>
                        </td>
                        <td>{rupees(Number(row.with_admin))}</td>
                        <td>{rupees(Number(row.with_clerks))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>No cash has been received yet.</Empty>
            )}
          </Panel>
          <Panel title="Cash handed to clerks">
            {open.length + done.length ? (
              <div className="anw-table">
                <table>
                  <thead>
                    <tr>
                      <th>Assigned</th>
                      <th>Clerk</th>
                      <th>Amount</th>
                      <th>Deposited (accepted)</th>
                      <th>With clerk</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...open, ...done].map((t) => (
                      <tr key={t.code}>
                        <td>{shortDate(t.assigned_at)}</td>
                        <td>{t.clerk_name}</td>
                        <td>{rupees(Number(t.amount))}</td>
                        <td>{rupees(Number(t.accepted_amount))}</td>
                        <td>{rupees(Number(t.with_clerk))}</td>
                        <td>
                          <span className={`fcw-status is-${t.status}`}>{STATUS[t.status]}</span>
                          {t.deposits.map((d) => (
                            <small key={d.code} className="fcw-sub">
                              {rupees(Number(d.amount))} on {shortDate(d.deposited_on)} · {DEPOSIT[d.status]}
                              {d.review_note ? ` · ${d.review_note}` : ""}
                            </small>
                          ))}
                        </td>
                        <td className="fcw-row-actions">
                          {data.can_manage && t.status === "assigned" && (
                            <button onClick={() => act(api.feePayments.cancel(t.code), "Transfer cancelled")}>Cancel</button>
                          )}
                          {data.can_manage && !["assigned", "cancelled", "settled"].includes(t.status) && Number(t.can_deposit) > 0 && (
                            <button
                              onClick={() =>
                                act(api.feePayments.returned(t.code, t.can_deposit, today()), "Recorded as returned to cash")
                              }
                            >
                              Returned {rupees(Number(t.can_deposit))}
                            </button>
                          )}
                          {t.deposits
                            .filter((d) => d.status === "awaiting_review")
                            .map((d) => (
                              <button key={d.code} className="fcw-primary" onClick={() => setReviewing({ transfer: t, deposit: d })}>
                                Review slip
                              </button>
                            ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>No cash has been handed to clerks yet.</Empty>
            )}
          </Panel>
        </>
      ) : ledger === "analytics" ? (
        <FeeCollectionAnalytics />
      ) : (
        <PaymentHistory key={ledger} fixedMethod={ledger} />
      )}
      {assigning && <TransferCash data={data} onClose={() => setAssigning(false)} onDone={load} />}
      {reviewing && (
        <ReviewSlip
          {...reviewing}
          onClose={() => setReviewing(null)}
          onDone={async () => {
            setReviewing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function TransferCash({ data, onClose, onDone }: { data: CashOverview; onClose: () => void; onDone: () => Promise<unknown> }) {
  const [clerk, setClerk] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const available = Number(data.with_admin);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.feePayments.assign({ clerk_account: clerk, amount: Number(amount).toFixed(2), note: note.trim() || undefined });
      toast.success("Cash assigned", "The clerk accepts it in the staff app.");
      await onDone();
      onClose();
    } catch (e) {
      toast.error("Not assigned", errorText(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <SideDrawer title="Transfer cash to a clerk" subtitle="The clerk collects it, deposits it at the bank and uploads the slip." onClose={onClose}>
      <form className="fcw-form fcw-drawer-form" onSubmit={submit}>
        <dl className="fcw-balance">
          <div>
            <dt>Today&apos;s cash balance</dt>
            <dd>{rupees(Number(data.cash_in_hand))}</dd>
          </div>
          <div>
            <dt>With admin (can transfer)</dt>
            <dd>{rupees(available)}</dd>
          </div>
          <div>
            <dt>Already with clerks</dt>
            <dd>{rupees(Number(data.with_clerks) + Number(data.awaiting_collection))}</dd>
          </div>
        </dl>
        <label>
          Clerk *
          <select required value={clerk} onChange={(e) => setClerk(e.target.value)}>
            <option value="">Select clerk</option>
            {data.clerks.map((c) => (
              <option key={c.account_code} value={c.account_code}>
                {c.name}
              </option>
            ))}
          </select>
          {!data.clerks.length && <small>Give a staff member the “Cash Clerk” role and a staff app login first.</small>}
        </label>
        <label>
          Amount to give the clerk (₹) *
          <input
            required
            inputMode="decimal"
            pattern="[0-9]+(\.[0-9]{1,2})?"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          />
          {Number(amount) > 0 && Number(amount) <= available && (
            <small>Cash left with admin: {rupees(available - Number(amount))}</small>
          )}
          {Number(amount) > available && <small className="fcw-warn">More than the cash with the admin.</small>}
        </label>
        <label>
          Note
          <input maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Deposit at SBI main branch" />
        </label>
        <footer className="fcw-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="fcw-primary" disabled={saving || !clerk || !(Number(amount) > 0) || Number(amount) > available}>
            {saving ? "Assigning…" : "Assign to clerk"}
          </button>
        </footer>
      </form>
    </SideDrawer>
  );
}

function ReviewSlip({
  transfer,
  deposit,
  onClose,
  onDone,
}: {
  transfer: CashTransfer;
  deposit: CashDeposit;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [image, setImage] = useState("");
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let url = "";
    api.feePayments
      .proofUrl(transfer.code, deposit.code)
      .then((value) => {
        url = value;
        setImage(value);
      })
      .catch(() => setFailed(true));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [transfer.code, deposit.code]);
  async function decide(decision: "accept" | "reject") {
    if (decision === "reject" && !note.trim()) return toast.warning("Give the reason for rejecting the slip");
    setSaving(true);
    try {
      await api.feePayments.review(transfer.code, deposit.code, decision, note.trim());
      toast.success(decision === "accept" ? "Deposit accepted" : "Slip rejected");
      await onDone();
    } catch (e) {
      toast.error("Not saved", errorText(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <SideDrawer title="Review bank deposit slip" subtitle={`${transfer.clerk_name} · ${shortDate(deposit.deposited_on)}`} onClose={onClose}>
      <div className="fcw-form fcw-drawer-form">
        <dl className="fcw-balance">
          <div>
            <dt>Cash handed over</dt>
            <dd>{rupees(Number(transfer.amount))}</dd>
          </div>
          <div>
            <dt>Deposited (this slip)</dt>
            <dd>{rupees(Number(deposit.amount))}</dd>
          </div>
          <div>
            <dt>Still with clerk after this</dt>
            <dd>{rupees(Number(transfer.with_clerk) - Number(deposit.amount))}</dd>
          </div>
        </dl>
        {deposit.bank_reference && <p>Bank reference: {deposit.bank_reference}</p>}
        <div className="fcw-slip">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={`Bank slip for ${rupees(Number(deposit.amount))}`} />
          ) : failed ? (
            <Empty>The slip could not be loaded.</Empty>
          ) : (
            <div className="anw-skeleton anw-skeleton-tall" />
          )}
        </div>
        <label>
          Note (required to reject)
          <input maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <footer className="fcw-actions">
          <button type="button" className="fcw-reject" disabled={saving} onClick={() => decide("reject")}>
            <X size={15} /> Reject
          </button>
          <button type="button" className="fcw-accept" disabled={saving} onClick={() => decide("accept")}>
            <Check size={15} /> Accept deposit
          </button>
        </footer>
      </div>
    </SideDrawer>
  );
}
