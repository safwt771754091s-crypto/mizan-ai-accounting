import type { Proposal } from "@/lib/data/types";
import {
  PROPOSAL_CATEGORY_LABELS,
  PROPOSAL_PRIORITY_LABELS,
} from "@/lib/proposals/rules";

const DEFAULT_REPO = "safwt771754091-crypto/mizan-ai-accounting";

export function issuesRepoSlug(): string {
  return (process.env.GITHUB_ISSUES_REPO?.trim() || DEFAULT_REPO).replace(/^https?:\/\/github\.com\//, "");
}

/**
 * الإرسال إلى GitHub اختياري: بدون توكن على الخادم تبقى الميزة معطّلة برسالة واضحة
 * بدل ادّعاء نجاح أو محاولة اتصال فاشلة.
 */
export function isIssueDispatchConfigured(): boolean {
  return Boolean(process.env.GITHUB_ISSUES_TOKEN?.trim());
}

export interface IssueSource {
  proposal: Proposal;
  companyName: string;
  authorName: string;
}

export interface IssuePayload {
  title: string;
  body: string;
  labels: string[];
}

export function buildProposalIssuePayload({ proposal, companyName, authorName }: IssueSource): IssuePayload {
  const lines = [
    `**الشركة:** ${companyName}`,
    `**الفئة:** ${PROPOSAL_CATEGORY_LABELS[proposal.category]}`,
    `**الأولوية:** ${PROPOSAL_PRIORITY_LABELS[proposal.priority]}`,
    `**مقدّم المقترح:** ${authorName}`,
    `**تاريخ التقديم:** ${proposal.createdAt.slice(0, 10)}`,
    "",
    "---",
    "",
    proposal.body.trim(),
    "",
    "---",
    `_أُنشئ تلقائياً من مركز المقترحات في RAKAZ AI — معرّف المقترح: ${proposal.id}_`,
  ];
  const labels = (process.env.GITHUB_ISSUES_LABELS ?? "")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);

  return {
    title: `[مقترح] ${proposal.title}`.slice(0, 240),
    body: lines.join("\n"),
    labels,
  };
}

export type IssueResult =
  | { ok: true; number: number; url: string }
  | { ok: false; error: string };

function failure(status: number): string {
  if (status === 401 || status === 403) return "توكن GitHub لا يملك صلاحية إنشاء Issue في هذا المستودع.";
  if (status === 404) return "المستودع غير موجود أو التوكن لا يملك وصولاً إليه.";
  if (status === 410) return "المشكلات معطّلة في هذا المستودع.";
  if (status === 422) return "رفض GitHub محتوى الـ Issue (تحقق من العناوين أو التصنيفات).";
  return `رفض GitHub الطلب (رمز ${status}).`;
}

export async function createProposalIssue(
  source: IssueSource,
  fetchImpl: typeof fetch = fetch,
): Promise<IssueResult> {
  const token = process.env.GITHUB_ISSUES_TOKEN?.trim();
  if (!token) return { ok: false, error: "الإرسال إلى GitHub غير مُهيّأ على الخادم." };

  const payload = buildProposalIssuePayload(source);
  try {
    const response = await fetchImpl(`https://api.github.com/repos/${issuesRepoSlug()}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, error: failure(response.status) };
    const data = (await response.json()) as { number?: number; html_url?: string };
    if (!data.number || !data.html_url) return { ok: false, error: "استجابة GitHub غير مكتملة." };
    return { ok: true, number: data.number, url: data.html_url };
  } catch {
    return { ok: false, error: "تعذر الاتصال بـ GitHub. تحقق من الشبكة وحاول مجدداً." };
  }
}
