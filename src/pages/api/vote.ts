import type { APIRoute } from "astro";
import { getSession, unauthorized, json } from "@/lib/session";
import { getMonth, saveMonth, castVote, tally, userVote } from "@/lib/months";

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = getSession(cookies);
  if (!session) return unauthorized();
  const { month, bookId } = (await request.json().catch(() => ({}))) as { month?: string; bookId?: string };
  if (!month || !bookId) return json({ error: "Missing month or bookId" }, 400);

  const m = await getMonth(month);
  if (!m) return json({ error: "Month not found" }, 404);
  try {
    const updated = castVote(m, bookId, session.email);
    await saveMonth(updated);
    return json({ tally: tally(updated), myVote: userVote(updated, session.email) });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "error" }, 400);
  }
};
