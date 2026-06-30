import type { APIRoute } from "astro";
import { getSession, isAdmin, unauthorized, json } from "@/lib/session";
import { getMonth } from "@/lib/months";
import {
  listMessages,
  saveMessages,
  addMessage,
  deleteMessage,
  newMessageId,
  ALLOWED_REACTIONS,
} from "@/lib/chat";

function payload(messages: unknown, email: string) {
  return { messages, me: email, isAdmin: isAdmin(email), allowedReactions: ALLOWED_REACTIONS };
}

export const GET: APIRoute = async ({ url, cookies }) => {
  const session = getSession(cookies);
  if (!session) return unauthorized();
  const month = url.searchParams.get("month");
  if (!month) return json({ error: "Missing month" }, 400);
  return json(payload(await listMessages(month), session.email));
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = getSession(cookies);
  if (!session) return unauthorized();
  const { month, text, parentId, topic } = (await request.json().catch(() => ({}))) as {
    month?: string;
    text?: string;
    parentId?: string | null;
    topic?: string | null;
  };
  if (!month || !text) return json({ error: "Missing month or text" }, 400);

  const m = await getMonth(month);
  if (!m || m.phase !== "closed") return json({ error: "Chat opens once there is a book of the month" }, 400);
  try {
    const updated = addMessage(
      await listMessages(month),
      session.email,
      text,
      newMessageId(),
      new Date().toISOString(),
      parentId ?? null,
      topic ?? null
    );
    await saveMessages(month, updated);
    return json(payload(updated, session.email));
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "error" }, 400);
  }
};

export const DELETE: APIRoute = async ({ url, cookies }) => {
  const session = getSession(cookies);
  if (!session) return unauthorized();
  const month = url.searchParams.get("month");
  const id = url.searchParams.get("id");
  if (!month || !id) return json({ error: "Missing month or id" }, 400);
  try {
    const updated = deleteMessage(await listMessages(month), id, session.email);
    await saveMessages(month, updated);
    return json(payload(updated, session.email));
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "error" }, 403);
  }
};
