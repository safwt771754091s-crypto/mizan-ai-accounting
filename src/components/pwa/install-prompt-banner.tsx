"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { useInstallPrompt } from "./use-install-prompt";

export function InstallPromptBanner() {
  const { showBanner, install, dismiss, markShown } = useInstallPrompt();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (showBanner) markShown();
  }, [showBanner, markShown]);

  useEffect(() => {
    if (!showBanner) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showBanner, dismiss]);

  if (!showBanner) return null;

  const handleInstall = async () => {
    setBusy(true);
    const outcome = await install();
    setBusy(false);
    if (outcome === "accepted") {
      // لا ندّعي نجاح التثبيت: نُخبر المستخدم بإكمال الخطوات، والحدث appinstalled هو المصدر الموثوق.
      toast.info("تم بدء التثبيت — أكمل الخطوات من نافذة المتصفح.");
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3 sm:px-4 sm:pb-4">
      <section
        role="dialog"
        aria-labelledby="rakaz-install-title"
        aria-describedby="rakaz-install-body"
        className="pointer-events-auto w-full max-w-md rounded-2xl border border-line bg-white p-4 shadow-xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-900 text-white">
            <Smartphone className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="rakaz-install-title" className="text-sm font-bold text-brand-950">
              ثبّت ركاز على هاتفك
            </h2>
            <p id="rakaz-install-body" className="mt-1 text-xs leading-6 text-muted">
              احصل على وصول سريع إلى ركاز، وتابع أعمالك المالية من شاشة هاتفك.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="إغلاق دعوة التثبيت"
            className="rounded-lg p-1.5 text-muted transition hover:bg-surface hover:text-brand-950"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleInstall}
            disabled={busy}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-800 disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" />
            {busy ? "جارٍ الفتح…" : "تثبيت التطبيق"}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-muted transition hover:bg-surface"
          >
            ليس الآن
          </button>
        </div>
      </section>
    </div>
  );
}
