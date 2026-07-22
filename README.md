# Golf Society & Handicap Tracker

Status: **All 7 phases of the roadmap in `SPEC.md` are complete.**

- ✅ Phase 1 — Next.js (App Router, TS) project skeleton, Tailwind + Shadcn-style
  UI primitives, full Supabase SQL migrations for every table, hand-written
  DB types.
- ✅ Phase 2 — PIN hashing (`lib/auth.ts`), `/register`, `/login` with a
  searchable player selector + numeric PIN keypad, session middleware,
  admin route gating, login rate-limiting.
- ✅ Phase 3 — pure golf math module (`lib/golf-math.ts`): stroke allocation
  (18- and 9-hole), net score + Stableford points, course-rate-based
  handicap adjustment. Vitest unit tests in `lib/__tests__/golf-math.test.ts`.
- ✅ Phase 4 — course management (`/courses`, `/courses/new`,
  `/courses/[id]/edit`): 9/18 hole toggle, cut/increase rate inputs, a
  scorecard-style hole grid with live par-total display, and full
  client + server validation of the stroke-index permutation
  (`lib/course-validation.ts`, unit tested).
- ✅ Phase 5 — scorecard entry (`/rounds/new`): course/tee/round-type
  selection, a dynamic hole grid sized to the chosen round type
  (`lib/round-setup.ts`, unit tested), and a live Stableford + estimated
  handicap-change preview computed with the same `lib/golf-math.ts` used
  server-side. Submits as `pending_approval`; `/rounds/[id]` shows the
  saved scorecard with its status.
