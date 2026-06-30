import { describe, it, expect } from "vitest";
import { addSuggestion, removeSuggestion, toggleInterest, type Suggestion } from "@/lib/suggestions";
import type { BookRef } from "@/lib/books";

const ref: BookRef = { id: "OL1W", olKey: "/works/OL1W", title: "Dune", author: "Herbert", coverUrl: "" };

function seed(): Suggestion[] {
  return addSuggestion([], ref, "a@terrahq.com", "2026-06-30T00:00:00Z");
}

describe("addSuggestion", () => {
  it("adds a suggestion with empty interest", () => {
    const list = seed();
    expect(list).toHaveLength(1);
    expect(list[0].suggestedBy).toBe("a@terrahq.com");
    expect(list[0].interested).toEqual([]);
  });

  it("rejects a duplicate by olKey", () => {
    const list = seed();
    expect(() => addSuggestion(list, ref, "b@terrahq.com", "x")).toThrow(/already/);
  });

  it("stores an optional note for the admin", () => {
    const list = addSuggestion([], ref, "a@terrahq.com", "now", "  please read this one  ");
    expect(list[0].note).toBe("please read this one");
    expect(seed()[0].note).toBe("");
  });
});

describe("removeSuggestion", () => {
  it("lets the author remove their own", () => {
    const list = seed();
    expect(removeSuggestion(list, "OL1W", "a@terrahq.com", false)).toHaveLength(0);
  });
  it("blocks a non-author non-admin", () => {
    const list = seed();
    expect(() => removeSuggestion(list, "OL1W", "b@terrahq.com", false)).toThrow(/Not allowed/);
  });
  it("lets an admin remove anyone's", () => {
    const list = seed();
    expect(removeSuggestion(list, "OL1W", "b@terrahq.com", true)).toHaveLength(0);
  });
});

describe("toggleInterest", () => {
  it("adds then removes interest", () => {
    let list = seed();
    list = toggleInterest(list, "OL1W", "b@terrahq.com");
    expect(list[0].interested).toEqual(["b@terrahq.com"]);
    list = toggleInterest(list, "OL1W", "b@terrahq.com");
    expect(list[0].interested).toEqual([]);
  });
});
