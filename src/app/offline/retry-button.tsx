"use client";

export function RetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="rounded-xl bg-brand-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-800"
    >
      إعادة المحاولة
    </button>
  );
}
