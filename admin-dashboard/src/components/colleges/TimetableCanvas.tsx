"use client";

import { useRef, useState, type PointerEvent } from "react";
import { GripHorizontal, Minus, Plus, Trash2 } from "lucide-react";
import {
  cellAt,
  editCell,
  emptyCell,
  resizeCell,
  timetableDays,
  type TimetableCell,
  type TimetableDraft,
} from "@/lib/colleges/timetable-templates";

export default function TimetableCanvas({
  draft,
  readOnly,
  change,
  onError,
}: {
  draft: TimetableDraft;
  readOnly: boolean;
  change: (value: TimetableDraft) => void;
  onError: (message: string) => void;
}) {
  const [selected, setSelected] = useState<{ day: number; row: number } | null>(
    null,
  );
  const [preview, setPreview] = useState<number | null>(null);
  const resize = useRef<{
    y: number;
    cell: TimetableCell;
    draft: TimetableDraft;
    span: number;
  } | null>(null);
  const active = selected
    ? cellAt(draft, selected.day, selected.row) ||
      emptyCell(selected.day, selected.row)
    : null;
  const update = (
    cell: TimetableCell,
    key: keyof TimetableCell,
    value: string,
  ) => change(editCell(draft, { ...cell, [key]: value }));
  function adjust(cell: TimetableCell, span: number) {
    try {
      change(resizeCell(draft, cell.day, cell.row, span));
      onError("");
    } catch (e) {
      onError((e as Error).message);
    }
  }
  function dragStart(
    event: PointerEvent<HTMLButtonElement>,
    cell: TimetableCell,
  ) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resize.current = { y: event.clientY, cell, draft, span: cell.span };
    setSelected({ day: cell.day, row: cell.row });
  }
  function dragMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = resize.current;
    if (!drag) return;
    const span = Math.max(
      1,
      drag.cell.span + Math.round((event.clientY - drag.y) / 128),
    );
    try {
      resizeCell(drag.draft, drag.cell.day, drag.cell.row, span);
      drag.span = span;
      setPreview(span);
      onError("");
    } catch (e) {
      onError((e as Error).message);
    }
  }
  function dragEnd() {
    const drag = resize.current;
    if (drag)
      change(resizeCell(drag.draft, drag.cell.day, drag.cell.row, drag.span));
    resize.current = null;
    setPreview(null);
  }
  return (
    <>
      {!readOnly && (
        <div className="tt-cell-tools" aria-label="Selected class controls">
          <span>
            {active
              ? `${timetableDays[active.day]} · ${draft.periods[active.row]?.start}`
              : "Select a class box to adjust it"}
          </span>
          {active && (
            <>
              <label>
                Class type
                <select
                  aria-label="Selected class type"
                  value={active.kind}
                  onChange={(e) => update(active, "kind", e.target.value)}
                >
                  <option value="theory">Theory</option>
                  <option value="lab">Laboratory</option>
                  <option value="activity">Activity / sports</option>
                </select>
              </label>
              <button
                type="button"
                aria-label="Shrink selected class"
                disabled={active.span <= 1}
                onClick={() => adjust(active, active.span - 1)}
              >
                <Minus size={14} />
              </button>
              <strong>
                {preview || active.span} period
                {(preview || active.span) > 1 ? "s" : ""}
              </strong>
              <button
                type="button"
                aria-label="Expand selected class"
                onClick={() => adjust(active, active.span + 1)}
              >
                <Plus size={14} />
              </button>
              <button
                type="button"
                onClick={() =>
                  change({
                    ...draft,
                    cells: draft.cells.filter(
                      (c) => c.day !== active.day || c.row !== active.row,
                    ),
                  })
                }
              >
                <Trash2 size={14} />
                Clear class
              </button>
            </>
          )}
        </div>
      )}
      <div
        className="tt-grid-scroll"
        tabIndex={0}
        aria-label="Weekly timetable, scroll horizontally for all days"
      >
        <div
          className="tt-grid"
          role="table"
          aria-label="Editable weekly timetable"
          style={{
            gridTemplateRows: `50px ${draft.periods.map((p) => (p.kind === "teaching" ? "128px" : "64px")).join(" ")}`,
          }}
        >
          <div className="tt-grid-corner" role="columnheader">
            Time
          </div>
          {timetableDays.map((day, i) => (
            <div
              className="tt-day"
              role="columnheader"
              key={day}
              style={{ gridColumn: i + 2, gridRow: 1 }}
            >
              {day}
              <small>
                {i + 1 < 6 ? "Classes & activities" : "Weekend classes"}
              </small>
            </div>
          ))}
          {draft.periods.map((period, row) => (
            <div
              key={row}
              className={`tt-time${period.kind !== "teaching" ? " tt-time-pause" : ""}`}
              role="rowheader"
              style={{ gridColumn: 1, gridRow: row + 2 }}
            >
              <input
                aria-label={`Period ${row + 1} start`}
                type="time"
                value={period.start}
                readOnly={readOnly}
                onChange={(e) =>
                  change({
                    ...draft,
                    periods: draft.periods.map((p, i) =>
                      i === row ? { ...p, start: e.target.value } : p,
                    ),
                  })
                }
              />
              <span>to</span>
              <input
                aria-label={`Period ${row + 1} end`}
                type="time"
                value={period.end}
                readOnly={readOnly}
                onChange={(e) =>
                  change({
                    ...draft,
                    periods: draft.periods.map((p, i) =>
                      i === row ? { ...p, end: e.target.value } : p,
                    ),
                  })
                }
              />
            </div>
          ))}
          {draft.periods.flatMap((period, row) => {
            if (period.kind !== "teaching")
              return [
                <div
                  role="cell"
                  className="tt-pause"
                  key={`pause-${row}`}
                  style={{ gridColumn: "2 / 8", gridRow: row + 2 }}
                >
                  <input
                    aria-label={`Period ${row + 1} break label`}
                    readOnly={readOnly}
                    value={period.label}
                    onChange={(e) =>
                      change({
                        ...draft,
                        periods: draft.periods.map((p, i) =>
                          i === row ? { ...p, label: e.target.value } : p,
                        ),
                      })
                    }
                  />
                </div>,
              ];
            return timetableDays.flatMap((day, column) => {
              const cell = cellAt(draft, column, row) || emptyCell(column, row);
              if (cell.row !== row) return [];
              const selectedCell =
                selected?.day === column && selected.row === row;
              const span = selectedCell && preview ? preview : cell.span;
              return [
                <div
                  role="cell"
                  key={`${column}-${row}`}
                  className={`tt-cell tt-${cell.kind}${selectedCell ? " tt-selected" : ""}`}
                  style={{
                    gridColumn: column + 2,
                    gridRow: `${row + 2} / span ${span}`,
                  }}
                  onFocusCapture={() => setSelected({ day: column, row })}
                >
                  <input
                    className="tt-subject-code"
                    aria-label={`${day} period ${row + 1} subject code`}
                    value={cell.subject_code}
                    placeholder={
                      cell.kind === "lab"
                        ? "LAB"
                        : cell.kind === "activity"
                          ? "ACTIVITY"
                          : "CODE"
                    }
                    readOnly={readOnly}
                    onChange={(e) =>
                      update(cell, "subject_code", e.target.value)
                    }
                  />
                  <textarea
                    aria-label={`${day} period ${row + 1} subject`}
                    value={cell.title}
                    placeholder={
                      cell.kind === "lab"
                        ? "Add laboratory"
                        : cell.kind === "activity"
                          ? "Add activity"
                          : "Add subject"
                    }
                    readOnly={readOnly}
                    rows={2}
                    onChange={(e) => update(cell, "title", e.target.value)}
                  />
                  <input
                    aria-label={`${day} period ${row + 1} faculty`}
                    value={cell.faculty}
                    placeholder="Faculty name"
                    readOnly={readOnly}
                    onChange={(e) => update(cell, "faculty", e.target.value)}
                  />
                  <input
                    aria-label={`${day} period ${row + 1} room`}
                    value={cell.room}
                    placeholder="Room / laboratory"
                    readOnly={readOnly}
                    onChange={(e) => update(cell, "room", e.target.value)}
                  />
                  {cell.span > 1 && (
                    <small className="tt-span-label">
                      {draft.periods[row].start} –{" "}
                      {draft.periods[row + cell.span - 1]?.end}
                    </small>
                  )}
                  {!readOnly && (
                    <button
                      type="button"
                      className="tt-resize"
                      aria-label={`Resize ${day} period ${row + 1} class`}
                      onPointerDown={(e) => dragStart(e, cell)}
                      onPointerMove={dragMove}
                      onPointerUp={dragEnd}
                      onPointerCancel={() => {
                        resize.current = null;
                        setPreview(null);
                      }}
                    >
                      <GripHorizontal size={18} />
                    </button>
                  )}
                </div>,
              ];
            });
          })}
        </div>
      </div>
      <div className="tt-legend">
        <span className="theory">Theory</span>
        <span className="lab">Laboratory</span>
        <span className="activity">Sports / activity</span>
        <span className="pause">Break / lunch</span>
      </div>
    </>
  );
}
