import { describe, it, expect } from "vitest";
import {
  createMonth,
  addCandidate,
  removeCandidate,
  openVoting,
  castVote,
  closeMonth,
  tally,
  userVote,
  currentMonthId,
  type Month,
} from "@/lib/months";
import type { BookRef } from "@/lib/books";

const NOW = "2026-07-01T00:00:00Z";
const a: BookRef = { id: "A", olKey: "/works/A", title: "A", author: "", coverUrl: "" };
const b: BookRef = { id: "B", olKey: "/works/B", title: "B", author: "", coverUrl: "" };
const c: BookRef = { id: "C", olKey: "/works/C", title: "C", author: "", coverUrl: "" };

function votingMonth(): Month {
  let m = createMonth("2026-07");
  m = addCandidate(m, a);
  m = addCandidate(m, b);
  m = addCandidate(m, c);
  return openVoting(m, NOW);
}

describe("currentMonthId", () => {
  it("formats YYYY-MM", () => {
    expect(currentMonthId(new Date("2026-07-15T12:00:00Z"))).toBe("2026-07");
    expect(currentMonthId(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01");
  });
});

describe("candidate management", () => {
  it("adds and dedupes candidates only in draft", () => {
    let m = createMonth("2026-07");
    m = addCandidate(m, a);
    m = addCandidate(m, a); // dup ignored
    expect(m.candidates).toHaveLength(1);
    m = removeCandidate(m, "A");
    expect(m.candidates).toHaveLength(0);
  });

  it("blocks opening voting with fewer than 2 candidates", () => {
    let m = createMonth("2026-07");
    m = addCandidate(m, a);
    expect(() => openVoting(m, NOW)).toThrow(/at least 2/);
  });

  it("blocks adding candidates after voting opens", () => {
    const m = votingMonth();
    expect(() => addCandidate(m, b)).toThrow(/draft/);
  });
});

describe("castVote", () => {
  it("records one vote", () => {
    const m = castVote(votingMonth(), "A", "u1@terrahq.com");
    expect(tally(m)).toEqual({ A: 1, B: 0, C: 0 });
    expect(userVote(m, "u1@terrahq.com")).toBe("A");
  });

  it("changing a vote moves it without double-counting", () => {
    let m = castVote(votingMonth(), "A", "u1@terrahq.com");
    m = castVote(m, "B", "u1@terrahq.com");
    expect(tally(m)).toEqual({ A: 0, B: 1, C: 0 });
    expect(userVote(m, "u1@terrahq.com")).toBe("B");
  });

  it("rejects votes when not in voting phase", () => {
    const draft = addCandidate(createMonth("2026-07"), a);
    expect(() => castVote(draft, "A", "u1@terrahq.com")).toThrow(/not open/);
  });

  it("rejects a vote for a non-candidate", () => {
    expect(() => castVote(votingMonth(), "Z", "u1@terrahq.com")).toThrow(/not a candidate/);
  });
});

describe("closeMonth", () => {
  it("picks the unique top candidate", () => {
    let m = votingMonth();
    m = castVote(m, "A", "u1@terrahq.com");
    m = castVote(m, "A", "u2@terrahq.com");
    m = castVote(m, "B", "u3@terrahq.com");
    const closed = closeMonth(m, NOW);
    expect(closed.phase).toBe("closed");
    expect(closed.winnerBookId).toBe("A");
  });

  it("errors on a tie without an explicit winner", () => {
    let m = votingMonth();
    m = castVote(m, "A", "u1@terrahq.com");
    m = castVote(m, "B", "u2@terrahq.com");
    expect(() => closeMonth(m, NOW)).toThrow(/Tie/);
  });

  it("accepts an explicit winner to break a tie", () => {
    let m = votingMonth();
    m = castVote(m, "A", "u1@terrahq.com");
    m = castVote(m, "B", "u2@terrahq.com");
    const closed = closeMonth(m, NOW, "B");
    expect(closed.winnerBookId).toBe("B");
  });

  it("rejects an explicit winner that is not a candidate", () => {
    let m = votingMonth();
    m = castVote(m, "A", "u1@terrahq.com");
    expect(() => closeMonth(m, NOW, "Z")).toThrow(/not a candidate/);
  });

  it("refuses to close with no votes", () => {
    expect(() => closeMonth(votingMonth(), NOW)).toThrow(/no votes/);
  });
});
