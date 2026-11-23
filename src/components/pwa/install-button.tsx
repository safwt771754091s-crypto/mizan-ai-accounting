"use client";

import { useState } from "react";
import { Download, Share2, X } from "lucide-react";
import { useInstallPrompt } from "./use-install-prompt";

export function InstallAppButton({ variant = "sidebar" }: { variant?: "landing" | "sidebar" }) {
  const { hydrated, installed, standalone, ios, promptAvailable, install } = useInstallPrompt();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // لا نعرض زراً غير فعّال: إما تثبيت آلي متاح، أو إرشادات iOS اليدوية.
  if (!hydrated || installed || standalone) return null;
  if (!promptAvailable && !ios) return null;

  const trigger = async () => {
    if (promptAvailable) {
      setBusy(true);
      await install();
      setBusy(false);
      return;
    }
    setOpen(true);
  };

  const styles =
    variant === "landing"
      ? "inline-flex items-center gap-1.5 rounded-xl border border-teal-400/40 px-3 py-2 text-xs font-bold text-teal-100 transition hover:bg-teal-500/15"
      : "flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-2 py-2 text-[11px] font-semibold text-white/70 transition hover:bg-white/5 hover:text-white";

  return (
    <>
      <button type="button" onClick={trigger} disabled={busy} data-testid="install-app-button" className={styles}>
        {promptAvailable ? <Download className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
        {busy ? "جارٍ الفتح…" : "تثبيت تطبيق ركاز"}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="rakaz-ios-install">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 id="rakaz-ios-install" className="text-sm font-bold text-brand-950">
                إضافة ركاز إلى الشاشة الرئيسية
              </h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="rounded-lg p-1 text-muted hover:bg-surface">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="mt-3 space-y-2 text-xs leading-6 text-muted">
              <li>1. افتح الصفحة في متصفح Safari.</li>
              <li>2. اضغط زر المشاركة <Share2 className="inline h-3.5 w-3.5 align-text-bottom" /> في شريط المتصفح.</li>
              <li>3. اختر «إضافة إلى الشاشة الرئيسية».</li>
              <li>4. اضغط «إضافة» — سيظهر ركاز كتطبيق.</li>
            </ol>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-xl bg-brand-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-800"
            >
              حسناً
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
