import type { BookRef } from "@/lib/books";
import { readJSON, writeJSON, listKeys } from "@/lib/blobs";

export type Profile = {
  email: string;
  displayName: string;
  goodreadsUrl: string; // "" when unset
  bio: string;
  avatarUrl: string; // "" when unset; a data: URL or http(s) URL
  topBooks: BookRef[]; // up to 3
  updatedAt: string; // ISO
};

export const MAX_TOP_BOOKS = 3;
export const MAX_BIO_CHARS = 280;
export const MAX_AVATAR_CHARS = 400_000; // ~300KB data URL ceiling

const STORE = "profiles";

export type ProfileInput = {
  displayName?: string;
  goodreadsUrl?: string;
  bio?: string;
  avatarUrl?: string;
  topBooks?: BookRef[];
};

/** Accent colors (CSS custom properties) used to tint member cards. */
export const ACCENT_VARS = [
  "var(--pink)",
  "var(--orange)",
  "var(--blue)",
  "var(--green)",
  "var(--coral)",
  "var(--lime)",
  "var(--gold)",
] as const;

/** Stable pseudo-random accent for any key — looks scattered, never flickers. */
export function accentForKey(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ACCENT_VARS[h % ACCENT_VARS.length];
}

/** Stable accent for a member, keyed by email. */
export function accentForEmail(email: string): string {
  return accentForKey(email);
}

// ---- Pure logic (unit-tested) ----

/** Default profile for an email with no saved profile yet. */
export function emptyProfile(email: string, now: string): Profile {
  return {
    email,
    displayName: nameFromEmail(email),
    goodreadsUrl: "",
    bio: "",
    avatarUrl: "",
    topBooks: [],
    updatedAt: now,
  };
}

export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function validGoodreadsUrl(url: string): boolean {
  if (!url) return true; // optional
  try {
    const u = new URL(url);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.endsWith("goodreads.com");
  } catch {
    return false;
  }
}

function validAvatar(url: string): boolean {
  if (!url) return true; // optional
  if (url.length > MAX_AVATAR_CHARS) return false;
  return /^data:image\/(png|jpe?g|webp|gif);base64,/.test(url) || /^https?:\/\//.test(url);
}

/** Apply user-supplied input to a profile, validating and clamping. */
export function applyProfileInput(current: Profile, input: ProfileInput, now: string): Profile {
  const goodreadsUrl = (input.goodreadsUrl ?? current.goodreadsUrl).trim();
  if (!validGoodreadsUrl(goodreadsUrl)) {
    throw new Error("Goodreads URL must be a valid goodreads.com link");
  }
  const bio = (input.bio ?? current.bio).trim();
  if (bio.length > MAX_BIO_CHARS) {
    throw new Error(`Bio exceeds ${MAX_BIO_CHARS} characters`);
  }
  const avatarUrl = (input.avatarUrl ?? current.avatarUrl).trim();
  if (!validAvatar(avatarUrl)) {
    throw new Error("Photo must be an image (under ~300KB)");
  }
  const displayName = (input.displayName ?? current.displayName).trim() || nameFromEmail(current.email);
  const topBooks = (input.topBooks ?? current.topBooks).slice(0, MAX_TOP_BOOKS);
  return { ...current, displayName, goodreadsUrl, bio, avatarUrl, topBooks, updatedAt: now };
}

// ---- Persistence ----

export async function getProfile(email: string): Promise<Profile | null> {
  return readJSON<Profile | null>(STORE, profileKey(email), null);
}

export async function saveProfile(profile: Profile): Promise<void> {
  await writeJSON(STORE, profileKey(profile.email), profile);
}

export async function listProfiles(): Promise<Profile[]> {
  const keys = await listKeys(STORE);
  const profiles = await Promise.all(keys.map((k) => readJSON<Profile | null>(STORE, k, null)));
  return profiles
    .filter((p): p is Profile => p !== null)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** Blob-safe key from an email. */
export function profileKey(email: string): string {
  return email.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

export type ReaderCard = { email: string; displayName: string; avatarUrl: string };

/** Map a list of emails to lightweight reader cards (name + avatar). */
export async function readerCards(emails: string[]): Promise<ReaderCard[]> {
  return Promise.all(
    emails.map(async (email) => {
      const p = await getProfile(email);
      return {
        email,
        displayName: p?.displayName ?? nameFromEmail(email),
        avatarUrl: p?.avatarUrl ?? "",
      };
    })
  );
}
