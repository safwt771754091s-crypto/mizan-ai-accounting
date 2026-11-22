import { normalizeArabic } from "../utils/similarity";
import type { ColumnMapping, DatasetSchema, MappingSuggestion, ParsedSheet } from "./types";

function normalizeHeader(value: string): string {
  return normalizeArabic(String(value ?? ""))
    .replace(/\bال\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchScore(header: string, alias: string): number {
  const h = normalizeHeader(header);
  const a = normalizeHeader(alias);
  if (!h || !a) return 0;
  if (h === a) return 100;
  if (h.replace(/\s/g, "") === a.replace(/\s/g, "")) return 95;
  if (h.includes(a) || a.includes(h)) {
    const ratio = Math.min(h.length, a.length) / Math.max(h.length, a.length);
    return 70 + Math.min(20, Math.round(ratio * 20));
  }
  const hTokens = new Set(h.split(" "));
  const aTokens = a.split(" ");
  if (aTokens.every((t) => hTokens.has(t))) return 65;
  return 0;
}

export function suggestMapping(sheet: ParsedSheet, schema: DatasetSchema): MappingSuggestion {
  const scanLimit = Math.min(10, sheet.rows.length);
  let best: { rowIndex: number; mapping: ColumnMapping; score: number } = {
    rowIndex: -1,
    mapping: {},
    score: 0,
  };

  const candidateRows: string[][] = [sheet.headers, ...sheet.rows.slice(0, scanLimit)];
  for (let rowIndex = 0; rowIndex < candidateRows.length; rowIndex += 1) {
    const row = candidateRows[rowIndex];
    if (!row || row.filter((c) => String(c ?? "").trim()).length < 2) continue;
    const mapping: ColumnMapping = {};
    const used = new Set<number>();
    let score = 0;
    for (const field of schema.fields) {
      let bestColumn = -1;
      let bestScore = 0;
      row.forEach((cell, columnIndex) => {
        if (used.has(columnIndex)) return;
        const s = Math.max(0, ...field.aliases.map((alias) => matchScore(cell, alias)));
        if (s > bestScore) {
          bestScore = s;
          bestColumn = columnIndex;
        }
      });
      if (bestColumn >= 0 && bestScore >= 60) {
        mapping[field.key] = bestColumn;
        used.add(bestColumn);
        score += bestScore + (field.required ? 20 : 0);
      } else {
        mapping[field.key] = null;
      }
    }
    if (score > best.score) best = { rowIndex, mapping, score };
  }

  const matched = schema.fields.filter((f) => best.mapping[f.key] !== null).map((f) => f.label);
  const unmatched = schema.fields.filter((f) => best.mapping[f.key] === null).map((f) => f.label);
  const requiredMissing = schema.fields
    .filter((f) => f.required && best.mapping[f.key] === null)
    .map((f) => f.label);
  const maxScore = schema.fields.reduce((s, f) => s + 120 + (f.required ? 20 : 0), 0);
  const confidence = maxScore > 0 ? Math.min(100, Math.round((best.score / maxScore) * 100)) : 0;

  return {
    mapping: best.mapping,
    confidence,
    matched,
    unmatched,
    requiredMissing,
    headerRowIndex: best.rowIndex === 0 ? -1 : best.rowIndex - 1,
  };
}

export function headersFromRow(row: string[]): string[] {
  return row.map((cell, index) => String(cell ?? "").trim() || `عمود ${index + 1}`);
}

/** يبحث عن أول صف يحتمل أن يكون رأس جدول (يحتوي على خلايا نصية غير رقمية). */
export function detectHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i += 1) {
    const row = rows[i];
    if (!row) continue;
    const filled = row.filter((c) => String(c ?? "").trim().length > 0);
    if (filled.length < 2) continue;
    const numeric = filled.filter((c) => /^-?[\d.,\s]+$/.test(String(c).trim())).length;
    if (numeric / filled.length < 0.3) return i;
  }
  return 0;
}
