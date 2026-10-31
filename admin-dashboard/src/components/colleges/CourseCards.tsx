"use client";
import IconAction from "./IconAction";
import SearchField, { searchValues } from "./SearchField";
/** Compact, API-backed course catalog. Filtering state is shared by cards and table views. */
import { useEffect, useRef, useState } from "react";
import CourseCurriculum from "./CourseCurriculum";
import {
  Info,
  CalendarDays,
  Check,
  Clock3,
  LayoutGrid,
  List,
  MoreVertical,
  Pencil,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import type { Row } from "@/services/api";
import CourseInsightsPanel from "./CourseInsightsPanel";
import "./course-cards.css";

const text = (value: unknown) =>
  value === null || value === undefined ? "" : String(value);

const OTHER = "Other courses";

/** Intermediate groups: by level, or by qualification/code for courses saved without a level. */
export function isIntermediate(row: Row): boolean {
  if (row.course_level) return row.course_level === "intermediate";
  return (
    /^intermediate/i.test(text(row.qualification)) ||
    /^INT-/i.test(text(row.code))
  );
}

function family(row: Row): string {
  if (isIntermediate(row)) return "Intermediate";
  return text(row.category) || OTHER;
}

/** Qualification monogram: BA, B.Com, BCA; the abbreviation in brackets; else initials. */
function monogram(row: Row): string {
  if (isIntermediate(row))
    return text(row.branch) || text(row.code).replace(/^INT-/i, "") || "INT";
  const qualification = text(row.qualification) || text(row.name);
  const bracket = qualification.match(/\(([^)]+)\)/);
  if (bracket) return bracket[1];
  if (qualification.length <= 6) return qualification;
  const words = qualification.replace(/^Bachelor of /i, "").split(/\s+/);
  return (
    "B" +
    words
      .filter((w) => /^[A-Z]/.test(w))
      .map((w) => w[0])
      .join("")
  ).slice(0, 5);
}

