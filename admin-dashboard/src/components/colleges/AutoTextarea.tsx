"use client";
/** Textarea that starts one line tall and grows (or shrinks) with its text; no inner scrollbar. */
import type { TextareaHTMLAttributes } from "react";
import { useAutoHeight } from "./useAutoHeight";

export default function AutoTextarea({
  value,
  className,
  ...props
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "rows"> & {
  value: string;
}) {
  const ref = useAutoHeight(value);
  return (
    <textarea
      {...props}
      ref={ref}
      rows={1}
      value={value}
      className={`auto-textarea ${className ?? ""}`}
    />
  );
}
