import type { ProposalCategory, ProposalPriority, ProposalStatus } from "@/lib/data/types";

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  new: "جديد",
  under_review: "قيد الدراسة",
  accepted: "معتمد",
  rejected: "مرفوض",
  shipped: "منفّذ",
};

export const PROPOSAL_CATEGORY_LABELS: Record<ProposalCategory, string> = {
  workflow: "سير عمل",
  report: "تقارير",
  import: "استيراد بيانات",
  ux: "واجهة وتجربة",
  other: "أخرى",
};

export const PROPOSAL_PRIORITY_LABELS: Record<ProposalPriority, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
};

/** الانتقالات المسموحة لمسار الفرز. لا حذف ولا رجوع من «منفّذ». */
const ALLOWED_FROM: Record<ProposalStatus, ProposalStatus[]> = {
  new: ["under_review", "accepted", "rejected"],
  under_review: ["accepted", "rejected"],
  accepted: ["shipped"],
  rejected: [],
  shipped: [],
};

export function canTransitionProposal(from: ProposalStatus, to: ProposalStatus): boolean {
  return ALLOWED_FROM[from]?.includes(to) ?? false;
}

export function transitionProposalError(from: ProposalStatus, to: ProposalStatus): string | null {
  if (from === to) return "المقترح في هذه الحالة بالفعل.";
  if (from === "shipped") return "المقترح منفّذ ولا يمكن تغيير حالته.";
  if (from === "rejected") return "المقترح مرفوض؛ لا يمكن نقله إلى حالة أخرى.";
  return canTransitionProposal(from, to) ? null : `لا يمكن الانتقال من «${PROPOSAL_STATUS_LABELS[from]}» إلى «${PROPOSAL_STATUS_LABELS[to]}».`;
}

/** لا يُرسل إلى GitHub إلا مقترح معتمد ولم يُرسل سابقاً. */
export function canDispatchProposal(status: ProposalStatus, issueNumber: number | null): { ok: boolean; error?: string } {
  if (issueNumber) return { ok: false, error: "هذا المقترح مرتبط بـ Issue بالفعل." };
  if (status !== "accepted") return { ok: false, error: "لا يُرسل إلى GitHub إلا مقترح معتمد." };
  return { ok: true };
}
