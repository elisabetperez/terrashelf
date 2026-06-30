import { readJSON, writeJSON } from "@/lib/blobs";
import { listMonths, displayLabel } from "@/lib/months";
import { listMessages } from "@/lib/chat";
import { profileKey } from "@/lib/profiles";

const STORE = "notif";
const EPOCH = "1970-01-01T00:00:00.000Z";

export type Mention = {
  month: string; // period id
  periodLabel: string;
  messageId: string;
  author: string;
  text: string;
  createdAt: string;
};

// ---- Pure logic (unit-tested) ----

/** The handle used to @mention an email (its local part, sanitized). */
export function handleFromEmail(email: string): string {
  return (email.split("@")[0] || "").toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

/** Lowercased, de-duplicated handles mentioned in a message. */
export function textMentions(text: string): string[] {
  const out = new Set<string>();
  const re = /@([a-zA-Z0-9._-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.add(m[1].toLowerCase());
  return [...out];
}

export function isUnread(mention: Mention, lastSeenAt: string): boolean {
  return mention.createdAt > lastSeenAt;
}

// ---- Persistence ----

export async function getLastSeen(email: string): Promise<string> {
  const data = await readJSON<{ lastSeenAt?: string } | null>(STORE, profileKey(email), null);
  return data?.lastSeenAt ?? EPOCH;
}

export async function markSeen(email: string, now: string): Promise<void> {
  await writeJSON(STORE, profileKey(email), { lastSeenAt: now });
}

/** All messages across all periods that @mention this user (newest first). */
export async function collectMentions(email: string, limit = 50): Promise<Mention[]> {
  const handle = handleFromEmail(email);
  if (!handle) return [];
  const months = await listMonths();
  const all: Mention[] = [];
  for (const month of months) {
    const messages = await listMessages(month.id);
    for (const msg of messages) {
      if (msg.author === email) continue; // don't notify on your own mentions
      if (textMentions(msg.text).includes(handle)) {
        all.push({
          month: month.id,
          periodLabel: displayLabel(month),
          messageId: msg.id,
          author: msg.author,
          text: msg.text,
          createdAt: msg.createdAt,
        });
      }
    }
  }
  all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return all.slice(0, limit);
}
