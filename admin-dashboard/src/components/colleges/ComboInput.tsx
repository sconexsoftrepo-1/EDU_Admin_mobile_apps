"use client";
/**
 * Text field with a suggestion list that always opens below it (same look as the sign-in role
 * picker). The user can pick a suggestion or keep any typed value, e.g. a new department.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { oneLine, useAutoHeight } from "./useAutoHeight";

export default function ComboInput({
  value,
  onChange,
  options,
  placeholder,
  required,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [typed, setTyped] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const field = useAutoHeight(value);
  const query = value.trim().toLowerCase();
  // Typing filters the list; opening it from the arrow shows every option.
  const shown =
    typed && query
      ? options.filter((o) => o.toLowerCase().includes(query))
      : options;

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    if (open && active >= 0)
      list.current
        ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const show = (all: boolean) => {
    setTyped(!all);
    setActive(Math.max(-1, options.indexOf(value)));
    setOpen(true);
  };
  const pick = (option: string) => {
    onChange(option);
    setTyped(false);
    setOpen(false);
  };

  return (
    <div className="combo" ref={root}>
      <textarea
        ref={field}
        rows={1}
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={open && shown.length > 0}
        aria-controls={id}
        aria-activedescendant={
          open && active >= 0 ? `${id}-${active}` : undefined
        }
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(e) => {
          onChange(oneLine(e.target.value));
          setTyped(true);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => show(true)}
        onClick={() => !open && show(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) return show(true);
            setActive((i) => Math.min(shown.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            // A one-line field: Enter picks the highlighted option, never adds a line break.
            e.preventDefault();
            if (open && active >= 0 && shown[active]) pick(shown[active]);
          } else if (e.key === "Escape" || e.key === "Tab") {
            setOpen(false);
          }
        }}
      />
      <button
        type="button"
        className="combo-toggle"
        tabIndex={-1}
        aria-label={open ? "Hide options" : "Show options"}
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => (open ? setOpen(false) : show(true))}
      >
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && shown.length > 0 && (
        <ul className="role-select-list" role="listbox" id={id} ref={list}>
          {shown.map((o, i) => (
            <li
              key={o}
              id={`${id}-${i}`}
              data-index={i}
              role="option"
              aria-selected={o === value}
              className={i === active ? "is-active" : undefined}
              onPointerEnter={() => setActive(i)}
              onPointerDown={(e) => e.preventDefault()}
              onClick={(e) => {
                // Inside a <label>, stop the click from re-focusing (and reopening) the field.
                e.preventDefault();
                pick(o);
              }}
            >
              {o}
              {o === value && <Check size={14} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
