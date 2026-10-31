"use client";
import {useState} from "react";
import FeeHeadManager from "./FeeHeadManager";
import SideDrawer from "./SideDrawer";
import { semesterAmounts } from "@/lib/colleges/program-fee-schedules";
import PDFActions from "./PDFActions";
import { Pencil, Download } from "lucide-react";
import { type College, money } from "@/data/colleges";
import { useCollege } from "./CollegeStore";
import "./fee-structures.css";
import { feeComponents, feeTotals, taxLabel } from "@/lib/colleges/fees";
import { professionalPdf } from "@/lib/colleges/download";
import { structureReport, tableReport } from "@/lib/colleges/reports";
export default function FeeStructures({ college: c }: { college: College }) {
  const [headsOpen,setHeadsOpen]=useState(false);
  const { state: s, role, run } = useCollege();
  return (
    <>
      {headsOpen&&<SideDrawer title="Fee heads" expanded onClose={()=>setHeadsOpen(false)}><FeeHeadManager/></SideDrawer>}
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
        <button type="button" onClick={()=>setHeadsOpen(true)}>Fee heads & custom heads</button>
      </div>
      <p className="erp-help">
        Each card contains the saved fee breakdown for one course schedule.
        Structure edits do not alter existing student fee assignments.
      </p>
      <section
        className="erp-fee-schedules"
        aria-labelledby="program-fee-schedules-title"
      >
        <div className="erp-fee-schedules-heading">
          <h2 id="program-fee-schedules-title">Program fee structures</h2>
          <span>
            {s.structures.length}{" "}
            {s.structures.length === 1 ? "schedule" : "schedules"}
          </span>
        </div>
        {s.structures.length === 0 ? (
          <p className="erp-help">
            No fee structures yet. Use Manage fee structures to create a course
            schedule.
          </p>
        ) : (
          <div className="erp-fee-card-grid">
            {s.structures.map((row) => {
              const total = feeTotals(
                feeComponents(row),
                row.taxMode || "not-configured",
              );
              const scope = row.feeSchedule;
              return (
                <article
                  className="erp-fee-card"
                  key={row.id}
                  aria-label={`${row.name} fee structure`}
                >
                  <header className="erp-fee-card-heading">
                    <div>
                      <h3>{row.name}</h3>
                      {scope && (
                        <p>
                          {[
                            scope.academicYear,
                            scope.basis === "full_course"
                              ? `${Math.ceil(scope.termCount / 2)} years · ${scope.termCount} semesters`
                              : `${scope.basis === "semester" || scope.frequency !== "annual" ? "Semester" : "Year"} ${scope.studyYear}`,
                            scope.installment > 1
                              ? `Installment ${scope.installment}`
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                    <span className="erp-fee-card-status">{row.status}</span>
                  </header>
                  <div className="erp-fee-card-breakdown">
                    <h4>
                      Fee breakdown{" "}
                      <span>
                        {total.lines.length} saved{" "}
                        {total.lines.length === 1 ? "head" : "heads"}
                      </span>
                    </h4>
                    <dl>
                      {total.lines.map((line) => (
                        <div key={line.id}>
                          <dt>{line.name}</dt>
                          <dd>{money(line.total)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <dl className="erp-fee-card-totals">
                    <div>
                      <dt>Base fee</dt>
                      <dd>{money(total.base)}</dd>
                    </div>
                    <div>
                      <dt>GST</dt>
                      <dd>{money(total.gst)}</dd>
                    </div>
                    <div className="erp-fee-card-grand-total">
                      <dt>
                        {scope?.basis === "full_course"
                          ? "Full course total"
                          : scope?.basis === "semester"
                            ? "Semester total"
                            : !scope || scope.frequency === "annual"
                              ? "Annual total"
                              : "Schedule total"}
                      </dt>
                      <dd>{money(total.total)}</dd>
                    </div>
                  </dl>
                  {scope?.basis === "full_course" && (
                    <div className="erp-fee-term-preview">
                      <strong>Semester payments</strong>
                      {semesterAmounts(
                        total.lines.map((line) => line.total),
                        scope.termCount,
                      ).map((amount, i) => {
                        return (
                          <div key={i}>
                            <span>
                              Year {Math.floor(i / 2) + 1} · Semester {i + 1}
                            </span>
                            <b>{money(amount)}</b>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="erp-fee-card-tax">
                    {taxLabel(row.taxMode || "not-configured")}
                  </p>
                  <div className="erp-fee-card-actions">
                    <button
                      type="button"
                      aria-label={`Edit ${row.name} fee breakdown`}
                      title="Edit fee breakdown"
                      onClick={() =>
                        run({ type: "structure.save", id: row.id, data: {} })
                      }
                    >
                      <Pencil size={14} />
                    </button>
                    <PDFActions
                      onAction={(mode) =>
                        professionalPdf(
                          row.id,
                          structureReport(c, s, row, role),
                          mode,
                        )
                      }
                    >
                      Download PDF
                    </PDFActions>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
