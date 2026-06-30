import type { APIRoute } from "astro";
import { getSession, unauthorized, json } from "@/lib/session";
import { markSeen } from "@/lib/notifications";

export const POST: APIRoute = async ({ cookies }) => {
  const session = getSession(cookies);
  if (!session) return unauthorized();
  await markSeen(session.email, new Date().toISOString());
  return json({ ok: true });
};
