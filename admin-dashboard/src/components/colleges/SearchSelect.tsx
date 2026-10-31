"use client";
/**
 * Drop-in replacement for `<select>` with type-to-filter. It takes the same props and `<option>`
 * children; the list always opens below the field and closes once an option is picked.
 * The value must be one of the options (unlike ComboInput, which keeps free text).
 */
import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import { oneLine, useAutoHeight } from "./useAutoHeight";

type Opt = { value: string; label: string };
type OptionProps = { value?: string | number; children?: ReactNode };

const textOf = (node: ReactNode): string =>
  Children.toArray(node)
    .map((n) =>
      typeof n === "string" || typeof n === "number"
        ? String(n)
        : isValidElement<{ children?: ReactNode }>(n)
          ? textOf(n.props.children)
          : "",
    )
    .join("");

function readOptions(children: ReactNode): Opt[] {
  const out: Opt[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      out.push(
        ...readOptions((child.props as { children?: ReactNode }).children),
      );
      return;
    }
    if (child.type !== "option") return;
    const props = child.props as OptionProps;
    const label = textOf(props.children);
    out.push({ value: String(props.value ?? label), label });
  });
  return out;
}

export default function Select({
  value,
  defaultValue,
  onChange,
  children,
  name,
  required,
  disabled,
  id: fieldId,
  onInvalid,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: {
  value?: string;
  defaultValue?: string;
  onChange?: (e: { target: { value: string } }) => void;
  children?: ReactNode;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  onInvalid?: (e: SyntheticEvent<HTMLTextAreaElement>) => void;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  // The empty option ("All …", "Select …") stays pickable, as in a native select.
  const options = readOptions(children);
  const placeholder = options.find((o) => o.value === "")?.label || "Select";
  // Like a native select, an uncontrolled field without an empty option starts on its first option.
  const [inner, setInner] = useState(
    defaultValue ??
      (options.some((o) => o.value === "") ? "" : (options[0]?.value ?? "")),
  );
  const current = value ?? inner;
  const selected = current
    ? options.find((o) => o.value === current)
    : undefined;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const field = useAutoHeight(query ?? selected?.label ?? "");
  const q = query?.trim().toLowerCase() || "";
  const shown = q
    ? options.filter((o) => o.label.toLowerCase().includes(q))
    : options;

  const close = () => {
    setOpen(false);
    setQuery(null);
  };
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (open && active >= 0)
      list.current
        ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const show = () => {
    if (disabled) return;
    setActive(options.findIndex((o) => o.value === current));
    setOpen(true);
  };
  const pick = (o: Opt) => {
    if (value === undefined) setInner(o.value);
    onChange?.({ target: { value: o.value } });
    close();
  };

  return (
    <div className="combo" ref={root}>
      {name && <input type="hidden" name={name} value={current} />}
      <textarea
        ref={field}
        rows={1}
        role="combobox"
        id={fieldId}
        onInvalid={onInvalid}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={id}
        aria-activedescendant={
          open && active >= 0 ? `${id}-${active}` : undefined
        }
        autoComplete="off"
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        value={query ?? selected?.label ?? ""}
        onFocus={(e) => {
          show();
          e.currentTarget.select();
        }}
        onClick={() => !open && show()}
        onChange={(e) => {
          setQuery(oneLine(e.target.value));
          setActive(0);
          setOpen(true);
        }}
        onBlur={() => setQuery(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) return show();
            setActive((i) => Math.min(shown.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            // A one-line field: Enter picks the highlighted option, never adds a line break.
            e.preventDefault();
            if (open && shown[active]) pick(shown[active]);
          } else if (e.key === "Escape" || e.key === "Tab") {
            close();
          }
        }}
      />
      <button
        type="button"
        className="combo-toggle"
        tabIndex={-1}
        disabled={disabled}
        aria-label={open ? "Hide options" : "Show options"}
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => (open ? close() : show())}
      >
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <ul className="role-select-list" role="listbox" id={id} ref={list}>
          {shown.length === 0 && (
            <li className="combo-empty" role="presentation">
              No matches
            </li>
          )}
          {shown.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-${i}`}
              data-index={i}
              role="option"
              aria-selected={o.value === current}
              className={i === active ? "is-active" : undefined}
              onPointerEnter={() => setActive(i)}
              onPointerDown={(e) => e.preventDefault()}
              onClick={(e) => {
                // Inside a <label>, stop the click from re-focusing (and reopening) the field.
                e.preventDefault();
                pick(o);
              }}
            >
              {o.label}
              {o.value === current && <Check size={14} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
