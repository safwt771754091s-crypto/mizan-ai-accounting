"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  PROPOSAL_CATEGORY_LABELS,
  PROPOSAL_PRIORITY_LABELS,
} from "@/lib/proposals/rules";
import type { ProposalFormState } from "@/app/actions/proposals";

type ProposalAction = (state: ProposalFormState, formData: FormData) => Promise<ProposalFormState>;

const fieldClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function ProposalCreateForm({
  action,
  companyId,
}: {
  action: ProposalAction;
  companyId: string;
}) {
  const [state, formAction, pending] = useActionState<ProposalFormState, FormData>(action, {});

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="companyId" value={companyId} />
      <label className="md:col-span-2">
        <span className="mb-1 block text-xs text-muted-foreground">عنوان المقترح</span>
        <input name="title" required maxLength={140} className={fieldClass} placeholder="مثال: تصدير قائمة الدخل إلى PDF" />
        {state.errors?.title ? <span className="text-xs text-destructive">{state.errors.title}</span> : null}
      </label>
      <label>
        <span className="mb-1 block text-xs text-muted-foreground">الفئة</span>
        <select name="category" className={fieldClass} defaultValue="workflow">
          {Object.entries(PROPOSAL_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="mb-1 block text-xs text-muted-foreground">الأولوية</span>
        <select name="priority" className={fieldClass} defaultValue="medium">
          {Object.entries(PROPOSAL_PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <label className="md:col-span-2">
        <span className="mb-1 block text-xs text-muted-foreground">الوصف والأثر المتوقع</span>
        <textarea name="body" required rows={4} maxLength={4000} className={fieldClass} placeholder="اشرح المشكلة، الحل المقترح، والأثر على العمل" />
        {state.errors?.body ? <span className="text-xs text-destructive">{state.errors.body}</span> : null}
      </label>
      <div className="md:col-span-2 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "جارٍ الحفظ..." : "تقديم المقترح"}</Button>
        {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
        {state.message ? <span className="text-xs text-emerald-700">{state.message}</span> : null}
      </div>
    </form>
  );
}

export function ProposalActionForm({
  action,
  fields,
  label,
  variant = "outline",
  withNote,
  notePlaceholder = "سبب القرار",
  noteRequired,
}: {
  action: ProposalAction;
  fields: Record<string, string>;
  label: string;
  variant?: "default" | "outline" | "danger" | "secondary" | "ghost" | "teal";
  withNote?: boolean;
  notePlaceholder?: string;
  noteRequired?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ProposalFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {withNote ? (
        <input name="note" required={noteRequired} placeholder={notePlaceholder} className="h-8 w-44 rounded-md border border-input bg-background px-2 text-xs" />
      ) : null}
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {pending ? "جارٍ..." : label}
      </Button>
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
      {state.message ? <span className="text-xs text-emerald-700">{state.message}</span> : null}
    </form>
  );
}
