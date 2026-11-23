import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

process.env.RAKAZ_DATA_DIR = mkdtempSync(path.join(tmpdir(), "rakaz-proposals-"));
process.env.RAKAZ_DATA_MODE = "demo";

let repo: import("@/lib/data/repository").Repository;
let rules: typeof import("@/lib/proposals/rules");
let issues: typeof import("@/lib/integrations/github-issues");
let createProposalIssue: typeof import("@/lib/integrations/github-issues").createProposalIssue;

const OWNER = "user-demo";
const OUTSIDER = "user-viewer";
const COMPANY = "co-ufuq";
const OTHER_COMPANY = "co-nakheel";

function input(title = "تصدير قائمة الدخل إلى PDF") {
  return {
    title,
    body: "نحتاج تصدير قائمة الدخل بصيغة PDF جاهزة للتوقيع والإرسال إلى البنك.",
    category: "report" as const,
    priority: "high" as const,
  };
}

beforeAll(async () => {
  const repository = await import("@/lib/data/repository");
  repo = repository.getRepository();
  rules = await import("@/lib/proposals/rules");
  issues = await import("@/lib/integrations/github-issues");
  createProposalIssue = issues.createProposalIssue;
});

describe("مقترحات التطوير — التخزين والعزل", () => {
  it("ينشئ المقترح بحالة «جديد» وبطوابع زمنية", async () => {
    const proposal = await repo.createProposal(COMPANY, OWNER, input());
    expect(proposal.status).toBe("new");
    expect(proposal.companyId).toBe(COMPANY);
    expect(proposal.createdBy).toBe(OWNER);
    expect(proposal.issueNumber).toBeNull();
    expect(proposal.decisionNote).toBeNull();
    expect(new Date(proposal.createdAt).toString()).not.toBe("Invalid Date");
  });

  it("يرفض التقديم من غير أعضاء الشركة", async () => {
    await expect(repo.createProposal(COMPANY, OUTSIDER, input())).rejects.toThrow();
  });

  it("يعزل مقترحات كل شركة", async () => {
    await repo.createProposal(OTHER_COMPANY, OWNER, input("مقترح الشركة الأخرى"));
    const ufuq = await repo.listProposals(COMPANY);
    const nakheel = await repo.listProposals(OTHER_COMPANY);
    expect(ufuq.every((item) => item.companyId === COMPANY)).toBe(true);
    expect(nakheel.every((item) => item.companyId === OTHER_COMPANY)).toBe(true);
    expect(nakheel.some((item) => item.title === "مقترح الشركة الأخرى")).toBe(true);
    expect(ufuq.some((item) => item.title === "مقترح الشركة الأخرى")).toBe(false);
  });

  it("يحدّث الحالة وقرار الفرز ويحفظ رابط الـ Issue", async () => {
    const proposal = await repo.createProposal(COMPANY, OWNER, input("مقترح للفرز"));
    expect((await repo.setProposalStatus(COMPANY, proposal.id, "under_review", OWNER)).ok).toBe(true);
    expect((await repo.setProposalStatus(COMPANY, proposal.id, "accepted", OWNER, "قيمة عالية")).ok).toBe(true);
    expect((await repo.attachProposalIssue(COMPANY, proposal.id, { number: 42, url: "https://github.com/o/r/issues/42" })).ok).toBe(true);

    const stored = (await repo.listProposals(COMPANY)).find((item) => item.id === proposal.id);
    expect(stored?.status).toBe("accepted");
    expect(stored?.decisionNote).toBe("قيمة عالية");
    expect(stored?.issueNumber).toBe(42);
    expect(stored?.issueUrl).toContain("/issues/42");
  });

  it("لا يعدّل مقترحاً من شركة أخرى", async () => {
    const proposal = await repo.createProposal(COMPANY, OWNER, input("مقترح محمي"));
    const result = await repo.setProposalStatus(OTHER_COMPANY, proposal.id, "accepted", OWNER);
    expect(result.ok).toBe(false);
    const untouched = (await repo.listProposals(COMPANY)).find((item) => item.id === proposal.id);
    expect(untouched?.status).toBe("new");
  });
});

