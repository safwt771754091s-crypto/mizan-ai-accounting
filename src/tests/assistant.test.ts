import { describe, expect, it } from "vitest";
import { buildDemoCompanies, buildDemoData } from "@/lib/data/demo-data";
import { buildAssistantContext } from "@/lib/ai/context";
import { answerLocally, askAssistant } from "@/lib/ai/agent";
import { formatMoney } from "@/lib/accounting/money";
import type { Ledger } from "@/lib/accounting/types";

const companies = buildDemoCompanies();
const data = buildDemoData();
const company = companies[0];
const companyData = data[company.id];
const ledger: Ledger = {
  accounts: companyData.accounts,
  entries: companyData.entries,
  periods: companyData.periods,
  currency: company.currency,
};

const context = buildAssistantContext({
  company,
  data: companyData,
  ledger,
  period: { from: "2025-01-01", to: "2025-12-31" },
});

describe("المساعد المحاسبي — الإجابات المحلية", () => {
  it("يجيب عن صافي الربح برقم فعلي من القيود", () => {
    const answer = answerLocally("ما صافي الربح؟", context);
    expect(answer.mode).toBe("local");
    expect(answer.answer).toContain(formatMoney(context.totals.netProfit, company.currency));
    expect(answer.sources.length).toBeGreaterThan(0);
  });

  it("يجيب عن أكبر المصروفات بقائمة مرتبة", () => {
    const answer = answerLocally("ما أكبر المصروفات؟", context);
    expect(answer.answer).toContain(context.topExpenses[0].name);
    expect(answer.answer).toContain("%");
  });

  it("يعرض القيود المكررة المكتشفة", () => {
    const answer = answerLocally("هل توجد قيود مكررة؟", context);
    expect(answer.answer).toContain(String(context.duplicates.length));
    expect(answer.answer).toContain("لا يتم حذف");
  });

  it("يعرض مؤشرات السيولة مع المعادلة", () => {
    const answer = answerLocally("اعرض مؤشرات السيولة", context);
    expect(answer.answer).toContain("نسبة التداول");
    expect(answer.answer).toContain("الأصول المتداولة");
  });

  it("يقارن شهرين من البيانات الفعلية", () => {
    const answer = answerLocally("قارن الشهر الحالي بالشهر السابق", context);
    expect(answer.answer).toContain("الإيرادات");
    expect(answer.answer).toContain("صافي الربح");
  });

  it("يشرح المركز المالي ويذكر التوازن", () => {
    const answer = answerLocally("اشرح قائمة المركز المالي", context);
    expect(answer.answer).toContain("إجمالي الأصول");
    expect(answer.answer).toContain("حقوق الملكية");
    expect(answer.answer).toContain("متوازنة");
  });

  it("لا يسرّب بيانات شركة أخرى", () => {
    const answer = answerLocally("حلل أداء الشركة", context);
    for (const other of companies.slice(1)) {
      expect(answer.answer).not.toContain(other.name);
    }
  });

  it("يعمل بدون مفتاح AI ولا يدّعي وجوده", async () => {
    const result = await askAssistant("ما صافي الربح؟", context);
    expect(result.mode).toBe("local");
    expect(result.answer).toContain(formatMoney(context.totals.netProfit, company.currency));
  });

  it("يذكر الحسابات التي تحتاج مراجعة", () => {
    const answer = answerLocally("ما الحسابات التي تحتاج إلى مراجعة؟", context);
    expect(answer.answer.length).toBeGreaterThan(20);
    expect(answer.answer).toMatch(/مراجعة|ملاحظات/);
  });
});
