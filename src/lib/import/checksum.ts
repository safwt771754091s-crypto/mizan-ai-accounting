import { createHash } from "node:crypto";
import type { FileKind } from "./types";

export function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function detectFileKind(fileName: string): FileKind | null {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "xlsx") return "xlsx";
  if (extension === "xls") return "xls";
  if (extension === "csv") return "csv";
  if (extension === "pdf") return "pdf";
  return null;
}

const MAGIC: Record<FileKind, Array<number[]>> = {
  xlsx: [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06]],
  xls: [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  pdf: [[0x25, 0x50, 0x44, 0x46]],
  csv: [],
};

export function validateFileSignature(buffer: Buffer, kind: FileKind): { ok: boolean; error?: string } {
  if (buffer.length < 4) return { ok: false, error: "الملف صغير جداً أو تالف." };
  if (kind === "csv" || kind === "xls") {
    // ملفات CSV/XLS النصية لا تملك توقيعاً ثابتاً؛ نمنع الملفات التنفيذية المعروفة.
    const head = buffer.subarray(0, 4).toString("hex");
    if (head === "7f454c46" || head.startsWith("4d5a")) {
      return { ok: false, error: "نوع الملف الفعلي غير مسموح." };
    }
    if (kind === "xls") {
      const isOle = MAGIC.xls.some((signature) => signature.every((byte, index) => buffer[index] === byte));
      if (!isOle && buffer.subarray(0, 1024).includes(0)) {
        return { ok: false, error: "ملف XLS تالف أو غير مدعوم. حوّله إلى XLSX." };
      }
    }
    return { ok: true };
  }
  const matches = MAGIC[kind].some((signature) => signature.every((byte, index) => buffer[index] === byte));
  if (!matches) return { ok: false, error: "نوع الملف الفعلي لا يطابق الامتداد. ارفع ملفاً صالحاً." };
  return { ok: true };
}

export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 180) || "file";
}
