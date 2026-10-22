"use client";
import PDFActions from "./PDFActions";
import { useRef, useState, type FormEvent } from "react";
import { X, Plus, Trash2, Download } from "lucide-react";
import { type College, money } from "@/data/colleges";
import { useCollege } from "./CollegeStore";
import ERPTable from "./ERPTable";
import {
  feeComponents,
  feeTotals,
  taxLabel,
  type TaxMode,
} from "@/lib/colleges/fees";
import type { RecordRow } from "@/lib/colleges/store";
import { professionalPdf } from "@/lib/colleges/download";
import { structureReport, tableReport } from "@/lib/colleges/reports";
type DraftLine = { id: string; name: string; amount: string; gstRate: string };
export default function FeeStructures({ college: c }: { college: College }) {
  const { state: s, role, run, message, clear } = useCollege();
  const [selected, setSelected] = useState<RecordRow | null>(null),
    [lines, setLines] = useState<DraftLine[]>([]),
    [mode, setMode] = useState<TaxMode>("not-configured"),
    [terms, setTerms] = useState("");
  const panel = useRef<HTMLDialogElement>(null);
  const components = lines.map((l) => ({
    ...l,
    amount: Math.round(Number(l.amount) * 100),
    gstRate: Number(l.gstRate),
  }));
  const totals = feeTotals(components, mode);
  const canEdit = role === "Super Admin" || role === "Accounts Manager";
  const edit = (row: RecordRow) => {
    clear();
    setSelected(row);
    setLines(
      feeComponents(row).map((l) => ({
        ...l,
        amount: (l.amount / 100).toFixed(2),
        gstRate: String(l.gstRate),
      })),
    );
    setMode(row.taxMode || "not-configured");
    setTerms(row.terms || "");
    panel.current?.showModal();
  };
  const update = (id: string, key: keyof DraftLine, value: string) =>
    setLines(lines.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (
      selected &&
      run({
        type: "structure.save",
        id: selected.id,
        data: {
          components: JSON.stringify(components),
          taxMode: mode,
          terms,
          note: selected.note || "",
        },
      })
    )
      panel.current?.close();
  };
  return (
    <>
      <div className="erp-welcome">
        <div>
          <h1>Fee structures</h1>
          <p>
            Itemized program schedules, configured GST, and detailed PDF
            exports.
          </p>
        </div>
        <PDFActions
          className="erp-primary"
          onAction={(mode) =>
            professionalPdf(
              "program-fee-structures",
              tableReport(
                c,
                s,
                "Program fee structures",
                s.structures.map((r) => ({ ...r })),
                [],
                role,
                "All program schedules",
              ),
              mode,
            )
          }
        >
          <Download size={15} />
          Export all structures
        </PDFActions>
      </div>
      <p className="erp-help">
        Legacy totals use a clearly marked illustrative split until you save an
        approved component schedule. Structure edits do not alter existing
        student fee assignments.
      </p>
      <ERPTable
        title="Program fee structures"
        rows={s.structures.map((row) => {
          const totals = feeTotals(
            feeComponents(row),
            row.taxMode || "not-configured",
          );
          return {
            ...row,
            base: totals.base,
            gst: totals.gst,
            total: totals.total,
            tax: taxLabel(row.taxMode || "not-configured"),
          };
        })}
        columns={[
          { key: "name", label: "Program" },
          {
            key: "base",
            label: "Base fee",
            render: (r) => money(Number(r.base)),
          },
          { key: "gst", label: "GST", render: (r) => money(Number(r.gst)) },
          {
            key: "total",
            label: "Annual total",
            render: (r) => money(Number(r.total)),
          },
          { key: "tax", label: "Tax treatment" },
          { key: "status", label: "Status" },
        ]}
        actions={(r) => (
          <>
            <button
              onClick={() => edit(s.structures.find((row) => row.id === r.id)!)}
            >
              Breakdown & GST
            </button>
            <PDFActions
              onAction={(mode) =>
                professionalPdf(
                  r.id,
                  structureReport(
                    c,
                    s,
                    s.structures.find((row) => row.id === r.id)!,
                    role,
                  ),
                  mode,
                )
              }
            >
              Download fee structure PDF
            </PDFActions>
          </>
        )}
        detailsExtra={(r) => (
          <div className="erp-fee-preview">
            {feeTotals(
              feeComponents(s.structures.find((row) => row.id === r.id)!),
              s.structures.find((row) => row.id === r.id)?.taxMode ||
                "not-configured",
            ).lines.map((l) => (
              <div key={l.id}>
                <span>{l.name}</span>
                <strong>{money(l.total)}</strong>
              </div>
            ))}
          </div>
        )}
      />
      <dialog
        ref={panel}
        className="erp-modal erp-fee-editor"
        data-panel-size={lines.length > 5 ? "wide" : "medium"}
        aria-labelledby="erp-fee-title"
        onClose={() => setSelected(null)}
      >
        <div className="erp-panel-title">
          <div>
            <h2 id="erp-fee-title">Program fee breakdown</h2>
            <p>{selected?.name}</p>
          </div>
          <button
            aria-label="Close fee breakdown"
            onClick={() => panel.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        {selected && (
          <form onSubmit={submit}>
            <p className="erp-help">
              {selected.components?.length
                ? "Saved component schedule."
                : "Illustrative allocation of the existing total. Review every fee head before saving."}{" "}
              Amounts are base values before configured GST.
            </p>
            <label>
              GST treatment
              <select
                aria-label="GST treatment"
                value={mode}
                onChange={(e) => setMode(e.target.value as TaxMode)}
                disabled={!canEdit}
              >
                <option value="not-configured">Not configured</option>
                <option value="no-tax">No GST applied (configured)</option>
                <option value="intra-state">CGST + SGST</option>
                <option value="inter-state">IGST</option>
              </select>
            </label>
            <p className="erp-help">
              GSTIN:{" "}
              {s.institution?.gstin || "Not configured in Institution settings"}
              . Tax applicability and rates must be verified before real use.
            </p>
            <div className="erp-fee-lines">
              {lines.map((line, index) => (
                <div className="erp-fee-line" key={line.id}>
                  <label>
                    Fee head {index + 1}
                    <input
                      aria-label={`Fee head ${index + 1}`}
                      value={line.name}
                      maxLength={100}
                      required
                      disabled={!canEdit}
                      onChange={(e) => update(line.id, "name", e.target.value)}
                    />
                  </label>
                  <label>
                    Base amount (INR)
                    <input
                      aria-label={`Base amount ${index + 1}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.amount}
                      required
                      disabled={!canEdit}
                      onChange={(e) =>
                        update(line.id, "amount", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    GST rate (%)
                    <input
                      aria-label={`GST rate ${index + 1}`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={line.gstRate}
                      required
                      disabled={
                        !canEdit ||
                        !["intra-state", "inter-state"].includes(mode)
                      }
                      onChange={(e) =>
                        update(line.id, "gstRate", e.target.value)
                      }
                    />
                  </label>
                  <div>
                    <small>Line total</small>
                    <strong>{money(totals.lines[index]?.total || 0)}</strong>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      aria-label={`Remove fee head ${index + 1}`}
                      disabled={lines.length === 1}
                      onClick={() =>
                        setLines(lines.filter((l) => l.id !== line.id))
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() =>
                  setLines([
                    ...lines,
                    {
                      id: crypto.randomUUID(),
                      name: "",
                      amount: "0.00",
                      gstRate: "0",
                    },
                  ])
                }
                disabled={lines.length >= 40}
              >
                <Plus size={14} />
                Add fee head
              </button>
            )}
            <div className="erp-fee-totals">
              {[
                ["Base fee", totals.base],
                ["CGST", totals.cgst],
                ["SGST", totals.sgst],
                ["IGST", totals.igst],
                ["Annual total", totals.total],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{money(Number(value))}</strong>
                </div>
              ))}
            </div>
            <label className="erp-fee-terms">
              Payment schedule / terms
              <textarea
                aria-label="Fee payment terms"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Installment dates, inclusions, exclusions, and payment instructions"
                disabled={!canEdit}
              />
            </label>
            <p role="alert">
              {message && message !== "Saved successfully" ? message : ""}
            </p>
            <div className="erp-modal-actions">
              <button type="button" onClick={() => panel.current?.close()}>
                Cancel
              </button>
              {canEdit && (
                <button className="erp-primary" type="submit">
                  Save fee breakdown
                </button>
              )}
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
