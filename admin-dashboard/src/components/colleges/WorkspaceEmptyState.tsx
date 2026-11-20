import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import "./workspace-empty-state.css";

/** Compact, data-neutral feedback shared by existing workspace panels. */
export default function WorkspaceEmptyState({
  children,
  title,
  icon: Icon = Inbox,
  className = "",
}: {
  children: ReactNode;
  title?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={`workspace-empty-state ${className}`}>
      <span className="workspace-empty-icon" aria-hidden="true"><Icon size={27} strokeWidth={1.5} /></span>
      {title && <strong>{title}</strong>}
      <p>{children}</p>
    </div>
  );
}
