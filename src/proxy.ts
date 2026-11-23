import { NextResponse, type NextRequest } from "next/server";
import { dataMode } from "@/lib/supabase/config";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/companies",
  "/upload",
  "/imports",
  "/accounts",
  "/trial-balance",
  "/ledger",
  "/statements",
  "/analysis",
  "/findings",
  "/anomalies",
  "/duplicates",
  "/reports",
  "/assistant",
  "/settings",
  "/users",
];

const AUTH_PAGES = ["/login", "/register"];

function hasSession(request: NextRequest): boolean {
  const hasSupabaseToken = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));
  if (hasSupabaseToken) return true;
  // كوكي وضع العرض لا يمثّل جلسة Supabase؛ إبقاؤه صالحاً بعد التحول إلى supabase
  // يجعل /login و/dashboard يعيدان توجيه بعضهما بلا نهاية.
  return dataMode() === "demo" && request.cookies.has("rakaz_session");
}

function cleanup(response: NextResponse, request: NextRequest): NextResponse {
  if (dataMode() === "supabase" && request.cookies.has("rakaz_session")) {
    response.cookies.delete("rakaz_session");
  }
  return response;
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = hasSession(request);

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (isProtected && !authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return cleanup(NextResponse.redirect(url), request);
  }

  // وجود `next` يعني أن صفحة محمية أعادت التوجيه إلى هنا لأن الجلسة غير صالحة؛
  // إعادة التوجيه مرة أخرى إلى /dashboard تُنشئ حلقة لا تنتهي.
  if (AUTH_PAGES.includes(pathname) && authed && !request.nextUrl.searchParams.has("next")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return cleanup(NextResponse.redirect(url), request);
  }

  return cleanup(NextResponse.next(), request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
