import { randomBytes } from "node:crypto";
import { readJSON, writeJSON } from "@/lib/blobs";

export type Message = {
  id: string;
  author: string; // email
  text: string;
  createdAt: string; // ISO
};

export const MAX_MESSAGE_CHARS = 280;

const STORE = "chat";

// ---- Pure logic (unit-tested) ----

/** Append a message. Validates non-empty and length. */
export function addMessage(list: Message[], author: string, text: string, id: string, now: string): Message[] {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty message");
  if (trimmed.length > MAX_MESSAGE_CHARS) throw new Error(`Message exceeds ${MAX_MESSAGE_CHARS} characters`);
  return [...list, { id, author, text: trimmed, createdAt: now }];
}

/** Delete a message. Only the author or an admin may delete it. */
export function deleteMessage(list: Message[], id: string, requester: string, isAdmin: boolean): Message[] {
  const target = list.find((m) => m.id === id);
  if (!target) return list;
  if (!isAdmin && target.author !== requester) {
    throw new Error("Not allowed to delete this message");
  }
  return list.filter((m) => m.id !== id);
}

export function newMessageId(): string {
  return randomBytes(8).toString("base64url");
}

// ---- Persistence ----

export async function listMessages(monthId: string): Promise<Message[]> {
  return readJSON<Message[]>(STORE, monthId, []);
}

export async function saveMessages(monthId: string, list: Message[]): Promise<void> {
  await writeJSON(STORE, monthId, list);
}
