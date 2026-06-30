import { describe, it, expect } from "vitest";
import { applyProfileInput, emptyProfile, nameFromEmail, MAX_TOP_BOOKS, MAX_BIO_CHARS } from "@/lib/profiles";
import type { BookRef } from "@/lib/books";

const NOW = "2026-06-30T00:00:00Z";
const book = (id: string): BookRef => ({ id, olKey: `/works/${id}`, title: id, author: "", coverUrl: "" });

describe("nameFromEmail", () => {
  it("title-cases the local part", () => {
    expect(nameFromEmail("eli.rodriguez@terrahq.com")).toBe("Eli Rodriguez");
    expect(nameFromEmail("eli@terrahq.com")).toBe("Eli");
  });
});

describe("applyProfileInput", () => {
  const base = emptyProfile("eli@terrahq.com", NOW);

  it("updates fields", () => {
    const p = applyProfileInput(base, { displayName: "Eli", bio: "books!", goodreadsUrl: "https://www.goodreads.com/eli" }, NOW);
    expect(p.displayName).toBe("Eli");
    expect(p.bio).toBe("books!");
    expect(p.goodreadsUrl).toBe("https://www.goodreads.com/eli");
  });

  it("rejects a non-goodreads url", () => {
    expect(() => applyProfileInput(base, { goodreadsUrl: "https://example.com/x" }, NOW)).toThrow(/goodreads/);
  });

  it("allows an empty goodreads url", () => {
    const p = applyProfileInput(base, { goodreadsUrl: "" }, NOW);
    expect(p.goodreadsUrl).toBe("");
  });

  it("clamps top books to the max", () => {
    const p = applyProfileInput(base, { topBooks: [book("1"), book("2"), book("3"), book("4")] }, NOW);
    expect(p.topBooks).toHaveLength(MAX_TOP_BOOKS);
  });

  it("rejects an over-long bio", () => {
    expect(() => applyProfileInput(base, { bio: "x".repeat(MAX_BIO_CHARS + 1) }, NOW)).toThrow(/Bio/);
  });

  it("falls back to a name derived from email when display name is blank", () => {
    const p = applyProfileInput(base, { displayName: "  " }, NOW);
    expect(p.displayName).toBe("Eli");
  });
});
