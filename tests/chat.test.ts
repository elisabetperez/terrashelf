import { describe, it, expect } from "vitest";
import { addMessage, deleteMessage, MAX_MESSAGE_CHARS, type Message } from "@/lib/chat";

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
  it("lets the author delete", () => {
    expect(deleteMessage(seed(), "m1", "a@terrahq.com", false)).toHaveLength(0);
  });
  it("blocks a non-author non-admin", () => {
    expect(() => deleteMessage(seed(), "m1", "b@terrahq.com", false)).toThrow(/Not allowed/);
  });
  it("lets an admin delete anyone's", () => {
    expect(deleteMessage(seed(), "m1", "b@terrahq.com", true)).toHaveLength(0);
  });
});
