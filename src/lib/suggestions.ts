import type { BookRef } from "@/lib/books";
import { readJSON, writeJSON } from "@/lib/blobs";

export type Suggestion = BookRef & {
  suggestedBy: string; // email
  createdAt: string; // ISO
  interested: string[]; // emails
  note: string; // optional note from the suggester for the admin
};

export const MAX_NOTE_CHARS = 280;
export const MAX_UPVOTES = 2;

const STORE = "suggestions";
const KEY = "all";

// ---- Pure logic (unit-tested) ----

/** Add a suggestion, rejecting duplicates by olKey. Returns the new list. */
export function addSuggestion(list: Suggestion[], ref: BookRef, email: string, now: string, note = ""): Suggestion[] {
  if (list.some((s) => s.olKey === ref.olKey)) {
    throw new Error("That book is already in the suggestion box");
  }
  const suggestion: Suggestion = {
    ...ref,
    suggestedBy: email,
    createdAt: now,
    interested: [],
    note: note.trim().slice(0, MAX_NOTE_CHARS),
  };
  return [...list, suggestion];
}

/** Remove a suggestion. Only the author or an admin may remove it. */
export function removeSuggestion(list: Suggestion[], id: string, requester: string, isAdmin: boolean): Suggestion[] {
  const target = list.find((s) => s.id === id);
  if (!target) return list;
  if (!isAdmin && target.suggestedBy !== requester) {
    throw new Error("Not allowed to remove this suggestion");
  }
  return list.filter((s) => s.id !== id);
}

/** Count how many suggestions this email has upvoted. */
export function upvoteCount(list: Suggestion[], email: string): number {
  return list.reduce((n, s) => n + (s.interested.includes(email) ? 1 : 0), 0);
}

/** Toggle the requester's upvote on a suggestion (max MAX_UPVOTES active). */
export function toggleInterest(list: Suggestion[], id: string, email: string): Suggestion[] {
  const target = list.find((s) => s.id === id);
  const adding = target ? !target.interested.includes(email) : false;
  if (adding && upvoteCount(list, email) >= MAX_UPVOTES) {
    throw new Error(`You can upvote at most ${MAX_UPVOTES} books — remove one first`);
  }
  return list.map((s) => {
    if (s.id !== id) return s;
    const has = s.interested.includes(email);
    return {
      ...s,
      interested: has ? s.interested.filter((e) => e !== email) : [...s.interested, email],
    };
  });
}

// ---- Persistence ----

export async function listSuggestions(): Promise<Suggestion[]> {
  return readJSON<Suggestion[]>(STORE, KEY, []);
}

export async function saveSuggestions(list: Suggestion[]): Promise<void> {
  await writeJSON(STORE, KEY, list);
}
