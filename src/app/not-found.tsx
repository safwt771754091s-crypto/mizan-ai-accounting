import Link from "next/link";
import { Scale } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-800 text-white">
        <Scale className="h-6 w-6" />
      </span>
      <p className="text-3xl font-bold text-brand-950">404</p>
      <h1 className="mt-2 text-lg font-bold text-ink">الصفحة غير موجودة</h1>
      <p className="mt-1 max-w-sm text-xs leading-6 text-muted">
        قد يكون الرابط قديماً أو أن الشركة المطلوبة غير متاحة لحسابك.
      </p>
      <div className="mt-5 flex gap-2">
        <Link href="/dashboard" className="rounded-xl bg-brand-800 px-4 py-2 text-xs font-bold text-white hover:bg-brand-900">
          لوحة التحكم
        </Link>
        <Link href="/" className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-bold text-ink hover:bg-surface">
          الصفحة الرئيسية
        </Link>
      </div>
    </div>
  );
}
