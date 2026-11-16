"use client";
import { useMemo, useState } from "react";
import { BookOpen, ChevronDown, LayoutGrid } from "lucide-react";
import type { AccessLevel, ScreenSummary } from "@/services/api";
import { hubIcons, screenIcon } from "@/lib/colleges/module-hubs";
import { groupByModule, LEVEL_HELP, LEVEL_LABELS } from "@/lib/colleges/access";
import "./access-picker.css";

const LEVELS: AccessLevel[] = ["view", "edit", "full"];

/**
 * Modules (with the sidebar's icons) holding a checkbox per screen and, when ticked, the access
 * level. `inherited` screens come from the login's roles: shown ticked and locked.
 */
export default function AccessPicker({
  screens,
  value,
  onChange,
  inherited = {},
  disabled = false,
  readOnly = false,
}: {
  screens: ScreenSummary[];
  value: Record<string, AccessLevel>;
  onChange?: (next: Record<string, AccessLevel>) => void;
  inherited?: Record<string, AccessLevel>;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  const groups = useMemo(() => groupByModule(screens), [screens]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const locked = (key: string) => key in inherited;
  const checked = (key: string) => key in value || locked(key);
  const set = (next: Record<string, AccessLevel>) => !readOnly && onChange?.(next);
  const toggle = (key: string) => {
    if (locked(key)) return;
    const next = { ...value };
    if (key in next) delete next[key];
    else next[key] = "view";
    set(next);
  };
  const toggleGroup = (keys: string[], on: boolean) => {
    const next = { ...value };
    for (const key of keys) {
      if (locked(key)) continue;
      if (on) next[key] ??= "view";
      else delete next[key];
    }
    set(next);
  };
  const q = query.trim().toLowerCase();
  const total = Object.keys({ ...inherited, ...value }).length;
  return (
    <div className={`ap ${readOnly ? "ap-readonly" : ""}`}>
      {!readOnly && (
        <div className="ap-toolbar">
          <input
            type="search"
            placeholder="Search screens…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search screens"
          />
          <span className="ap-total">
            <LayoutGrid size={14} /> {total} screen{total === 1 ? "" : "s"}
          </span>
        </div>
      )}
      <div className="ap-modules">
        {groups.map((group) => {
          const Icon = hubIcons[group.key] || BookOpen;
          const items = group.screens.filter(
            (s) => !q || `${s.title} ${s.key}`.toLowerCase().includes(q),
          );
          if (!items.length) return null;
          if (readOnly && !items.some((s) => checked(s.key))) return null;
          const shown = readOnly ? items.filter((s) => checked(s.key)) : items;
          const count = group.screens.filter((s) => checked(s.key)).length;
          const all = count === group.screens.length;
          const expanded = readOnly || q !== "" || open[group.key] !== false;
          return (
            <section key={group.key} className={`ap-module ${count ? "has-access" : ""}`}>
              <header>
                {!readOnly && (
                  <input
                    type="checkbox"
                    aria-label={`All screens in ${group.title}`}
                    checked={all}
                    ref={(el) => {
                      if (el) el.indeterminate = count > 0 && !all;
                    }}
                    disabled={disabled}
                    onChange={() =>
                      toggleGroup(
                        group.screens.map((s) => s.key),
                        !all,
                      )
                    }
                  />
                )}
                <span className="ap-module-icon">
                  <Icon size={17} />
                </span>
                <strong>{group.title}</strong>
                <small>
                  {count}/{group.screens.length}
                </small>
                {!readOnly && (
                  <button
                    type="button"
                    className="ap-collapse"
                    aria-expanded={expanded}
                    aria-label={`${expanded ? "Collapse" : "Expand"} ${group.title}`}
                    onClick={() => setOpen((o) => ({ ...o, [group.key]: !expanded }))}
                  >
                    <ChevronDown size={16} />
                  </button>
                )}
              </header>
              {expanded && (
                <ul>
                  {shown.map((screen) => {
                    const ScreenIcon = screenIcon(screen.key);
                    const on = checked(screen.key);
                    const level = inherited[screen.key] || value[screen.key];
                    return (
                      <li key={screen.key} className={on ? "is-on" : ""}>
                        <label className="ap-screen">
                          {!readOnly && (
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={disabled || locked(screen.key)}
                              onChange={() => toggle(screen.key)}
                            />
                          )}
                          <ScreenIcon size={16} aria-hidden="true" />
                          <span>{screen.title}</span>
                          {locked(screen.key) && <em>From role</em>}
                        </label>
                        {on && (
                          <div className="ap-levels" role="radiogroup" aria-label={`${screen.title} access`}>
                            {LEVELS.map((l) => (
                              <button
                                type="button"
                                key={l}
                                role="radio"
                                aria-checked={level === l}
                                title={LEVEL_HELP[l]}
                                className={level === l ? "is-active" : ""}
                                disabled={disabled || readOnly || locked(screen.key)}
                                onClick={() => set({ ...value, [screen.key]: l })}
                              >
                                {LEVEL_LABELS[l]}
                              </button>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
