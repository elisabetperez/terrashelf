import type { APIRoute } from "astro";
import { getSession, unauthorized, json } from "@/lib/session";
import { getProfile, saveProfile, emptyProfile, applyProfileInput, type ProfileInput } from "@/lib/profiles";

export const GET: APIRoute = async ({ url, cookies }) => {
  const session = getSession(cookies);
  if (!session) return unauthorized();
  const email = (url.searchParams.get("email") ?? session.email).toLowerCase();
  const profile = (await getProfile(email)) ?? emptyProfile(email, new Date().toISOString());
  return json({ profile, isMe: email === session.email });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = getSession(cookies);
  if (!session) return unauthorized();
  const input = (await request.json().catch(() => ({}))) as ProfileInput;
  const now = new Date().toISOString();
  const current = (await getProfile(session.email)) ?? emptyProfile(session.email, now);
  try {
    const updated = applyProfileInput(current, input, now);
    await saveProfile(updated);
    return json({ profile: updated });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "error" }, 400);
  }
};
