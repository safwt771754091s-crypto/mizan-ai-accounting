"use client";

/** يطلب من الـ Service Worker حذف كل الاستجابات المخزّنة (يُستدعى عند الخروج). */
export function purgeServiceWorkerCaches(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    navigator.serviceWorker.controller?.postMessage({ type: "PURGE" });
  } catch {
    /* لا شيء لتنظيفه */
  }
}
