import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import proxy from "@/proxy";

function makeRequest(path: string, cookies: string[] = []) {
  const headers = new Headers();
  if (cookies.length) headers.set("cookie", cookies.join("; "));
  return new NextRequest(new URL(`https://app.test${path}`), { headers });
}

const SUPABASE_COOKIE = "sb-asoihsutloeqktjhqrtl-auth-token=abc";
const DEMO_COOKIE = "rakaz_session=demo-user";

afterEach(() => vi.unstubAllEnvs());

describe("proxy — إعادة التوجيه والجلسات", () => {
  it("يحوّل الزائر غير المسجّل من صفحة محمية إلى الدخول مع next", () => {
    vi.stubEnv("RAKAZ_DATA_MODE", "supabase");
    const res = proxy(makeRequest("/dashboard"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/dashboard");
  });

  it("يقبل جلسة Supabase ويمرّرها", () => {
    vi.stubEnv("RAKAZ_DATA_MODE", "supabase");
    const res = proxy(makeRequest("/dashboard", [SUPABASE_COOKIE]));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("يتجاهل كوكي وضع العرض بعد التحول إلى supabase", () => {
    vi.stubEnv("RAKAZ_DATA_MODE", "supabase");
    const res = proxy(makeRequest("/dashboard", [DEMO_COOKIE]));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("يمسح كوكي وضع العرض القديم من الاستجابة", () => {
    vi.stubEnv("RAKAZ_DATA_MODE", "supabase");
    const res = proxy(makeRequest("/login", [DEMO_COOKIE]));
    expect(res.headers.get("set-cookie")).toContain("rakaz_session=");
    expect(res.headers.get("set-cookie")).toContain("Expires=Thu, 01 Jan 1970");
  });

  it("يحترم كوكي وضع العرض في وضع demo", () => {
    vi.stubEnv("RAKAZ_DATA_MODE", "demo");
    const res = proxy(makeRequest("/dashboard", [DEMO_COOKIE]));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("يعيد المسجّل من صفحة الدخول إلى لوحة التحكم", () => {
    vi.stubEnv("RAKAZ_DATA_MODE", "supabase");
    const res = proxy(makeRequest("/login", [SUPABASE_COOKIE]));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  it("لا يعيد التوجيه عند وجود next حتى لا تنشأ حلقة لا نهائية", () => {
    vi.stubEnv("RAKAZ_DATA_MODE", "supabase");
    const res = proxy(makeRequest("/login?next=/dashboard", [SUPABASE_COOKIE]));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
