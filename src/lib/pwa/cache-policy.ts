/**
 * سياسة التخزين المؤقت للـ Service Worker.
 *
 * القاعدة الحاكمة: لا يُخزَّن أي HTML محمي ولا أي بيانات مالية أو جلسة.
 * التخزين يقتصر على أصول ثابتة (JS/CSS/خطوط/أيقونات) وصفحة عدم الاتصال.
 * نسخة مطابقة موجودة داخل public/sw.js — يتحقق من التطابق اختبار الوحدة.
 */

export const SENSITIVE_PREFIXES = [
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
] as const;

export const OFFLINE_FALLBACK = "/offline";

const STATIC_PREFIXES = ["/_next/static/", "/icons/"];
const STATIC_EXACT = ["/manifest.webmanifest", "/icon.png", "/apple-icon.png", "/favicon.ico"];
const STATIC_EXTENSIONS = [".js", ".css", ".woff2", ".woff", ".png", ".svg", ".webp", ".ico"];

export function isSensitivePath(pathname: string): boolean {
  return SENSITIVE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isCacheableStaticAsset(pathname: string): boolean {
  if (STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  if (STATIC_EXACT.includes(pathname)) return true;
  return STATIC_EXTENSIONS.some((extension) => pathname.endsWith(extension));
}

export type RequestStrategy = "static-cache" | "network-only" | "navigation-network-only";

export function strategyFor(request: { method: string; pathname: string; mode: string }): RequestStrategy {
  if (request.method !== "GET") return "network-only";
  if (request.mode === "navigate") return "navigation-network-only";
  if (request.pathname.startsWith("/api/")) return "network-only";
  if (isSensitivePath(request.pathname)) return "network-only";
  if (isCacheableStaticAsset(request.pathname)) return "static-cache";
  return "network-only";
}