function years(row: Row): string {
  if (row.duration_label) return text(row.duration_label);
  const count = Number(row.duration_semesters);
  if (!count) return "";
  const value = count / 2;
  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${value === 1 ? "year" : "years"}`;
}

/** Intermediate semesters are named year-term: 1-1, 1-2, 2-1, 2-2 (1st year 1st semester, ...). */
export function semesterLabels(row: Row): string[] {
  const count = Number(row.duration_semesters) || (isIntermediate(row) ? 4 : 0);
  return Array.from({ length: count }, (_, i) =>
    isIntermediate(row)
      ? `${Math.floor(i / 2) + 1}-${(i % 2) + 1}`
      : `Semester ${i + 1}`,
  );
}

function semesters(row: Row): string {
  if (isIntermediate(row)) return String(semesterLabels(row).length);
  const label = text(row.semesters_label);
  if (label) return /class/i.test(label) ? "Annual (Class 11 and 12)" : label;
  return row.duration_semesters ? text(row.duration_semesters) : "";
}

type GroupBy = "years" | "semesters";

/** Numbers in a catalog label: "3–4 years" -> [3, 4], "Usually 10" -> [10]. */
const numbers = (label: string) => (label.match(/\d+/g) || []).map(Number);

/** The group a degree course falls in for the chosen grouping. */
function bucket(row: Row, by: GroupBy): string {
  if (by === "years") {
    const label = text(row.duration_label);
    const found = numbers(label);
    if (!found.length) {
      // "Programme-dependent" and similar: no fixed length.
      const sem = Number(row.duration_semesters);
      return label || !sem ? "Varies" : `${sem / 2} years`;
    }
    const [low, high] = found;
    return high && high !== low
      ? `${low}–${high} years`
      : `${low} ${low === 1 ? "year" : "years"}`;
  }
  const found = numbers(text(row.semesters_label));
  if (!found.length)
    return text(row.semesters_label)
      ? "Varies"
      : text(row.duration_semesters) || "Varies";
  const [low, high] = found;
  return high && high !== low ? `${low}–${high}` : String(low);
}

/** Domains alphabetically; years and semesters numerically, "Varies" last. */
function order(a: string, b: string): number {
  const na = numbers(a),
    nb = numbers(b);
  if (!na.length || !nb.length) return na.length ? -1 : nb.length ? 1 : 0;
  return na[0] - nb[0] || (na[1] || na[0]) - (nb[1] || nb[0]);
}

export default function CourseCards({
  rows,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  rows: Row[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (row: Row) => void;
  onDelete: (row: Row) => Promise<void>;
}) {
  const [curriculumCourse, setCurriculumCourse] = useState<Row | null>(null);
  const [level, setLevel] = useState<"intermediate" | "degree">("intermediate");
  const [groupBy, setGroupBy] = useState<GroupBy>("years");
  const [active, setActive] = useState("");
  const [program, setProgram] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [confirming, setConfirming] = useState("");
  const [deleting, setDeleting] = useState("");
  const [menu, setMenu] = useState("");
  const [feedback, setFeedback] = useState("");
  const [insights, setInsights] = useState<Row | null>(null);
  const filterDialog = useRef<HTMLDialogElement>(null);
  const menuRoot = useRef<HTMLDivElement>(null);
  const menuTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!menu) return;
    const outside = (e: PointerEvent) => {
      if (!menuRoot.current?.contains(e.target as Node)) setMenu("");
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu("");
        menuTrigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [menu]);
  const intermediate = rows.filter(isIntermediate);
  const degrees = rows.filter((r) => !isIntermediate(r));
  const base = level === "intermediate" ? intermediate : degrees;
  const families = [...new Set(base.map(family))].sort();
  const searched = base.filter(
    (r) =>
      (!program || family(r) === program) &&
      [r.name, r.code, r.branch, r.qualification].some((v) =>
        text(v).toLowerCase().includes(search.trim().toLowerCase()),
      ),
  );
  const buckets = [...new Set(searched.map((r) => bucket(r, groupBy)))].sort(
    order,
  );
  const filtered = searched
    .filter((r) => !active || bucket(r, groupBy) === active)
    .sort((a, b) =>
      sort === "duration"
        ? order(bucket(a, "years"), bucket(b, "years")) ||
          text(a.name).localeCompare(text(b.name))
        : text(sort === "code" ? a.code : a.name).localeCompare(
            text(sort === "code" ? b.code : b.name),
          ),
    );
  const groups: [string, Row[]][] =
    level === "intermediate"
      ? [["Intermediate groups", filtered]]
      : [...new Set(filtered.map((r) => bucket(r, groupBy)))]
          .sort(order)
          .map((key) => [
            groupBy === "years"
              ? `Degree programs · ${key}`
              : `Degree programs · ${key === "Varies" ? key : `${key} semesters`}`,
            filtered.filter((r) => bucket(r, groupBy) === key),
          ]);
  const hasFilters = !!(program || search || active);
  const reset = () => {
    setProgram("");
    setSearch("");
    setActive("");
  };
  const changeLevel = (value: typeof level) => {
    setLevel(value);
    setProgram("");
    setActive("");
  };
  async function remove(row: Row) {
    setDeleting(text(row.code));
    setFeedback("");
    try {
      await onDelete(row);
      setFeedback(`${text(row.name)} deleted.`);
    } catch (e) {
      setFeedback(
        e instanceof Error
          ? e.message
          : "Unable to delete this course. Try again.",
      );
    } finally {
      setDeleting("");
      setConfirming("");
    }
  }
  function filters(mobile = false) {
    return (
      <>
        <label className="crs-program">
          <span>Program</span>
          <select
            aria-label={mobile ? "Mobile program" : "Program"}
            value={program}
            onChange={(e) => {
              setProgram(e.target.value);
              setActive("");
            }}
          >
            <option value="">All programs</option>
            {families.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <div className="crs-filter-bottom">
          <div className="crs-filter-group">
            <span>Level</span>
            <div
              className="crs-segment"
              role="group"
              aria-label={mobile ? "Mobile course level" : "Course level"}
            >
              {(
                [
                  ["intermediate", "Intermediate", intermediate.length],
                  ["degree", "Degree", degrees.length],
                ] as const
              ).map(([key, label, count]) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={level === key}
                  onClick={() => changeLevel(key)}
                >
                  {label}
                  <span>{count}</span>
                </button>
              ))}
            </div>
          </div>
          {level === "degree" && (
            <>
              <div className="crs-filter-group">
                <span>Group by</span>
                <div
                  className="crs-segment"
                  role="group"
                  aria-label={
                    mobile ? "Mobile grouping" : "Group degree courses by"
                  }
                >
                  {(["years", "semesters"] as const).map((by) => (
                    <button
                      key={by}
                      type="button"
                      aria-pressed={groupBy === by}
                      onClick={() => {
                        setGroupBy(by);
                        setActive("");
                      }}
                    >
                      {by === "years" ? "Years" : "Semesters"}
                    </button>
                  ))}
                </div>
              </div>
              <label className="crs-duration">
                <span>
                  {groupBy === "years" ? "Years to complete" : "Semesters"}
                </span>
                <select
                  aria-label={
                    mobile ? "Mobile duration filter" : "Duration filter"
                  }
                  value={active}
                  onChange={(e) => setActive(e.target.value)}
                >
                  <option value="">
                    {groupBy === "years" ? "All durations" : "All semesters"} (
                    {searched.length})
                  </option>
                  {active && !buckets.includes(active) && (
                    <option value={active}>{active} (0)</option>
                  )}
                  {buckets.map((key) => (
                    <option value={key} key={key}>
                      {key}
                      {groupBy === "semesters" && key !== "Varies"
                        ? " semesters"
                        : ""}{" "}
                      (
                      {
                        searched.filter((r) => bucket(r, groupBy) === key)
                          .length
                      }
                      )
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
      </>
    );
  }
  function actions(row: Row) {
    const code = text(row.code);
    if (confirming === code)
      return (
        <div
          className="crs-confirm"
          role="group"
          aria-label={`Confirm deletion of ${text(row.name)}`}
        >
          <span>{deleting === code ? "Deleting…" : "Delete this course?"}</span>
          <button
            className="crs-btn crs-btn-danger"
            disabled={!!deleting}
            onClick={() => void remove(row)}
            aria-label={`Confirm delete ${text(row.name)}`}
          >
            <Check size={14} /> Delete
          </button>
          <button
            className="crs-btn"
            disabled={!!deleting}
            onClick={() => setConfirming("")}
          >
            <X size={14} /> Keep
          </button>
        </div>
      );
    return (
      <>
        <button className="crs-btn" onClick={() => setCurriculumCourse(row)}>
          Subjects & labs
        </button>
        {canEdit && (
          <button
            className="crs-btn crs-btn-edit"
            onClick={() => onEdit(row)}
            aria-label={`Edit ${text(row.name)}`}
          >
            <Pencil size={14} /> Edit
          </button>
        )}
        {canDelete && (
          <button
            className="crs-btn crs-btn-delete"
            onClick={() => {
              setConfirming(code);
              setMenu("");
            }}
            aria-label={`Delete ${text(row.name)}`}
          >
            <Trash2 size={14} /> Delete
          </button>
        )}
        <button
          className="crs-view"
          aria-label={`View details of ${text(row.name)}`}
          title="View details"
          onClick={() => setInsights(row)}
        >
          <Info size={17} />
        </button>
      </>
    );
  }
  return (
    <div className="crs">
      {curriculumCourse && (
        <CourseCurriculum
          program={text(curriculumCourse.code)}
          name={text(curriculumCourse.name)}
          semesters={Number(curriculumCourse.duration_semesters) || 4}
          canEdit={canEdit}
          onClose={() => setCurriculumCourse(null)}
        />
      )}
      <div className="crs-filters">
        <SearchField
          aria-label="Search courses"
          placeholder="Search by course name or code…"
          value={search}
          onValueChange={setSearch}
          suggestions={searchValues(base, [
            "name",
            "code",
            "branch",
            "qualification",
          ])}
        />
        <div className="crs-desktop-filters">{filters()}</div>
        <button className="crs-reset" onClick={reset}>
          <RotateCcw size={16} /> Reset
        </button>
        <button
          className="crs-mobile-filter"
          onClick={() => filterDialog.current?.showModal()}
        >
          <SlidersHorizontal size={17} /> Filters
        </button>
      </div>
      {hasFilters && (
        <div className="crs-active-filters" aria-label="Active filters">
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Clear course search"
            >
              Search: {search}
              <X size={13} />
            </button>
          )}
          {program && (
            <button
              onClick={() => setProgram("")}
              aria-label="Clear program filter"
            >
              {program}
              <X size={13} />
            </button>
          )}
          {active && (
            <button
              onClick={() => setActive("")}
              aria-label="Clear duration filter"
            >
              {active}
              {groupBy === "semesters" ? " semesters" : ""}
              <X size={13} />
            </button>
          )}
          <button onClick={reset}>Reset all</button>
        </div>
      )}
      <div className="crs-viewbar">
        <div className="crs-segment" role="group" aria-label="Course view">
          <button
            aria-pressed={view === "cards"}
            onClick={() => setView("cards")}
          >
            <LayoutGrid size={16} /> Cards
          </button>
          <button
            aria-pressed={view === "table"}
            onClick={() => setView("table")}
          >
            <List size={16} /> Table
          </button>
        </div>
        <label className="crs-sort">
          <span className="crs-sr-only">Sort courses</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort courses"
          >
            <option value="name">Sort by: Name (A–Z)</option>
            <option value="code">Sort by: Course code</option>
            <option value="duration">Sort by: Duration</option>
          </select>
        </label>
      </div>
      {feedback && (
        <p className="crs-feedback" role="status">
          {feedback}
        </p>
      )}
      {!filtered.length && (
        <div className="crs-empty">
          <Search size={26} />
          <h3>No matching courses found</h3>
          <p>Try adjusting your search or filters.</p>
          <button className="crs-btn" onClick={reset}>
            Clear filters
          </button>
        </div>
      )}
      {view === "cards"
        ? groups
            .filter(([, list]) => list.length)
            .map(([name, list], index) => (
              <section
                key={name}
                className="crs-family"
                aria-labelledby={`course-group-${index}`}
              >
                <header>
                  <h3 id={`course-group-${index}`}>{name}</h3>
                  <p>
                    {list.length} {list.length === 1 ? "course" : "courses"}
                  </p>
                </header>
                <div className="crs-grid">
                  {list.map((row) => {
                    const code = text(row.code);
                    return (
                      <article
                        className="crs-card"
                        key={code}
                        data-state={confirming === code ? "confirm" : undefined}
                        onClick={(e) => {
                          if (
                            !(e.target as Element).closest(
                              "button, a, input, select",
                            )
                          )
                            setInsights(row);
                        }}
                      >
                        <div className="crs-card-heading">
                          <span className="crs-badge" aria-hidden="true">
                            {monogram(row).length > 8
                              ? monogram(row).slice(0, 3).toUpperCase()
                              : monogram(row)}
                          </span>
                          <div className="crs-title">
                            <h4>
                              <button onClick={() => setInsights(row)}>
                                {text(row.name) || text(row.branch)}
                              </button>
                            </h4>
                            <p>{code}</p>
                          </div>
                          <div
                            className="crs-menu-wrap"
                            ref={menu === code ? menuRoot : undefined}
                          >
                            <button
                              className="crs-menu-trigger"
                              aria-label={`Actions for ${text(row.name)}`}
                              aria-expanded={menu === code}
                              onClick={(e) => {
                                menuTrigger.current = e.currentTarget;
                                setMenu(menu === code ? "" : code);
                              }}
                            >
                              <MoreVertical size={17} />
                            </button>
                            {menu === code && (
                              <div
                                className="crs-menu"
                                role="group"
                                aria-label="Course actions"
                              >
                                <IconAction
                                  kind="info"
                                  label={`View details for ${text(row.name)}`}
                                  onClick={() => {
                                    setInsights(row);
                                    setMenu("");
                                  }}
                                />
                                {canEdit && (
                                  <button
                                    onClick={() => {
                                      onEdit(row);
                                      setMenu("");
                                    }}
                                  >
                                    Edit course
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    onClick={() => {
                                      setConfirming(code);
                                      setMenu("");
                                    }}
                                  >
                                    Delete course
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <dl className="crs-facts">
                          {years(row) && (
                            <div>
                              <dt>
                                <Clock3 size={15} />
                                <span className="crs-sr-only">Duration</span>
                              </dt>
                              <dd>{years(row)}</dd>
                            </div>
                          )}
                          {semesters(row) && (
                            <div>
                              <dt>
                                <CalendarDays size={15} />
                                <span className="crs-sr-only">Semesters</span>
                              </dt>
                              <dd>
                                {semesters(row)}
                                {/^[\d–—\s-]+$/.test(semesters(row))
                                  ? " semesters"
                                  : ""}
                              </dd>
                            </div>
                          )}
                          {!!row.intake_capacity && (
                            <div>
                              <dt>Intake</dt>
                              <dd>{text(row.intake_capacity)}</dd>
                            </div>
                          )}
                        </dl>
                        {!!semesterLabels(row).length && (
                          <ul
                            className="crs-terms"
                            aria-label={`Semester plan for ${text(row.name)}`}
                          >
                            {semesterLabels(row).map((label) => (
                              <li key={label}>{label}</li>
                            ))}
                          </ul>
                        )}
                        <footer className="crs-actions">{actions(row)}</footer>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))
        : !!filtered.length && (
            <div className="crs-table-wrap">
              <table>
                <caption className="crs-sr-only">
                  Filtered course catalog
                </caption>
                <thead>
                  <tr>
                    <th>Course name</th>
                    <th>Course code</th>
                    <th>Duration</th>
                    <th>Semesters</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={text(row.code)}>
                      <td>
                        <button
                          className="crs-table-name"
                          onClick={() => setInsights(row)}
                        >
                          {text(row.name)}
                        </button>
                      </td>
                      <td>{text(row.code)}</td>
                      <td>{years(row) || "Not specified"}</td>
                      <td>{semesters(row) || "Not specified"}</td>
                      <td>
                        <div className="crs-table-actions">{actions(row)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      <p className="crs-count" role="status">
        Showing {filtered.length} of {rows.length} courses
        {level === "degree" ? ` · Grouped by ${groupBy}` : ""}
      </p>
      <dialog
        className="crs-filter-dialog"
        ref={filterDialog}
        aria-label="Filter courses"
      >
        <header>
          <h2>Filter courses</h2>
          <button
            aria-label="Close filters"
            onClick={() => filterDialog.current?.close()}
          >
            <X size={20} />
          </button>
        </header>
        {filters(true)}
        <footer>
          <button onClick={reset}>Reset</button>
          <button
            className="crs-apply"
            onClick={() => filterDialog.current?.close()}
          >
            Show {filtered.length} courses
          </button>
        </footer>
      </dialog>
      {insights && (
        <CourseInsightsPanel
          course={insights}
          colour="#a46a27"
          onClose={() => setInsights(null)}
        />
      )}
    </div>
  );
}
