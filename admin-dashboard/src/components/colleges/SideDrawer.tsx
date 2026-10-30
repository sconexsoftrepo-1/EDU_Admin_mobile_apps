"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import "./student-enrollment-details.css";

export default function SideDrawer({
  title,
  subtitle,
  expanded = false,
  className = "",
  actions,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  expanded?: boolean;
  className?: string;
  actions?: ReactNode;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`edu-record-drawer ${expanded ? "edu-record-drawer-expanded" : ""} ${className}`}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const box = e.currentTarget.getBoundingClientRect();
          if (e.clientX < box.left) onClose();
        }
      }}
    >
      <header className="edu-record-drawer-header">
        <div>
          <h2 id={titleId}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="edu-record-drawer-actions">
          {actions}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            title="Close panel"
          >
            <X size={20} />
          </button>
        </div>
      </header>
      <div className="edu-record-drawer-body">{children}</div>
    </dialog>
  );
}
