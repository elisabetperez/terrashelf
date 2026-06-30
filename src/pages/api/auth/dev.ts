import type { APIRoute } from "astro";
import { signSession, isAllowedEmail } from "@/lib/auth";
import { SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/session";

/** Dev-only login: signs a session without Google OAuth. Disabled in production. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const enabled = import.meta.env.DEV && import.meta.env.DEV_LOGIN_ENABLED === "true";
  if (!enabled) return new Response("Not found", { status: 404 });

  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!isAllowedEmail(email, import.meta.env.ALLOWED_EMAIL)) {
    return new Response("Email not allowed", { status: 403 });
  }
  const secret = import.meta.env.SESSION_SECRET;
  const token = signSession({ exp: Date.now() + SESSION_TTL_MS, email }, secret);
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: !import.meta.env.DEV,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return redirect("/", 302);
};
