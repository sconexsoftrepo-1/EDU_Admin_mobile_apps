"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
} from "react";
import { Search, X } from "lucide-react";
import "./search-field.css";

/** Suggestions come only from the records already available to this screen. */
export function searchValues(
  rows: readonly unknown[],
  keys?: readonly string[],
): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    if (typeof row === "string") values.add(row);
    else if (row && typeof row === "object") {
      const record = row as Record<string, unknown>;
      if (record.first_name)
        values.add(
          [record.first_name, record.last_name].filter(Boolean).join(" "),
        );
      for (const value of keys
        ? keys.map((key) => record[key])
        : Object.values(record)) {
        if (
          typeof value === "string" &&
          value.trim() &&
          !/^https?:\/\//.test(value)
        )
          values.add(value);
        else if (typeof value === "number" && Number.isFinite(value))
          values.add(String(value));
      }
    }
  }
  return [...values];
}

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "size"
> & {
  value: string;
  onValueChange: (value: string) => void;
  suggestions?: readonly string[];
};
const EMPTY: readonly string[] = [];

export default function SearchField({
  value,
  onValueChange,
  suggestions = EMPTY,
  className = "",
  placeholder = "Search or filter…",
  ...props
}: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(-1);
  const matches = useMemo(() => {
    const query = value.trim().toLocaleLowerCase();
    return query
      ? [...new Set(suggestions)]
          .filter((s) => s.toLocaleLowerCase().includes(query))
          .slice(0, 8)
      : [];
  }, [suggestions, value]);
  const open = focused && !dismissed && !!value.trim();
  useLayoutEffect(() => {
    const dropdown = panel.current;
    if (!dropdown || !open) {
      dropdown?.hidePopover();
      return;
    }
    const place = () => {
      const box = input.current?.parentElement?.getBoundingClientRect();
      if (!box) return;
      const below = window.innerHeight - box.bottom - 12;
      const above = box.top - 12;
      const upward = below < 180 && above > below;
      Object.assign(dropdown.style, {
        left: `${Math.max(8, box.left)}px`,
        width: `${Math.min(box.width, window.innerWidth - 16)}px`,
        top: upward ? "auto" : `${box.bottom + 5}px`,
        bottom: upward ? `${window.innerHeight - box.top + 5}px` : "auto",
        maxHeight: `${Math.max(0, Math.min(320, upward ? above : below))}px`,
      });
    };
    place();
    dropdown.showPopover();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      dropdown.hidePopover();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  useEffect(() => {
    if (active >= 0)
      panel.current
        ?.querySelector(`[id="${id}-${active}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, id]);
  const choose = (text: string) => {
    onValueChange(text);
    setDismissed(true);
    setActive(-1);
  };
  return (
    <div className={`edu-search-field ${className}`}>
      <Search size={17} aria-hidden="true" />
      <input
        {...props}
        ref={input}
        className="edu-search-input"
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={props["aria-label"] || placeholder}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={
          open && matches[active] ? `${id}-${active}` : undefined
        }
        autoComplete="off"
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setActive(-1);
        }}
        onChange={(e) => {
          onValueChange(e.target.value);
          setDismissed(false);
          setActive(-1);
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setDismissed(false);
            setActive((i) =>
              matches.length
                ? e.key === "ArrowDown"
                  ? Math.min(i + 1, matches.length - 1)
                  : Math.max(i - 1, 0)
                : -1,
            );
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (open && matches[active]) choose(matches[active]);
            else setDismissed(true);
          } else if (e.key === "Escape" && open) {
            e.preventDefault();
            e.stopPropagation();
            setDismissed(true);
          }
          props.onKeyDown?.(e);
        }}
      />
      {value && (
        <button
          className="edu-search-clear"
          type="button"
          aria-label="Clear search"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            choose("");
            input.current?.focus();
          }}
        >
          <X size={15} />
        </button>
      )}
      <div
        ref={panel}
        id={id}
        popover="manual"
        role="listbox"
        aria-label="Search suggestions"
        className="edu-search-suggestions"
      >
        {matches.length ? (
          matches.map((text, i) => (
            <div
              key={text}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? "is-active" : undefined}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(text)}
            >
              {text}
            </div>
          ))
        ) : (
          <p role="status">No matching suggestions</p>
        )}
      </div>
    </div>
  );
}
