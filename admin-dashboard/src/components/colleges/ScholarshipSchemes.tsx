"use client";
/**
 * Scholarship schemes: award, sponsor, eligibility and terms, with students awarded — each scheme
 * as a formatted PDF (backend app/core/print_pdfs.py: GET print/scholarships, print/scholarship/{code}).
 */
import { useEffect, useState } from "react";
import { Award, ChevronDown } from "lucide-react";
import { apiRequest } from "@/services/api/client";
import PrintButtons from "./PrintButtons";
import "./scholarship-schemes.css";

type Scheme = {
  code: string;
  name: string;
  sponsor?: string | null;
  award_label: string;
  academic_year_name?: string | null;
  awards: number;
  granted: number;
  pending: number;
  granted_amount: string;
  rules: {
    description?: string;
    criteria?: string[];
    documents?: string[];
    terms?: string[];
    how_to_apply?: string;
    renewal?: string;
    last_date?: string;
  };
};
const inr = (v: string | number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(v || 0));

export default function ScholarshipSchemes() {
  const [items, setItems] = useState<Scheme[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    apiRequest<{ items: Scheme[] }>("print/scholarships")
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  if (error || !items?.length) return null;
  return (
    <section className="sch-panel" aria-label="Scholarship schemes">
      <header>
        <div>
          <h2>Scholarship schemes</h2>
          <p>
            Award, eligibility, documents and terms for each scheme — share the
            scheme PDF with students and parents.
          </p>
        </div>
      </header>
      <div className="sch-grid">
        {items.map((s) => (
          <article key={s.code} className="sch-card">
            <div className="sch-top">
              <span className="sch-icon" aria-hidden="true">
                <Award size={18} />
              </span>
              <div>
                <strong>{s.name}</strong>
                <small>
                  {s.sponsor || "College"}
                  {s.academic_year_name ? ` · ${s.academic_year_name}` : ""}
                </small>
              </div>
            </div>
            <p className="sch-award">{s.award_label}</p>
            {s.rules.description && (
              <p className="sch-desc">{s.rules.description}</p>
            )}
            <dl className="sch-stats">
              <div>
                <dt>Awarded</dt>
                <dd>{s.granted}</dd>
              </div>
              <div>
                <dt>Pending</dt>
                <dd>{s.pending}</dd>
              </div>
              <div>
                <dt>Granted</dt>
                <dd>{inr(s.granted_amount)}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="sch-more"
              aria-expanded={open === s.code}
              onClick={() => setOpen(open === s.code ? null : s.code)}
            >
              Eligibility & terms{" "}
              <ChevronDown
                size={14}
                aria-hidden="true"
                style={{
                  transform: open === s.code ? "rotate(180deg)" : undefined,
                }}
              />
            </button>
            {open === s.code && (
              <div className="sch-rules">
                {(
                  [
                    ["Eligibility", s.rules.criteria],
                    ["Documents required", s.rules.documents],
                    ["Terms & conditions", s.rules.terms],
                  ] as const
                ).map(
                  ([title, list]) =>
                    !!list?.length && (
                      <div key={title}>
                        <h4>{title}</h4>
                        <ul>
                          {list.map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      </div>
                    ),
                )}
                {s.rules.how_to_apply && (
                  <p>
                    <strong>How to apply:</strong> {s.rules.how_to_apply}
                    {s.rules.last_date
                      ? ` · last date ${s.rules.last_date}`
                      : ""}
                  </p>
                )}
              </div>
            )}
            <PrintButtons
              path={`scholarship/${encodeURIComponent(s.code)}`}
              filename={`scholarship-${s.name.replaceAll(" ", "-")}`}
              viewLabel="View scheme"
            />
          </article>
        ))}
      </div>
    </section>
  );
}
