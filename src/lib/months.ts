import type { BookRef } from "@/lib/books";
import { readJSON, writeJSON, listKeys, deleteJSON } from "@/lib/blobs";

export type Phase = "draft" | "voting" | "closed";

export type Month = {
  id: string; // "2026-07"
  phase: Phase;
  candidates: BookRef[];
  votes: Record<string, string[]>; // bookId -> emails
  winnerBookId: string | null;
  openedAt: string | null;
  closedAt: string | null;
};

const STORE = "months";
const MONTH_ID_RE = /^\d{4}-\d{2}$/;

// ---- Pure logic (unit-tested) ----

/** Current month id ("YYYY-MM") for a given date. */
export function currentMonthId(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function isValidMonthId(id: string): boolean {
  return MONTH_ID_RE.test(id);
}

export function createMonth(id: string): Month {
  if (!isValidMonthId(id)) throw new Error("Invalid month id (expected YYYY-MM)");
  return { id, phase: "draft", candidates: [], votes: {}, winnerBookId: null, openedAt: null, closedAt: null };
}

export function addCandidate(month: Month, ref: BookRef): Month {
  if (month.phase !== "draft") throw new Error("Candidates can only be added while the month is a draft");
  if (month.candidates.some((c) => c.id === ref.id)) return month;
  return { ...month, candidates: [...month.candidates, ref] };
}

export function removeCandidate(month: Month, bookId: string): Month {
  if (month.phase !== "draft") throw new Error("Candidates can only be removed while the month is a draft");
  return { ...month, candidates: month.candidates.filter((c) => c.id !== bookId) };
}

export function openVoting(month: Month, now: string): Month {
  if (month.phase !== "draft") throw new Error("Only a draft month can open voting");
  if (month.candidates.length < 2) throw new Error("Need at least 2 candidates to open voting");
  return { ...month, phase: "voting", openedAt: now };
}

/** Cast or change a member's vote. One vote per member for the whole month. */
export function castVote(month: Month, bookId: string, email: string): Month {
  if (month.phase !== "voting") throw new Error("Voting is not open");
  if (!month.candidates.some((c) => c.id === bookId)) throw new Error("That book is not a candidate");
  const votes: Record<string, string[]> = {};
  // Remove the member from every candidate first (so changing a vote doesn't double-count).
  for (const [id, emails] of Object.entries(month.votes)) {
    const filtered = emails.filter((e) => e !== email);
    if (filtered.length) votes[id] = filtered;
  }
  votes[bookId] = [...(votes[bookId] ?? []), email];
  return { ...month, votes };
}

/** Vote tally: bookId -> count. */
export function tally(month: Month): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of month.candidates) out[c.id] = month.votes[c.id]?.length ?? 0;
  return out;
}

/** The candidate id this member currently votes for, or null. */
export function userVote(month: Month, email: string): string | null {
  for (const [id, emails] of Object.entries(month.votes)) {
    if (emails.includes(email)) return id;
  }
  return null;
}

/** Total number of votes cast. */
export function totalVotes(month: Month): number {
  return Object.values(month.votes).reduce((n, emails) => n + emails.length, 0);
}

/**
 * Close voting and set the winner.
 * - No votes at all -> error.
 * - With an explicit winnerBookId, it must be a candidate (used to break ties).
 * - Otherwise the unique top candidate wins; a tie without an explicit choice errors.
 */
export function closeMonth(month: Month, now: string, explicitWinnerId?: string): Month {
  if (month.phase !== "voting") throw new Error("Only a month in voting can be closed");
  if (totalVotes(month) === 0) throw new Error("Cannot close a month with no votes");

  const counts = tally(month);
  if (explicitWinnerId) {
    if (!month.candidates.some((c) => c.id === explicitWinnerId)) {
      throw new Error("Chosen winner is not a candidate");
    }
    return { ...month, phase: "closed", winnerBookId: explicitWinnerId, closedAt: now };
  }

  const max = Math.max(...Object.values(counts));
  const top = Object.keys(counts).filter((id) => counts[id] === max);
  if (top.length > 1) {
    throw new Error("Tie — choose a winner among the tied candidates");
  }
  return { ...month, phase: "closed", winnerBookId: top[0], closedAt: now };
}

export function winnerBook(month: Month): BookRef | null {
  if (!month.winnerBookId) return null;
  return month.candidates.find((c) => c.id === month.winnerBookId) ?? null;
}

// ---- Persistence ----

export async function getMonth(id: string): Promise<Month | null> {
  if (!isValidMonthId(id)) return null;
  return readJSON<Month | null>(STORE, id, null);
}

export async function saveMonth(month: Month): Promise<void> {
  await writeJSON(STORE, month.id, month);
}

export async function deleteMonth(id: string): Promise<void> {
  await deleteJSON(STORE, id);
}

export async function listMonths(): Promise<Month[]> {
  const keys = (await listKeys(STORE)).filter(isValidMonthId);
  const months = await Promise.all(keys.map((k) => getMonth(k)));
  return months.filter((m): m is Month => m !== null).sort((a, b) => b.id.localeCompare(a.id));
}
