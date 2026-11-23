import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, GitPullRequest, Lightbulb, MessageSquarePlus, XCircle } from "lucide-react";
import { loadCompanyContext } from "@/lib/data/context";
import { AccessDenied, NoCompanyState } from "@/components/app/blocks";
import { ProposalActionForm, ProposalCreateForm } from "@/components/app/proposal-forms";
import { createProposalAction, dispatchProposalAction, setProposalStatusAction } from "@/app/actions/proposals";
import {
  PROPOSAL_CATEGORY_LABELS,
  PROPOSAL_PRIORITY_LABELS,
  PROPOSAL_STATUS_LABELS,
} from "@/lib/proposals/rules";
import { isIssueDispatchConfigured } from "@/lib/integrations/github-issues";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState, PageHeader, StatCard } from "@/components/ui/misc";

export const metadata: Metadata = { title: "مركز المقترحات" };

const STATUS_VARIANT = {
  new: "info",
  under_review: "warning",
  accepted: "success",
  rejected: "danger",
  shipped: "neutral",
} as const;

const PRIORITY_VARIANT = {
  low: "neutral",
  medium: "info",
  high: "danger",
} as const;

export default async function ProposalsPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const params = await searchParams;
  const ctx = await loadCompanyContext(params.company);

  if (!ctx.company) {
    return (
      <>
        <PageHeader title="مركز المقترحات" />
        <NoCompanyState />
      </>
    );
  }

  if (!ctx.allows("proposals.view")) {
    return (
      <>
        <PageHeader title="مركز المقترحات" />
        <AccessDenied description="عرض المقترحات يحتاج صلاحية «عرض المقترحات»." />
      </>
    );
  }

  const companyId = ctx.company.id;
  const proposals = await ctx.repo.listProposals(companyId);
  const canCreate = ctx.allows("proposals.create");
  const canTriage = ctx.allows("proposals.triage");
  const dispatchReady = isIssueDispatchConfigured();

  const open = proposals.filter((item) => item.status === "new" || item.status === "under_review").length;
  const accepted = proposals.filter((item) => item.status === "accepted").length;
  const shipped = proposals.filter((item) => item.status === "shipped").length;
  const dispatched = proposals.filter((item) => item.issueNumber !== null).length;

  return (
    <>
      <PageHeader
        title="مركز المقترحات"
        description="أفكار التطوير داخل الشركة: تُقدَّم، تُفرز، وتُحوَّل إلى Issue على GitHub عند الاعتماد."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="مفتوحة" value={open} hint="جديدة أو قيد الدراسة" icon={<Lightbulb className="h-4 w-4" />} />
        <StatCard label="معتمدة" value={accepted} hint="بانتظار التنفيذ" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="منفّذة" value={shipped} icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="مُرسلة إلى GitHub" value={dispatched} icon={<GitPullRequest className="h-4 w-4" />} />
      </div>

      {canCreate ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquarePlus className="h-4 w-4" /> مقترح جديد
            </CardTitle>
            <CardDescription>اشرح المشكلة والحل المقترح والأثر المتوقع على العمل.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProposalCreateForm action={createProposalAction} companyId={companyId} />
          </CardContent>
        </Card>
      ) : null}

      {canTriage && !dispatchReady ? (
        <Alert variant="info" title="الإرسال إلى GitHub غير مُهيّأ">
          الفرز والاعتماد يعملان الآن. لتفعيل إنشاء Issue تلقائياً أضف المتغير
          <code className="mx-1 rounded bg-muted px-1">GITHUB_ISSUES_TOKEN</code>
          على الخادم (توكن بصلاحية Issues: write)، واختيارياً
          <code className="mx-1 rounded bg-muted px-1">GITHUB_ISSUES_REPO</code>
          لتحديد المستودع.
        </Alert>
      ) : null}

      {proposals.length === 0 ? (
        <EmptyState
          title="لا توجد مقترحات بعد"
          description={canCreate ? "ابدأ بتقديم أول مقترح من النموذج أعلاه." : "سيظهر هنا ما يقدّمه أعضاء الشركة."}
        />
      ) : (
        <div className="grid gap-3">
          {proposals.map((proposal) => (
            <Card key={proposal.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-base">{proposal.title}</CardTitle>
                  <CardDescription>
                    {PROPOSAL_CATEGORY_LABELS[proposal.category]} · {proposal.createdAt.slice(0, 10)}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={PRIORITY_VARIANT[proposal.priority]}>
                    {PROPOSAL_PRIORITY_LABELS[proposal.priority]}
                  </Badge>
                  <Badge variant={STATUS_VARIANT[proposal.status]}>{PROPOSAL_STATUS_LABELS[proposal.status]}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="whitespace-pre-line text-sm text-muted-foreground">{proposal.body}</p>
                {proposal.decisionNote ? (
                  <p className="rounded-md bg-muted/60 px-3 py-2 text-xs">قرار الفرز: {proposal.decisionNote}</p>
                ) : null}
                {proposal.issueUrl ? (
                  <p className="text-xs">
                    مرتبط بـ GitHub:
                    <Link href={proposal.issueUrl} target="_blank" rel="noreferrer" className="ms-1 text-primary underline">
                      Issue #{proposal.issueNumber}
                    </Link>
                  </p>
                ) : null}

                {canTriage ? (
                  <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                    {proposal.status === "new" ? (
                      <ProposalActionForm
                        action={setProposalStatusAction}
                        fields={{ companyId, proposalId: proposal.id, status: "under_review" }}
                        label="قيد الدراسة"
                      />
                    ) : null}
                    {proposal.status === "new" || proposal.status === "under_review" ? (
                      <>
                        <ProposalActionForm
                          action={setProposalStatusAction}
                          fields={{ companyId, proposalId: proposal.id, status: "accepted" }}
                          label="اعتماد"
                          variant="teal"
                        />
                        <ProposalActionForm
                          action={setProposalStatusAction}
                          fields={{ companyId, proposalId: proposal.id, status: "rejected" }}
                          label="رفض"
                          variant="danger"
                          withNote
                          noteRequired
                          notePlaceholder="سبب الرفض (مطلوب)"
                        />
                      </>
                    ) : null}
                    {proposal.status === "accepted" ? (
                      <>
                        <ProposalActionForm
                          action={setProposalStatusAction}
                          fields={{ companyId, proposalId: proposal.id, status: "shipped" }}
                          label="تم التنفيذ"
                        />
                        {dispatchReady ? (
                          <ProposalActionForm
                            action={dispatchProposalAction}
                            fields={{ companyId, proposalId: proposal.id }}
                            label={proposal.issueNumber ? "مرتبط بـ GitHub" : "إرسال إلى GitHub"}
                            variant="secondary"
                          />
                        ) : null}
                      </>
                    ) : null}
                    {proposal.status === "rejected" || proposal.status === "shipped" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <XCircle className="h-3 w-3" /> لا إجراءات متاحة في هذه الحالة
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
