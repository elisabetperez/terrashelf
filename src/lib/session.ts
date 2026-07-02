import type { AstroCookies } from "astro";
import { verifySession, isAdminEmail, adminRole as authAdminRole, type SessionPayload, type AdminRole } from "@/lib/auth";

export const SESSION_COOKIE = "terrashelf_session";
export const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

/** Read and verify the session from cookies. Null when absent/invalid. */
export function getSession(cookies: AstroCookies): SessionPayload | null {
  const raw = cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const secret = import.meta.env.SESSION_SECRET;
  if (!secret) return null;
  return verifySession(raw, secret);
}

export function isAdmin(email: string | null | undefined): boolean {
  return isAdminEmail(email, import.meta.env.ADMIN_EMAILS);
}

/** "admin" (primary) | "co-admin" | null — same permissions, different label. */
export function adminRole(email: string | null | undefined): AdminRole {
  return authAdminRole(email, import.meta.env.ADMIN_EMAILS);
}

/** 401 JSON helper. */
export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

/** 403 JSON helper. */
export function forbidden(): Response {
  return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
