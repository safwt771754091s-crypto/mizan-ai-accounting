import type { FileKind, ParsedSheet, ParsedWorkbook } from "./types";
import { detectHeaderRow, headersFromRow } from "./detect";

const MAX_ROWS = 5000;
const MAX_COLUMNS = 80;

function decodeText(buffer: Buffer): { text: string; encoding: string } {
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(buffer), encoding: "utf-8" };
  } catch {
    try {
      return { text: new TextDecoder("windows-1256").decode(buffer), encoding: "windows-1256" };
    } catch {
      return { text: buffer.toString("utf8"), encoding: "utf-8-lossy" };
    }
  }
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("result" in record) return cellToString(record.result);
    if ("text" in record) return cellToString(record.text);
    if ("richText" in record && Array.isArray(record.richText)) {
      return record.richText.map((part) => cellToString((part as Record<string, unknown>).text)).join("");
    }
    if ("hyperlink" in record) return cellToString(record.hyperlink);
    return "";
  }
  return String(value).trim();
}

function finalizeSheet(name: string, index: number, matrix: string[][]): ParsedSheet {
  const cleaned = matrix
    .map((row) => row.map((cell) => String(cell ?? "").trim()))
    .filter((row) => row.some((cell) => cell.length > 0));

  const headerRowIndex = detectHeaderRow(cleaned);
  const headerRow = cleaned[headerRowIndex] ?? [];
  const headers = headersFromRow(headerRow);
  const body = cleaned.slice(headerRowIndex + 1);
  const truncated = body.length > MAX_ROWS;
  const rows = body.slice(0, MAX_ROWS);

  return {
    name,
    index,
    headers,
    rows,
    totalRows: body.length,
    truncated,
  };
}

async function parseCsv(buffer: Buffer, fileName: string): Promise<ParsedWorkbook> {
  const Papa = (await import("papaparse")).default;
  const { text, encoding } = decodeText(buffer);
  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: "greedy",
    delimiter: "",
  });
  const warnings: string[] = [];
  if (encoding !== "utf-8") warnings.push(`تم قراءة الملف بترميز ${encoding}. تحقق من صحة الحروف العربية.`);
  const matrix = (parsed.data ?? []).map((row) => (Array.isArray(row) ? row.map((c) => String(c ?? "")) : []));
  const sheet = finalizeSheet("CSV", 0, matrix);
  if (parsed.errors?.length) {
    warnings.push(`تم تجاهل ${parsed.errors.length} مشكلة أثناء قراءة CSV: ${parsed.errors[0]?.message ?? ""}`);
  }
  return {
    fileName,
    kind: "csv",
    sizeBytes: buffer.length,
    sheets: [sheet],
    warnings,
    parser: "papaparse",
  };
}

async function parseXlsx(buffer: Buffer, fileName: string): Promise<ParsedWorkbook> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheets: ParsedSheet[] = [];
  workbook.eachSheet((worksheet, index) => {
    const rowCount = Math.min(worksheet.rowCount, MAX_ROWS + 12);
    const columnCount = Math.min(worksheet.columnCount, MAX_COLUMNS);
    const matrix: string[][] = [];
    for (let r = 1; r <= rowCount; r += 1) {
      const row = worksheet.getRow(r);
      const values: string[] = [];
      for (let c = 1; c <= columnCount; c += 1) {
        values.push(cellToString(row.getCell(c).value));
      }
      matrix.push(values);
    }
    sheets.push(finalizeSheet(worksheet.name, index, matrix));
  });
  const warnings: string[] = [];
  if (!sheets.length) warnings.push("الملف لا يحتوي على أوراق عمل قابلة للقراءة.");
  return {
    fileName,
    kind: "xlsx",
    sizeBytes: buffer.length,
    sheets,
    warnings,
    parser: "exceljs",
  };
}

async function parseLegacyXls(buffer: Buffer, fileName: string): Promise<ParsedWorkbook> {
  const isBinary = buffer.subarray(0, 512).includes(0);
  if (isBinary) {
    throw new Error(
      "صيغة XLS القديمة (BIFF) غير مدعومة للقراءة المباشرة. افتح الملف في Excel واحفظه بصيغة XLSX ثم أعد الرفع.",
    );
  }
  const result = await parseCsv(buffer, fileName);
  return { ...result, kind: "xls", warnings: [...result.warnings, "تمت قراءة الملف كملف نصي/CSV نظراً لعدم كونه XLS ثنائياً."] };
}

async function parsePdf(buffer: Buffer, fileName: string): Promise<ParsedWorkbook> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const warnings: string[] = [];
  const sheets: ParsedSheet[] = [];
  try {
    const tableResult = await parser.getTable();
    (tableResult.pages ?? []).forEach((page, pageIndex) => {
      (page.tables ?? []).forEach((table, tableIndex) => {
        const matrix = table.map((row) => row.map((cell) => String(cell ?? "")));
        if (matrix.length >= 2) {
          sheets.push(finalizeSheet(`صفحة ${pageIndex + 1} - جدول ${tableIndex + 1}`, sheets.length, matrix));
        }
      });
    });
    if (!sheets.length) {
      const textResult = await parser.getText();
      const lines = String(textResult.text ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      const matrix = lines.map((line) => line.split(/\s{2,}|\t|\|/).map((c) => c.trim()).filter(Boolean));
      if (matrix.length) sheets.push(finalizeSheet("نص PDF", 0, matrix));
      warnings.push(
        "لم يتم اكتشاف جداول واضحة في PDF؛ تم استخراج النص وتقسيمه تقديرياً. راجع ربط الأعمدة والبيانات قبل الاستيراد.",
      );
    }
  } finally {
    await parser.destroy();
  }
  if (!sheets.length) {
    warnings.push("تعذر استخراج نص من PDF. قد يكون الملف صوراً ممسوحة ضوئياً ويحتاج إلى OCR.");
  }
  warnings.push("استخراج PDF تقديري وقد يتأثر بتنسيق الملف. البيانات المستوردة تحتاج مراجعة يدوية.");
  return {
    fileName,
    kind: "pdf",
    sizeBytes: buffer.length,
    sheets,
    warnings,
    parser: "pdf-parse",
  };
}

export async function parseWorkbook(params: {
  buffer: Buffer;
  fileName: string;
  kind: FileKind;
}): Promise<ParsedWorkbook> {
  const { buffer, fileName, kind } = params;
  if (buffer.length === 0) throw new Error("الملف فارغ.");
  switch (kind) {
    case "csv":
      return parseCsv(buffer, fileName);
    case "xlsx":
      return parseXlsx(buffer, fileName);
    case "xls":
      return parseLegacyXls(buffer, fileName);
    case "pdf":
      return parsePdf(buffer, fileName);
    default:
      throw new Error("صيغة ملف غير مدعومة.");
  }
}
