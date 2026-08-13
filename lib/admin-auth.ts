import { getBindings } from "./database";

export const ADMIN_COOKIE = "struny_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signature(value: string): Promise<string> {
  const secret = getBindings().ADMIN_SESSION_SECRET;
  if (!secret) return "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

export async function createAdminSession(): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000).toString();
  return `${issuedAt}.${await signature(issuedAt)}`;
}

export async function verifyAdminSession(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [issuedAt, suppliedSignature] = token.split(".");
  if (!issuedAt || !suppliedSignature) return false;
  const age = Math.floor(Date.now() / 1000) - Number(issuedAt);
  if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_SECONDS) return false;
  const expected = await signature(issuedAt);
  if (!expected || suppliedSignature.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ suppliedSignature.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const expected = getBindings().ADMIN_PASSWORD ?? "";
  if (!expected || password.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ password.charCodeAt(index);
  }
  return mismatch === 0;
}

export function readCookie(request: Request, name: string): string | null {
  const cookies = request.headers.get("cookie") ?? "";
  for (const cookie of cookies.split(";")) {
    const [key, ...parts] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(parts.join("="));
  }
  return null;
}

export async function isAdminRequest(request: Request): Promise<boolean> {
  return verifyAdminSession(readCookie(request, ADMIN_COOKIE));
}

export const adminCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
