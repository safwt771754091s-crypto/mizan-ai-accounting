"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AuthError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[rakaz] خطأ في صفحات الدخول:", error.message, error.digest ?? "");
  }, [error]);

  return (
    <div className="rounded-2xl border border-line bg-white p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-50 text-danger-600">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h1 className="mt-4 text-lg font-bold text-brand-950">تعذّر فتح الصفحة</h1>
      <p className="mt-2 text-sm leading-7 text-muted">
        حدث خطأ غير متوقع أثناء تحميل هذه الصفحة. أعد المحاولة، وإذا تكرر الخطأ فأغلق المتصفح وافتحه من جديد.
      </p>
      {error.digest ? (
        <p dir="ltr" className="mt-2 font-mono text-[11px] text-muted">
          ERROR {error.digest}
        </p>
      ) : null}
      <div className="mt-5 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-800"
        >
          <RefreshCw className="h-4 w-4" />
          إعادة المحاولة
        </button>
        <a href="/login" className="text-xs font-semibold text-teal-700 hover:underline">
          العودة إلى صفحة الدخول
        </a>
      </div>
    </div>
  );
}
