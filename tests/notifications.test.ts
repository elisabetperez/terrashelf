import { describe, it, expect } from "vitest";
import { handleFromEmail, textMentions, isUnread, type Mention } from "@/lib/notifications";

describe("handleFromEmail", () => {
  it("uses the sanitized local part", () => {
    expect(handleFromEmail("Eli.Perez@terrahq.com")).toBe("eli.perez");
    expect(handleFromEmail("eli@terrahq.com")).toBe("eli");
  });
});

describe("textMentions", () => {
  it("extracts unique lowercased handles", () => {
    expect(textMentions("hey @Eli and @ana, also @eli")).toEqual(["eli", "ana"]);
  });
  it("returns empty when no mentions", () => {
    expect(textMentions("no mentions here")).toEqual([]);
  });
});

describe("isUnread", () => {
  const m: Mention = { month: "2026-06", periodLabel: "June", messageId: "x", author: "a@x.com", text: "@eli", createdAt: "2026-06-10T00:00:00Z" };
  it("is unread when created after last seen", () => {
    expect(isUnread(m, "2026-06-09T00:00:00Z")).toBe(true);
    expect(isUnread(m, "2026-06-11T00:00:00Z")).toBe(false);
  });
});