- ✅ Phase 6 — admin approval queue (`/admin/approvals`): lists pending
  scorecards oldest-first; clicking one opens the existing `/rounds/[id]`
  detail view (reused rather than duplicated) with an admin panel to
  approve, override the proposed handicap change and approve, or reject.
  Approve/reject run as atomic Postgres functions
  (`supabase/migrations/0008_approval_functions.sql`) — status update,
  `players.current_handicap` update, and the `handicap_history` insert all
  happen in one transaction, and re-check the scorecard is still pending
  before acting (so two admins can't double-approve the same round).
- ✅ Phase 7 — player profiles (`/players`, `/players/[id]`) with a
  handicap timeline chart (recharts) that back-calculates a sensible
  starting point from the first approved round, and a society-wide rounds
  feed (`/rounds`) showing every logged round with a status badge. See
  "A deliberate access-control change" below — this phase relaxed who can
  view a scorecard's detail page.

## 1. Install dependencies

```bash
npm install
```

## 2. Get a Postgres database

Two options — pick one:

### Option A: Local Postgres via Docker (recommended for offline-friendly dev)

Needs [Docker](https://docs.docker.com/desktop/) or Docker Engine running
(on a Chromebook's Linux/Crostini container, `sudo apt install docker.io`
then add yourself to the `docker` group works fine — see note at the bottom
of this section). No hosted Supabase project needed; this runs Postgres +
PostgREST entirely on your machine.

```bash
npx supabase start
```

The Supabase CLI (installed as a devDependency, so `npx` finds it without a
global install) reads `supabase/config.toml` and `supabase/migrations/`,
which are already set up in this repo — it boots Postgres, applies every
migration, then runs `supabase/seed.sql`. First run pulls Docker images, so
it needs internet once; after that it's fully offline.

When it finishes, it prints something like:

```
API URL: http://127.0.0.1:54321
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
service_role key: eyJhbGciOiJIUzI1NiIs...
Studio URL: http://127.0.0.1:54323
```

Copy the **API URL** and **service_role key** into `.env.local` (step 3).
`Studio URL` is a local web GUI for browsing your tables — handy for
checking data without writing SQL.

To stop it: `npx supabase stop`. To wipe and re-run migrations + seed from
scratch: `npx supabase db reset`.

Auth/Storage/Realtime containers are disabled in `supabase/config.toml`
since this app doesn't use them (custom PIN auth, no file storage) — that
keeps the container count down, which matters more on a Chromebook than a
desktop.

**Docker on Crostini:** if `docker` isn't already installed:
```bash
sudo apt update && sudo apt install -y docker.io
sudo usermod -aG docker $USER
# log out of the Linux terminal and back in for the group change to apply
```

### Option B: Hosted Supabase project

Create a project at supabase.com, then grab from **Project Settings → API**:
- Project URL
- `service_role` key (⚠️ server-only — never put this in a `NEXT_PUBLIC_*` var
  or ship it to the browser)

Apply migrations with `npx supabase link --project-ref your-project-ref &&
npx supabase db push`, or paste `supabase/migrations/*.sql` (in numeric
order) into the Supabase SQL editor.

## 3. Set environment variables

```bash
cp .env.local.example .env.local
```

Fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from whichever option
you chose above, and generate a `SESSION_SECRET`:

```bash
openssl rand -base64 32
```

## 4. Seed data

`supabase/seed.sql` has a sample course + admin row — the PIN hash in it is
a placeholder, not a real bcrypt hash, so that admin row can't actually log
in as-is. Register a real admin through the app instead (see below) and
manually set their `role` to `'admin'` — in Studio's table editor (Option A)
or the hosted project's table editor (Option B) — since self-registration
always creates `role = 'player'` by design.

**Then log out and log back in as that player.** Role is baked into the
session token at login time, not re-checked from the database on every
request — flipping the database row alone leaves an already-logged-in
session still carrying the old role. This shows up confusingly rather
than obviously: pages that re-query the database directly (like the
dashboard) correctly show admin buttons, but middleware's route
protection reads the role from the session token, not the database, so
clicking through to `/courses`/`/admin/approvals`/`/admin/settings`
silently bounces back to `/dashboard` — it looks like the link does
nothing, when what's actually happening is an instant redirect back to
where you started. Logging out and back in issues a fresh token with the
current database role and fixes it immediately.

## 5. Run the app

```bash
npm run dev
```

Visit `http://localhost:3000` → redirects to `/login` → "Register here" to
create your first player.

## Why RLS is "default deny" rather than per-player policies

This app authenticates players with a 4-digit PIN, not Supabase Auth, so
there's no `auth.uid()` to key row-level policies on. All authorization
happens in Server Actions (`lib/auth.ts`'s `requireSession()` /
`requireAdmin()`) using the service-role Supabase client. RLS is enabled on
every table as a defense-in-depth backstop — see the comment block at the
top of `supabase/migrations/0007_rls_policies.sql` for the full reasoning.

## Testing the golf math module

```bash
npm run test        # run once
npm run test:watch  # watch mode while iterating
```

`lib/golf-math.ts` is pure (no Supabase, no I/O), so it's fully covered by
Vitest unit tests without needing a database running. It has two
assumptions the spec didn't pin down explicitly — both flagged with an
`ASSUMPTION:` comment in the file itself:
- `playing_handicap` is rounded to the nearest whole number (round-half-up)
  before the stroke-allocation formulas run, since those formulas only make
  sense for integers but the column stores decimals.
- Stableford points flatten at 5 for anything better than an albatross
  (net −3), since the spec's table doesn't define a rate beyond that.

## Future-proofing for multi-tenancy (not built — schema only)

If this app is ever sold to multiple societies, there are two very
different shapes that could take:

- **One deployment per customer** (what you have today): each society
  gets their own Vercel project + their own Supabase project. Perfect
  data isolation (different Postgres instances entirely), but doesn't
  scale operationally past a handful of customers — every migration,
  every bug fix, has to be applied to every customer's database
  individually.
- **True multi-tenant**: one deployment, one database, every table
  scoped by a `society_id`. Scales to hundreds of customers on one
  codebase, but the stakes for getting tenant isolation wrong are much
  higher than any bug in a single-tenant app — a missed filter doesn't
  just show a wrong number, it can leak one society's data to another.

`supabase/migrations/0015_future_proof_multi_tenancy.sql` does the cheap
part of preparing for the second option, **without actually building
multi-tenancy**:

- A `societies` table, seeded with exactly one row (today's society, a
  fixed id: `00000000-0000-0000-0000-000000000001`)
- Every existing table gets a `society_id` column, including
  `holes`/`scores`/`handicap_history` where it's technically derivable
  via a join through their parent — duplicated directly onto every row
  anyway so a future RLS policy can check it without a join
- **Every new column has a DEFAULT pointing at that one society**, which
  is what makes this migration a complete no-op for existing code —
  every `.insert()` across the app, none of which mention `society_id`,
  keeps working completely unchanged
- `app_settings`' primary key changed from `key` alone to
  `(society_id, key)`, since settings need to be per-society once a
  second one exists (society A might restrict self-logging, society B
  might not) — re-keying now, with one row, avoids a much more painful
  migration once real per-society settings data exists

**What this deliberately does NOT do** — all real application-layer work
for whenever (if ever) a second society actually exists:
- No RLS policy anywhere actually checks `society_id`. Doing that
  properly needs a per-request session variable set by application code
  (`set_config('app.current_society_id', ...)`), which doesn't exist —
  this app currently does all authorization in code (`requireSession()`/
  `requireAdmin()`), not RLS, for the reasons in
  `0007_rls_policies.sql`. For genuine tenant isolation, RLS as a
  database-level backstop becomes much more valuable than it is
  today — the cost of a missed filter goes from "wrong number displayed"
  to "cross-tenant data exposure."
- No tenant resolution (subdomain routing, a society picker, anything
  that determines "which society is this request for")
- No changes to any server action to filter by `society_id` — every
  query today still implicitly operates over the one society, because
  there's only one
- No platform-admin layer for managing multiple societies (creating one,
  suspending one, seeing usage across all of them) — today's single
  `admin` role is scoped to one society's own data, not a
  vendor-management role
- Registration (`/register`) doesn't ask "which society" — there's
  nowhere else to go

None of that is hard to reason about later — it's real, contained work,
not a rewrite — but it's real work, not schema. This migration just makes
that later work smaller.

### Phase 1 status: tenant resolution (in progress, `feature/multi-tenant` branch)

Built so far, not yet merged to `master`:

- `lib/tenant-resolution.ts` — pure hostname parsing (`extractSubdomain`),
  fully unit tested (`lib/__tests__/tenant-resolution.test.ts`), including
  the two cases that matter most for safety: an unrelated custom domain
  must never be mistaken for a subdomain match, and a domain that merely
  *contains* the root as a substring must never match either.
- `middleware.ts` now resolves a `society_id` from the request's hostname
  on every request, before anything else runs, and forwards it downstream
  as an `x-society-id` header — using `.set()` (not `.append()`), so a
  client sending that header themselves gets silently overwritten, not
  merged. An unrecognized subdomain gets a 404, not a silent fallback to
  the default society — falling back silently there would be exactly the
  kind of cross-tenant bug this whole effort exists to prevent.
- `lib/tenant.ts` — `getCurrentSocietyId()`, reading that header for
  Server Components/Actions to consume. Not called from anywhere yet;
  it's the foundation Phase 3 (query scoping) will build on.
- `PLATFORM_ROOT_DOMAIN` env var (see `.env.local.example`), unset by
  default — every request resolves to the one seeded society regardless,
  which is what makes this entire phase a no-op for the current
  single-tenant deployment.

**How to test this locally**, once you've pulled this branch:
```bash
npm run dev
```
Then in your browser:
- `http://localhost:3000` — unaffected, default society (today's
  behavior, unchanged)
- `http://evs-golf-society.localhost:3000` — resolves the SAME default
  society, by its actual slug, proving the subdomain lookup path works
  end-to-end against the real database
- `http://doesnotexist.localhost:3000` — should 404, proving an unknown
  subdomain is rejected rather than silently falling back

No `PLATFORM_ROOT_DOMAIN` needs to be set for any of this — `*.localhost`
subdomain testing works with zero configuration, per the comments in
`.env.local.example`.

**Not done yet** (Phase 3, still ahead): no query anywhere actually
filters by `society_id`. Every page still shows the same data regardless
of which hostname resolved — that's the next, much larger piece of work.

### Phase 2 status: auth becomes tenant-aware (in progress, `feature/multi-tenant` branch)

Built on top of Phase 1:

- **`SessionPayload` gains `societyId`.** Every session token now encodes
  which society it was issued for, alongside `playerId`/`role`.
- **Cross-tenant session detection.** `lib/auth.ts`'s `getSession()` (and
  `middleware.ts`'s separate, Edge-safe copy of the same check) now
  compares the session's `societyId` against the CURRENT request's
  resolved tenant on every read — not just at login. A session issued for
  Society A presented on a request that resolves to Society B is treated
  exactly like "not logged in," never trusted just because the token
  itself is otherwise valid and unexpired. Fails closed: if the current
  society can't even be determined, the session is treated as invalid
  rather than assumed valid.
- **Registration is tenant-scoped.** `registerPlayer` resolves the
  current request's society and stamps the new player with it explicitly
  — not left to the column's DB default, which only covers the original
  single society.
- **Login verifies tenant match.** `loginPlayer` checks the selected
  player actually belongs to the current tenant before allowing login —
  same generic "Player not found" error either way, so a wrong-tenant
  attempt doesn't leak that the id exists elsewhere.
- **`listPlayersForLogin` is scoped now, not deferred to Phase 3.** This
  is technically a query filter — Phase 3's job in general — but showing
  another tenant's member list in the login dropdown is an auth bug, not
  a general data-scoping one, so it couldn't wait for the broader effort.

**A real, one-time consequence worth knowing before you deploy this
branch anywhere with live sessions:** every token signed before this
change lacks `societyId` and will fail verification once this ships —
anyone currently logged in gets signed out and needs to log in again.
One-time inconvenience, not a bug: there's no safe value to retroactively
assume for an old token.

**Still explicitly NOT done** — this phase covers authentication and
registration specifically, not general data access:
- No other server action checks that the data it's reading/writing
  belongs to the caller's own society — an admin action like adjusting a
  player's handicap doesn't yet verify the target player is in the same
  society as the admin. That's Phase 3.
- **Don't run this app with a second real tenant's data until Phase 3 is
  done.** Phase 1 and 2 make tenant *resolution* and *authentication*
  correct; they don't yet make every *query* correct. A second tenant
  today could still see (or be seen by) the first through any
  unscoped action.

### Phase 3 status: every query scoped by tenant (in progress, `feature/multi-tenant` branch)

This is the big one — every server action that touches `courses`,
`holes`, `scorecards`, `scores`, `handicap_history`, `players`, or
`app_settings` now filters by `society_id`, resolved via
`getCurrentSocietyId()`. Files touched: `app/actions/courses.ts`,
`app/actions/scorecards.ts`, `app/actions/approvals.ts`,
`app/actions/players.ts`, `app/actions/settings.ts`, plus two direct
Supabase queries in `app/dashboard/page.tsx` and `app/rounds/new/page.tsx`
that bypassed the action-file pattern.

**The most important thing this phase found, not just fixed:** every
admin action built on a Postgres RPC function (`approveScorecard`,
`rejectScorecard`, `adjustPlayerHandicap`, `wipePlayerHistory`,
`deleteRound`) operates purely by id, with **no tenant awareness inside
the SQL function itself**. Before this phase, an admin who somehow
obtained another society's scorecard or player id — a leaked URL, a
guessed UUID — could approve, reject, adjust, wipe, or delete data
belonging to a completely different tenant, because the RPC would just
act on whatever id it was given. Every one of these five call sites now
does an explicit `.eq("id", ...).eq("society_id", ...)` ownership check
immediately before calling the RPC, returning "not found" if it doesn't
match — same generic error either way, so a wrong-tenant attempt doesn't
confirm the id exists elsewhere. This is a real vulnerability class this
phase closed, not a theoretical one flagged for later.

**`app_settings`' composite key needed its own fix.** Back in the
future-proofing migration, its primary key changed from `key` alone to
`(society_id, key)` — but `updateSetting`'s `.upsert()` was still using
`onConflict: "key"`, which no longer matches any real constraint on the
table. Easy to miss, since it would only surface once a second tenant
tried to change a setting and the upsert resolved against the wrong
target. Fixed to `onConflict: "society_id,key"`, with `society_id`
included in the upserted row.

**Every list/collection query is scoped** — `listCourses`,
`listCoursesForRound`, `listAllPlayers`, `listPendingScorecards`,
`listSocietyRounds` — these are the ones where a missed filter would be
immediately, visibly wrong (one tenant's course list showing another's
courses). Every single-row lookup by id is scoped too, even where the id
itself is already effectively tenant-safe (e.g. fetching the current
session's own player row) — redundant in some cases, but consistent, so
nothing is "correct by accident" and every query stands on its own.

**What's still worth doing, not done in this pass:**
- The Postgres RPC functions themselves could be hardened to accept and
  verify `p_society_id` internally, as a second layer beneath the
  application-level check — real defense in depth, given how much these
  specific functions can mutate (a handicap value, an entire player's
  history). Not done here because the application-level check already
  closes the actual vulnerability; the DB-level version is a valuable
  follow-up, not an open gap.
- Nothing has been tested yet against a second real tenant with real
  data in the same database. Before merging this branch, seed a second
  test society (a different slug) locally and manually verify each page
  — courses, rounds, approvals, players — genuinely shows only its own
  tenant's data when visited via that tenant's `*.localhost` subdomain.

## Dashboard gross score stats

Every player's dashboard now shows their average gross score and best
round, split by 9 vs 18 holes (a 9-hole total and an 18-hole total aren't
comparable, so they're never averaged together).

Two judgment calls worth knowing about:
- **Only approved rounds count.** Pending/rejected aren't a verified
  score yet.
- **A round with any picked-up hole is excluded entirely**, not just from
  the average but from "best round" too. A picked-up hole means
  `total_gross_stroke_play` only sums the completed holes (see
  `lib/golf-math.ts`'s `summarizeRound`), so it's a partial total, not a
  real, comparable score — including it risked showing an incomplete
  round as someone's "best," which would be actively misleading rather
  than just imprecise.

This uses gross strokes specifically (not Stableford points), per an
explicit choice — the app's main scoring format is Stableford, so this
was worth confirming rather than assuming, since the two tell genuinely
different stories about a round.

## A real production outage, and what it taught

The per-society-branding fix above initially changed how a non-subdomain
hostname (a tenant's own custom domain, plain `localhost`, anything not
matching the platform root domain) resolves — instead of using a fixed,
hardcoded society ID, it started looking up the default society **by
slug**, purely so the display name could come from the same query as the
id. This took `evsgolfsociety.co.uk` down in production: the slug lookup
found nothing, and the whole site 404'd for every hostname that wasn't a
recognized subdomain — including the one production domain guaranteed to
get hit constantly.

Two things got fixed, not just the one that caused the outage:

1. **The default-society fallback resolves by fixed ID again**, not
   slug. A hardcoded UUID can't drift or typo the way a free-text column
   can — `middleware.ts`'s `resolveSociety` now only uses a slug lookup
   for a *real, recognized* tenant subdomain, where "not found" is a
   legitimate, expected outcome the caller should reject. The
   fallback path fails toward one fixed, known-correct id instead.
2. **Negative results are no longer cached for that fallback lookup.**
   Before this, if the default-society lookup failed for *any* transient
   reason (a network blip, a momentary Supabase hiccup), that failure got
   cached for a full minute — meaning the whole site would've stayed
   down even after the underlying cause resolved itself. Caching a
   genuine "this subdomain doesn't exist" for a real tenant lookup is
   still fine and intentional; caching "the one fixed fallback id
   momentarily failed to resolve" is not.

The broader lesson, worth remembering for any future change to this
resolution logic specifically: it's tempting to unify two code paths
(the default case and the real-subdomain case) for the sake of getting
one extra piece of data "for free" from the same query. Here that
elegance came at the cost of removing a resilience property (a fixed,
undriftable identifier for the one path that MUST always resolve) that
existed for a real reason. Any future change here should ask explicitly:
does this still keep the default-society path independent of anything
that could plausibly be wrong, missing, or mistyped?

## Per-society branding: name, not just photo

The hero photo work above left one thing still hardcoded: the "back to
home" link at the top of every page, the login page's displayed name,
and the browser tab title / social-preview metadata all read a single
`SOCIETY_NAME` constant (`lib/branding.ts`, now deleted) — so every
tenant's pages showed "EVs Golf Society" regardless of which society was
actually being viewed.

Fixed by reading `societies.name` per-request instead:

- `middleware.ts` now resolves the society's `name` alongside its `id`
  and forwards it as a second request header (`x-society-name`,
  URL-encoded — society names are free text and HTTP header values don't
  safely support arbitrary characters otherwise). This also simplified
  the resolution logic: a bare/apex/www hostname now resolves through the
  *same* lookup as a real tenant subdomain, just using the default
  society's own slug — there's no special-cased "default" sentinel value
  anymore, which is what made getting the name for free (not just the
  id) straightforward for every request, not only ones with a real
  subdomain.
- `lib/tenant.ts` gained `getCurrentSocietyName()`, reading that header.
- `components/brand-eyebrow.tsx` and `components/auth-hero-photo.tsx` are
  now **async Server Components that fetch the name themselves**, rather
  than requiring every one of the ~12 pages that render `BrandEyebrow` to
  fetch and pass it down as a prop. This only works because neither
  component has any client-side interactivity — worth knowing if either
  ever needs an onClick/onChange added later, since that would force a
  `"use client"` boundary and break this pattern.
- `app/layout.tsx`'s metadata is now `generateMetadata()` (async) instead
  of a static export — title/description use the resolved society name,
  the social-preview image uses that society's own uploaded hero photo
  (omitted entirely if they haven't uploaded one, rather than falling
  back to any hardcoded asset), and `metadataBase` is derived from the
  actual incoming request's `Host` header rather than a hardcoded EVS
  URL — this correctly handles both `*.localsociety.club` subdomains and
  a tenant's own custom domain (like `evsgolfsociety.co.uk`) with no
  extra per-society configuration needed.

One minor, accepted cost: `generateMetadata` now runs `getAppSettings()`
on every single page load (for the OG image), which is one extra query
per page beyond whatever that page's own component already does. Not
incorrect, just worth knowing if this app's query volume ever needs
tightening up.

## Per-society login page photo

`/admin/settings` also has an upload panel for the login/register hero
photo — the first thing in this app to use Supabase Storage (previously
disabled entirely; see `supabase/config.toml`). Stored as a plain setting
(`hero_photo_url`) in the same `app_settings` key/value table every other
setting lives in, rather than a new column — exactly the extensibility
the settings design was built for.

**A society with no uploaded photo gets a clean, photo-less hero panel**
(just the fairway-green background and name), not a fallback to any other
society's image — showing one society's actual members as another's
default branding would be a strange first impression for a brand-new
tenant. EVS is the one exception, and only because it already had a real
photo before this feature existed: `0016_hero_photo_storage.sql` seeds
EVS's `hero_photo_url` setting to point at the pre-existing static asset,
so their login page looks exactly the same as before, with no action
needed on their part.

Technical notes:
- Uploads go through the service-role client, same as every other write
  in this app — the storage bucket (`society-photos`) is marked public
  for *reads* (so a logged-out visitor can see the photo on the login
  page without a signed URL), but writes only ever happen server-side.
- The hero panel's frame uses a generic `aspect-[3/2]` ratio with
  `object-contain`, not EVS's original photo's exact dimensions — since
  this now needs to handle arbitrary uploaded photos of unknown
  proportions, guaranteeing nothing gets cropped (letterboxing instead)
  matters more than a pixel-perfect frame for one specific image.
- `next.config.mjs`'s `images.remotePatterns` is derived from
  `SUPABASE_URL` at config-load time, so it automatically covers both the
  local Docker stack and the hosted production project without a
  separate value to keep in sync.
- 5MB max, PNG/JPEG/WebP only, validated both client-side (immediate
  feedback) and server-side (the real enforcement — never trust the
  client-side check alone).

One thing I can't fully verify without a real `next build` (no network
access in the environment I develop in): the Supabase Storage client
calls (`.storage.from(...).upload()` / `.getPublicUrl()`) aren't part of
the hand-written `Database` generic type that's caused build surprises
elsewhere in this codebase — they're plain methods on the base client,
unrelated to table typing — so I don't expect the same class of issue,
but it's worth knowing I'm reasoning from how the library is documented
to behave here, not from having compiled it.

## Application settings (`/admin/settings`)

A general, extensible settings store — `app_settings` is a plain
key/value table (`supabase/migrations/0014_app_settings.sql`), not one
column per setting. Adding the next setting later needs **no new
migration**: add its key to `SettingKey` and a field to `AppSettings` in
`lib/app-settings.ts`, add a row to the mapping in `getAppSettings()`, and
drop a UI control onto `/admin/settings`'s page (writes still go through
`updateSetting()` in `app/actions/settings.ts`). The `value` column is
`jsonb`, so future settings aren't limited to booleans either.

The read (`getAppSettings`) and the writes (`updateSetting` and friends)
deliberately live in two different files: `getAppSettings` is wrapped in
React's `cache()` so the several independent calls one request already
makes (root layout, `generateMetadata`, and whichever page is rendering)
collapse into a single query, and Next.js requires every export of a
`"use server"` file to be a plain async function declaration — a
`cache()`-wrapped function (or a re-export) doesn't qualify and fails the
build. So `lib/app-settings.ts` has no `"use server"` directive and holds
just the read; `app/actions/settings.ts` keeps `"use server"` and holds
only the mutations.

**First setting: "Players can log their own rounds."** Turning it off
means only admins can log a round — for any player, including their own.
Admins logging on behalf of another player are unaffected either way.

This is enforced in three places, deliberately not just one:
1. The dashboard hides "Log a round" for non-admins when it's off
2. `/rounds/new` shows an explanatory message instead of the form if a
   non-admin reaches it directly (typing the URL, an old bookmark, etc.)
3. **`createScorecard` rejects the submission outright** if a non-admin
   session tries it while the setting is off

Only #3 is the actual security boundary — #1 and #2 are UX, not
protection. If you're auditing this for a security review, that's the one
line that matters; the rest just avoids showing a form nobody's allowed
to submit.

**Brand colors.** Admins can customize Primary/Secondary/Accent (the
three CSS custom properties from `app/globals.css` used throughout the
UI) per society, stored as hex under the `brand_colors` key. The math
lives in `lib/color.ts` (pure, unit-tested in
`lib/__tests__/color.test.ts`) rather than in the component or the
action:
- Hex → HSL, since `globals.css`'s variables are HSL triplets
  (`--primary: 158 45% 22%`)
- A readable foreground (near-black or near-white) is picked per color via
  the WCAG relative-luminance formula, so an admin can't accidentally
  choose a color and end up with unreadable button text — they only ever
  pick the three base colors, never a foreground
- A dark-mode-safe variant (lightness clamped into a visible band against
  the dark theme's background) is derived from the same base color rather
  than asked for separately — this app has no dark-mode toggle wired up
  anywhere yet, so today this half is inert, but it's ready the moment one
  exists

`app/layout.tsx` applies the result: light-mode variables go on the
`<html>` element's inline `style` (inline style always wins over
`globals.css`'s `:root` rules, regardless of stylesheet load order),
dark-mode variables go in a `.dark`-scoped `<style>` tag since there's no
single element to attach them to directly. Saving `null` (the "Reset to
default" button) removes the customization entirely rather than storing
the built-in palette's own values, so the built-in "clubhouse ledger"
theme in `globals.css` keeps being the single source of truth for
societies that never touch this setting.

## Admins logging a round on behalf of a player

`/rounds/new` shows an extra "Log this round for" picker, admin-only —
useful for a member without a phone handy, or entering a paper scorecard
after the fact. It defaults to the admin's own name; picking someone else
also defaults the playing handicap field to that player's current
handicap (still editable).

This is enforced server-side, not just hidden in the UI: `createScorecard`
only honors a different target player when the session's role is actually
`admin` — a non-admin submitting a crafted request with someone else's
player id gets rejected outright, not silently ignored.

One thing NOT built: there's no record of *who* actually submitted a round
when an admin logs it for someone else — `scorecards.player_id` is who the
round is for, same as always, with no separate "logged by" column. If you
want that audit trail (e.g. "logged by admin X on behalf of Y"), it's a
small schema addition, just not something the request asked for.

## Picking up ("blobbing" a hole)

Not in the original spec — added as a society rule to speed up play: once a
player can no longer score at least 1 Stableford point on a hole, they can
pick up rather than finishing it. That hole scores 0 points and has no real
gross/net stroke count.

Worth knowing:
- **`total_gross_stroke_play` / `total_net_stroke_play` only ever sum
  completed holes.** A round with any picked-up holes has an inherently
  partial gross/net total — the UI shows a note when this applies
  (`/rounds/new`'s live preview and `/rounds/[id]`'s result card), but if
  you ever query these columns directly, don't assume they represent a
  full round's stroke play.
- The `scores` table enforces this at the database level: a row is either
  `picked_up = true` with null gross/net strokes and 0 points, or
  `picked_up = false` with all three populated — see the CHECK constraint
  in `supabase/migrations/0013_add_picked_up_to_scores.sql`.
- This is entirely self-reported, same as gross scores — there's no
  validation preventing someone from picking up "too early" (e.g. after
  only 2 strokes on a par 4). Golf societies run on the honor system for
  self-scoring generally, and this follows the same trust model rather
  than trying to enforce the rule server-side.

## A deliberate access-control change (Phase 7)

Through Phase 5 and 6, `/rounds/[id]` was viewable only by the scorecard's
owner or an admin. Phase 7 added `/rounds` as a **society-wide** feed of
every round, any status — which only makes sense if clicking into one
doesn't 404 for everyone except the person who played it. So
`getScorecardDetail` in `app/actions/scorecards.ts` now allows **any
logged-in society member** to view any scorecard's detail, not just its
owner or an admin.

This was a judgment call, not something the spec pins down explicitly. The
reasoning: this app already treats handicaps as shared/visible across the
society (that's the whole point of a shared register — comparing handicaps
for matches), the "Society Handicap Register" framing is used throughout
the UI, and the roadmap explicitly calls this a "society-wide feed." If you
want pending/rejected rounds to stay private until an admin has acted on
them (visible only to the player and admins), that's a one-line change:
put back the `scorecard.player_id !== session.playerId && session.role
!== "admin"` check that used to be in `getScorecardDetail`, and decide
whether `/rounds` itself should filter to `status: 'approved'` only for
non-owners.

## Applying a new migration without wiping your local data

`npx supabase db reset` re-applies every migration from scratch — great for
a clean slate, but it also deletes whatever players/courses/rounds you've
already created for testing. Once you have real test data you want to
keep, apply just the new migration file instead:

```bash
npx supabase status   # confirms the local stack is running, shows the DB URL
psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2 | tr -d '\"')" \
  -f supabase/migrations/0008_approval_functions.sql
```

Or simpler: open Studio (`http://127.0.0.1:54323`) → SQL Editor → paste the
contents of the new migration file → Run. Either way, only run *new*
migration files this way — re-running an already-applied one is usually
harmless here (everything uses `create or replace function` / `if not
exists` patterns) but isn't guaranteed for every migration going forward.

## Notes on what's deliberately simplified for now

- **Rate limiting** (`lib/rate-limit.ts`) is in-memory, per-process. Fine for
  a single-instance deployment; move to a shared store before scaling to
  multiple instances.
- **Admin promotion** has no UI yet — promote a player to admin directly in
  the Supabase table editor for now, then have them log out and back in
  (session role is baked in at login time — see "Seed data" above for why
  a bare database update alone isn't enough). A proper admin-management
  screen isn't in the spec's roadmap, so flagging it here rather than
  adding scope unprompted.
- **Editing a course's holes replaces the whole hole set** (delete + re-insert)
  rather than diffing row-by-row. Fine before a season starts; if you edit a
  course's holes after scorecards already reference its old hole rows, those
  scorecards' `scores.hole_id` foreign keys will point at deleted rows. Not
  addressed yet since scorecard entry (Phase 5) doesn't exist yet either —
  worth revisiting once it does.
- **No edit/delete for a submitted scorecard.** If a player mis-enters a
  score, there's currently no way to correct it themselves — the admin
  approval queue (Phase 6) is where a wrong scorecard gets rejected, and the
  player re-submits. A player-facing edit-before-approval flow isn't in the
  spec's roadmap, so it's not built.
- **`playing_handicap` is not auto-derived from course/tee slope or rating**
  — the spec doesn't define a slope/rating model, so the form just defaults
  it to the player's current handicap and lets them override it manually
  (e.g. if their handicap changed since their last approved round).
- **No rejection reason field.** The spec's `scorecards` schema has no
  column for one, so a rejected round just flips to `status: 'rejected'`
  with no stored explanation. If your society wants admins to leave a note
  (e.g. "wrong tee selected, please resubmit"), that'd need a schema change
  — flagging it here since it's a plausible real-world ask, not something
  I quietly decided not to build.
- **No notification to the player when their round is approved/rejected.**
  They'll see the updated status next time they visit `/rounds/[id]` or
  their dashboard, but nothing actively tells them. Not in the spec's
  roadmap, so not built.
- **An admin override never rewrites `scorecards.proposed_handicap_change`**
  — that column stays as the original calculated proposal for audit
  purposes. The actually-applied amount (which may differ, if overridden)
  lives on the `handicap_history` row the approval creates instead. Worth
  knowing if you ever query `scorecards` directly expecting it to reflect
  what was actually approved.
- **`/rounds` (the society feed) is capped at the 50 most recent rounds**,
  not paginated. Fine for a typical society's volume; revisit if that ever
  feels short.
- **The handicap timeline chart's starting point is back-calculated**
  (`first history entry's handicap_value minus its adjustment_amount`)
  rather than stored anywhere — there's no "initial handicap" row in
  `handicap_history` for the value set at registration, so the chart
  infers it. This means a brand-new player with zero approved rounds gets
  no chart at all (just a "no approved rounds yet" message) rather than a
  flat line at their starting handicap.
