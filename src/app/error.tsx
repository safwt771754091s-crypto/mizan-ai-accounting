"use client";

import { useEffect } from "react";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[rakaz] خطأ في الصفحة الرئيسية:", error.message, error.digest ?? "");
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-bold text-brand-950">تعذّر تحميل الصفحة</h1>
      <p className="text-sm leading-7 text-muted">
        حدث خطأ غير متوقع. أعد المحاولة، وإذا تكرر الخطأ فأغلق المتصفح وافتحه من جديد.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-brand-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-800"
      >
        إعادة المحاولة
      </button>
    </main>
  );
}
