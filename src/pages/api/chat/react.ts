import type { APIRoute } from "astro";
import { getSession, isAdmin, unauthorized, json } from "@/lib/session";
import { getMonth, hasChosenBook } from "@/lib/months";
import { listMessages, saveMessages, toggleReaction, ALLOWED_REACTIONS } from "@/lib/chat";

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = getSession(cookies);
  if (!session) return unauthorized();
  const { month, id, emoji } = (await request.json().catch(() => ({}))) as {
    month?: string;
    id?: string;
    emoji?: string;
  };
  if (!month || !id || !emoji) return json({ error: "Missing month, id or emoji" }, 400);

  const m = await getMonth(month);
  if (!m || !hasChosenBook(m)) return json({ error: "No book of the month yet" }, 400);
  try {
    const updated = toggleReaction(await listMessages(month), id, emoji, session.email);
    await saveMessages(month, updated);
    return json({ messages: updated, me: session.email, isAdmin: isAdmin(session.email), allowedReactions: ALLOWED_REACTIONS });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "error" }, 400);
  }
};
