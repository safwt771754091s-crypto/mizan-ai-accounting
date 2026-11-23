import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = { title: "لا يوجد اتصال" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-5">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-800">
          <WifiOff className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-brand-950">لا يوجد اتصال بالإنترنت حالياً</h1>
        <p className="mt-2 text-sm leading-7 text-muted">
          لا يمكن تنفيذ العمليات المحاسبية حتى يعود الاتصال. بياناتك المحفوظة لم تتأثر، وستُستأنف العمليات بعد عودة
          الشبكة.
        </p>
        <div className="mt-5">
          <RetryButton />
        </div>
        <p className="mt-4 text-[10px] text-muted">RAKAZ AI — ركاز</p>
      </div>
    </main>
  );
}
