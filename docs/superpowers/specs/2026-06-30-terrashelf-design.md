# TerraShelf — Design Spec

**Date:** 2026-06-30
**Status:** Approved for planning
**Author:** eli@terrahq.com

A book-club social network for the terrahq.com team. Each month the club votes on a
book to read, members join the chosen book, chat about it, and propose future reads
through a suggestion box. Built and deployed exactly like the `Andres-PTO-episodes`
project: Astro SSR on Netlify with Netlify Blobs as the datastore.

All UI copy, labels, and URLs are in **English**.

---

## 1. Goals & non-goals

**Goals**
- Authenticated, terrahq.com-only club with a single admin (eli@terrahq.com).
- Monthly cycle: suggestions → admin picks candidates → members vote → admin closes → winner becomes "book of the month".
- Per-month book chat and join/leave membership for the winning book.
- A global suggestion box with an "interested" signal to help the admin pick candidates.

**Non-goals (for now)**
- No real-time websockets (chat uses light polling).
- No public/unauthenticated access.
- No mobile app; responsive web only.
- History pages (`/months`, `/month/[id]`) are deferred to a later iteration.

---

## 2. Stack & deployment

Mirrors `Andres-PTO-episodes`:

- **Astro 5**, `output: "server"`, `@astrojs/netlify` adapter.
- **`@netlify/blobs`** as the key/value datastore, with a local filesystem fallback
  (`.netlify/blobs-local`) so `netlify dev` works without cloud Blobs.
- **SCSS** — copy the existing SCSS framework (`src/assets/sass/framework/**`) and add
  new component styles; design tokens in a `_terrashelf-tokens.scss`.
- **Vitest** for unit tests on the `lib/` modules.
- **netlify.toml**: `command = "npm run test && npm run build"`, `publish = "dist"`,
  `NODE_VERSION = "20"`.
- Deploy: connect repo to Netlify; every push to `main` rebuilds and deploys.

**Environment variables** (`.env.example`):
```
SESSION_SECRET=replace-with-32-random-bytes-in-base64
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
ALLOWED_EMAIL=terrahq.com          # domain-only: any @terrahq.com Google account
ADMIN_EMAILS=eli@terrahq.com       # comma-separated admin allow-list
```

---

## 3. Authentication & authorization

Reused almost verbatim from the reference project:

- **Login**: Google OAuth (`/api/auth/google/start` → Google → `/api/auth/google/callback`).
  On success we verify the ID token, check `email_verified`, check the email matches
  `ALLOWED_EMAIL` (domain match because the value has no `@`), then issue an
  HMAC-signed session cookie (`terrashelf_session`, 60-day TTL).
- **`lib/auth.ts`**: `signSession` / `verifySession` (HMAC-SHA256, base64url) and
  `isAdminEmail(email, ADMIN_EMAILS)`. Reused unchanged except cookie name.
- **`lib/audit.ts`**: records logins (email, ip, ua, timestamp) for the admin panel. Reused.
- **Gate**: every page renders the `AuthGate` component instead of content when there's
  no valid session. Every API route returns `401` without a valid session, and
  admin-only routes return `403` when the session email isn't in `ADMIN_EMAILS`.

---

## 4. Domain model (Netlify Blobs)

A shared `BookRef` shape is embedded wherever a book is referenced:

```ts
type BookRef = {
  id: string;        // stable id we assign (derived from olKey)
  olKey: string;     // Open Library work key, e.g. "/works/OL12345W"
  title: string;
  author: string;    // first/primary author, joined if several
  coverUrl: string;  // Open Library cover URL ("" if none)
};
```

### Store `suggestions`
Global suggestion box. One blob holds the list (key `all`).
```ts
type Suggestion = BookRef & {
  suggestedBy: string;     // email
  createdAt: string;       // ISO
  interested: string[];    // emails who clicked "interested"
};
```
- Duplicate guard: a book already suggested (same `olKey`) cannot be added twice.

### Store `months`
One blob per month, key `YYYY-MM`.
```ts
type Phase = "draft" | "voting" | "closed";
type Month = {
  id: string;                       // "2026-07"
  phase: Phase;
  candidates: BookRef[];            // chosen by admin
  votes: Record<string, string[]>;  // bookId -> emails (one vote per user across the month)
  winnerBookId: string | null;      // set when phase === "closed"
  openedAt: string | null;          // ISO, when voting opened
  closedAt: string | null;          // ISO, when closed
};
```

### Store `memberships`
Per month, key `YYYY-MM` → `string[]` of emails who joined the winning book.

### Store `chat`
Per month, key `YYYY-MM` → `Message[]`.
```ts
type Message = { id: string; author: string; text: string; createdAt: string };
```
- `MAX_MESSAGE_CHARS = 280`.

### Store `audit`
Login/visit log (reused from reference).

---

## 5. Monthly cycle rules

1. **Suggest** — any logged-in member adds books to the suggestion box via the Open
   Library search, and toggles "interested" on any suggestion.
2. **Assemble candidates** — admin creates the month (starts in `draft`) and adds
   candidates, either picked from suggestions or searched directly. Candidates are
   `BookRef`s embedded in the month.
3. **Open voting** — admin moves the month to `voting`. Members can now vote.
4. **Vote** — exactly **one vote per member** for the whole month; a member may
   **change** their vote freely while `phase === "voting"`. Votes are rejected when the
   month is not in `voting`. Vote tallies are visible to everyone.
