import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

process.env.RAKAZ_DATA_DIR = mkdtempSync(path.join(tmpdir(), "rakaz-iso-"));
process.env.RAKAZ_DATA_MODE = "demo";

let repo: import("@/lib/data/repository").Repository;

beforeAll(async () => {
  const { getRepository } = await import("@/lib/data/repository");
  repo = getRepository();
});

function batchInput(entryNumber: string) {
  return {
    batch: {
      fileName: `${entryNumber}.csv`,
      fileKind: "csv" as const,
      sizeBytes: 120,
      checksum: `checksum-${entryNumber}`,
      dataset: "journal_entries" as const,
      sheetName: "Sheet1",
      mapping: {},
      rowCount: 2,
      importedCount: 1,
      skippedCount: 0,
      errorCount: 0,
      warningCount: 0,
      status: "completed" as const,
      issues: [],
      warnings: [],
    },
    accounts: [],
    entries: [
      {
        entryNumber,
        date: "2025-02-01",
        description: "قيد عزل البيانات",
        lines: [
          { accountCode: "1100", debit: 500, credit: 0 },
          { accountCode: "4010", debit: 0, credit: 500 },
        ],
      },
    ],
    records: [],
  };
}

describe("عزل البيانات المحاسبية بين الشركات", () => {
  it("يحفظ القيود في الشركة المحددة فقط", async () => {
    const companyA = await repo.createCompany("user-demo", {
      name: "شركة العزل أ",
      currency: "SAR",
      fiscalYearStart: "2025-01-01",
      fiscalYearEnd: "2025-12-31",
    });
    const companyB = await repo.createCompany("user-demo", {
      name: "شركة العزل ب",
      currency: "SAR",
      fiscalYearStart: "2025-01-01",
      fiscalYearEnd: "2025-12-31",
    });

    await repo.saveImport(companyA.id, "user-demo", batchInput("ISO-001"));

    const dataA = await repo.getCompanyData(companyA.id);
    const dataB = await repo.getCompanyData(companyB.id);

    expect(dataA.entries.some((entry) => entry.entryNumber === "ISO-001")).toBe(true);
    expect(dataB.entries.some((entry) => entry.entryNumber === "ISO-001")).toBe(false);
    expect(dataA.entries.every((entry) => entry.companyId === companyA.id)).toBe(true);
  });

  it("يمنع حفظ الاستيراد لمستخدم غير عضو في الشركة", async () => {
    const company = await repo.createCompany("user-demo", {
      name: "شركة العزل ج",
      currency: "SAR",
      fiscalYearStart: "2025-01-01",
      fiscalYearEnd: "2025-12-31",
    });
    await expect(repo.saveImport(company.id, "user-viewer", batchInput("ISO-002"))).rejects.toThrow();
  });

  it("يورّث عملة الشركة للقيود المستوردة", async () => {
    const company = await repo.createCompany("user-demo", {
      name: "شركة بالدولار",
      currency: "USD",
      fiscalYearStart: "2025-01-01",
      fiscalYearEnd: "2025-12-31",
    });
    await repo.saveImport(company.id, "user-demo", batchInput("ISO-003"));
    const data = await repo.getCompanyData(company.id);
    const entry = data.entries.find((item) => item.entryNumber === "ISO-003");
    expect(entry?.currency).toBe("USD");
  });
});
