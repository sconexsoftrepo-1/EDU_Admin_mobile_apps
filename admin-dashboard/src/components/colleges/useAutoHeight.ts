"use client";
import { useLayoutEffect, useRef } from "react";

/**
 * Grows a one-line <textarea> to fit its text, so long values (e.g. a department name) wrap
 * and stay fully visible instead of being cut off like in an <input>.
 */
export function useAutoHeight(text: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);
  return ref;
}

/** Keeps these fields single-value: no line breaks from typing or pasting. */
export const oneLine = (value: string) => value.replace(/[\r\n]+/g, " ");
