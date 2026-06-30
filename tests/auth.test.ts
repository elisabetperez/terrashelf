import { describe, it, expect } from "vitest";
import { signSession, verifySession, isAdminEmail, isAllowedEmail } from "@/lib/auth";

const SECRET = "test-secret-please-ignore-0123456789";

describe("session signing", () => {
  it("round-trips a valid session", () => {
    const token = signSession({ exp: Date.now() + 10_000, email: "a@terrahq.com" }, SECRET);
    const payload = verifySession(token, SECRET);
    expect(payload?.email).toBe("a@terrahq.com");
  });

  it("rejects a tampered token", () => {
    const token = signSession({ exp: Date.now() + 10_000, email: "a@terrahq.com" }, SECRET);
    expect(verifySession(token + "x", SECRET)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = signSession({ exp: Date.now() - 1, email: "a@terrahq.com" }, SECRET);
    expect(verifySession(token, SECRET)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const token = signSession({ exp: Date.now() + 10_000, email: "a@terrahq.com" }, SECRET);
    expect(verifySession(token, "other-secret")).toBeNull();
  });
});

describe("isAdminEmail", () => {
  it("matches case-insensitively within the list", () => {
    expect(isAdminEmail("Eli@terrahq.com", "eli@terrahq.com, x@terrahq.com")).toBe(true);
    expect(isAdminEmail("nope@terrahq.com", "eli@terrahq.com")).toBe(false);
    expect(isAdminEmail("eli@terrahq.com", undefined)).toBe(false);
  });
});

describe("isAllowedEmail", () => {
  it("matches a bare domain", () => {
    expect(isAllowedEmail("anyone@terrahq.com", "terrahq.com")).toBe(true);
    expect(isAllowedEmail("anyone@gmail.com", "terrahq.com")).toBe(false);
  });
  it("matches a full address", () => {
    expect(isAllowedEmail("eli@terrahq.com", "eli@terrahq.com")).toBe(true);
    expect(isAllowedEmail("other@terrahq.com", "eli@terrahq.com")).toBe(false);
  });
});
