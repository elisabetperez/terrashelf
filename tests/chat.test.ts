import { describe, it, expect } from "vitest";
import { addMessage, deleteMessage, toggleReaction, MAX_MESSAGE_CHARS, type Message } from "@/lib/chat";

const NOW = "2026-07-01T00:00:00Z";

function seed(): Message[] {
  return addMessage([], "a@terrahq.com", "hello", "m1", NOW);
}

describe("addMessage", () => {
  it("appends a trimmed message", () => {
    const list = addMessage([], "a@terrahq.com", "  hi  ", "m1", NOW);
    expect(list[0].text).toBe("hi");
  });
  it("rejects an empty message", () => {
    expect(() => addMessage([], "a@terrahq.com", "   ", "m1", NOW)).toThrow(/Empty/);
  });
  it("rejects an over-long message", () => {
    const long = "x".repeat(MAX_MESSAGE_CHARS + 1);
    expect(() => addMessage([], "a@terrahq.com", long, "m1", NOW)).toThrow(/exceeds/);
  });
});

describe("deleteMessage", () => {
  it("lets the author delete their own", () => {
    expect(deleteMessage(seed(), "m1", "a@terrahq.com")).toHaveLength(0);
  });
  it("blocks anyone who is not the author", () => {
    expect(() => deleteMessage(seed(), "m1", "b@terrahq.com")).toThrow(/only delete your own/);
  });
});

describe("threads", () => {
  it("adds a reply to an existing root", () => {
    let list = addMessage([], "a@terrahq.com", "root", "m1", NOW);
    list = addMessage(list, "b@terrahq.com", "reply", "m2", NOW, "m1");
    expect(list[1].parentId).toBe("m1");
  });

  it("rejects a reply to a missing thread", () => {
    expect(() => addMessage([], "a@terrahq.com", "x", "m2", NOW, "nope")).toThrow(/Thread not found/);
  });

  it("rejects replying to a reply (one level deep)", () => {
    let list = addMessage([], "a@terrahq.com", "root", "m1", NOW);
    list = addMessage(list, "b@terrahq.com", "reply", "m2", NOW, "m1");
    expect(() => addMessage(list, "c@terrahq.com", "x", "m3", NOW, "m2")).toThrow(/reply to a reply/);
  });

  it("carries a topic on the root but not on replies", () => {
    let list = addMessage([], "a@terrahq.com", "root", "m1", NOW, null, "Chapter 1");
    expect(list[0].topic).toBe("Chapter 1");
    list = addMessage(list, "b@terrahq.com", "reply", "m2", NOW, "m1", "Chapter 9");
    expect(list[1].topic).toBeNull();
  });

  it("deleting a root cascades to its replies", () => {
    let list = addMessage([], "a@terrahq.com", "root", "m1", NOW);
    list = addMessage(list, "b@terrahq.com", "reply", "m2", NOW, "m1");
    list = addMessage(list, "c@terrahq.com", "other root", "m3", NOW);
    const after = deleteMessage(list, "m1", "a@terrahq.com");
    expect(after.map((m) => m.id)).toEqual(["m3"]);
  });
});

describe("toggleReaction", () => {
  it("adds then removes a reaction", () => {
    let list = addMessage([], "a@terrahq.com", "hi", "m1", NOW);
    list = toggleReaction(list, "m1", "🔥", "b@terrahq.com");
    expect(list[0].reactions["🔥"]).toEqual(["b@terrahq.com"]);
    list = toggleReaction(list, "m1", "🔥", "b@terrahq.com");
    expect(list[0].reactions["🔥"]).toBeUndefined();
  });

  it("rejects a disallowed emoji", () => {
    const list = addMessage([], "a@terrahq.com", "hi", "m1", NOW);
    expect(() => toggleReaction(list, "m1", "🍕", "b@terrahq.com")).toThrow(/not allowed/);
  });
});
