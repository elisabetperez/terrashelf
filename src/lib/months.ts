import type { BookRef } from "@/lib/books";
import { readJSON, writeJSON, listKeys, deleteJSON } from "@/lib/blobs";

export type Phase = "draft" | "voting" | "closed";

export type Month = {
  id: string; // "2026-07" — the storage key / identity
  phase: Phase;
  candidates: BookRef[];
  votes: Record<string, string[]>; // bookId -> emails
  winnerBookId: string | null;
  openedAt: string | null;
  closedAt: string | null;
  label: string | null; // optional custom name, e.g. "Summer read"
  startDate: string | null; // optional YYYY-MM-DD reading-period start (need not be day 1)
  endDate: string | null; // optional YYYY-MM-DD reading-period end
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
  return {
    id,
    phase: "draft",
    candidates: [],
    votes: {},
    winnerBookId: null,
    openedAt: null,
    closedAt: null,
    label: null,
    startDate: null,
    endDate: null,
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Update the optional label and reading-period dates. Undefined leaves a field unchanged. */
export function setSchedule(
  month: Month,
  input: { label?: string; startDate?: string; endDate?: string }
): Month {
  const norm = (d?: string) => {
    if (d === undefined) return undefined;
    const t = d.trim();
    if (!t) return null;
    if (!DATE_RE.test(t)) throw new Error("Dates must be YYYY-MM-DD");
    return t;
  };
  const startDate = norm(input.startDate);
  const endDate = norm(input.endDate);
  if (startDate && endDate && startDate > endDate) {
    throw new Error("Start date must be on or before the end date");
  }
  return {
    ...month,
    label: input.label !== undefined ? input.label.trim() || null : month.label,
    startDate: startDate !== undefined ? startDate : month.startDate,
    endDate: endDate !== undefined ? endDate : month.endDate,
  };
}

/** Human month name from an id, e.g. "June 2026". */
export function monthName(id: string): string {
  if (!isValidMonthId(id)) return id;
  return new Date(id + "-01T00:00:00Z").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Display label: the custom label if set, otherwise the month name. */
export function displayLabel(month: Pick<Month, "id" | "label">): string {
  return month.label || monthName(month.id);
}

/** A short "Jun 15 – Jul 15" reading-period string, or null when no dates are set. */
export function scheduleText(month: Pick<Month, "startDate" | "endDate">): string | null {
  if (!month.startDate && !month.endDate) return null;
  const f = (d: string) =>
    new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  if (month.startDate && month.endDate) return `${f(month.startDate)} – ${f(month.endDate)}`;
  if (month.startDate) return `from ${f(month.startDate)}`;
  return `until ${f(month.endDate!)}`;
}

/**
 * The "active" period for the home page, by status rather than the calendar:
 * a month in voting wins; otherwise the most recent closed; otherwise the most
 * recent draft. Recency is by startDate when set, else by id.
 */
export function pickActive(months: Month[]): Month | null {
  const order = (a: Month, b: Month) => (b.startDate ?? b.id).localeCompare(a.startDate ?? a.id);
  const inPhase = (p: Phase) => months.filter((m) => m.phase === p).sort(order);
  return inPhase("voting")[0] ?? inPhase("closed")[0] ?? inPhase("draft")[0] ?? null;
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
