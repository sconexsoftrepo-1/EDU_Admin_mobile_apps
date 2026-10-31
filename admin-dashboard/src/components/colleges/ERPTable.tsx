"use client";
import SearchField, { searchValues } from "./SearchField";
import PDFActions from "./PDFActions";
import IconAction from "./IconAction";
import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";
import { Download, Search, ChevronLeft, ChevronRight, X } from "lucide-react";
import { professionalPdf } from "@/lib/colleges/download";
import { excelTable } from "@/lib/colleges/export-table";
import { useCollege } from "./CollegeStore";
import { collegeBySlug } from "@/data/colleges";
import { tableReport } from "@/lib/colleges/reports";
import { formatDate } from "./DateInput";
import { alignClass } from "./table-align";
export type TableRecord = { id: string; [key: string]: unknown };
export default function ERPTable({
  title,
  rows,
  columns,
  actions,
  detailsExtra,
  filters,
}: {
  title: string;
  rows: TableRecord[];
  columns: {
    key: string;
    label: string;
    render?: (row: TableRecord) => ReactNode;
  }[];
  actions?: (row: TableRecord) => ReactNode;
  detailsExtra?: (row: TableRecord) => ReactNode;
  /** Filters shown inside the card; switches to the single-card toolbar layout. */
  filters?: ReactNode;
}) {
  const { state, role } = useCollege();
  const college = collegeBySlug(state.slug)!;
  const detailDialog = useRef<HTMLDialogElement>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = rows.find((r) => r.id === detailId);
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [sort, setSort] = useState("id"),
    [asc, setAsc] = useState(true),
    [page, setPage] = useState(0),
    [size, setSize] = useState(10),
    [hidden, setHidden] = useState<string[]>([]),
    [selected, setSelected] = useState<string[]>([]);
  const filtered = rows
    .filter(
      (r) =>
        Object.values(r)
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (!status || r.status === status),
    )
    .sort(
      (a, b) =>
        String(a[sort] ?? "").localeCompare(String(b[sort] ?? ""), undefined, {
          numeric: true,
        }) * (asc ? 1 : -1),
    );
  const safePage = Math.min(
      page,
      Math.max(0, Math.ceil(filtered.length / size) - 1),
    ),
    shown = filtered.slice(safePage * size, (safePage + 1) * size);
  /** Excel with the same columns and amounts as the PDF report (totals added by excelTable). */
  const exportExcel = (name: string, list: typeof filtered) => {
    const visibleColumns = columns.filter((c) => !hidden.includes(c.key));
    const section = tableReport(
      college,
      state,
      title,
      list,
      visibleColumns,
      role,
      "",
    ).sections.find((s) => s.columns?.length && s.rows);
    if (section?.columns && section.rows)
      excelTable(
        name,
        title,
        section.columns,
        section.rows.filter((r) => r[0] !== "Grand total"),
      );
    else
      excelTable(
        name,
        title,
        visibleColumns.map((c) => c.label),
        list.map((r) =>
          visibleColumns.map((c) => formatDate(String(r[c.key] ?? ""))),
        ),
      );
  };
  const exportActions = (
    <div className="erp-export-actions">
      <button onClick={() => exportExcel(title, filtered)}>
        <Download size={14} /> Excel
      </button>
      <PDFActions
        onAction={(mode) =>
          professionalPdf(
            title,
            tableReport(
              college,
              state,
              title,
              filtered,
              columns.filter((c) => !hidden.includes(c.key)),
              role,
              `Search: ${query || "all"}; Status: ${status || "all"}; ${(() => {
                try {
                  const filters = JSON.parse(
                    sessionStorage.getItem(`kc-filters-${state.slug}`) || "{}",
                  );
                  return `Academic year: ${filters.year || "all"}; Department: ${filters.department || "all"}; Dates: ${filters.from || "all"} to ${filters.to || "all"}`;
                } catch {
                  return "Current selection";
                }
              })()}`,
            ),
            mode,
          )
        }
      >
        PDF report
      </PDFActions>
      <button onClick={() => window.print()}>Print</button>
    </div>
  );
  const single = !!filters;
  return (
    <section
      className={`erp-panel erp-table-panel${single ? " is-single-card" : ""}`}
      aria-label={single ? title : undefined}
    >
      {single ? (
        filters
      ) : (
        <div className="erp-panel-title">
          <h2>
            {title} <span>{filtered.length}</span>
          </h2>
          {exportActions}
        </div>
      )}
      <div className="erp-table-tools">
        <SearchField
          aria-label={`Search ${title}`}
          placeholder={`Search ${title.toLowerCase()}…`}
          value={query}
          onValueChange={(value) => { setQuery(value); setPage(0); }}
          suggestions={searchValues(rows)}
        />
        <select
          aria-label="Status filter"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All statuses</option>
          {Array.from(
            new Set(rows.map((r) => String(r.status || "")).filter(Boolean)),
          ).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <details className="erp-columns">
          <summary>Columns</summary>
          <div>
            {columns.map((c) => (
              <label key={c.key}>
                <input
                  type="checkbox"
                  checked={!hidden.includes(c.key)}
                  onChange={() =>
                    setHidden(
                      hidden.includes(c.key)
                        ? hidden.filter((k) => k !== c.key)
                        : [...hidden, c.key],
                    )
                  }
                />
                {c.label}
              </label>
            ))}
          </div>
        </details>
        {selected.length > 0 && (
          <button
            onClick={() =>
              exportExcel(
                title + "-selected",
                filtered.filter((r) => selected.includes(r.id)),
              )
            }
          >
            Export {selected.length} selected
          </button>
        )}
        {single && (
          <>
            <p className="erp-table-count">
              <strong>{filtered.length}</strong> {title.toLowerCase()}
            </p>
            {exportActions}
          </>
        )}
      </div>
      <div className="erp-table-scroll">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Select visible rows"
                  checked={
                    !!shown.length &&
                    shown.every((r) => selected.includes(r.id))
                  }
                  onChange={(e) =>
                    setSelected(e.target.checked ? shown.map((r) => r.id) : [])
                  }
                />
              </th>
              {columns
                .filter((c) => !hidden.includes(c.key))
                .map((c) => (
                  <th
                    key={c.key}
                    className={alignClass(c.key) || undefined}
                    aria-sort={
                      sort === c.key
                        ? asc
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      onClick={() => {
                        if (sort === c.key) setAsc(!asc);
                        else {
                          setSort(c.key);
                          setAsc(true);
                        }
                      }}
                    >
                      {c.label} {sort === c.key ? (asc ? "↑" : "↓") : ""}
                    </button>
                  </th>
                ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.id}`}
                    checked={selected.includes(r.id)}
                    onChange={() =>
                      setSelected(
                        selected.includes(r.id)
                          ? selected.filter((x) => x !== r.id)
                          : [...selected, r.id],
                      )
                    }
                  />
                </td>
                {columns
                  .filter((c) => !hidden.includes(c.key))
                  .map((c) => (
                    <td
                      key={c.key}
                      data-label={c.label}
                      className={alignClass(c.key) || undefined}
                    >
                      {c.render ? (
                        c.render(r)
                      ) : c.key === "status" ? (
                        <span
                          className={`erp-status status-${String(r.status).toLowerCase().replaceAll(" ", "-")}`}
                        >
                          {String(r.status)}
                        </span>
                      ) : c.key === "name" &&
                        r.profile &&
                        typeof r.profile === "object" &&
                        "photo" in r.profile &&
                        typeof r.profile.photo === "string" &&
                        r.profile.photo ? (
                        <span className="erp-student-name-photo">
                          <Image
                            src={r.profile.photo}
                            width={30}
                            height={36}
                            alt=""
                            unoptimized
                          />
                          {String(r[c.key])}
                        </span>
                      ) : (
                        formatDate(String(r[c.key] ?? "—"))
                      )}
                    </td>
                  ))}
                <td data-label="Actions">
                  <div className="erp-row-actions">
                    <IconAction
                      kind="info"
                      label={`View details for ${String(r.name || r.id)}`}
                      onClick={() => {
                        setDetailId(r.id);
                        detailDialog.current?.showModal();
                      }}
                    />
                    {actions?.(r)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && (
          <div className="erp-empty">
            <Search />
            <h3>No matching records</h3>
            <p>Try a different search or status filter.</p>
            <button
              onClick={() => {
                setQuery("");
                setStatus("");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
      <dialog
        ref={detailDialog}
        className="erp-record-drawer"
        data-panel-size={
          columns.length > 14
            ? "wide"
            : columns.length > 7
              ? "medium"
              : "compact"
        }
        aria-label={`${title} record details`}
      >
        <div className="erp-panel-title">
          <div>
            <small>{title}</small>
            <h2>{String(detail?.name || detail?.id || "Record details")}</h2>
          </div>
          <button
            aria-label="Close record details"
            onClick={() => detailDialog.current?.close()}
          >
            <X size={18} />
          </button>
        </div>
        {detail && (
          <>
            <dl className="erp-record-fields">
              {columns.map((c) => (
                <div key={c.key}>
                  <dt>{c.label}</dt>
                  <dd>
                    {c.render
                      ? c.render(detail)
                      : formatDate(String(detail[c.key] ?? "—"))}
                  </dd>
                </div>
              ))}
            </dl>
            {detailsExtra?.(detail)}
            {actions && (
              <div className="erp-record-footer erp-row-actions">
                {actions(detail)}
              </div>
            )}
          </>
        )}
      </dialog>
      <div className="erp-pagination">
        <span>
          {filtered.length
            ? `${safePage * size + 1}–${Math.min((safePage + 1) * size, filtered.length)}`
            : "0"}{" "}
          of {filtered.length}
        </span>
        <select
          aria-label="Rows per page"
          value={size}
          onChange={(e) => {
            setSize(+e.target.value);
            setPage(0);
          }}
        >
          {[10, 25, 50].map((n) => (
            <option key={n} value={n}>
              {n} per page
            </option>
          ))}
        </select>
        <button
          aria-label="Previous page"
          disabled={safePage === 0}
          onClick={() => setPage(safePage - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          aria-label="Next page"
          disabled={(safePage + 1) * size >= filtered.length}
          onClick={() => setPage(safePage + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  );
}
