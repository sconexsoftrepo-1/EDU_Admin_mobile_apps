"use client";
import { useState } from "react";
import { Pencil, Power, Trash2 } from "lucide-react";
import { api, errorText, type LoginAccount } from "@/services/api";
import { toast } from "./toast";

/** Edit, activate / deactivate and delete for one login. */
export default function LoginActions({
  account,
  self,
  onEdit,
  onChanged,
}: {
  account: Pick<LoginAccount, "code" | "login_id" | "active">;
  /** The signed-in admin's own login: cannot be turned off or deleted. */
  self?: boolean;
  onEdit?: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  async function run(work: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await work();
      toast.success(done);
      await onChanged();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }
  return (
    <div className="la-row-actions">
      {onEdit && (
        <button type="button" onClick={onEdit} disabled={busy} title="Edit login and access">
          <Pencil size={14} /> Edit
        </button>
      )}
      <button
        type="button"
        className={account.active ? "la-off" : "la-on"}
        disabled={busy || self}
        title={self ? "You cannot deactivate your own login" : undefined}
        onClick={() =>
          void run(
            () => api.administration.setAccountActive(account.code, !account.active),
            account.active ? `${account.login_id} deactivated` : `${account.login_id} activated`,
          )
        }
      >
        <Power size={14} /> {account.active ? "Deactivate" : "Activate"}
      </button>
      {confirm ? (
        <span className="la-confirm" role="group" aria-label={`Delete ${account.login_id}?`}>
          Delete permanently?
          <button
            type="button"
            className="erp-danger"
            disabled={busy}
            onClick={() =>
              void run(() => api.administration.deleteAccount(account.code), `${account.login_id} deleted`)
            }
          >
            Yes, delete
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirm(false)}>
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="la-delete"
          disabled={busy || self}
          title={self ? "You cannot delete your own login" : "Delete this login"}
          onClick={() => setConfirm(true)}
        >
          <Trash2 size={14} /> Delete
        </button>
      )}
    </div>
  );
}
