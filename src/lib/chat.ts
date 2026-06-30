import { randomBytes } from "node:crypto";
import { readJSON, writeJSON, deleteJSON } from "@/lib/blobs";

export type Reactions = Record<string, string[]>; // emoji -> emails

export type Message = {
  id: string;
  author: string; // email
  text: string;
  createdAt: string; // ISO
  parentId: string | null; // null = thread root; otherwise the root message id
  reactions: Reactions;
};

export const MAX_MESSAGE_CHARS = 280;
export const ALLOWED_REACTIONS = ["👍", "❤️", "😂", "🔥", "🎉", "🤯", "👀", "📚"] as const;

const STORE = "chat";

// ---- Pure logic (unit-tested) ----

/** Normalize a stored message (older records may lack newer fields). */
export function normalize(m: Partial<Message> & { id: string; author: string; text: string; createdAt: string }): Message {
  return { parentId: null, reactions: {}, ...m } as Message;
}

/**
 * Append a message. `parentId` null starts a new thread; otherwise it must be
 * the id of an existing thread root (replies are one level deep).
 */
export function addMessage(
  list: Message[],
  author: string,
  text: string,
  id: string,
  now: string,
  parentId: string | null = null
): Message[] {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty message");
  if (trimmed.length > MAX_MESSAGE_CHARS) throw new Error(`Message exceeds ${MAX_MESSAGE_CHARS} characters`);
  if (parentId !== null) {
    const parent = list.find((m) => m.id === parentId);
    if (!parent) throw new Error("Thread not found");
    if (parent.parentId !== null) throw new Error("Cannot reply to a reply");
  }
  return [...list, { id, author, text: trimmed, createdAt: now, parentId, reactions: {} }];
}

/** Delete a message. Author or admin only. Deleting a thread root removes its replies. */
export function deleteMessage(list: Message[], id: string, requester: string, isAdmin: boolean): Message[] {
  const target = list.find((m) => m.id === id);
  if (!target) return list;
  if (!isAdmin && target.author !== requester) {
    throw new Error("Not allowed to delete this message");
  }
  if (target.parentId === null) {
    // Root: drop it and every reply under it.
    return list.filter((m) => m.id !== id && m.parentId !== id);
  }
  return list.filter((m) => m.id !== id);
}

/** Toggle the requester's reaction on a message. */
export function toggleReaction(list: Message[], id: string, emoji: string, email: string): Message[] {
  if (!ALLOWED_REACTIONS.includes(emoji as (typeof ALLOWED_REACTIONS)[number])) {
    throw new Error("Reaction not allowed");
  }
  return list.map((m) => {
    if (m.id !== id) return m;
    const current = m.reactions[emoji] ?? [];
    const has = current.includes(email);
    const next = has ? current.filter((e) => e !== email) : [...current, email];
    const reactions: Reactions = { ...m.reactions };
    if (next.length) reactions[emoji] = next;
    else delete reactions[emoji];
    return { ...m, reactions };
  });
}

export function newMessageId(): string {
  return randomBytes(8).toString("base64url");
}

// ---- Persistence ----

export async function listMessages(monthId: string): Promise<Message[]> {
  const raw = await readJSON<Message[]>(STORE, monthId, []);
  return raw.map(normalize);
}

export async function saveMessages(monthId: string, list: Message[]): Promise<void> {
  await writeJSON(STORE, monthId, list);
}

export async function deleteAllMessages(monthId: string): Promise<void> {
  await deleteJSON(STORE, monthId);
}
