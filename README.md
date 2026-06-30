# TerraShelf

The terrahq.com book club — a small social network for reading together. Each month
the club votes on a book, members join the chosen read and chat about it, and everyone
proposes future books through a suggestion box. There's also a members directory where
each person shows their Goodreads and all-time top 3.

Astro (SSR) + Netlify, with Netlify Blobs as the datastore. Same shape as the
`Andres-PTO-episodes` project.

## Features

- **Google login**, restricted to `@terrahq.com`. `eli@terrahq.com` is the admin.
- **Monthly cycle**: suggestions → admin picks candidates → members vote → admin closes
  → winner becomes the book of the month.
- **One vote per member** per month, changeable while voting is open.
- **Join/leave** the book of the month and a **live chat** (light polling) for it.
- **Suggestion box** with an "interested" signal.
- **Member profiles**: display name, Goodreads URL, short bio, and a top-3 shelf.

## Local development

```bash
npm install
npm run dev          # http://localhost:4321
```

No Google OAuth needed locally: a **dev login** (enabled by `DEV_LOGIN_ENABLED=true` in
`.env`, dev builds only) lets you sign in as any `@terrahq.com` address. As admin
(`eli@terrahq.com`) go to **Admin** to create the month, add candidates, and open voting.

Data is stored in Netlify Blobs, emulated locally by `astro dev`.

## Tests

```bash
npm run test         # Vitest — pure logic in src/lib
```

## Deploy (Netlify)

1. Push this repo and connect it to a Netlify site.
2. In **Site settings → Environment variables** add:
   - `SESSION_SECRET` — 32 random bytes (`openssl rand -base64 32`).
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — from a Google OAuth client whose
     redirect URI is `https://<your-site>/api/auth/google/callback`.
   - `ALLOWED_EMAIL=terrahq.com`
   - `ADMIN_EMAILS=eli@terrahq.com`
   - (Do **not** set `DEV_LOGIN_ENABLED` in production.)
3. Every push to `main` runs the tests and deploys (`npm run test && npm run build`).

## Structure

- `src/lib/` — pure domain logic + Blobs persistence (auth, months, suggestions,
  membership, chat, profiles, openlibrary). Unit-tested.
- `src/pages/` — pages (`/`, `/suggestions`, `/members`, `/profile`, `/admin`) and the
  `api/` routes.
- `src/components/` — `Layout` (chrome + auth gate) and `AuthGate`.
- `src/styles/global.css` — white theme, pink-led accent palette.
- `docs/superpowers/specs/` — the design spec.
