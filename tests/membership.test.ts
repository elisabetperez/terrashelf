import { describe, it, expect } from "vitest";
import { toggleMember } from "@/lib/membership";

describe("toggleMember", () => {
  it("adds then removes a member", () => {
    let list = toggleMember([], "u1@terrahq.com");
    expect(list).toEqual(["u1@terrahq.com"]);
    list = toggleMember(list, "u1@terrahq.com");
    expect(list).toEqual([]);
  });

  it("keeps other members intact", () => {
    const list = toggleMember(["u1@terrahq.com"], "u2@terrahq.com");
    expect(list).toEqual(["u1@terrahq.com", "u2@terrahq.com"]);
  });
});
