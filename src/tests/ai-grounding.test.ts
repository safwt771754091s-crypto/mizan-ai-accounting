import { describe, expect, it } from "vitest";
import { extractNumbers, findUngroundedNumbers } from "@/lib/ai/grounding";

const SOURCE = JSON.stringify({
  netRevenue: 2153149.13,
  netProfit: 45542.11,
  totalAssets: 3456621.94,
  ratios: [{ label: "هامش الربح الإجمالي", value: 44.83 }],
  reasons: ["نسبة الارتفاع عن المتوسط 467%"],
  period: { from: "2025-01-01", to: "2025-12-31" },
});

describe("منع الأرقام غير المستمدة من البيانات", () => {
  it("يقبل الأرقام المنسقة بفواصل الآلاف", () => {
    expect(findUngroundedNumbers("صافي الربح 45,542.11 ر.س وصافي الإيرادات 2,153,149.13", SOURCE)).toEqual([]);
  });

  it("يكشف رقماً مختلقاً", () => {
    expect(findUngroundedNumbers("صافي الربح 78,320.00 ر.س", SOURCE)).toEqual(["78,320.00"]);
  });

  it("يقبل النسبة بعد التقريب لخانة واحدة", () => {
    expect(findUngroundedNumbers("الهامش الإجمالي 44.8%", SOURCE)).toEqual([]);
  });

  it("يكشف نسبة غير موجودة", () => {
    expect(findUngroundedNumbers("الهامش الإجمالي 51.2%", SOURCE)).toEqual(["51.2%"]);
  });

  it("يستثني السنوات والأعداد الصغيرة", () => {
    expect(findUngroundedNumbers("في 2025 وُجدت 3 ملاحظات و2024 قبلها", SOURCE)).toEqual([]);
  });

  it("يتعامل مع الأرقام العربية والفواصل العربية", () => {
    expect(findUngroundedNumbers("صافي الربح ٤٥٬٥٤٢.١١", SOURCE)).toEqual([]);
    expect(findUngroundedNumbers("صافي الربح ٧٨٬٣٢٠.٠٠", SOURCE)).toEqual(["78٬320.00"]);
  });

  it("يستخرج الأرقام والنسب معاً", () => {
    const tokens = extractNumbers("42,000.00 ثم 467% ثم 2.98");
    expect(tokens.map((token) => [token.value, token.isPercent])).toEqual([
      [42000, false],
      [467, true],
      [2.98, false],
    ]);
  });
});
