const ARABIC_INDIC = /[\u0660-\u0669]/g;
const EXTENDED_ARABIC_INDIC = /[\u06F0-\u06F9]/g;

function toLatinDigits(text: string): string {
  return text
    .replace(ARABIC_INDIC, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(EXTENDED_ARABIC_INDIC, (digit) => String(digit.charCodeAt(0) - 0x06f0));
}

export interface NumberToken {
  raw: string;
  value: number;
  isPercent: boolean;
}

const NUMBER_PATTERN = /(\d[\d,\u066C]*(?:\.\d+)?)\s*(%?)/g;

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[,\u066C]/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function extractNumbers(text: string): NumberToken[] {
  const normalized = toLatinDigits(text);
  const tokens: NumberToken[] = [];
  for (const match of normalized.matchAll(NUMBER_PATTERN)) {
    const value = parseAmount(match[1]);
    if (value === null) continue;
    tokens.push({ raw: match[1], value, isPercent: match[2] === "%" });
  }
  return tokens;
}

function groundedValues(sourceText: string): number[] {
  return extractNumbers(sourceText).map((token) => Math.abs(token.value));
}

/**
 * يعيد الأرقام الواردة في إجابة النموذج وغير الموجودة في بيانات الشركة المحسوبة.
 * الأرقام الصغيرة (ترتيب، عدد بنود) والسنوات تُستثنى لتقليل الإنذارات الكاذبة.
 */
export function findUngroundedNumbers(
  answer: string,
  sourceText: string,
  options: { minAmount?: number; tolerance?: number } = {},
): string[] {
  const minAmount = options.minAmount ?? 100;
  const tolerance = options.tolerance ?? 0.51;
  const allowed = groundedValues(sourceText);
  const close = (value: number) => allowed.some((item) => Math.abs(item - value) <= tolerance);
  const offending = new Set<string>();

  for (const token of extractNumbers(answer)) {
    const value = Math.abs(token.value);
    if (token.isPercent) {
      if (!close(value)) offending.add(`${token.raw}%`);
      continue;
    }
    if (Number.isInteger(value) && value >= 1900 && value <= 2100) continue;
    if (value < minAmount) continue;
    if (!close(value)) offending.add(token.raw);
  }

  return [...offending];
}
