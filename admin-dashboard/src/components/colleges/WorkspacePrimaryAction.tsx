import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  title?: string;
};

/** Shared primary action for college workspace headers. */
export default function WorkspacePrimaryAction({
  children,
  onClick,
  disabled = false,
  busy = false,
  title,
}: Props) {
  return (
    <button type="button" className="edu-workspace-action" onClick={onClick}
      disabled={disabled || busy} aria-busy={busy} title={title}>
      {children}
    </button>
  );
}
