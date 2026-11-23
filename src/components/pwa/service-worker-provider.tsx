"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { RefreshCw, WifiOff, X } from "lucide-react";
import { STORAGE_KEYS, readNumber, writeValue } from "@/lib/pwa/storage";

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const RELOAD_GUARD_MS = 10_000;
const RELOAD_GUARD_KEY = "rakaz.sw.lastReloadAt";

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function ServiceWorkerProvider() {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // لا نسجّل في التطوير إلا بطلب صريح، حتى لا يتدخل التخزين في إعادة التحميل السريع.
    if (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_PWA_DEV !== "1") return;

    let registration: ServiceWorkerRegistration | undefined;
    let disposed = false;

    const offerUpdate = (worker: ServiceWorker | null) => {
      if (!worker) return;
      if (readNumber(window.sessionStorage, STORAGE_KEYS.updateSnoozed) === 1) return;
      setWaiting(worker);
    };

    const watch = (reg: ServiceWorkerRegistration) => {
      // لا نعدّه تحديثاً إلا إذا كانت الصفحة محكومة بنسخة سابقة فعلاً.
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
        });
      });
    };

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        if (disposed) return;
        registration = reg;
        watch(reg);
      })
      .catch(() => undefined);

    const check = () => {
      registration?.update().catch(() => undefined);
    };
    const interval = window.setInterval(check, UPDATE_CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waiting) return;
    const lastReload = readNumber(window.sessionStorage, RELOAD_GUARD_KEY) ?? 0;
    // حارس ضد حلقات إعادة التحميل إذا لم يتبدّل المتحكم كما هو متوقع.
    if (Date.now() - lastReload < RELOAD_GUARD_MS) return;
    setUpdating(true);
    writeValue(window.sessionStorage, RELOAD_GUARD_KEY, String(Date.now()));
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
    waiting.postMessage({ type: "SKIP_WAITING" });
  }, [waiting]);

  const snoozeUpdate = () => {
    writeValue(window.sessionStorage, STORAGE_KEYS.updateSnoozed, "1");
    setWaiting(null);
  };

  return (
    <>
      {online ? null : (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-2 bg-danger-600 px-4 py-2 text-center text-[11px] font-semibold text-white"
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          لا يوجد اتصال بالإنترنت حالياً. لا يمكن تنفيذ العمليات المحاسبية حتى يعود الاتصال.
        </div>
      )}

      {waiting ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3">
          <section
            role="status"
            aria-live="polite"
            className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-xl"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-800">
              <RefreshCw className={`h-4 w-4 ${updating ? "motion-safe:animate-spin" : ""}`} />
            </span>
            <p className="min-w-0 flex-1 text-[11px] font-semibold leading-5 text-brand-950">
              يتوفر إصدار جديد من ركاز. حدّث الآن للحصول على آخر التحسينات.
            </p>
            <button
              type="button"
              onClick={applyUpdate}
              disabled={updating}
              className="rounded-xl bg-brand-900 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-brand-800 disabled:opacity-60"
            >
              {updating ? "جارٍ التحديث…" : "تحديث الآن"}
            </button>
            <button
              type="button"
              onClick={snoozeUpdate}
              aria-label="تأجيل التحديث"
              className="rounded-lg p-1 text-muted transition hover:bg-surface"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}