describe("مقترحات التطوير — قواعد سير العمل", () => {
  it("يسمح بالانتقالات المعتمدة فقط", () => {
    expect(rules.canTransitionProposal("new", "under_review")).toBe(true);
    expect(rules.canTransitionProposal("new", "accepted")).toBe(true);
    expect(rules.canTransitionProposal("under_review", "accepted")).toBe(true);
    expect(rules.canTransitionProposal("accepted", "shipped")).toBe(true);
    expect(rules.canTransitionProposal("new", "shipped")).toBe(false);
    expect(rules.canTransitionProposal("shipped", "new")).toBe(false);
    expect(rules.canTransitionProposal("rejected", "accepted")).toBe(false);
  });

  it("يعطي سبباً واضحاً لكل انتقال مرفوض", () => {
    expect(rules.transitionProposalError("new", "new")).toContain("بالفعل");
    expect(rules.transitionProposalError("shipped", "accepted")).toContain("منفّذ");
    expect(rules.transitionProposalError("rejected", "accepted")).toContain("مرفوض");
    expect(rules.transitionProposalError("new", "shipped")).toContain("لا يمكن الانتقال");
    expect(rules.transitionProposalError("new", "accepted")).toBeNull();
  });

  it("لا يُرسل إلى GitHub إلا مقترح معتمد وغير مرتبط", () => {
    expect(rules.canDispatchProposal("new", null).ok).toBe(false);
    expect(rules.canDispatchProposal("accepted", null).ok).toBe(true);
    const linked = rules.canDispatchProposal("accepted", 12);
    expect(linked.ok).toBe(false);
    expect(linked.error).toContain("بالفعل");
  });
});

describe("مقترحات التطوير — تكامل GitHub", () => {
  const proposal = {
    id: "prop-test-1",
    companyId: COMPANY,
    title: "تقرير مقارنة الفترات",
    body: "نريد تقريراً يقارن فترة بفترة أخرى.",
    category: "report" as const,
    priority: "medium" as const,
    status: "accepted" as const,
    createdBy: OWNER,
    createdAt: "2026-02-01T09:00:00.000Z",
    updatedAt: "2026-02-01T09:00:00.000Z",
    decisionNote: null,
    issueNumber: null,
    issueUrl: null,
  };

  it("يبني محتوى الـ Issue بالشركة والفئة والأولوية دون أي أسرار", () => {
    const payload = issues.buildProposalIssuePayload({
      proposal,
      companyName: "شركة الأفق",
      authorName: "سارة العتيبي",
    });
    expect(payload.title).toBe("[مقترح] تقرير مقارنة الفترات");
    expect(payload.body).toContain("شركة الأفق");
    expect(payload.body).toContain("تقارير");
    expect(payload.body).toContain("متوسطة");
    expect(payload.body).toContain("سارة العتيبي");
    expect(payload.body).toContain("prop-test-1");
    expect(payload.body).not.toMatch(/ghp_|Bearer|token/i);
  });

  it("لا يدّعي الإرسال عند غياب التوكن", async () => {
    delete process.env.GITHUB_ISSUES_TOKEN;
    expect(issues.isIssueDispatchConfigured()).toBe(false);
    const result = await createProposalIssue({ proposal, companyName: "شركة", authorName: "مستخدم" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("غير مُهيّأ");
  });

  it("يرسل الطلب إلى واجهة GitHub ويعيد رقم المشكلة ورابطها", async () => {
    process.env.GITHUB_ISSUES_TOKEN = "test-token";
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ number: 77, html_url: "https://github.com/o/r/issues/77" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const result = await createProposalIssue({ proposal, companyName: "شركة", authorName: "مستخدم" }, fakeFetch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.number).toBe(77);
      expect(result.url).toContain("/issues/77");
    }
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/repos/");
    expect(calls[0].url).toContain("/issues");
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token");
    expect(String(calls[0].init?.body)).toContain("تقرير مقارنة الفترات");
    delete process.env.GITHUB_ISSUES_TOKEN;
  });

  it("يترجم رفض GitHub إلى رسالة مفهومة دون كشف التوكن", async () => {
    process.env.GITHUB_ISSUES_TOKEN = "test-token";
    const forbidden = (async () => new Response("{}", { status: 403 })) as unknown as typeof fetch;
    const result = await createProposalIssue({ proposal, companyName: "شركة", authorName: "مستخدم" }, forbidden);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("صلاحية");
      expect(result.error).not.toContain("test-token");
    }

    const broken = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const failed = await createProposalIssue({ proposal, companyName: "شركة", authorName: "مستخدم" }, broken);
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.error).toContain("تعذر الاتصال");
    delete process.env.GITHUB_ISSUES_TOKEN;
  });
});
