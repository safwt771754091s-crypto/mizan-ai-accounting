import Decimal from "decimal.js";

// دقة مالية عالية ومنع أي أخطاء floating point في الحسابات المحاسبية.
Decimal.set({ precision: 32, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -30, toExpPos: 30 });

export type DecimalLike = Decimal | string | number;

export const ZERO = new Decimal(0);

export function dec(value: DecimalLike | null | undefined): Decimal {
  if (value === null || value === undefined || value === "") return new Decimal(0);
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_ARABIC = "۰۱۲۳۴۵۶۷۸۹";

export function normalizeDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const a = ARABIC_INDIC.indexOf(ch);
    if (a >= 0) { out += String(a); continue; }
    const e = EASTERN_ARABIC.indexOf(ch);
    if (e >= 0) { out += String(e); continue; }
    out += ch;
  }
  return out;
}

/**
 * يحوّل أي قيمة مالية واردة من ملفات العملاء إلى Decimal بدقة.
 * يتعامل مع: الأرقام العربية، الفواصل الألفية، الفاصلة العشرية العربية،
 * الأقواس للسالب، إشارة السالب الملحقة، رموز العملات، والمسافات غير المرئية.
 */
export function toMoney(raw: unknown): Decimal {
  if (raw === null || raw === undefined) return new Decimal(0);
  if (raw instanceof Decimal) return raw;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return new Decimal(0);
    return new Decimal(raw);
  }
  let s = normalizeDigits(String(raw)).trim();
  if (!s) return new Decimal(0);

  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  s = s.replace(/[\u200e\u200f\u061c\u00a0\u202f]/g, " ");
  s = s.replace(/[٬،]/g, ",").replace(/٫/g, ".");
  // إزالة رموز العملات والحروف
  // رموز عملات تحتوي نقطة (ر.س، د.إ، ج.م) تترك فاصلاً بادئاً/منتهياً بعد إزالة الحروف
  const hadSymbols = /[^\d.,+\-()\s]/.test(s);
  s = s.replace(/[^\d.,+\-]/g, "").trim();
  if (hadSymbols) s = s.replace(/^[.,]+/, "").replace(/[.,]+$/, "");
  if (s.startsWith("-")) { negative = true; s = s.slice(1); }
  if (s.endsWith("-")) { negative = true; s = s.slice(0, -1); }
  s = s.replace(/\+/g, "");

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // الفاصل الأخير هو العشري، والآخر ألفي
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const parts = s.split(",");
    const isThousands = parts.length > 2 || (parts.length === 2 && parts[1].length === 3);
    s = isThousands ? parts.join("") : s.replace(",", ".");
  } else if (lastDot >= 0) {
    const parts = s.split(".");
    const allThousands = parts.length > 2 && parts.slice(1).every((part) => part.length === 3);
    if (allThousands) s = parts.join("");
    else if (parts.length > 2) s = parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
  }

  if (!/^-?\d*(\.\d*)?$/.test(s) || s === "" || s === "-" || s === ".") return new Decimal(0);
  const value = new Decimal(s);
  return negative ? value.negated() : value;
}

export function round2(value: DecimalLike): Decimal {
  return dec(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function money(value: DecimalLike): number {
  const n = round2(value).toNumber();
  return Object.is(n, -0) ? 0 : n;
}

export function sum(values: Iterable<DecimalLike>): Decimal {
  let total = new Decimal(0);
  for (const v of values) total = total.plus(dec(v));
  return total;
}

export function isZero(value: DecimalLike, tolerance = "0.005"): boolean {
  return dec(value).abs().lt(tolerance);
}

export function formatMoney(value: DecimalLike, currency = "SAR", locale = "en-US"): string {
  const n = round2(value).toNumber();
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `${formatted} ${currencySymbol(currency)}`;
}

export function formatNumber(value: DecimalLike, digits = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(round2(value).toNumber());
}

export function formatPercent(value: DecimalLike, digits = 1): string {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(dec(value).toDecimalPlaces(digits).toNumber())}%`;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  SAR: "ر.س",
  AED: "د.إ",
  EGP: "ج.م",
  KWD: "د.ك",
  QAR: "ر.ق",
  OMR: "ر.ع",
  BHD: "د.ب",
  JOD: "د.أ",
  USD: "$",
  EUR: "€",
  GBP: "£",
  YER: "ر.ي",
  IQD: "د.ع",
  LYD: "د.ل",
  TND: "د.ت",
  DZD: "د.ج",
  MAD: "د.م",
};

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency?.toUpperCase()] ?? currency?.toUpperCase() ?? "";
}
