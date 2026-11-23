/**
 * RAKAZ AI — Service Worker
 *
 * قواعد ثابتة:
 * 1) لا يُخزَّن أي HTML لأي صفحة محمية، ولا أي استجابة تحمل Set-Cookie.
 * 2) التخزين المؤقت للأصول الثابتة فقط (JS/CSS/خطوط/أيقونات) + صفحة عدم الاتصال.
 * 3) طلبات API وSupabase لا تُعترض أبداً.
 * 4) التحديث لا يُفعَّل تلقائياً: ينتظر أمر SKIP_WAITING من الواجهة.
 *
 * نسخة سياسة مطابقة في src/lib/pwa/cache-policy.ts، ويقارنها اختبار الوحدة.
 */
const CACHE_VERSION = "rakaz-v1.1.0";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_CACHE = `${CACHE_VERSION}-offline`;
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/manifest.webmanifest",
];

const SENSITIVE_PREFIXES = [
  "/dashboard",
  "/companies",
  "/upload",
  "/imports",
  "/accounts",
  "/trial-balance",
  "/ledger",
  "/journal",
  "/statements",
  "/analysis",
  "/findings",
  "/anomalies",
  "/duplicates",
  "/reports",
  "/assistant",
  "/settings",
  "/users",
  "/approvals",
  "/periods",
];

const STATIC_PREFIXES = ["/_next/static/", "/icons/"];
const STATIC_EXACT = ["/manifest.webmanifest", "/icon.png", "/apple-icon.png", "/favicon.ico"];
const STATIC_EXTENSIONS = [".js", ".css", ".woff2", ".woff", ".png", ".svg", ".webp", ".ico"];

function isSensitivePath(pathname) {
  return SENSITIVE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isCacheableStaticAsset(pathname) {
  if (STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  if (STATIC_EXACT.includes(pathname)) return true;
  return STATIC_EXTENSIONS.some((extension) => pathname.endsWith(extension));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(OFFLINE_CACHE);
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          fetch(new Request(url, { cache: "reload" }))
            .then((response) => (response.ok ? cache.put(url, response) : undefined))
            .catch(() => undefined),
        ),
      );
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== STATIC_CACHE && key !== OFFLINE_CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (data.type === "PURGE") {
    // عند تسجيل الخروج: لا نُبقي أي استجابة قابلة للاسترجاع، ثم نعيد تجهيز صفحة عدم الاتصال.
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
        const cache = await caches.open(OFFLINE_CACHE);
        await Promise.all(
          PRECACHE_URLS.map((url) =>
            fetch(new Request(url, { cache: "reload" }))
              .then((response) => (response.ok ? cache.put(url, response) : undefined))
              .catch(() => undefined),
          ),
        );
      })(),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const offline = await caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE });
          return offline || new Response("offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
        }
      })(),
    );
    return;
  }

  if (isSensitivePath(url.pathname)) return;
  if (!isCacheableStaticAsset(url.pathname)) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request, { cacheName: STATIC_CACHE });
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.status === 200 && response.type === "basic" && !response.headers.get("set-cookie")) {
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, response.clone());
      }
      return response;
    })(),
  );
});
