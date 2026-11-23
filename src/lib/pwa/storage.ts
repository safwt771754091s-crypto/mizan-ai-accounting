/** تخزين محلي آمن: يفشل بهدوء في التصفح الخاص أو عند منع التخزين. */

export const STORAGE_KEYS = {
  dismissCount: "rakaz.install.dismissCount",
  snoozeUntil: "rakaz.install.snoozeUntil",
  installed: "rakaz.install.installed",
  sessionShown: "rakaz.install.shownInSession",
  updateSnoozed: "rakaz.sw.updateSnoozed",
} as const;

export function readNumber(storage: Storage | undefined, key: string): number | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeValue(storage: Storage | undefined, key: string, value: string): void {
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    /* التخزين ممنوع — نتجاهل بهدوء */
  }
}

export function removeValue(storage: Storage | undefined, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}
