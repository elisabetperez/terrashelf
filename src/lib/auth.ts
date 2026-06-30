import { createHmac, timingSafeEqual } from "node:crypto";

export type SessionPayload = {
  exp: number; // epoch ms
  email: string; // identity (Google email)
};

/** True if `email` is in the comma-separated ADMIN_EMAILS list. */
export function isAdminEmail(email: string | null | undefined, list: string | undefined): boolean {
  if (!email || !list) return false;
  const allowed = list
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

/**
 * True if `email` is allowed in.
 * `allowed` may be a full address ("you@example.com") or a bare domain
 * ("example.com", matches any address at that domain).
 */
export function isAllowedEmail(email: string | null | undefined, allowed: string | undefined): boolean {
  if (!email || !allowed) return false;
  const e = email.toLowerCase();
  const a = allowed.toLowerCase().trim();
  return a.includes("@") ? e === a : e.endsWith(`@${a}`);
}

function b64urlEncode(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payload: string, secret: string): string {
  return b64urlEncode(createHmac("sha256", secret).update(payload).digest());
}

export function signSession(p: SessionPayload, secret: string): string {
  const payload = b64urlEncode(JSON.stringify(p));
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySession(cookie: string, secret: string): SessionPayload | null {
  if (!cookie) return null;
  const parts = cookie.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = sign(payload, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  let data: SessionPayload;
  try {
    data = JSON.parse(b64urlDecode(payload).toString("utf8"));
  } catch {
    return null;
  }
  if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
  if (typeof data.email !== "string" || !data.email) return null;
  return data;
}
