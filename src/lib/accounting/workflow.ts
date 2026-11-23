import type { AccountingPeriod, JournalEntry, JournalEntryStatus } from "./types";

/**
 * قواعد دورة حياة القيد — منطق خالص بلا وصول لقاعدة البيانات، ليكون قابلاً للاختبار مباشرة.
 * الصلاحيات تُفحص خارجياً (assertCompanyPermission)، وهنا تُفحص الحالة وفصل المهام.
 */
export type EntryAction = "submit" | "approve" | "reject" | "post" | "post_direct" | "void";

export interface TransitionResult {
  ok: boolean;
  error?: string;
  nextStatus?: JournalEntryStatus;
}

const ALLOWED_FROM: Record<EntryAction, JournalEntryStatus[]> = {
  submit: ["draft", "rejected"],
  approve: ["submitted"],
  reject: ["submitted", "approved"],
  post: ["approved"],
  post_direct: ["draft", "submitted"],
  void: ["posted"],
};

const ACTION_LABELS: Record<EntryAction, string> = {
  submit: "إرسال القيد",
  approve: "اعتماد القيد",
  reject: "رفض القيد",
  post: "ترحيل القيد",
  post_direct: "الترحيل المباشر",
  void: "إلغاء القيد",
};

const NEXT_STATUS: Record<EntryAction, JournalEntryStatus> = {
  submit: "submitted",
  approve: "approved",
  reject: "rejected",
  post: "posted",
  post_direct: "posted",
  void: "void",
};

/** الإجراءات التي تُغيّر الأرصدة أو تعتمدها لا تُنفّذ في فترة مغلقة. */
const BLOCKED_IN_CLOSED_PERIOD: EntryAction[] = ["submit", "approve", "post", "post_direct", "void"];

export function periodStatusForDate(
  periods: AccountingPeriod[],
  date: string,
): AccountingPeriod["status"] | null {
  const day = date.slice(0, 10);
  const period = periods.find((item) => day >= item.startDate.slice(0, 10) && day <= item.endDate.slice(0, 10));
  return period?.status ?? null;
}

export function checkTransition(
  entry: Pick<JournalEntry, "status" | "createdBy" | "submittedBy" | "approvedBy" | "date">,
  action: EntryAction,
  actorId: string,
  periodStatus: AccountingPeriod["status"] | null = null,
): TransitionResult {
  const label = ACTION_LABELS[action];

  if (!ALLOWED_FROM[action].includes(entry.status)) {
    return {
      ok: false,
      error: `لا يمكن ${label} وهو بحالة «${statusLabel(entry.status)}».`,
    };
  }

  if (periodStatus === "closed" || periodStatus === "locked") {
    if (BLOCKED_IN_CLOSED_PERIOD.includes(action)) {
      return {
        ok: false,
        error: `الفترة المالية ${periodStatus === "locked" ? "مقفلة" : "مغلقة"}؛ لا يمكن ${label} فيها.`,
      };
    }
  }

  // فصل المهام: من يعتمد أو يرفض لا يكون هو من أنشأ القيد أو أرسله.
  if (action === "approve" || action === "reject") {
    if (entry.createdBy && entry.createdBy === actorId) {
      return { ok: false, error: `فصل المهام: لا يمكنك ${label} لقيد أنشأته بنفسك.` };
    }
    if (entry.submittedBy && entry.submittedBy === actorId) {
      return { ok: false, error: `فصل المهام: لا يمكنك ${label} لقيد أرسلته بنفسك.` };
    }
  }

  return { ok: true, nextStatus: NEXT_STATUS[action] };
}

export function statusLabel(status: JournalEntryStatus): string {
  switch (status) {
    case "draft":
      return "مسودة";
    case "submitted":
      return "بانتظار الاعتماد";
    case "approved":
      return "معتمد";
    case "rejected":
      return "مرفوض";
    case "posted":
      return "مرحّل";
    case "void":
      return "ملغى";
  }
}

export function pendingActionFor(status: JournalEntryStatus): EntryAction | null {
  switch (status) {
    case "draft":
      return "submit";
    case "submitted":
      return "approve";
    case "approved":
      return "post";
    default:
      return null;
  }
}
