import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OFFLINE_FALLBACK, SENSITIVE_PREFIXES, isCacheableStaticAsset, isSensitivePath, strategyFor } from "@/lib/pwa/cache-policy";
import { CACHE_VERSION } from "@/lib/pwa/version";

const swSource = readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");

function parseStringArray(name: string): string[] {
  const match = swSource.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  if (!match) throw new Error(`لم يُعثر على ${name} داخل sw.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

describe("سياسة التخزين المؤقت", () => {
  it("تعتبر كل صفحات البيانات المالية حساسة", () => {
    for (const page of [
      "/statements",
      "/trial-balance",
      "/ledger",
      "/journal",
      "/reports",
      "/analysis",
      "/dashboard",
      "/companies",
      "/accounts",
      "/findings",
      "/duplicates",
      "/anomalies",
      "/assistant",
      "/upload",
      "/imports",
      "/settings",
      "/users",
      "/approvals",
      "/periods",
    ]) {
      expect(isSensitivePath(page)).toBe(true);
      expect(isSensitivePath(`${page}/detail/123`)).toBe(true);
    }
  });

  it("لا تعتبر الصفحات العامة حساسة", () => {
    expect(isSensitivePath("/")).toBe(false);
    expect(isSensitivePath("/login")).toBe(false);
    expect(isSensitivePath("/register")).toBe(false);
    expect(isSensitivePath("/offline")).toBe(false);
  });

  it("تسمح بتخزين الأصول الثابتة فقط", () => {
    expect(isCacheableStaticAsset("/_next/static/chunks/main.js")).toBe(true);
    expect(isCacheableStaticAsset("/icons/icon-192.png")).toBe(true);
    expect(isCacheableStaticAsset("/manifest.webmanifest")).toBe(true);
    expect(isCacheableStaticAsset("/statements")).toBe(false);
    expect(isCacheableStaticAsset("/api/reports")).toBe(false);
  });

  it("تعطي كل طلب استراتيجية واضحة", () => {
    expect(strategyFor({ method: "GET", pathname: "/statements", mode: "navigate" })).toBe("navigation-network-only");
    expect(strategyFor({ method: "GET", pathname: "/dashboard", mode: "cors" })).toBe("network-only");
    expect(strategyFor({ method: "GET", pathname: "/api/reports", mode: "cors" })).toBe("network-only");
    expect(strategyFor({ method: "POST", pathname: "/_next/static/chunk.js", mode: "cors" })).toBe("network-only");
    expect(strategyFor({ method: "GET", pathname: "/_next/static/chunk.js", mode: "no-cors" })).toBe("static-cache");
  });
});

describe("تطابق public/sw.js مع سياسة TypeScript", () => {
  it("قائمة الصفحات الحساسة متطابقة", () => {
    expect(parseStringArray("SENSITIVE_PREFIXES")).toEqual([...SENSITIVE_PREFIXES]);
  });

  it("إصدار الكاش متطابق مع APP_VERSION", () => {
    const match = swSource.match(/const CACHE_VERSION = "([^"]+)"/);
    expect(match?.[1]).toBe(CACHE_VERSION);
  });

  it("صفحة عدم الاتصال متطابقة ومُخزّنة مسبقاً", () => {
    expect(swSource).toContain(`const OFFLINE_URL = "${OFFLINE_FALLBACK}"`);
    const precacheBlock = swSource.match(/const PRECACHE_URLS = \[([\s\S]*?)\];/)?.[1] ?? "";
    expect(precacheBlock).toContain("OFFLINE_URL");
    expect(parseStringArray("PRECACHE_URLS")).toContain("/icons/icon-192.png");
  });

  it("لا يتضمن Service Worker أي تخزين لطلبات API أو جلسات", () => {
    expect(swSource).toContain('url.pathname.startsWith("/api/")');
    expect(swSource).toContain('response.headers.get("set-cookie")');
    expect(swSource).toContain('request.mode === "navigate"');
  });
});
