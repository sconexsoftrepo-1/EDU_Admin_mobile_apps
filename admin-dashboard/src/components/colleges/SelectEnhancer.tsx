"use client";
/**
 * Turns every native `<select>` in the campus portal into a type-to-filter field: opening it lays a
 * plain text input exactly over the field and lists the matching options below, in the look of
 * the sign-in role picker. The real `<select>` keeps its value, `required` check and React
 * `onChange`; only the browser's popup is replaced.
 * Skipped: the sign-in screen (`.campus-auth`), multi-selects, list boxes and `[data-native-select]`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import "./select-enhancer.css";

type Item = {
  value: string;
  label: string;
  group?: string;
  disabled: boolean;
  index: number;
};
type Place = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
  field: { left: number; top: number; width: number; height: number };
};

const eligible = (el: Element | null): el is HTMLSelectElement =>
  el instanceof HTMLSelectElement &&
  !el.multiple &&
  el.size <= 1 &&
  !el.disabled &&
  !el.closest(".campus-auth, [data-native-select]");

const setValue = Object.getOwnPropertyDescriptor(
  HTMLSelectElement.prototype,
  "value",
)?.set;

function readItems(select: HTMLSelectElement): Item[] {
  return Array.from(select.options)
    .map((o, index) => ({
      value: o.value,
      label: (o.label || o.textContent || "").trim(),
      group:
        o.parentElement instanceof HTMLOptGroupElement
          ? o.parentElement.label
          : undefined,
      disabled: o.disabled,
      hidden: o.hidden,
      index,
    }))
    .filter((o) => !o.hidden)
    .map(({ hidden: _hidden, ...o }) => o);
}

function place(select: HTMLSelectElement): Place {
  const r = select.getBoundingClientRect();
  const field = { left: r.left, top: r.top, width: r.width, height: r.height };
  const vw = window.innerWidth,
    vh = window.innerHeight;
  const width = Math.min(Math.max(r.width, 220), vw - 16);
  const left = Math.max(8, Math.min(r.left, vw - width - 8));
  const below = vh - r.bottom - 12,
    above = r.top - 12;
  if (below < 240 && above > below)
    return {
      left,
      width,
      bottom: vh - r.top + 4,
      maxHeight: Math.min(340, above),
      field,
    };
  return {
    left,
    width,
    top: r.bottom + 4,
    maxHeight: Math.min(340, Math.max(160, below)),
    field,
  };
}

/** Copies the select's own look so the typing field reads as the same control. */
function look(select: HTMLSelectElement): React.CSSProperties {
  const c = getComputedStyle(select);
  return {
    background:
      c.backgroundColor === "rgba(0, 0, 0, 0)" ? "#fff" : c.backgroundColor,
    borderRadius: c.borderRadius,
    borderWidth: c.borderTopWidth,
    color: c.color,
    fontFamily: c.fontFamily,
    fontSize: c.fontSize,
    fontWeight: c.fontWeight,
    paddingLeft: c.paddingLeft,
    paddingRight: `calc(${c.paddingRight} + 18px)`,
  };
}

