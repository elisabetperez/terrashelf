import { readJSON, writeJSON } from "@/lib/blobs";

const STORE = "memberships";

// ---- Pure logic (unit-tested) ----

/** Toggle a member into/out of the join list. */
export function toggleMember(list: string[], email: string): string[] {
  return list.includes(email) ? list.filter((e) => e !== email) : [...list, email];
}

// ---- Persistence ----

export async function getMembers(monthId: string): Promise<string[]> {
  return readJSON<string[]>(STORE, monthId, []);
}

export async function saveMembers(monthId: string, list: string[]): Promise<void> {
  await writeJSON(STORE, monthId, list);
}
