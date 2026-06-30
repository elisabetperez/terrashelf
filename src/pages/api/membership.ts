import type { APIRoute } from "astro";
import { getSession, unauthorized, json } from "@/lib/session";
import { getMonth } from "@/lib/months";
import { getMembers, saveMembers, toggleMember } from "@/lib/membership";

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = getSession(cookies);
  if (!session) return unauthorized();
  const { month } = (await request.json().catch(() => ({}))) as { month?: string };
  if (!month) return json({ error: "Missing month" }, 400);

  const m = await getMonth(month);
  if (!m || m.phase !== "closed") return json({ error: "No book of the month yet" }, 400);

  const updated = toggleMember(await getMembers(month), session.email);
  await saveMembers(month, updated);
  return json({ members: updated, joined: updated.includes(session.email) });
};
