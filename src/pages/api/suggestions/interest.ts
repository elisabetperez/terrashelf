import type { APIRoute } from "astro";
import { getSession, isAdmin, unauthorized, json } from "@/lib/session";
import { listSuggestions, saveSuggestions, toggleInterest } from "@/lib/suggestions";

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = getSession(cookies);
  if (!session) return unauthorized();
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return json({ error: "Missing id" }, 400);
  try {
    const updated = toggleInterest(await listSuggestions(), id, session.email);
    await saveSuggestions(updated);
    return json({ suggestions: updated, me: session.email, isAdmin: isAdmin(session.email) });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "error" }, 400);
  }
};
