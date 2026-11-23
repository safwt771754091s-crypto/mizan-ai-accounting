import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

process.env.RAKAZ_DATA_DIR = mkdtempSync(path.join(tmpdir(), "rakaz-controls-"));
process.env.RAKAZ_DATA_MODE = "demo";

let repo: import("@/lib/data/repository").Repository;
let filterEntries: typeof import("@/lib/accounting/engine").filterEntries;
let computeMovements: typeof import("@/lib/accounting/engine").computeMovements;

function batchInput(entryNumber: string) {
  return {
    batch: {
      fileName: "entries.csv",
      fileKind: "csv" as const,
      sizeBytes: 100,
      checksum: `checksum-${entryNumber}`,
      dataset: "journal_entries" as const,
      sheetName: "Sheet1",
      mapping: {},
      rowCount: 1,
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
        date: "2025-02-10",
        description: "قيد رقابة داخلية",
        lines: [
          { accountCode: "1100", debit: 1000, credit: 0 },
          { accountCode: "4010", debit: 0, credit: 1000 },
        ],
      },
    ],
    records: [],
  };
}

beforeAll(async () => {
  const { getRepository } = await import("@/lib/data/repository");
  const engine = await import("@/lib/accounting/engine");
  repo = getRepository();
  filterEntries = engine.filterEntries;
  computeMovements = engine.computeMovements;
});

describe("رقابة الاستيراد ودورة حياة القيد", () => {
  it("الاستيراد بحالة «بانتظار الاعتماد» لا يؤثر على الأرصدة", async () => {
    const company = await repo.createCompany("user-demo", {
      name: "شركة الرقابة أ",
      currency: "SAR",
      fiscalYearStart: "2025-01-01",
      fiscalYearEnd: "2025-12-31",
    });

    const invited = await repo.inviteMember(company.id, "viewer@rakaz.ai", "accountant");
    expect(invited.ok).toBe(true);
    await repo.saveImport(company.id, "user-viewer", batchInput("CTL-001"), "submitted");
    const data = await repo.getCompanyData(company.id);
    const entry = data.entries.find((item) => item.entryNumber === "CTL-001");

    expect(entry?.status).toBe("submitted");
    expect(entry?.submittedBy).toBe("user-viewer");
    expect(entry?.submittedAt).toBeTruthy();

    const posted = filterEntries(data.entries);
    expect(posted).toHaveLength(0);

    const movements = computeMovements({ accounts: data.accounts, entries: data.entries });
    expect(movements.entryCount).toBe(0);
  });

  it("الاستيراد بحالة «مرحّل» يظهر في الأرصدة", async () => {
    const company = await repo.createCompany("user-demo", {
      name: "شركة الرقابة ب",
      currency: "SAR",
      fiscalYearStart: "2025-01-01",
      fiscalYearEnd: "2025-12-31",
    });

    await repo.saveImport(company.id, "user-demo", batchInput("CTL-002"));
    const data = await repo.getCompanyData(company.id);
    const posted = filterEntries(data.entries);

    expect(posted).toHaveLength(1);
    expect(posted[0].status).toBe("posted");
  });

  it("نقل القيد بين الحالات يضبط المنفّذ والوقت ويُسجّل التدقيق", async () => {
    const company = await repo.createCompany("user-demo", {
      name: "شركة الرقابة ج",
      currency: "SAR",
      fiscalYearStart: "2025-01-01",
      fiscalYearEnd: "2025-12-31",
    });
    const invited = await repo.inviteMember(company.id, "viewer@rakaz.ai", "accountant");
    expect(invited.ok).toBe(true);
    await repo.saveImport(company.id, "user-viewer", batchInput("CTL-003"), "submitted");
    const before = await repo.getCompanyData(company.id);
    const entry = before.entries.find((item) => item.entryNumber === "CTL-003")!;

    await repo.updateEntryStatus(company.id, entry.id, { status: "approved", userId: "user-demo" });
    await repo.updateEntryStatus(company.id, entry.id, { status: "posted", userId: "user-demo" });
    await repo.appendAudit(company.id, "user-demo", {
      action: "entry.approve",
      entity: "journal_entry",
      entityId: entry.id,
      fromStatus: "submitted",
      toStatus: "approved",
      meta: { entryNumber: entry.entryNumber },
    });

    const after = await repo.getCompanyData(company.id);
    const updated = after.entries.find((item) => item.id === entry.id)!;
    expect(updated.status).toBe("posted");
    expect(updated.approvedBy).toBe("user-demo");
    expect(updated.postedBy).toBe("user-demo");
    expect(updated.approvedAt).toBeTruthy();
    expect(updated.postedAt).toBeTruthy();

    const audit = await repo.listAudit(company.id);
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("entry.approve");
    expect(audit[0].fromStatus).toBe("submitted");
    expect(audit[0].toStatus).toBe("approved");
  });

  it("سجل التدقيق معزول بين الشركات", async () => {
    const companyA = await repo.createCompany("user-demo", {
      name: "شركة التدقيق أ",
      currency: "SAR",
      fiscalYearStart: "2025-01-01",
      fiscalYearEnd: "2025-12-31",
    });
    const companyB = await repo.createCompany("user-demo", {
      name: "شركة التدقيق ب",
      currency: "SAR",
      fiscalYearStart: "2025-01-01",
      fiscalYearEnd: "2025-12-31",
    });

    await repo.appendAudit(companyA.id, "user-demo", { action: "period.close", entity: "accounting_period" });

    expect(await repo.listAudit(companyA.id)).toHaveLength(1);
    expect(await repo.listAudit(companyB.id)).toHaveLength(0);
  });

  it("إغلاق الفترة يغيّر حالتها، والقيد المرحّل يبقى محسوباً", async () => {
    const company = await repo.createCompany("user-demo", {
      name: "شركة الفترات",
      currency: "SAR",
      fiscalYearStart: "2025-01-01",
      fiscalYearEnd: "2025-12-31",
    });
    await repo.saveImport(company.id, "user-demo", batchInput("CTL-004"));
    const data = await repo.getCompanyData(company.id);
    const period = data.periods[0];
    expect(period).toBeTruthy();

    const result = await repo.setPeriodStatus(company.id, period.id, "closed");
    expect(result.ok).toBe(true);

    const after = await repo.getCompanyData(company.id);
    expect(after.periods.find((item) => item.id === period.id)?.status).toBe("closed");
    expect(filterEntries(after.entries)).toHaveLength(1);
  });
});
