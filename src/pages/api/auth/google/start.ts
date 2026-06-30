import type { APIRoute } from "astro";
import { randomBytes } from "node:crypto";

const STATE_COOKIE = "ts_oauth_state";
const STATE_TTL_SEC = 10 * 60;

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const clientId = import.meta.env.GOOGLE_CLIENT_ID;
  if (!clientId) return new Response("Google OAuth not configured", { status: 500 });

  const state = randomBytes(24).toString("base64url");
  const redirectUri = `${url.origin}/api/auth/google/callback`;

  cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: !import.meta.env.DEV,
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_SEC,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    access_type: "online",
  });
  return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
};
