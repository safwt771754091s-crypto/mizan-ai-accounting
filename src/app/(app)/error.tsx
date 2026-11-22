"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[rakaz] خطأ في واجهة التطبيق:", error.message, error.digest ?? "");
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-50 text-danger-600">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-brand-950">تعذّر تحميل هذه الصفحة</h1>
        <p className="mt-2 text-sm leading-7 text-muted">
          حدث خطأ غير متوقع أثناء تجهيز البيانات. بياناتك لم تُحذف. أعد المحاولة، وإذا تكرر الخطأ فأرسل رقم الخطأ
          للدعم.
        </p>
        {error.digest ? (
          <p dir="ltr" className="mt-2 font-mono text-xs text-muted">
            ERROR {error.digest}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-800"
      >
        <RefreshCw className="h-4 w-4" />
        إعادة المحاولة
      </button>
    </div>
  );
}
