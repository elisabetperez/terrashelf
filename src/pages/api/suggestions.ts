import type { APIRoute } from "astro";
import { getSession, isAdmin, unauthorized, json } from "@/lib/session";
import { bookIdFromOlKey, type BookRef } from "@/lib/books";
import { listSuggestions, saveSuggestions, addSuggestion, removeSuggestion } from "@/lib/suggestions";

export const GET: APIRoute = async ({ cookies }) => {
  const session = getSession(cookies);
  if (!session) return unauthorized();
  const suggestions = await listSuggestions();
  return json({ suggestions, me: session.email, isAdmin: isAdmin(session.email) });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = getSession(cookies);
  if (!session) return unauthorized();
  const body = (await request.json().catch(() => ({}))) as Partial<BookRef> & { note?: string };
  if (!body.olKey || !body.title) return json({ error: "Missing book" }, 400);
  const ref: BookRef = {
    id: bookIdFromOlKey(body.olKey),
    olKey: body.olKey,
    title: body.title,
    author: body.author ?? "",
    coverUrl: body.coverUrl ?? "",
  };
  try {
    const updated = addSuggestion(await listSuggestions(), ref, session.email, new Date().toISOString(), body.note ?? "");
    await saveSuggestions(updated);
    return json({ suggestions: updated, me: session.email, isAdmin: isAdmin(session.email) });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "error" }, 400);
  }
};

export const DELETE: APIRoute = async ({ url, cookies }) => {
  const session = getSession(cookies);
  if (!session) return unauthorized();
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "Missing id" }, 400);
  try {
    const updated = removeSuggestion(await listSuggestions(), id, session.email, isAdmin(session.email));
    await saveSuggestions(updated);
    return json({ suggestions: updated, me: session.email, isAdmin: isAdmin(session.email) });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "error" }, 403);
  }
};
