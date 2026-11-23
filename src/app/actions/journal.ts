"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { assertCompanyPermission } from "@/lib/auth/permissions";
import { getRepository } from "@/lib/data/repository";
import { checkTransition, periodStatusForDate } from "@/lib/accounting/workflow";
import type { EntryAction } from "@/lib/accounting/workflow";
import type { Permission } from "@/lib/auth/permission-catalog";
import type { AccountingPeriod } from "@/lib/accounting/types";

export interface JournalActionState {
  error?: string;
  message?: string;
}

const ACTION_PERMISSION: Record<EntryAction, Permission> = {
  submit: "journal.submit",
  approve: "journal.approve",
  reject: "journal.approve",
  post: "journal.post",
  post_direct: "journal.post",
  void: "journal.reverse",
};

const ACTION_AUDIT: Record<EntryAction, string> = {
  submit: "entry.submit",
  approve: "entry.approve",
  reject: "entry.reject",
  post: "entry.post",
  post_direct: "entry.post_direct",
  void: "entry.void",
};

const REVALIDATE = ["/approvals", "/ledger", "/trial-balance", "/statements", "/dashboard", "/audit"];

async function runTransition(action: EntryAction, formData: FormData): Promise<JournalActionState> {
  const user = await requireUser("/approvals");
  const companyId = String(formData.get("companyId") ?? "");
  const entryId = String(formData.get("entryId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!companyId || !entryId) return { error: "بيانات الطلب غير مكتملة." };
  if (action === "reject" && !note) return { error: "سبب الرفض مطلوب ليكون القرار قابلاً للمراجعة." };

  const repo = getRepository();
  const gate = await assertCompanyPermission(user, companyId, ACTION_PERMISSION[action]);
  if (!gate.ok) return { error: gate.error };

  const data = await repo.getCompanyData(companyId);
  const entry = data.entries.find((item) => item.id === entryId);
  if (!entry) return { error: "القيد غير موجود في هذه الشركة." };

  const periods = data.periods as AccountingPeriod[];
  const decision = checkTransition(entry, action, user.id, periodStatusForDate(periods, entry.date));
  if (!decision.ok) return { error: decision.error };

  const updated = await repo.updateEntryStatus(companyId, entryId, {
    status: decision.nextStatus!,
    userId: user.id,
    note: note || null,
  });
  if (!updated.ok) return { error: updated.error ?? "تعذر تحديث القيد." };

  await repo.appendAudit(companyId, user.id, {
    action: ACTION_AUDIT[action],
    entity: "journal_entry",
    entityId: entryId,
    fromStatus: entry.status,
    toStatus: decision.nextStatus,
    note: note || null,
    meta: { entryNumber: entry.entryNumber, amount: entry.lines.reduce((total, line) => total + Number(line.debit || 0), 0) },
  });

  for (const path of REVALIDATE) revalidatePath(path);
  return { message: "تم تنفيذ الإجراء بنجاح." };
}

export async function submitEntryAction(_prev: JournalActionState, formData: FormData): Promise<JournalActionState> {
  return runTransition("submit", formData);
}

export async function approveEntryAction(_prev: JournalActionState, formData: FormData): Promise<JournalActionState> {
  return runTransition("approve", formData);
}

export async function rejectEntryAction(_prev: JournalActionState, formData: FormData): Promise<JournalActionState> {
  return runTransition("reject", formData);
}

export async function postEntryAction(_prev: JournalActionState, formData: FormData): Promise<JournalActionState> {
  return runTransition("post", formData);
}

export async function postDirectEntryAction(_prev: JournalActionState, formData: FormData): Promise<JournalActionState> {
  return runTransition("post_direct", formData);
}

export async function voidEntryAction(_prev: JournalActionState, formData: FormData): Promise<JournalActionState> {
  return runTransition("void", formData);
}

export async function closePeriodAction(_prev: JournalActionState, formData: FormData): Promise<JournalActionState> {
  const user = await requireUser("/periods");
  const companyId = String(formData.get("companyId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  const repo = getRepository();
  const gate = await assertCompanyPermission(user, companyId, "periods.close");
  if (!gate.ok) return { error: gate.error };

  const data = await repo.getCompanyData(companyId);
  const period = data.periods.find((item) => item.id === periodId);
  if (!period) return { error: "الفترة المالية غير موجودة." };
  if (period.status !== "open") return { error: "الفترة ليست مفتوحة." };

  const blocking = data.entries.filter(
    (entry) =>
      entry.date.slice(0, 10) >= period.startDate.slice(0, 10) &&
      entry.date.slice(0, 10) <= period.endDate.slice(0, 10) &&
      (entry.status === "draft" || entry.status === "submitted" || entry.status === "approved"),
  );
  if (blocking.length > 0) {
    return {
      error: `لا يمكن إغلاق الفترة: يوجد ${blocking.length} قيداً غير مرحّل (مسودة أو بانتظار اعتماد). اعتمدها أو رفضها أولاً.`,
    };
  }

  const result = await repo.setPeriodStatus(companyId, periodId, "closed");
  if (!result.ok) return { error: result.error ?? "تعذر إغلاق الفترة." };

  await repo.appendAudit(companyId, user.id, {
    action: "period.close",
    entity: "accounting_period",
    entityId: periodId,
    fromStatus: period.status,
    toStatus: "closed",
    meta: { name: period.name, start: period.startDate, end: period.endDate },
  });
  for (const path of [...REVALIDATE, "/periods"]) revalidatePath(path);
  return { message: `تم إغلاق الفترة «${period.name}».` };
}

export async function reopenPeriodAction(_prev: JournalActionState, formData: FormData): Promise<JournalActionState> {
  const user = await requireUser("/periods");
  const companyId = String(formData.get("companyId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { error: "سبب إعادة الفتح مطلوب." };

  const repo = getRepository();
  const gate = await assertCompanyPermission(user, companyId, "periods.reopen");
  if (!gate.ok) return { error: gate.error };

  const data = await repo.getCompanyData(companyId);
  const period = data.periods.find((item) => item.id === periodId);
  if (!period) return { error: "الفترة المالية غير موجودة." };
  if (period.status === "locked") return { error: "الفترة مقفلة نهائياً ولا يمكن إعادة فتحها." };
  if (period.status === "open") return { error: "الفترة مفتوحة أصلاً." };

  const result = await repo.setPeriodStatus(companyId, periodId, "open");
  if (!result.ok) return { error: result.error ?? "تعذر إعادة فتح الفترة." };

  await repo.appendAudit(companyId, user.id, {
    action: "period.reopen",
    entity: "accounting_period",
    entityId: periodId,
    fromStatus: period.status,
    toStatus: "open",
    note,
    meta: { name: period.name },
  });
  for (const path of [...REVALIDATE, "/periods"]) revalidatePath(path);
  return { message: `تم إعادة فتح الفترة «${period.name}».` };
}
