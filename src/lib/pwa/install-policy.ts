/** سياسة عرض دعوة التثبيت — منطق خالص قابل للاختبار ومستقل عن المتصفح. */

export const INSTALL_POLICY = {
  /** مهلة قبل ظهور الدعوة حتى لا تقطع أول تفاعل للمستخدم. */
  minDelayMs: 8000,
  /** لا تظهر أكثر من مرة واحدة في الجلسة. */
  oncePerSession: true,
  /** بعد الرفض الأول، إخفاء 14 يوماً، ثم 45 يوماً، ثم لا تعرض مجدداً. */
  snoozeAfterDismissMs: [14 * 24 * 60 * 60 * 1000, 45 * 24 * 60 * 60 * 1000],
  maxDismissals: 3,
} as const;

export interface InstallContext {
  installed: boolean;
  standalone: boolean;
  promptAvailable: boolean;
  shownThisSession: boolean;
  /** هل ما زال المستخدم داخل فترة الإخفاء بعد رفض سابق؟ */
  snoozed: boolean;
  dismissCount: number;
}

export function shouldShowInstallBanner(context: InstallContext): boolean {
  if (context.installed || context.standalone) return false;
  if (!context.promptAvailable) return false;
  if (context.dismissCount >= INSTALL_POLICY.maxDismissals) return false;
  if (context.snoozed) return false;
  if (context.shownThisSession && INSTALL_POLICY.oncePerSession) return false;
  return true;
}

/** مدة الإخفاء بعد الرفض؛ null تعني التوقف عن العرض نهائياً. */
export function snoozeAfterDismiss(dismissCountAfter: number): number | null {
  if (dismissCountAfter >= INSTALL_POLICY.maxDismissals) return null;
  return INSTALL_POLICY.snoozeAfterDismissMs[Math.min(dismissCountAfter - 1, INSTALL_POLICY.snoozeAfterDismissMs.length - 1)];
}

/** هل تاريخ الإخفاء المحفوظ ما زال سارياً في اللحظة الحالية؟ */
export function isSnoozed(snoozeUntil: number | null, now: number): boolean {
  return snoozeUntil !== null && now < snoozeUntil;
}
