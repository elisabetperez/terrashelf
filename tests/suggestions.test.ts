import { describe, it, expect } from "vitest";
import { addSuggestion, removeSuggestion, toggleInterest, upvoteCount, MAX_UPVOTES, type Suggestion } from "@/lib/suggestions";
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

const ref2: BookRef = { id: "OL2W", olKey: "/works/OL2W", title: "PHM", author: "Weir", coverUrl: "" };
const ref3: BookRef = { id: "OL3W", olKey: "/works/OL3W", title: "Sapiens", author: "Harari", coverUrl: "" };

describe("toggleInterest (upvote)", () => {
  it("adds then removes interest", () => {
    let list = seed();
    list = toggleInterest(list, "OL1W", "b@terrahq.com");
    expect(list[0].interested).toEqual(["b@terrahq.com"]);
    list = toggleInterest(list, "OL1W", "b@terrahq.com");
    expect(list[0].interested).toEqual([]);
  });

  it(`enforces a max of ${MAX_UPVOTES} upvotes per person`, () => {
    let list = addSuggestion(seed(), ref2, "x", "n");
    list = addSuggestion(list, ref3, "x", "n");
    list = toggleInterest(list, "OL1W", "u@terrahq.com");
    list = toggleInterest(list, "OL2W", "u@terrahq.com");
    expect(upvoteCount(list, "u@terrahq.com")).toBe(2);
    expect(() => toggleInterest(list, "OL3W", "u@terrahq.com")).toThrow(/at most 2/);
    // removing one frees a slot
    list = toggleInterest(list, "OL1W", "u@terrahq.com");
    list = toggleInterest(list, "OL3W", "u@terrahq.com");
    expect(upvoteCount(list, "u@terrahq.com")).toBe(2);
  });
});
