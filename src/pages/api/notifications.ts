import type { APIRoute } from "astro";
import { getSession, unauthorized, json } from "@/lib/session";
import { collectMentions, getLastSeen, isUnread } from "@/lib/notifications";

export const GET: APIRoute = async ({ cookies }) => {
  const session = getSession(cookies);
  if (!session) return unauthorized();
  const [mentions, lastSeenAt] = await Promise.all([collectMentions(session.email), getLastSeen(session.email)]);
  const unread = mentions.filter((m) => isUnread(m, lastSeenAt)).length;
  return json({ mentions, unread, lastSeenAt });
};
