import type { BookRef } from "@/lib/books";
import { bookIdFromOlKey } from "@/lib/books";

type OpenLibraryDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
};

type OpenLibraryResponse = {
  docs?: OpenLibraryDoc[];
};

/** Build an Open Library cover URL from a cover id. */
export function coverUrl(coverId: number | undefined): string {
  return typeof coverId === "number" ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : "";
}

/** Pure mapping of an Open Library search response to BookRefs. */
export function mapSearchResponse(json: OpenLibraryResponse): BookRef[] {
  const docs = Array.isArray(json.docs) ? json.docs : [];
  return docs
    .filter((d): d is OpenLibraryDoc & { key: string; title: string } => Boolean(d.key && d.title))
    .map((d) => ({
      id: bookIdFromOlKey(d.key),
      olKey: d.key,
      title: d.title,
      author: (d.author_name ?? []).join(", "),
      coverUrl: coverUrl(d.cover_i),
    }));
}

/** Search Open Library and return normalized BookRefs (top `limit`). */
export async function searchBooks(query: string, limit = 12): Promise<BookRef[]> {
  const q = query.trim();
  if (!q) return [];
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("fields", "key,title,author_name,cover_i");
  const resp = await fetch(url, { headers: { "User-Agent": "TerraShelf/0.1 (book club)" } });
  if (!resp.ok) throw new Error(`Open Library search failed (${resp.status})`);
  const json = (await resp.json()) as OpenLibraryResponse;
  return mapSearchResponse(json).slice(0, limit);
}
