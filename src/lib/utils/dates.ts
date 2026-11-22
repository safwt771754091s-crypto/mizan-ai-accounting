import { normalizeDigits } from "../accounting/money";

const AR_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

function toIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

export function parseDateValue(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate())).toISOString().slice(0, 10);
  }
  const text = normalizeDigits(String(raw)).trim();
  if (!text) return null;

  const iso = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return toIso(Number(y), Number(m), Number(d));
  }

  const dmy = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = Number(y) < 100 ? 2000 + Number(y) : Number(y);
    return toIso(year, Number(m), Number(d));
  }

  const serial = text.match(/^\d{5}(\.\d+)?$/);
  if (serial) {
    const days = Number(text);
    if (days > 20000 && days < 80000) {
      const date = new Date(Date.UTC(1899, 11, 30) + Math.round(days) * 86400000);
      return date.toISOString().slice(0, 10);
    }
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())).toISOString().slice(0, 10);
  }
  return null;
}

export function formatDateArabic(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getUTCDate()} ${AR_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function formatDateShort(iso?: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

export function monthLabel(month: string): string {
  const [year, m] = month.split("-");
  const index = Number(m) - 1;
  return `${AR_MONTHS[index] ?? m} ${year}`;
}

export function daysBetween(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`);
  const db = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(da) || Number.isNaN(db)) return 0;
  return Math.round((db - da) / 86400000);
}
