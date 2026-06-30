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
  setSchedule,
  displayLabel,
  scheduleText,
  pickActive,
  monthName,
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

describe("schedule & labels", () => {
  it("sets a custom label and reading-period dates not tied to day 1", () => {
    const m = setSchedule(createMonth("2026-06"), { label: "Summer read", startDate: "2026-06-15", endDate: "2026-07-15" });
    expect(m.label).toBe("Summer read");
    expect(m.startDate).toBe("2026-06-15");
    expect(displayLabel(m)).toBe("Summer read");
    expect(scheduleText(m)).toBe("Jun 15 – Jul 15");
  });

  it("falls back to the month name when no label is set", () => {
    expect(displayLabel(createMonth("2026-06"))).toBe(monthName("2026-06"));
    expect(monthName("2026-06")).toBe("June 2026");
    expect(scheduleText(createMonth("2026-06"))).toBeNull();
  });

  it("rejects a malformed date and an inverted range", () => {
    expect(() => setSchedule(createMonth("2026-06"), { startDate: "15-06-2026" })).toThrow(/YYYY-MM-DD/);
    expect(() => setSchedule(createMonth("2026-06"), { startDate: "2026-07-01", endDate: "2026-06-01" })).toThrow(/on or before/);
  });
});

describe("pickActive", () => {
  const m = (id: string, phase: Month["phase"]): Month => ({ ...createMonth(id), phase });
  it("prefers voting, then most recent closed, then draft", () => {
    expect(pickActive([m("2026-05", "closed"), m("2026-06", "voting")])?.id).toBe("2026-06");
    expect(pickActive([m("2026-05", "closed"), m("2026-06", "closed")])?.id).toBe("2026-06");
    expect(pickActive([m("2026-06", "draft")])?.id).toBe("2026-06");
    expect(pickActive([])).toBeNull();
  });
});
