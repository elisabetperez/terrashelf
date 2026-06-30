import type { APIRoute } from "astro";
import { getSession, unauthorized, json } from "@/lib/session";
import { searchBooks } from "@/lib/openlibrary";

export const GET: APIRoute = async ({ url, cookies }) => {
  if (!getSession(cookies)) return unauthorized();
  const q = url.searchParams.get("q") ?? "";
  try {
    const books = await searchBooks(q);
    return json({ books });
  } catch (err) {
    return json({ books: [], error: err instanceof Error ? err.message : "search failed" }, 502);
  }
};
