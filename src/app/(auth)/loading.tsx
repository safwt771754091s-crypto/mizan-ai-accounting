export default function AuthLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="h-3 w-40 rounded bg-line/70" />
      <div className="h-7 w-52 rounded bg-line/70" />
      <div className="h-3 w-64 rounded bg-line/50" />
      <div className="mt-6 space-y-3">
        <div className="h-11 w-full rounded-xl bg-line/40" />
        <div className="h-11 w-full rounded-xl bg-line/40" />
        <div className="h-11 w-full rounded-xl bg-brand-900/20" />
      </div>
    </div>
  );
}