export default function SelectEnhancer() {
  const [select, setSelect] = useState<HTMLSelectElement | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<Place | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const current = useRef<HTMLSelectElement | null>(null);

  const close = useCallback((refocus = true) => {
    const el = current.current;
    current.current = null;
    setSelect(null);
    setPos(null);
    if (el) {
      el.removeAttribute("data-picking");
      el.setAttribute("aria-expanded", "false");
      if (refocus && el.isConnected) el.focus({ preventScroll: true });
    }
  }, []);

  const open = useCallback(
    (el: HTMLSelectElement, typed = "") => {
      if (current.current && current.current !== el) close(false);
      const next = readItems(el);
      current.current = el;
      el.setAttribute("data-picking", "true");
      el.setAttribute("aria-expanded", "true");
      setItems(next);
      setQuery(typed);
      const selected = next.findIndex((o) => o.index === el.selectedIndex);
      setActive(typed ? 0 : Math.max(0, selected));
      setPos(place(el));
      setSelect(el);
    },
    [close],
  );

  // Intercept the browser popup for every eligible select on the page.
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (panel.current?.contains(target) || field.current?.contains(target))
        return;
      const el = target?.closest?.("select") ?? null;
      if (e.button === 0 && eligible(el)) {
        e.preventDefault();
        el.focus({ preventScroll: true });
        if (current.current === el) close();
        else open(el);
        return;
      }
      if (current.current) close(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as Element | null;
      if (!eligible(el) || current.current === el || e.ctrlKey || e.metaKey)
        return;
      const opener = ["Enter", " ", "ArrowDown", "ArrowUp", "F4"].includes(
        e.key,
      );
      const printable = e.key.length === 1 && e.key !== " " && !e.altKey;
      if (!opener && !printable) return;
      e.preventDefault();
      open(el, printable ? e.key : "");
    };
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, close]);

  // Follow the field while the page scrolls; close if it disappears.
  useEffect(() => {
    if (!select) return;
    const follow = (e: Event) => {
      if (e.target instanceof Node && panel.current?.contains(e.target)) return;
      if (!select.isConnected || !select.getClientRects().length)
        return close(false);
      setPos(place(select));
    };
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [select, close]);

  useEffect(() => {
    if (select) search.current?.focus({ preventScroll: true });
  }, [select]);

  const q = query.trim().toLowerCase();
  const shown = q
    ? items.filter((o) =>
        `${o.label} ${o.group || ""}`.toLowerCase().includes(q),
      )
    : items;

  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>(`[data-i="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, select, query]);

  const pick = (item?: Item) => {
    const el = current.current;
    if (!el || !item || item.disabled) return;
    if (el.value !== item.value) {
      setValue?.call(el, item.value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    close();
  };

  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < shown.length; i += dir)
      if (!shown[i].disabled) return i;
    return from;
  };

  if (!select || !pos) return null;
  const selected = items.find((o) => o.index === select.selectedIndex);
  const placeholder = selected?.value
    ? selected.label
    : selected?.label || "Type to search…";
  const host = select.closest("dialog[open]") ?? document.body;
  const label =
    select.getAttribute("aria-label") ||
    select.labels?.[0]?.textContent?.trim() ||
    select.name ||
    "Options";
  return createPortal(
    <>
      <div
        ref={field}
        className="sx-field"
        style={{
          left: pos.field.left,
          top: pos.field.top,
          width: pos.field.width,
          height: pos.field.height,
        }}
      >
        <input
          ref={search}
          style={look(select)}
          role="combobox"
          aria-expanded="true"
          aria-controls="sx-list"
          aria-label={`Search ${label.toLowerCase()}`}
          aria-activedescendant={shown[active] ? `sx-opt-${active}` : undefined}
          placeholder={placeholder}
          spellCheck={false}
          onBlur={() => close(false)}
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => step(i, 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => step(i, -1));
            } else if (e.key === "Home" && !query) {
              e.preventDefault();
              setActive(step(-1, 1));
            } else if (e.key === "End" && !query) {
              e.preventDefault();
              setActive(step(shown.length, -1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick(shown[active]);
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              close();
            } else if (e.key === "Tab") close(false);
          }}
        />
        <ChevronDown className="sx-chevron" size={16} aria-hidden="true" />
      </div>
      <div
        ref={panel}
        className="sx-panel"
        style={{
          left: pos.left,
          width: pos.width,
          top: pos.top,
          bottom: pos.bottom,
          maxHeight: pos.maxHeight,
        }}
        data-placement={pos.top === undefined ? "up" : "down"}
        onMouseDown={(e) => e.preventDefault()}
      >
        <ul ref={list} id="sx-list" role="listbox" aria-label={label}>
          {shown.map((o, i) => (
            <li key={`${o.index}`} role="presentation">
              {o.group && o.group !== shown[i - 1]?.group && (
                <span className="sx-group">{o.group}</span>
              )}
              <div
                id={`sx-opt-${i}`}
                role="option"
                data-i={i}
                aria-selected={o.index === select.selectedIndex}
                aria-disabled={o.disabled || undefined}
                className={i === active ? "is-active" : undefined}
                onMouseEnter={() => !o.disabled && setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
              >
                <span>{o.label || "—"}</span>
                {o.index === select.selectedIndex && (
                  <Check size={15} aria-hidden="true" />
                )}
              </div>
            </li>
          ))}
          {!shown.length && (
            <li className="sx-empty">No matches for “{query}”</li>
          )}
        </ul>
      </div>
    </>,
    host,
  );
}
