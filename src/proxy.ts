import { NextResponse, type NextRequest } from "next/server";

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
  if (request.cookies.has("rakaz_session")) return true;
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));
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
    return NextResponse.redirect(url);
  }

  if (AUTH_PAGES.includes(pathname) && authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
