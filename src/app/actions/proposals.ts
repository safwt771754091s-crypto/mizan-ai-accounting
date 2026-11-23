"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { assertCompanyPermission } from "@/lib/auth/permissions";
import { getRepository } from "@/lib/data/repository";
import type { ProposalStatus } from "@/lib/data/types";
import { canDispatchProposal, transitionProposalError } from "@/lib/proposals/rules";
import { createProposalIssue, isIssueDispatchConfigured } from "@/lib/integrations/github-issues";

export interface ProposalFormState {
  error?: string;
  message?: string;
  errors?: Record<string, string>;
}

const createSchema = z.object({
  companyId: z.string().min(1),
  title: z.string().trim().min(4, "العنوان قصير جداً").max(140, "العنوان أطول من المسموح"),
  body: z.string().trim().min(20, "اشرح المقترح بما لا يقل عن 20 حرفاً").max(4000),
  category: z.enum(["workflow", "report", "import", "ux", "other"]),
  priority: z.enum(["low", "medium", "high"]),
});

const statusSchema = z.object({
  companyId: z.string().min(1),
  proposalId: z.string().min(1),
  status: z.enum(["under_review", "accepted", "rejected", "shipped"]),
  note: z.string().trim().max(500).optional(),
});

function revalidate() {
  revalidatePath("/proposals");
  revalidatePath("/audit");
}

export async function createProposalAction(
  _prev: ProposalFormState,
  formData: FormData,
): Promise<ProposalFormState> {
  const user = await requireUser("/proposals");
  const parsed = createSchema.safeParse({
    companyId: String(formData.get("companyId") ?? ""),
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    category: String(formData.get("category") ?? "other"),
    priority: String(formData.get("priority") ?? "medium"),
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      errors[key] ??= issue.message;
    }
    return { errors };
  }

  const gate = await assertCompanyPermission(user, parsed.data.companyId, "proposals.create");
  if (!gate.ok) return { error: gate.error };

  try {
    const repo = getRepository();
    const proposal = await repo.createProposal(parsed.data.companyId, user.id, {
      title: parsed.data.title,
      body: parsed.data.body,
      category: parsed.data.category,
      priority: parsed.data.priority,
    });
    await repo.appendAudit(parsed.data.companyId, user.id, {
      action: "proposal.create",
      entity: "proposal",
      entityId: proposal.id,
      toStatus: "new",
      meta: { title: proposal.title, priority: proposal.priority },
    });
    revalidate();
    return { message: "تم حفظ المقترح وإضافته إلى قائمة الفرز." };
  } catch {
    return { error: "تعذر حفظ المقترح. تحقق من البيانات وحاول مرة أخرى." };
  }
}

export async function setProposalStatusAction(
  _prev: ProposalFormState,
  formData: FormData,
): Promise<ProposalFormState> {
  const user = await requireUser("/proposals");
  const parsed = statusSchema.safeParse({
    companyId: String(formData.get("companyId") ?? ""),
    proposalId: String(formData.get("proposalId") ?? ""),
    status: String(formData.get("status") ?? ""),
    note: String(formData.get("note") ?? "").trim() || undefined,
  });
  if (!parsed.success) return { error: "بيانات الطلب غير مكتملة." };

  const gate = await assertCompanyPermission(user, parsed.data.companyId, "proposals.triage");
  if (!gate.ok) return { error: gate.error };

  const repo = getRepository();
  const proposals = await repo.listProposals(parsed.data.companyId);
  const proposal = proposals.find((item) => item.id === parsed.data.proposalId);
  if (!proposal) return { error: "المقترح غير موجود في هذه الشركة." };

  const transitionError = transitionProposalError(proposal.status, parsed.data.status);
  if (transitionError) return { error: transitionError };
  if (parsed.data.status === "rejected" && !parsed.data.note) {
    return { error: "سبب الرفض مطلوب ليكون القرار قابلاً للمراجعة." };
  }

  const result = await repo.setProposalStatus(
    parsed.data.companyId,
    proposal.id,
    parsed.data.status,
    user.id,
    parsed.data.note ?? null,
  );
  if (!result.ok) return { error: result.error };

  await repo.appendAudit(parsed.data.companyId, user.id, {
    action: "proposal.status",
    entity: "proposal",
    entityId: proposal.id,
    fromStatus: proposal.status,
    toStatus: parsed.data.status,
    note: parsed.data.note ?? null,
    meta: { title: proposal.title },
  });
  revalidate();
  return { message: "تم تحديث حالة المقترح." };
}

export async function dispatchProposalAction(
  _prev: ProposalFormState,
  formData: FormData,
): Promise<ProposalFormState> {
  const user = await requireUser("/proposals");
  const companyId = String(formData.get("companyId") ?? "");
  const proposalId = String(formData.get("proposalId") ?? "");
  if (!companyId || !proposalId) return { error: "بيانات الطلب غير مكتملة." };

  const gate = await assertCompanyPermission(user, companyId, "proposals.triage");
  if (!gate.ok) return { error: gate.error };
  if (!isIssueDispatchConfigured()) {
    return {
      error:
        "الإرسال إلى GitHub معطّل: أضف GITHUB_ISSUES_TOKEN على الخادم (متغير بيئة) ثم أعد المحاولة.",
    };
  }

  const repo = getRepository();
  const proposals = await repo.listProposals(companyId);
  const proposal = proposals.find((item) => item.id === proposalId);
  if (!proposal) return { error: "المقترح غير موجود في هذه الشركة." };

  const allowed = canDispatchProposal(proposal.status, proposal.issueNumber);
  if (!allowed.ok) return { error: allowed.error };

  const access = await repo.getCompanyAccess(user.id, companyId);
  const members = await repo.listMembers(companyId);
  const authorName = members.find((member) => member.user.id === proposal.createdBy)?.user.fullName ?? "عضو الشركة";

  const issue = await createProposalIssue({
    proposal,
    companyName: access?.company.name ?? "شركة",
    authorName,
  });
  if (!issue.ok) return { error: issue.error };

  const attached = await repo.attachProposalIssue(companyId, proposal.id, {
    number: issue.number,
    url: issue.url,
  });
  if (!attached.ok) {
    return {
      error: `أُنشئت المشكلة #${issue.number} على GitHub لكن تعذر ربطها بالمقترح. أضف الرابط يدوياً: ${issue.url}`,
    };
  }

  await repo.appendAudit(companyId, user.id, {
    action: "proposal.dispatch",
    entity: "proposal",
    entityId: proposal.id,
    note: issue.url,
    meta: { title: proposal.title, issue: issue.number },
  });
  revalidate();
  return { message: `أُنشئت المشكلة #${issue.number} على GitHub.` };
}

export type ProposalStatusAction = Extract<ProposalStatus, "under_review" | "accepted" | "rejected" | "shipped">;
