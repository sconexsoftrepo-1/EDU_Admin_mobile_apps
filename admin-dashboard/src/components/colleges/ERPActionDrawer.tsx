"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
export type DrawerAction = {
  title: string;
  description: string;
  confirm: () => void;
};
export default function ERPActionDrawer({
  action,
  close,
}: {
  action: DrawerAction | null;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (action && !dialog.current?.open) dialog.current?.showModal();
  }, [action]);
  return (
    <dialog
      ref={dialog}
      className="erp-modal erp-action-drawer"
      data-panel-size="compact"
      aria-labelledby="erp-action-title"
      onClose={close}
    >
      <div className="erp-panel-title">
        <h2 id="erp-action-title">{action?.title}</h2>
        <button
          aria-label="Close confirmation"
          onClick={() => dialog.current?.close()}
        >
          <X size={20} />
        </button>
      </div>
      <p className="erp-confirmation-description">{action?.description}</p>
      <div className="erp-modal-actions">
        <button onClick={() => dialog.current?.close()}>Cancel</button>
        <button
          className="erp-primary"
          onClick={() => {
            action?.confirm();
            dialog.current?.close();
          }}
        >
          Confirm action
        </button>
      </div>
    </dialog>
  );
}
