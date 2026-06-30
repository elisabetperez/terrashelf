/** A book reference embedded wherever a book is shown. */
export type BookRef = {
  id: string; // stable id derived from olKey, e.g. "OL12345W"
  olKey: string; // Open Library work key, e.g. "/works/OL12345W"
  title: string;
  author: string; // primary author(s), joined
  coverUrl: string; // "" when no cover
};

/** Derive a stable id from an Open Library work key. */
export function bookIdFromOlKey(olKey: string): string {
  const tail = olKey.split("/").filter(Boolean).pop() ?? olKey;
  return tail.trim();
}
