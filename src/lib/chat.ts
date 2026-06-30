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
  topic: string | null; // optional chapter/topic, only on thread roots
};

export const MAX_MESSAGE_CHARS = 1000;
export const MAX_TOPIC_CHARS = 60;
export const ALLOWED_REACTIONS = ["👍", "❤️", "😂", "🔥", "🎉", "🤯", "👀", "📚"] as const;

const STORE = "chat";

// ---- Pure logic (unit-tested) ----

/** Normalize a stored message (older records may lack newer fields). */
export function normalize(m: Partial<Message> & { id: string; author: string; text: string; createdAt: string }): Message {
  return { parentId: null, reactions: {}, topic: null, ...m } as Message;
}

/**
 * Append a message. `parentId` null starts a new thread (and may carry a topic);
 * otherwise it must be the id of an existing thread root (replies are one level deep).
 */
export function addMessage(
  list: Message[],
  author: string,
  text: string,
  id: string,
  now: string,
  parentId: string | null = null,
  topic: string | null = null
): Message[] {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty message");
  if (trimmed.length > MAX_MESSAGE_CHARS) throw new Error(`Message exceeds ${MAX_MESSAGE_CHARS} characters`);
  if (parentId !== null) {
    const parent = list.find((m) => m.id === parentId);
    if (!parent) throw new Error("Thread not found");
    if (parent.parentId !== null) throw new Error("Cannot reply to a reply");
  }
  // Only thread roots carry a topic.
  let cleanTopic: string | null = null;
  if (parentId === null && topic) {
    cleanTopic = topic.trim().slice(0, MAX_TOPIC_CHARS) || null;
  }
  return [...list, { id, author, text: trimmed, createdAt: now, parentId, reactions: {}, topic: cleanTopic }];
}

/** Delete a message — only its own author may. Deleting a thread root removes its replies. */
export function deleteMessage(list: Message[], id: string, requester: string): Message[] {
  const target = list.find((m) => m.id === id);
  if (!target) return list;
  if (target.author !== requester) {
    throw new Error("You can only delete your own messages");
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
