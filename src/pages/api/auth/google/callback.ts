import type { APIRoute } from "astro";
import { signSession, isAllowedEmail } from "@/lib/auth";
import { SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/session";

const STATE_COOKIE = "ts_oauth_state";

type TokenResponse = { id_token?: string; error?: string };
type TokenInfo = { email?: string; email_verified?: string | boolean; aud?: string; error?: string };

function htmlError(msg: string, status: number): Response {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Error</title></head><body style="font-family:system-ui;padding:2rem"><h1>Could not sign in</h1><p>${msg}</p><p><a href="/">Back</a></p></body></html>`;
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const clientId = import.meta.env.GOOGLE_CLIENT_ID;
  const clientSecret = import.meta.env.GOOGLE_CLIENT_SECRET;
  const allowed = import.meta.env.ALLOWED_EMAIL;
  const sessionSecret = import.meta.env.SESSION_SECRET;
  if (!clientId || !clientSecret || !allowed || !sessionSecret) {
    return htmlError("Server misconfigured (missing environment variables).", 500);
  }

  const code = url.searchParams.get("code");
  const stateFromUrl = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  if (oauthError) return htmlError(`Google returned an error: ${oauthError}`, 400);
  if (!code || !stateFromUrl) return htmlError("Missing callback parameters.", 400);

  const stateCookie = cookies.get(STATE_COOKIE)?.value;
  cookies.delete(STATE_COOKIE, { path: "/" });
  if (!stateCookie || stateCookie !== stateFromUrl) {
    return htmlError("State mismatch. Please try again.", 400);
  }

  const redirectUri = `${url.origin}/api/auth/google/callback`;
  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokens = (await tokenResp.json().catch(() => ({}))) as TokenResponse;
  if (!tokenResp.ok || !tokens.id_token) {
    return htmlError(`Could not exchange the code (${tokens.error ?? "no detail"}).`, 502);
  }

  const infoResp = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokens.id_token)}`
  );
  const info = (await infoResp.json().catch(() => ({}))) as TokenInfo;
  if (!infoResp.ok || info.error) return htmlError("Could not verify the Google token.", 502);
  if (info.aud !== clientId) return htmlError("The token does not belong to this app.", 400);
  if (info.email_verified !== "true" && info.email_verified !== true) {
    return htmlError("Your Google email is not verified.", 403);
  }

  const email = (info.email ?? "").toLowerCase();
  if (!email || !isAllowedEmail(email, allowed)) {
    return htmlError(`Access denied for ${info.email ?? "that email"}.`, 403);
  }

  const token = signSession({ exp: Date.now() + SESSION_TTL_MS, email }, sessionSecret);
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: !import.meta.env.DEV,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return redirect("/", 302);
};
