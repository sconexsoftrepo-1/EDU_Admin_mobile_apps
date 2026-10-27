"use client";
/** API-driven role picker; keeps keyboard focus on the combobox. */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Crown,
  GraduationCap,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

type Option = { code: string; name: string };

function RoleIcon({ name }: { name: string }) {
  const Icon = /super admin/i.test(name)
    ? Crown
    : /admin/i.test(name)
      ? Settings
      : /faculty|teacher|principal/i.test(name)
        ? GraduationCap
        : /parent/i.test(name)
          ? UsersRound
          : /student/i.test(name)
            ? UserRound
            : ShieldCheck;
  return <Icon size={18} strokeWidth={1.7} aria-hidden="true" />;
}

export default function RoleSelect({
  options,
  value,
  onChange,
  placeholder = "Loading roles…",
  disabled = false,
}: {
  options: Option[];
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [placement, setPlacement] = useState({ above: false, height: 270 });
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const selected = options.find((o) => o.code === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    const panel = list.current;
    const item = panel?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!open || !panel || !item) return;
    if (item.offsetTop < panel.scrollTop) panel.scrollTop = item.offsetTop;
    else if (
      item.offsetTop + item.offsetHeight >
      panel.scrollTop + panel.clientHeight
    )
      panel.scrollTop = item.offsetTop + item.offsetHeight - panel.clientHeight;
  }, [open, active]);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = root.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop || 0;
      const bottom = top + (viewport?.height || window.innerHeight);
      const below = bottom - rect.bottom - 12;
      const above = rect.top - top - 12;
      const useAbove =
        below < Math.min(220, options.length * 44 + 12) && above > below;
      setPlacement({
        above: useAbove,
        height: Math.max(44, Math.min(270, useAbove ? above : below)),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [open, options.length]);

  const show = () => {
    if (disabled || !options.length) return;
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.code === value),
      ),
    );
    setOpen(true);
  };
  const pick = (i: number) => {
    onChange(options[i].code);
    setOpen(false);
  };

  return (
    <div
      className="role-select"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <button
        type="button"
        className="role-select-trigger"
        role="combobox"
        aria-label="Role"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        disabled={disabled || !options.length}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (!open) {
            if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
              e.preventDefault();
              show();
            }
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(options.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === "Home") {
            e.preventDefault();
            setActive(0);
          } else if (e.key === "End") {
            e.preventDefault();
            setActive(options.length - 1);
          } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pick(active);
          } else if (e.key === "Escape" || e.key === "Tab") {
            setOpen(false);
          }
        }}
      >
        <span>
          <RoleIcon name={selected?.name || ""} />
          <span>{selected?.name ?? placeholder}</span>
        </span>
        <ChevronDown className="role-chevron" size={16} aria-hidden="true" />
      </button>
      {open && (
        <ul
          className="role-select-list"
          role="listbox"
          aria-label="Role"
          id={id}
          ref={list}
          style={{
            top: placement.above ? "auto" : "calc(100% + 4px)",
            bottom: placement.above ? "calc(100% + 4px)" : "auto",
            maxHeight: placement.height,
          }}
        >
          {options.map((o, i) => (
            <li
              key={o.code}
              id={`${id}-${i}`}
              data-index={i}
              role="option"
              aria-selected={o.code === value}
              className={i === active ? "is-active" : undefined}
              onPointerEnter={() => setActive(i)}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => pick(i)}
            >
              <span className="role-option-label">
                <RoleIcon name={o.name} />
                {o.name}
              </span>
              {o.code === value && <Check size={14} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