5. **Close** — admin closes the month. The candidate with the most votes wins
   (`phase → "closed"`, `winnerBookId` set).
   - **Tie**: closing requires the admin to pick the winner among the tied candidates
     (the close action accepts an optional explicit `winnerBookId`; if omitted and there
     is a unique top candidate, that one wins; if omitted and there's a tie, the action
     errors asking the admin to choose).
   - **No votes**: a month with zero votes cannot be closed (error).
6. **Read & chat** — once `closed`, members can **join/leave** the winning book and use
   the month's **chat**.

`lib/months.ts` owns this state machine and is the most heavily tested module.

---

## 6. Pages (MVP = lean)

Built now:
- **`/`** — the current month (current calendar month).
  - `voting`: candidate cards (cover, title, author), live vote counts, the member's
    current vote highlighted, click to cast/change vote.
  - `closed`: the book-of-the-month hero, join/leave button + member count, and the
    chat panel (light polling ~5s).
  - `draft` / not-yet-created: a friendly "voting hasn't opened yet" state.
- **`/suggestions`** — the suggestion box: an Open Library search-and-add box, plus the
  list of existing suggestions with author, cover, who suggested it, and an
  "interested" toggle with count.
- **`/admin`** — admin-only: create month, add/remove candidates (from suggestions or
  search), open voting, close voting (with winner/tie handling), and the login log.

Deferred (later iteration): **`/months`** (archive grid) and **`/month/[id]`** (any
month's detail). The MVP keeps everything for the current month on `/`.

`AuthGate` replaces page content for unauthenticated visitors.

---

## 7. API routes

All under `src/pages/api/`. JSON in/out. Session required unless noted; admin routes
require an admin session.

- `GET  /api/auth/google/start` — begin OAuth (reused).
- `GET  /api/auth/google/callback` — finish OAuth, set session (reused).
- `POST /api/logout` — clear session (reused).
- `GET  /api/openlibrary/search?q=` — server-side proxy to Open Library search; returns
  a normalized list of `BookRef` candidates (title, author, olKey, coverUrl).
- `GET  /api/suggestions` — list suggestions (+ `me` email).
- `POST /api/suggestions` — add a suggestion `{ olKey, title, author, coverUrl }`.
- `DELETE /api/suggestions?id=` — delete (own suggestion, or admin).
- `POST /api/suggestions/interest` — toggle "interested" `{ id }`.
- `GET  /api/month?id=YYYY-MM` — fetch a month (defaults to current); includes
  `me`, `isAdmin`, and the member's current vote.
- `POST /api/vote` — cast/change vote `{ month, bookId }` (voting phase only).
- `POST /api/membership` — toggle join `{ month }` (closed phase only).
- `GET  /api/chat?month=YYYY-MM` — list messages (+ `me`, `isAdmin`).
- `POST /api/chat` — add message `{ month, text }` (closed phase only).
- `DELETE /api/chat?month=&id=` — delete (own message, or admin).
- `POST /api/admin/month` — admin actions: `create`, `addCandidate`, `removeCandidate`,
  `openVoting`, `close` (with optional `winnerBookId`). Admin only.

---

## 8. `lib/` modules

Pure logic + Blobs persistence, each independently testable, following the reference's
local-fallback pattern (`isMissingBlobsEnv` → read/write `.netlify/blobs-local`).

- `auth.ts` — HMAC sessions + `isAdminEmail` (reused, cookie renamed).
- `audit.ts` — login/visit log (reused).
- `books.ts` — `BookRef` type and helpers (id derivation from `olKey`).
- `openlibrary.ts` — `searchBooks(query)`: fetch Open Library, map to `BookRef[]`,
  build cover URLs, handle missing fields. Pure mapping function is unit-tested with a
  fixture; the fetch is thin.
- `suggestions.ts` — `list`, `add` (dedupe by `olKey`), `remove` (own/admin),
  `toggleInterest`.
- `months.ts` — `getMonth`, `currentMonthId`, `createMonth`, `addCandidate`,
  `removeCandidate`, `openVoting`, `castVote` (one-per-user, change allowed, phase
  guard), `close` (winner selection + tie + no-votes rules). The state machine.
- `membership.ts` — `getMembers`, `toggleMember` (closed phase only).
- `chat.ts` — `list`, `add` (≤280 chars, closed phase only), `delete` (own/admin).

---

## 9. Tests (Vitest)

- **auth**: `signSession`/`verifySession` round-trip, tampered/expired token rejected,
  `isAdminEmail` matching.
- **openlibrary**: mapping a sample Open Library response to `BookRef[]` (missing
  author/cover handled).
- **suggestions**: add, dedupe by `olKey`, remove own vs admin, interest toggle on/off.
- **months**:
  - `castVote` records one vote, changing the vote moves it (no double-count), voting
    blocked when not in `voting`.
  - `close` picks the unique top candidate; tie without explicit winner errors; tie with
    explicit `winnerBookId` succeeds; zero votes errors.
  - phase transitions (`draft → voting → closed`) enforce valid order.
- **membership**: toggle join on/off; blocked unless `closed`.
- **chat**: add (length limit, phase guard), delete own vs admin vs forbidden.

---

## 10. Styling

- Copy the SCSS framework folder from the reference project unchanged.
- New `_terrashelf-tokens.scss` for the book-club palette/typography.
- New component styles under `src/assets/sass/components/` for: auth gate, book card,
  candidate/voting grid, book-of-the-month hero, suggestion list, chat panel, admin panel.
- BEM-ish class naming consistent with the reference (`c--<component>-a`).

---

## 11. Open follow-ups (post-MVP)

- `/months` archive + `/month/[id]` detail pages.
- Optional automatic month close by calendar date.
- Optional reactions on chat messages (the reference's reactions pattern can be lifted).
