"use client";
import "./search-field.css";
/**
 * Country calling-code picker with flags (react-phone-number-input / libphonenumber-js data).
 * The list opens below, filters as you type (name or code) and closes once a country is picked.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumber,
  type Country,
} from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import names from "react-phone-number-input/locale/en.json";
import "./country-code-picker.css";

/** Countries that share a calling code: which one "+1", "+7", … should show. */
const PREFERRED: Record<string, Country> = {
  "+91": "IN",
  "+1": "US",
  "+44": "GB",
  "+61": "AU",
  "+7": "RU",
};

export const callingCode = (country: Country) =>
  `+${getCountryCallingCode(country)}`;

export function countryForCode(code: string): Country {
  return (
    PREFERRED[code] ??
    getCountries().find((c) => callingCode(c) === code) ??
    "IN"
  );
}

const COUNTRIES = getCountries()
  .map((c) => ({ country: c, name: names[c] ?? c, code: callingCode(c) }))
  .sort((a, b) =>
    a.country === "IN"
      ? -1
      : b.country === "IN"
        ? 1
        : a.name.localeCompare(b.name),
  );

export function Flag({ country }: { country: Country }) {
  const Svg = flags[country];
  return (
    <span className="cc-flag" aria-hidden="true">
      {Svg ? <Svg title={names[country] ?? country} /> : null}
    </span>
  );
}

export default function CountryCodePicker({
  country,
  onChange,
  label,
}: {
  country: Country;
  onChange: (country: Country) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLSpanElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const id = useId();
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, "");
    return q
      ? COUNTRIES.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.code.slice(1).startsWith(q) ||
            c.country.toLowerCase() === q,
        )
      : COUNTRIES;
  }, [query]);

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (open)
      list.current
        ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const show = () => {
    setQuery("");
    setActive(
      Math.max(
        0,
        COUNTRIES.findIndex((c) => c.country === country),
      ),
    );
    setOpen(true);
  };
  const pick = (c: Country) => {
    onChange(c);
    setOpen(false);
  };

  return (
    <span className="cc-picker" ref={root}>
      {/* Not a <button>: inside a field <label> that would steal the label from the number input. */}
      <span
        role="combobox"
        tabIndex={0}
        className="cc-trigger"
        aria-label={`${label} country code, ${names[country] ?? country} ${callingCode(country)}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.preventDefault();
          if (open) setOpen(false);
          else show();
        }}
        onKeyDown={(e) => {
          if (["Enter", " ", "ArrowDown"].includes(e.key)) {
            e.preventDefault();
            show();
          }
        }}
      >
        <Flag country={country} />
        <span>{callingCode(country)}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </span>
      {open && (
        <span className="cc-panel">
          <span className="cc-search edu-search-field">
            <Search size={14} aria-hidden="true" />
            <input className="edu-search-input"
              ref={search}
              aria-label="Search country"
              placeholder="Search country or code"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((i) => Math.min(shown.length - 1, i + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => Math.max(0, i - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (shown[active]) pick(shown[active].country);
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
            />
          </span>
          <ul className="cc-list" role="listbox" id={id} ref={list}>
            {shown.length === 0 && (
              <li className="combo-empty" role="presentation">
                No matches
              </li>
            )}
            {shown.map((c, i) => (
              <li
                key={c.country}
                data-index={i}
                role="option"
                aria-selected={c.country === country}
                className={i === active ? "is-active" : undefined}
                onPointerEnter={() => setActive(i)}
                onPointerDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  pick(c.country);
                }}
              >
                <Flag country={c.country} />
                <span className="cc-name">{c.name}</span>
                <span className="cc-code">{c.code}</span>
                {c.country === country && (
                  <Check size={14} aria-hidden="true" />
                )}
              </li>
            ))}
          </ul>
        </span>
      )}
    </span>
  );
}

/** Phone number with a flag country-code picker (India +91 by default). */
export function PhoneInput({
  code,
  onCode,
  value,
  onChange,
  required,
  label,
  id,
}: {
  code: string;
  onCode: (code: string) => void;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  label: string;
  id?: string;
}) {
  // +1, +7, … are shared by several countries, so the chosen flag is remembered here.
  const [country, setCountry] = useState<Country>(() => countryForCode(code));
  const shown = callingCode(country) === code ? country : countryForCode(code);
  const input = useRef<HTMLInputElement>(null);
  // India keeps the 10-digit mobile pattern; other countries are checked with libphonenumber.
  useEffect(() => {
    const digits = value.replace(/\s/g, "");
    input.current?.setCustomValidity(
      code === "+91" || !digits || isValidPhoneNumber(code + digits)
        ? ""
        : `Enter a valid ${names[shown] ?? ""} phone number`.replace("  ", " "),
    );
  }, [code, value, shown]);
  return (
    <span className="enw-phone">
      <CountryCodePicker
        label={label}
        country={shown}
        onChange={(c) => {
          setCountry(c);
          onCode(callingCode(c));
        }}
      />
      <input
        ref={input}
        id={id}
        type="tel"
        inputMode="numeric"
        aria-label={label}
        placeholder={code === "+91" ? "10-digit mobile number" : "Phone number"}
        required={required}
        pattern={code === "+91" ? "[6-9][0-9]{9}" : "[0-9 ]{4,17}"}
        title={code === "+91" ? "10-digit mobile number" : "Phone number"}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9 ]/g, ""))}
      />
    </span>
  );
}

/** Splits a stored number ("+91 98765 43210", "9876543210") into calling code and digits. */
export function splitPhone(stored?: string | null): {
  code: string;
  number: string;
} {
  const text = (stored ?? "").trim();
  if (text.startsWith("+")) {
    try {
      const parsed = parsePhoneNumber(text);
      if (parsed)
        return {
          code: `+${parsed.countryCallingCode}`,
          number: String(parsed.nationalNumber),
        };
    } catch {
      // not a parseable international number; fall through
    }
  }
  return { code: "+91", number: text.replace(/[^0-9 ]/g, "") };
}

/**
 * Uncontrolled phone field for FormData-based forms: posts "<code> <number>" under `name`.
 */
export function FormPhoneInput({
  name,
  defaultValue,
  required,
  label,
  id,
  onValue,
}: {
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  label: string;
  id?: string;
  onValue?: (value: string) => void;
}) {
  const [phone, setPhone] = useState(() => splitPhone(defaultValue));
  const combined = phone.number.trim()
    ? `${phone.code} ${phone.number.trim()}`
    : "";
  const update = (next: { code: string; number: string }) => {
    setPhone(next);
    onValue?.(next.number.trim() ? `${next.code} ${next.number.trim()}` : "");
  };
  return (
    <>
      <input type="hidden" name={name} value={combined} />
      <PhoneInput
        id={id}
        label={label}
        required={required}
        code={phone.code}
        onCode={(code) => update({ ...phone, code })}
        value={phone.number}
        onChange={(number) => update({ ...phone, number })}
      />
    </>
  );
}

/** Field keys/types that hold a phone or mobile number (backend columns, form-builder fields). */
export function isPhoneField(key: string, type?: string) {
  if (type === "tel" || type === "phone") return true;
  if (type && !["text", "string", "varchar"].includes(type)) return false;
  return /(^|[._])(phone|mobile|whatsapp)([._]|$)|_phone$|^phone|(pickup|work)_contact$|contact_(number|mobile)$|^contact$/i.test(
    key,
  );
}
