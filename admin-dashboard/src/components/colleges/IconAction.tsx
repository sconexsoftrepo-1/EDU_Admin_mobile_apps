"use client";
/**
 * Row action as an icon button (pencil = edit, trash = delete). The label is the tooltip and the
 * accessible name, e.g. label="Edit Katta" or label="Delete role".
 */
import type { MouseEventHandler } from "react";
import { Pencil, Trash2 } from "lucide-react";

export default function IconAction({
  kind,
  label,
  onClick,
  disabled,
}: {
  kind: "edit" | "delete";
  label: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
}) {
  const Icon = kind === "edit" ? Pencil : Trash2;
  return (
    <button
      type="button"
      className={`icon-action icon-action-${kind}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={15} aria-hidden="true" />
    </button>
  );
}
