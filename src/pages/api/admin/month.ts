import type { APIRoute } from "astro";
import { getSession, isAdmin, unauthorized, forbidden, json } from "@/lib/session";
import { bookIdFromOlKey, type BookRef } from "@/lib/books";
import {
  getMonth,
  saveMonth,
  createMonth,
  addCandidate,
  removeCandidate,
  openVoting,
  closeMonth,
  deleteMonth,
  type Month,
} from "@/lib/months";
import { deleteMembers } from "@/lib/membership";
import { deleteAllMessages } from "@/lib/chat";

type Body = {
  action: "create" | "addCandidate" | "removeCandidate" | "openVoting" | "close" | "reset";
  id?: string;
  ref?: Partial<BookRef>;
  bookId?: string;
  winnerBookId?: string;
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = getSession(cookies);
  if (!session) return unauthorized();
  if (!isAdmin(session.email)) return forbidden();

  const body = (await request.json().catch(() => ({}))) as Body;
  const now = new Date().toISOString();

  try {
    if (body.action === "create") {
      if (!body.id) return json({ error: "Missing month id" }, 400);
      const existing = await getMonth(body.id);
      const month = existing ?? createMonth(body.id);
      await saveMonth(month);
      return json({ month });
    }

    if (body.action === "reset") {
      if (!body.id) return json({ error: "Missing month id" }, 400);
      // Wipe everything for this month: the month itself, its readers and its chat.
      await Promise.all([deleteMonth(body.id), deleteMembers(body.id), deleteAllMessages(body.id)]);
      return json({ ok: true });
    }

    if (!body.id) return json({ error: "Missing month id" }, 400);
    const month = await getMonth(body.id);
    if (!month) return json({ error: "Month not found" }, 404);

    let updated: Month;
    switch (body.action) {
      case "addCandidate": {
        if (!body.ref?.olKey || !body.ref.title) return json({ error: "Missing book" }, 400);
        const ref: BookRef = {
          id: bookIdFromOlKey(body.ref.olKey),
          olKey: body.ref.olKey,
          title: body.ref.title,
          author: body.ref.author ?? "",
          coverUrl: body.ref.coverUrl ?? "",
        };
        updated = addCandidate(month, ref);
        break;
      }
      case "removeCandidate":
        if (!body.bookId) return json({ error: "Missing bookId" }, 400);
        updated = removeCandidate(month, body.bookId);
        break;
      case "openVoting":
        updated = openVoting(month, now);
        break;
      case "close":
        updated = closeMonth(month, now, body.winnerBookId);
        break;
      default:
        return json({ error: "Unknown action" }, 400);
    }
    await saveMonth(updated);
    return json({ month: updated });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "error" }, 400);
  }
};
