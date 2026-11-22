import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

process.env.MIZAN_DATA_DIR = mkdtempSync(path.join(tmpdir(), "mizan-repo-"));
process.env.MIZAN_DATA_MODE = "demo";

let repo: import("@/lib/data/repository").Repository;

beforeAll(async () => {
  const { getRepository } = await import("@/lib/data/repository");
  repo = getRepository();
});

describe("مستودع البيانات التجريبي", () => {
  it("يعمل في وضع demo", () => {
    expect(repo.mode).toBe("demo");
  });

  it("يعيد شركات المستخدم حسب العضوية فقط", async () => {
    const owner = await repo.listCompanies("user-demo");
    const viewer = await repo.listCompanies("user-viewer");
    const auditor = await repo.listCompanies("user-auditor");
    expect(owner).toHaveLength(3);
    expect(viewer.map((c) => c.id)).toEqual(["co-nakheel"]);
    expect(auditor.map((c) => c.id)).toEqual(["co-nakheel"]);
  });

  it("يمنع الوصول إلى شركة غير مرتبطة بالمستخدم", async () => {
    expect(await repo.getCompanyAccess("user-viewer", "co-ufuq")).toBeNull();
    expect(await repo.getCompanyAccess("user-demo", "co-ufuq")).not.toBeNull();
  });

  it("ينشئ شركة جديدة بدليل حسابات وفترة مالية وعضوية مالك", async () => {
    const company = await repo.createCompany("user-demo", {
      name: "شركة اختبار العزل",
      currency: "SAR",
      fiscalYearStart: "2025-01-01",
      fiscalYearEnd: "2025-12-31",
    });
    const access = await repo.getCompanyAccess("user-demo", company.id);
    expect(access?.role).toBe("owner");
    const data = await repo.getCompanyData(company.id);
    expect(data.accounts.length).toBeGreaterThan(10);
    expect(data.periods).toHaveLength(1);
    const other = await repo.getCompanyAccess("user-viewer", company.id);
    expect(other).toBeNull();
  });

  it("يرفض الاستيراد لدور المشاهد", async () => {
    await expect(
      repo.saveImport("co-nakheel", "user-viewer", {
        batch: {
          fileName: "x.csv",
          fileKind: "csv",
          sizeBytes: 10,
          checksum: "checksum-viewer-test",
          dataset: "expenses",
          sheetName: "CSV",
          mapping: {},
          rowCount: 1,
          importedCount: 0,
          skippedCount: 0,
          errorCount: 0,
          warningCount: 0,
          status: "completed",
          issues: [],
          warnings: [],
        },
        accounts: [],
        entries: [],
        records: [],
      }),
    ).rejects.toThrow(/صلاحية/);
  });

  it("يستورد قيداً ويمنع التكرار بنفس البصمة", async () => {
    const input = {
      batch: {
        fileName: "entries.csv",
        fileKind: "csv" as const,
        sizeBytes: 100,
        checksum: "checksum-import-test-1",
        dataset: "journal_entries" as const,
        sheetName: "CSV",
        mapping: { entryNumber: 0, date: 1, accountCode: 2, debit: 3, credit: 4 },
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
          entryNumber: "TEST-0001",
          date: "2025-05-01",
          description: "قيد اختبار",
          lines: [
            { accountCode: "1010", debit: 1500, credit: 0 },
            { accountCode: "4010", debit: 0, credit: 1500 },
          ],
        },
      ],
      records: [{ rowNumber: 2, values: { entryNumber: "TEST-0001" } }],
    };

    const first = await repo.saveImport("co-nakheel", "user-demo", input);
    expect(first.duplicate).toBe(false);
    const second = await repo.saveImport("co-nakheel", "user-demo", input);
    expect(second.duplicate).toBe(true);

    const data = await repo.getCompanyData("co-nakheel");
    expect(data.entries.filter((entry) => entry.entryNumber === "TEST-0001")).toHaveLength(1);
    expect(data.batches.some((batch) => batch.checksum === "checksum-import-test-1")).toBe(true);
  });

  it("يحدّث حالة الملاحظة ولا يسمح للمشاهد", async () => {
    await repo.setFindingStatus("co-nakheel", "user-demo", "finding-test", "reviewed", "تمت المراجعة");
    let data = await repo.getCompanyData("co-nakheel");
    expect(data.findingStates.find((state) => state.findingId === "finding-test")?.status).toBe("reviewed");

    await expect(repo.setFindingStatus("co-nakheel", "user-viewer", "finding-test", "dismissed")).rejects.toThrow();
    data = await repo.getCompanyData("co-nakheel");
    expect(data.findingStates.find((state) => state.findingId === "finding-test")?.status).toBe("reviewed");
  });

  it("يدير الأعضاء بصلاحيات المالك", async () => {
    const result = await repo.inviteMember("co-ufuq", "viewer@mizan.ai", "viewer");
    expect(result.ok).toBe(true);
    const members = await repo.listMembers("co-ufuq");
    expect(members.some((member) => member.user.email === "viewer@mizan.ai")).toBe(true);

    const again = await repo.inviteMember("co-ufuq", "viewer@mizan.ai", "viewer");
    expect(again.ok).toBe(false);
  });
});
