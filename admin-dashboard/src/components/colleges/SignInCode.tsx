"use client";

import { useEffect, useRef, useState } from "react";

/** Best-effort feedback: unsupported devices simply keep the visual feedback. */
export function codeHaptic(pattern: number | number[]) {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try { navigator.vibrate(pattern); } catch { /* Optional device capability. */ }
}

export default function SignInCode({ disabled, invalid, verified, onChange }: {
  disabled: boolean;
  invalid: boolean;
  verified: boolean;
  onChange: (code: string) => void;
}) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { inputs.current[0]?.focus(); }, []);
  useEffect(() => {
    if (invalid) {
      codeHaptic([35, 50, 35]);
      inputs.current[0]?.focus();
      inputs.current[0]?.select();
    }
  }, [invalid]);
  useEffect(() => { if (verified) codeHaptic([15, 45, 25]); }, [verified]);

  function update(next: string[]) {
    setDigits(next);
    onChange(next.join(""));
  }
  function enter(raw: string, index: number) {
    const value = raw.replace(/\D/g, "").slice(0, 6);
    if (!value) return;
    const start = value.length === 6 ? 0 : index;
    const next = [...digits];
    for (let n = 0; n < value.length && start + n < 6; n++) next[start + n] = value[n];
    update(next);
    codeHaptic(8);
    const target = inputs.current[Math.min(start + value.length, 5)];
    target?.focus();
    target?.select();
  }

  return (
    <fieldset className={`ca-otp${invalid ? " is-invalid" : ""}${verified ? " is-verified" : ""}`} disabled={disabled}>
      <legend>6-digit code</legend>
      <div className="ca-otp-digits">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => { inputs.current[index] = element; }}
            className={digit ? "is-filled" : undefined}
            aria-label={`Digit ${index + 1} of 6`}
            aria-describedby={invalid ? "sign-in-error code-help" : "code-help"}
            aria-invalid={invalid || undefined}
            name={`code-digit-${index + 1}`}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={6}
            pattern="[0-9]"
            required
            value={digit}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => {
              if (!event.target.value) {
                const next = [...digits]; next[index] = ""; update(next);
              } else enter(event.target.value, index);
            }}
            onPaste={(event) => {
              const value = event.clipboardData.getData("text");
              if (/\d/.test(value)) { event.preventDefault(); enter(value, index); }
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace") {
                event.preventDefault();
                const target = digits[index] ? index : Math.max(index - 1, 0);
                const next = [...digits]; next[target] = ""; update(next);
                inputs.current[target]?.focus();
                inputs.current[target]?.select();
              } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                inputs.current[Math.max(0, Math.min(5, index + (event.key === "ArrowLeft" ? -1 : 1)))]?.focus();
              }
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}
