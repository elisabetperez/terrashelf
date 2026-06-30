import { describe, it, expect } from "vitest";
import { mapSearchResponse, coverUrl } from "@/lib/openlibrary";

describe("mapSearchResponse", () => {
  it("maps docs to BookRefs", () => {
    const refs = mapSearchResponse({
      docs: [
        { key: "/works/OL1W", title: "Dune", author_name: ["Frank Herbert"], cover_i: 42 },
        { key: "/works/OL2W", title: "No Cover", author_name: ["Someone"] },
        { key: "/works/OL3W", title: "No Author" },
      ],
    });
    expect(refs).toHaveLength(3);
    expect(refs[0]).toEqual({
      id: "OL1W",
      olKey: "/works/OL1W",
      title: "Dune",
      author: "Frank Herbert",
      coverUrl: "https://covers.openlibrary.org/b/id/42-M.jpg",
    });
    expect(refs[1].coverUrl).toBe("");
    expect(refs[2].author).toBe("");
  });

  it("drops docs without key or title", () => {
    const refs = mapSearchResponse({ docs: [{ title: "no key" }, { key: "/works/OLx" }, {}] });
    expect(refs).toHaveLength(0);
  });

  it("handles a missing docs array", () => {
    expect(mapSearchResponse({})).toEqual([]);
  });
});

describe("coverUrl", () => {
  it("returns empty for undefined", () => {
    expect(coverUrl(undefined)).toBe("");
  });
});
