/** An edit sent for approval: the API call succeeded, but no data changed yet. */
let lastPendingAt = 0;
const listeners = new Set<() => void>();

export function notifyEditPending() {
  lastPendingAt = Date.now();
  listeners.forEach((listener) => listener());
}
export function onEditPending(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
/** True right after an edit was queued, when a form's own "saved" message would be wrong. */
export const editJustQueued = () => Date.now() - lastPendingAt < 2500;
