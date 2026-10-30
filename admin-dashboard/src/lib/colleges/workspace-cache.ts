/** Private browser-memory cache. It never persists tokens, passwords or college records to disk. */
const MAX_ENTRIES = 80;
const MAX_AGE_MS = 5 * 60_000;
type Entry = { value: unknown; updatedAt: number };
const entries = new Map<string, Entry>();
const pending = new Map<string, Promise<unknown>>();
let generation = 0;
export function workspaceCacheKey(
  account: string | undefined,
  role: string | undefined,
  resource: string,
): string | null {
  return account && role ? `${account}:${role}:${resource}` : null;
}
export function readWorkspaceCache<T>(key: string | null): T | undefined {
  if (!key) return undefined;
  const entry = entries.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.updatedAt > MAX_AGE_MS) {
    entries.delete(key);
    return undefined;
  }
  return entry.value as T;
}
export function writeWorkspaceCache<T>(key: string | null, value: T): T {
  if (!key) return value;
  entries.delete(key);
  entries.set(key, { value, updatedAt: Date.now() });
  while (entries.size > MAX_ENTRIES)
    entries.delete(entries.keys().next().value!);
  return value;
}
/** Always revalidates; concurrent readers of the same account/role/resource share one request. */
export function refreshWorkspaceCache<T>(
  key: string | null,
  loader: () => Promise<T>,
  shouldCache: (value: T) => boolean = () => true,
): Promise<T> {
  if (!key) return loader();
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;
  const version = generation;
  const task = Promise.resolve()
    .then(loader)
    .then((value) => {
      if (version === generation && shouldCache(value))
        writeWorkspaceCache(key, value);
      return value;
    })
    .finally(() => {
      if (pending.get(key) === task) pending.delete(key);
    });
  pending.set(key, task);
  return task;
}
export function clearWorkspaceCache(): void {
  generation++;
  entries.clear();
  pending.clear();
  forgetWorkspaceSession();
}

import type { AccountRole, MeResponse, ScreenSummary } from "@/services/api";
export type PreparedWorkspaceSession = {
  me: MeResponse;
  active: AccountRole;
  screens: ScreenSummary[];
};
let handoff: { college: string; key: string; expiresAt: number } | null = null;
/**
 * The signed-in navigation (account, roles and permitted screen keys — no tokens, no college
 * records) is kept for the browser tab, so a reload shows the sidebar at once while the session
 * is revalidated in the background. Cleared on sign-out and whenever the cache is cleared.
 */
const SESSION_PREFIX = "edunexa-workspace-session:";
export function storeWorkspaceSession(
  college: string,
  session: PreparedWorkspaceSession,
): void {
  try {
    sessionStorage.setItem(SESSION_PREFIX + college, JSON.stringify(session));
  } catch {
    /* Storage disabled: the session is fetched on reload instead. */
  }
}
export function readStoredWorkspaceSession(
  college: string,
): PreparedWorkspaceSession | undefined {
  try {
    const raw = sessionStorage.getItem(SESSION_PREFIX + college);
    return raw ? (JSON.parse(raw) as PreparedWorkspaceSession) : undefined;
  } catch {
    return undefined;
  }
}
export function forgetWorkspaceSession(): void {
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(SESSION_PREFIX)) sessionStorage.removeItem(key);
  } catch {
    /* Nothing stored. */
  }
}
/** Reuse the just-verified login response across the client-side route transition. No tokens are cached. */
export function prepareWorkspaceSession(
  college: string,
  session: PreparedWorkspaceSession,
): void {
  storeWorkspaceSession(college, session);
  const key = workspaceCacheKey(
    session.me.account.code,
    session.active.code,
    "login-handoff",
  )!;
  writeWorkspaceCache(key, session);
  handoff = { college, key, expiresAt: Date.now() + 10_000 };
}
export function readPreparedWorkspaceSession(
  college: string,
): PreparedWorkspaceSession | undefined {
  if (!handoff || handoff.college !== college || handoff.expiresAt < Date.now())
    return undefined;
  return readWorkspaceCache<PreparedWorkspaceSession>(handoff.key);
}
