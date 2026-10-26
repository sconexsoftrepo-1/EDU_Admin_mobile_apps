"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Filter, Search, X } from "lucide-react";
import "./table-column-filter.css";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export default function TableColumnFilter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value?: string[];
  onChange: (value: string[] | undefined) => void;
}) {
  const mounted = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const matches = options.filter((option) =>
    (option || "(Blanks)")
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  const close = () => panel.current?.hidePopover();
  return (
    <>
      <button
        type="button"
        className={`edu-column-filter-icon ${value !== undefined ? "is-filtered" : ""}`}
        aria-label={`Filter ${label}`}
        title={
          value === undefined ? `Filter ${label}` : `${label} filter applied`
        }
        aria-expanded={open}
        aria-controls={id}
        disabled={!mounted}
        onClick={(event) => {
          if (open) {
            close();
            return;
          }
          const box = event.currentTarget.getBoundingClientRect();
          setPosition({
            left: Math.max(8, Math.min(box.left, window.innerWidth - 336)),
            top: Math.min(
              box.bottom + 8,
              Math.max(8, window.innerHeight - 460),
            ),
          });
          setSearch("");
          setDraft(new Set(value ?? options));
          panel.current?.showPopover();
          input.current?.focus();
        }}
      >
        <Filter size={14} />
        {value !== undefined && <span className="edu-filter-dot" />}
      </button>
      {mounted &&
        createPortal(
          <div
            ref={panel}
            id={id}
            popover="auto"
            className="edu-column-filter-popup"
            role="dialog"
            aria-label={`Filter ${label}`}
            style={{ left: position.left, top: position.top }}
            onToggle={() =>
              setOpen(panel.current?.matches(":popover-open") || false)
            }
          >
            <div className="edu-filter-popup-heading">
              <h3>{label}</h3>
              <button
                type="button"
                aria-label={`Close ${label} filter`}
                title="Close filter"
                onClick={close}
              >
                <X size={16} />
              </button>
            </div>
            <label className="edu-filter-search">
              <Search size={14} aria-hidden="true" />
              <input
                ref={input}
                type="search"
                aria-label={`Search ${label} values`}
                placeholder="Search values…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="edu-filter-selection">
              <button type="button" onClick={() => setDraft(new Set(options))}>
                Select all
              </button>
              <button type="button" onClick={() => setDraft(new Set())}>
                Select none
              </button>
              <span>{draft.size} selected</span>
            </div>
            <div
              data-empty={!matches.length}
              className="edu-filter-values"
              role="group"
              aria-label={`${label} values`}
            >
              {matches.slice(0, 200).map((option) => (
                <label key={option}>
                  <input
                    type="checkbox"
                    checked={draft.has(option)}
                    onChange={(event) =>
                      setDraft((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(option);
                        else next.delete(option);
                        return next;
                      })
                    }
                  />
                  <span>{option || "(Blanks)"}</span>
                </label>
              ))}
              {!matches.length && (
                <p>
                  {options.length
                    ? "No matching values."
                    : "No values available."}
                </p>
              )}
              {matches.length > 200 && (
                <p>Showing 200 values. Refine your search to find more.</p>
              )}
            </div>
            <footer className="edu-filter-footer">
              <button
                type="button"
                onClick={() => {
                  onChange(undefined);
                  close();
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="edu-filter-apply"
                onClick={() => {
                  onChange(
                    draft.size === options.length ? undefined : [...draft],
                  );
                  close();
                }}
              >
                Apply filter
              </button>
            </footer>
          </div>,
          document.body,
        )}
    </>
  );
}
