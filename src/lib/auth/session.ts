import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "mizan_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

interface SessionPayload {
  uid: string;
  exp: number;
}

function secret(): string {
  const value = process.env.MIZAN_DEMO_SESSION_SECRET;
  if (value && value.length >= 16) return value;
  // قيمة تطوير فقط. في الإنتاج يجب ضبط MIZAN_DEMO_SESSION_SECRET.
  return "mizan-demo-development-secret-change-me";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload?.uid || !payload?.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createDemoSession(userId: string): Promise<void> {
  const cookieStore = await cookies();
  const token = encode({ uid: userId, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS });
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function readDemoSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return decode(token)?.uid ?? null;
}

export async function destroyDemoSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/** يُستخدم في middleware حيث لا تتوفر واجهة cookies الخاصة بالخادم. */
export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  return decode(token)?.uid ?? null;
}
