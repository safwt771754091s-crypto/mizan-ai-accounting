import { describe, expect, it } from "vitest";
import { checkTransition, periodStatusForDate, statusLabel } from "@/lib/accounting/workflow";
import type { AccountingPeriod } from "@/lib/accounting/types";

const CREATOR = "user-accountant";
const APPROVER = "user-owner";

function entry(status: string, overrides: Record<string, unknown> = {}) {
  return {
    status: status as never,
    date: "2025-03-15",
    createdBy: CREATOR,
    submittedBy: status === "submitted" ? CREATOR : null,
    approvedBy: null,
    ...overrides,
  } as Parameters<typeof checkTransition>[0];
}

describe("دورة حياة القيد", () => {
  it("يسمح بإرسال المسودة والمرفوض فقط", () => {
    expect(checkTransition(entry("draft"), "submit", CREATOR).ok).toBe(true);
    expect(checkTransition(entry("rejected"), "submit", CREATOR).ok).toBe(true);
    expect(checkTransition(entry("posted"), "submit", CREATOR).ok).toBe(false);
    expect(checkTransition(entry("approved"), "submit", CREATOR).ok).toBe(false);
  });

  it("لا يعتمد القيد إلا من حالة «بانتظار الاعتماد»", () => {
    expect(checkTransition(entry("submitted"), "approve", APPROVER).ok).toBe(true);
    expect(checkTransition(entry("draft"), "approve", APPROVER).ok).toBe(false);
    expect(checkTransition(entry("posted"), "approve", APPROVER).ok).toBe(false);
  });

  it("فصل المهام: من أنشأ القيد أو أرسله لا يعتمده", () => {
    const created = checkTransition(entry("submitted"), "approve", CREATOR);
    expect(created.ok).toBe(false);
    expect(created.error).toContain("فصل المهام");

    const submittedByOther = entry("submitted", { createdBy: "someone-else", submittedBy: CREATOR });
    expect(checkTransition(submittedByOther, "approve", CREATOR).ok).toBe(false);
    expect(checkTransition(submittedByOther, "approve", APPROVER).ok).toBe(true);
  });

  it("الرفض يحتاج حالة قابلة للرفض ويحترم فصل المهام", () => {
    expect(checkTransition(entry("submitted"), "reject", APPROVER).ok).toBe(true);
    expect(checkTransition(entry("draft"), "reject", APPROVER).ok).toBe(false);
    expect(checkTransition(entry("submitted"), "reject", CREATOR).ok).toBe(false);
  });

  it("الترحيل يحتاج اعتماداً مسبقاً، والترحيل المباشر يحتاج صلاحية منفصلة", () => {
    expect(checkTransition(entry("approved"), "post", APPROVER).ok).toBe(true);
    expect(checkTransition(entry("submitted"), "post", APPROVER).ok).toBe(false);
    expect(checkTransition(entry("draft"), "post", APPROVER).ok).toBe(false);
    expect(checkTransition(entry("draft"), "post_direct", APPROVER).ok).toBe(true);
    expect(checkTransition(entry("submitted"), "post_direct", APPROVER).ok).toBe(true);
  });

  it("الإلغاء من المرحّل فقط", () => {
    expect(checkTransition(entry("posted"), "void", APPROVER).ok).toBe(true);
    expect(checkTransition(entry("approved"), "void", APPROVER).ok).toBe(false);
  });

  it("الفترة المغلقة تمنع الإجراءات المؤثرة على الأرصدة وتسمح بالرفض", () => {
    for (const action of ["submit", "approve", "post", "post_direct", "void"] as const) {
      const status = { submit: "draft", approve: "submitted", post: "approved", post_direct: "draft", void: "posted" }[
        action
      ];
      const result = checkTransition(entry(status), action, APPROVER, "closed");
      expect(result.ok, action).toBe(false);
      expect(result.error).toContain("مغلقة");
    }
    expect(checkTransition(entry("submitted"), "reject", APPROVER, "closed").ok).toBe(true);
  });

  it("الفترة المقفلة تُسمّى مقفلة في الرسالة", () => {
    const result = checkTransition(entry("draft"), "submit", CREATOR, "locked");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("مقفلة");
  });
});

describe("تحديد الفترة المالية للتاريخ", () => {
  const periods: AccountingPeriod[] = [
    { id: "p1", name: "2025-Q1", startDate: "2025-01-01", endDate: "2025-03-31", status: "closed" },
    { id: "p2", name: "2025-Q2", startDate: "2025-04-01", endDate: "2025-06-30", status: "open" },
  ];

  it("يرجع حالة الفترة التي يقع فيها التاريخ", () => {
    expect(periodStatusForDate(periods, "2025-02-14")).toBe("closed");
    expect(periodStatusForDate(periods, "2025-05-01")).toBe("open");
  });

  it("يرجع null خارج أي فترة معرّفة", () => {
    expect(periodStatusForDate(periods, "2024-12-31")).toBeNull();
  });
});

describe("تسميات الحالات", () => {
  it("تغطي كل الحالات بنص عربي", () => {
    const labels = (["draft", "submitted", "approved", "rejected", "posted", "void"] as const).map(statusLabel);
    expect(labels).toEqual(["مسودة", "بانتظار الاعتماد", "معتمد", "مرفوض", "مرحّل", "ملغى"]);
  });
});
