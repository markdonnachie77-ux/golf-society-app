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

## Mobile bug: numbers not registering on some phones in portrait

Reported symptom: on some phones, tapping a score box brought up the
numeric keyboard correctly, but pressing a number key did nothing — and
switching to landscape fixed it. That orientation-specific pattern was
the key clue: mobile browsers' viewport *width* is what changes between
portrait/landscape, and this matches a known, longstanding class of bug
with `<input type="number">` on mobile — Chrome silently discarding
input in some cases, and various Android keyboard apps failing to
register keypresses into number inputs at all. Verified against GOV.UK's
frontend team's own account of hitting and fixing this exact bug class
(they moved their date-input fields away from `type="number"` for the
same reason).

**Fix: every numeric input in the app now uses `type="text"` with
`inputMode="numeric"` or `inputMode="decimal"`, not `type="number"`.**
This is the documented, battle-tested mitigation — GOV.UK Frontend ships
it in production across UK government services. Two variants, applied
based on what each field actually needs:

- **Integer fields** (hole scores, stroke index, yardage): `inputMode="numeric"`
  + `pattern="[0-9]*"` + an `onChange` filter stripping anything that
  isn't a digit. `type="number"`'s native `min`/`max` no longer apply to
  a text input, so those bounds are now enforced purely in JS — worth
  knowing if a similar integer field gets added later and the min/max
  isn't obviously duplicated into the validation logic.
- **Decimal fields** (handicaps, course cut/increase rates): `inputMode="decimal"`,
  no digit-only filter, since these can be negative (a "plus" handicap)
  and need a decimal point — validated via `Number()`/`Number.isNaN()`
  the same way they already were.

This couldn't be reproduced directly (no physical device testing
available in the environment this was built in) — the fix is applied
with high confidence given it's a well-documented, authoritative pattern
matching the exact reported symptom, but it's worth explicit confirmation
from the affected users' actual phones once deployed, not just assumed
fixed.

**Update: that wasn't the actual root cause.** The `type="text"` +
`inputMode` change above was a legitimate, worthwhile fix for a real
class of bug — but testing afterward showed digits were still failing to
appear, and the person testing it did something genuinely useful: they
found the failure was tied to **browser zoom level**, not orientation
directly — above roughly 110% zoom, the digit stopped appearing,
regardless of portrait/landscape, and landscape only "fixed" it because
it happened to give the layout enough room again at the same zoom
percentage.

The real cause: the score input sat in a flex row next to a "Pick up"
button, styled `min-w-0` (input) beside `shrink-0` (button). `min-w-0`
means literally no minimum width — as the row's available space shrinks
(which is exactly what browser zoom does to a fixed physical screen: more
physical pixels are needed per CSS pixel, so less CSS-pixel space fits),
the input has nothing stopping it from shrinking all the way to zero
while the button holds its size. Past a certain zoom level, the input
collapses to an invisible sliver — the digit genuinely was being typed
into it the whole time (which is exactly why the earlier keyboard-focused
fix didn't help), there was just no visible box left to show it in.

**Fix: `min-w-0` → `min-w-[3rem]`** on the score input specifically — a
real floor it can never shrink below. If a row's total content genuinely
can't fit (an extreme zoom level, say), it now overflows into the
horizontal scroll already set up on this grid's wrapper, rather than
silently collapsing the input to nothing. Checked the rest of the
codebase for the same pattern (`min-w-0` on an interactive element
sitting next to a non-shrinking sibling) — the one other `min-w-0` usage
found is on a text label with `truncate`, which is the safe, correct use
of the pattern (graceful ellipsis, not a collapsing interactive
element), not something that needed the same fix.

## Rounds feed: pagination, filtering, sorting, and date range

`/rounds` is paginated (20 per page) and filterable by player, course,
and/or a date range, all via plain query params
(`?page=N&player=<id>&course=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD`) — same
URL-is-the-source-of-truth approach throughout, not client-side state.
That matters together, not just individually: `PaginationControls`
carries every active filter into its Previous/Next links via an
`extraParams` prop, so paging forward on a filtered view doesn't silently
drop anything. Changing a filter always navigates back to page 1, since
a different filter means a different total page count.

**The date range filter is `played_at` (a plain Postgres `date` column,
not a timestamp) with `.gte()`/`.lte()`** — both bounds inclusive, no
time-of-day boundary considerations needed since there's no time
component to the column at all. Validated server-side
(`isValidDateString` in `app/actions/scorecards.ts`) before ever reaching
the query — this isn't just format-checking (`\d{4}-\d{2}-\d{2}`), it
also catches calendar-invalid dates a naive `Date.parse()` would
silently "roll over" instead of rejecting (`2026-02-30` parses as March
2nd rather than throwing) — constructing the date and checking the
result's actual year/month/day match what was asked for catches that.
The two `<input type="date">`s also cross-constrain each other's
`min`/`max` client-side, so an inverted range can't be picked in the
browser's own date picker in the first place — a nice-to-have on top of
the real server-side validation, not a substitute for it.

**Sorting is by Score only** — clicking the "Score" header cycles
unsorted → highest first → lowest first → unsorted (`?sort=desc` /
`?sort=asc`), same URL-param approach, composing correctly with every
filter above. `total_stableford_points` is a direct column on
`scorecards`, so this sorts natively with a plain `.order()` call — no
complications. Player name and course name were deliberately **not**
made sortable alongside it: they only exist on the related
`players`/`courses` tables via an embedded select, and PostgREST has a
long-standing, still-open limitation where `.order()` on an
embedded/foreign table's column only orders rows *within* a nested
array — it does not order the parent rows by that value (see
[postgrest-js#198](https://github.com/supabase/postgrest-js/issues/198)).
Sorting name-based columns correctly would need a real fix — most likely
a Postgres view flattening player/course names onto the row directly —
not a small enough addition to bundle in alongside the rest of this.

One cross-feature bug worth knowing about, since it's the kind of thing
that's easy to reintroduce: `RoundsFilterBar`'s `navigate()` always
merges a change into the *full* current filter/sort state (passed in as
props), rather than each filter rebuilding the URL from just its own
value. An earlier version didn't do this — changing the player filter
would silently drop an active score sort, and vice versa, since neither
filter's handler knew what the other currently had set. Any future
filter/sort control added to this page should go through the same
merge-with-full-state pattern, not reintroduce a handler that only knows
about itself.

Real pagination via Supabase's `.range()`, with `{ count: "exact" }` on
the same query to get a total row count alongside the page of results,
rather than a separate count query — this replaced an earlier flat
cap-at-50 with no way to see anything before it.

The two dropdown filters reuse `listAllPlayers()` and
`listCoursesForRound()` — both already open to any logged-in society
member, not admin-gated, which matters here since any player (not just
admins) can filter the shared rounds feed.

Only `/rounds` has pagination, filtering, or sorting — `/admin/approvals`,
`/players`, and `/courses` are still flat lists. Approvals in particular
is a short, actively-managed queue (items leave it as soon as they're
reviewed), so it's much less likely to grow the way a permanent
historical feed does — worth revisiting if any of the others ever
actually need it, not built preemptively.

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

## Event / competition management

Admins draft an event (name, course, date, first tee time, capacity),
edit it freely, then publish it — only published events are visible to
players at all; a draft is invisible, not just non-registerable.
Published events can be reverted to draft (registrations aren't touched
by this — they'd just become invisible again until re-published).

**Two new tables** (`supabase/migrations/0017_events.sql`): `events` and
`event_registrations`. Both carry `society_id` directly, same
defense-in-depth reasoning as every other table since the multi-tenancy
work — a query scoped by `society_id` is correct on its own, not
dependent on a join being right too.

**Capacity is enforced by a Postgres function
(`register_for_event`), not a plain application-level insert** — same
reasoning as `0008_approval_functions.sql`'s `approve_scorecard`: two
players clicking "register" at the same moment, with exactly one spot
left, is a genuine race condition a check-then-insert from a Server
Action can't safely rule out. The function locks the event row (`FOR
UPDATE`) before checking capacity, which serializes concurrent
registration attempts for that event — the second one only sees the
count after the first has already committed (or not) its effect on that
same locked row.

**`p_skip_player_checks` is one flag controlling two checks** (the
`self_registration_enabled` setting and the capacity limit), because
both are specifically about *self*-service registration. An admin
registering someone on their behalf isn't self-registration at all, so
neither check applies to them — this was an explicit design choice
(confirmed directly): admins can deliberately overbook an event past its
stated capacity. Player self-registration always respects both.

**De-registering yourself is always available**, regardless of
`self_registration_enabled` — that setting only gates *adding* a new
registration, not withdrawing an existing one. Removing a row has no
capacity race condition to guard against either, so both
`deregisterFromEvent` and the admin equivalent are plain scoped deletes,
not RPC calls — only the capacity-checked *add* path needed the atomic
function treatment.

**Registering or de-registering for a past event is blocked**
(`event.event_date < today`, checked in `app/actions/events.ts`) — using
the server's own UTC date, same minor, accepted imprecision as
`played_at`'s database default elsewhere in this app; someone right at
a timezone boundary could see this cut over up to ~12 hours off from
their own local midnight, which isn't worth solving with real timezone
handling for a golf society's event list.

**A draft event can never have registrations** (registration only opens
once published, enforced by `register_for_event`'s own status check),
which is what makes `deleteEvent`'s draft-only restriction safe — there's
never a "what happens to existing registrations" question to answer for
something that gets deleted, since a draft literally cannot have any.

**Admin-only paths needed a small middleware addition beyond the usual
prefix list**: `/events/new` is a plain prefix, same as `/players/new`,
but `/events/<id>/edit` has the id sitting in the *middle* of the path,
which a simple `.startsWith()` prefix can't express — `/events` and
`/events/<id>` both need to stay open to every player. `middleware.ts`
adds a small regex (`/^\/events\/[^/]+\/edit$/`) alongside the prefix
list specifically for this shape, verified against both the paths it
should and shouldn't match before shipping.

**The events list splits into Upcoming and Past** rather than one flat
list — `listEvents()` sorts ascending by date, which left as a single
list would put every past event before every upcoming one on the page;
the split (and reversing the past half to most-recent-first) happens in
`app/events/page.tsx` itself rather than changing what the action
returns. An event happening today counts as upcoming, not past.

**Both foreign keys in `event_registrations` point at `players`**
(`player_id` and `registered_by`) — an unqualified `players(...)` embed
would be ambiguous to PostgREST the same way it once was in the approval
queue and the rounds feed (`players!scorecards_player_id_fkey`), so
`getEventDetail`'s select explicitly qualifies which one it means
(`players!event_registrations_player_id_fkey`).

I couldn't test this feature against a live database or run a real
concurrent-registration race — no Postgres instance or browser available
in the environment I built it in. I traced through the `register_for_event`
function's logic by hand, including the locking behavior under
concurrent calls, and I'm confident in the reasoning, but this is worth
deliberately testing once deployed: two people registering for the last
spot at nearly the same moment, an admin overbooking on purpose, a
player withdrawing and re-registering, and reverting a published event
back to draft.

### Event scoring format and leaderboard (`0018_event_scoring.sql`)

Each event has a scoring format — Stroke Play or Stableford — that
governs its leaderboard only, nothing else. Handicap adjustment always
uses Stableford points, regardless of which format the event a round
happens to be tagged to was set to; the two are entirely separate
concerns that happen to both involve the word "Stableford."

**Stroke Play ranks by lowest `total_net_stroke_play`, not gross** —
this is a handicap-based society, and net is the standard way amateur
competitions level the field. Stableford ranks by highest
`total_stableford_points`, which is already handicap-adjusted by
design.

**Stroke Play additionally excludes any round with a picked-up hole**
from the leaderboard entirely — a picked-up hole means
`total_net_stroke_play` is only a partial sum of the holes actually
completed (see `lib/golf-math.ts`'s `summarizeRound`), an incomplete
score that can't fairly compete against a full round. Stableford has no
equivalent problem: a picked-up hole scores 0 points, which is itself a
valid, complete Stableford outcome by the format's own design, not a
gap that needs excluding. Same reasoning as `getPlayerGrossScoreStats`
in `app/actions/players.ts`, which excludes picked-up rounds from
gross-score stats for an identical reason but never needed a Stableford
counterpart.

**A round links to an event at submission time, not afterward** — the
round-logging form (`components/new-scorecard-form.tsx`) shows a "Log
this round for an event?" dropdown, but only when there's a genuine
match: an event the target player (self, or whoever an admin is logging
for) is registered for, whose course and date match what's actually
being submitted. `createScorecard` re-validates all of this server-side
regardless of what the form sent — the event must exist, be published,
match the round's course and date exactly, and the target player must
actually be registered — since trusting a client-supplied event id could
otherwise let a crafted request tag any round to any event and pollute
its leaderboard.

**The event-linking dropdown works for the admin "log on behalf of"
case too, not just self.** The initial candidate-events list passed into
the form is always the *viewer's* own registrations — when an admin
switches who they're logging for, the form refetches that specific
player's registered events client-side
(`listRegisteredEventsForRoundLogging`), rather than requiring a
separate page load or a pre-built map of every player's events (which
would work but cost a query per player up front for something most
players won't have any matches for on a given day).

### Dashboard "log your round" reminder

If you're registered for a published event dated today or up to 7 days
in the past, and you haven't submitted a round for it yet, a dismissible
banner shows on the dashboard. Same 7-day window as the round-linking
dropdown itself (`listRegisteredEventsForRoundLogging`) — deliberately,
since a round genuinely can't be tagged to anything older than that
window anyway (the dropdown wouldn't offer it as an option), so there's
no point reminding about something that's no longer linkable.

"Already submitted a round" means any status — pending, approved, or
even rejected — not just approved. Once you've logged something for an
event, you've done your part; a still-pending or rejected round isn't a
reason to keep nagging.

**Dismissal is stored in `localStorage`, per event id** — a deliberate
choice, not database-backed. It's a lightweight, per-device UI
preference, not something that needs to sync across devices or survive
a data export. It's also only ever a "not right now" — if you dismiss
the banner but still haven't logged a round after 7 days, the reminder
disappears anyway (superseded by the date window), and if you do log a
round, `listPendingEventRoundReminders` stops returning it at all
regardless of dismissal state. This is the first thing in the app to use
`localStorage` at all — everywhere else state either lives in the
database or in a URL query param, since this is genuinely the first
case where neither fit: too trivial for a database round-trip, and not
meaningful to put in a shareable URL.

## Course Rating and Slope Rating per tee (`0020_course_and_slope_rating.sql`)

First step toward competition handicap rules (World Handicap System
style Course Handicap calculations) — capturing Course Rating and
Slope Rating for the white and yellow tees on each course. The actual
Course Handicap calculation itself (`Handicap Index × Slope Rating /
113 + (Course Rating − Par)`) is a separate, later step; this migration
is purely the data capture the user explicitly asked for first.

**Per-tee-color column pairs directly on `courses`, not a new "tees"
table** — this follows the exact pattern `0003_create_holes.sql`
already established for `white_yards`/`yellow_yards`, rather than
introducing a new normalization. Course Rating and Slope Rating are
properties of a whole tee set, not per-hole, so they belong on
`courses` (course-level) rather than `holes` (per-hole) — but the
"one column pair per tee color" shape matches what this codebase
already does elsewhere for exactly this kind of per-tee data.

**All four columns are nullable, with no default.** An admin setting
up a course may not have Course Rating or Slope Rating to hand yet —
these come from the course's official rating card, not something
typed from memory — so null is a valid "not yet captured" state, not
an error. The form's optional-field parsing specifically distinguishes
an empty field (→ `null`) from a genuinely malformed value (→ `NaN`,
which the zod schema then rejects with a clear error) — `Number("")`
evaluates to `0` in JavaScript, which would otherwise have incorrectly
failed the schema's `.positive()` check instead of being treated as
"not set." Verified this distinction directly against zod's actual
behavior for null, a valid number, `NaN`, zero, and negative inputs,
since getting this wrong either way — silently accepting bad input or
incorrectly rejecting an intentionally-blank field — would be an
annoying, hard-to-diagnose form bug.

Slope Rating is constrained to 55–155, matching the World Handicap
System's own defined range (113 = average difficulty) — a real,
standardized bound worth enforcing directly rather than leaving
unconstrained. Course Rating only gets a loose upper bound (under
100), since it varies legitimately with course length and hole count
(a 9-hole course's rating is roughly half an 18-hole one) in a way
that doesn't have an equally standardized range to check against.

## Handicap cut for winner and "confirm leaderboard" (`0019_event_handicap_cut.sql`)

Each event has a "handicap cut for winner" setting (an integer, can be
zero) and an admin-only "confirm leaderboard" action. Confirming locks
in whoever's currently in first place and, if the cut is nonzero,
immediately takes that many strokes off their handicap.

**Two decisions were confirmed directly with the user rather than
assumed, since both are easy to get wrong in a way that quietly
misapplies a real handicap change:**

- **A tie for first gets no automatic cut at all** — not split, not
  applied to both, not decided by whoever the query happens to list
  first. Ties are for the admin to resolve manually via the existing
  handicap override on a player's profile. `confirmEventLeaderboard`
  only compares the top two leaderboard entries for this — a tie
  further down the list (second vs. third place, say) never affects
  who's confirmed as the winner.
- **Confirming is permanent — no undo, no re-confirm.** If a late
  scorecard comes in afterward that would have changed the result,
  that's a manual correction via `adjustPlayerHandicap`, not something
  this feature reopens. The database enforces this too, not just the
  UI: `confirm_event_leaderboard` locks the event row and raises if
  `leaderboard_confirmed_at` is already set, so a double-click or two
  admins racing can't apply the cut twice.

**Confirmation and the handicap adjustment happen in one atomic
transaction, not two separate calls.** The obvious approach — call the
existing `manual_handicap_adjustment` RPC as a second step after
marking the event confirmed — was deliberately avoided: if that second
call failed for any reason, the event would be left permanently marked
confirmed with the cut never actually applied, and confirming can't be
retried to fix it. `confirm_event_leaderboard` inlines the same
compute-delta / update-handicap / insert-history logic
`manual_handicap_adjustment` already uses, inside the same transaction
that sets the confirmation fields.

**The winner is determined from the exact same `getEventLeaderboard`
the page itself displays**, not re-derived independently — so what gets
confirmed can never disagree with what an admin actually saw on screen
when they clicked confirm. Also gets an explicit defense-in-depth
society check on the determined winner immediately before the RPC call
(matching the pattern used for `onBehalfOfPlayerId` in
`createScorecard`) — the id is already inherently society-scoped by
construction (it comes from an approved scorecard, which can only
belong to a player in the same society), but a real handicap mutation
seemed worth confirming that explicitly rather than trusting it holds
by construction alone.

Verified the winner/tie logic directly against five cases, including
the one most likely to be gotten wrong by accident: a tie for *second*
place must not prevent a clear winner from being determined at all —
only the top two entries matter for tie detection.

## Stuck "Removing…" / "Reverting…" buttons after a successful action

Real bug, found via the QR-code sign-up flow: register for an event,
and the button that should say "Withdraw my registration" instead
renders permanently as "Removing…", disabled, doing nothing.

The cause: `EventRegistrationButton` renders one of two different
buttons depending on `isRegistered` — Register, or Withdraw. Both
handlers call `router.refresh()` on success to re-fetch server data and
get the prop that flips which branch renders. But `router.refresh()`
re-renders the *same component instance* with new props — it doesn't
remount it — so the component's own `pending` state carries straight
across that branch switch. Neither handler ever reset `pending` back to
`false` on success, only on failure, so a successful *register* left
`pending` stuck `true` at the exact moment the component switched to
rendering the *withdraw* button, which read that stale flag and showed
its own "Removing…" text, disabled, forever — since the button being
disabled meant there was no way to click it and clear the state either.

**Checked this pattern everywhere else it's used in the app** rather
than fixing only the reported instance — six other components use the
identical `setPending(true)` → action → `router.refresh()` shape
(hero photo upload, wipe history, reset PIN, brand colors, setting
toggles, handicap override), and every single one of them already
resets `pending` before refreshing. That confirms this was a genuine
oversight isolated to the event-registration components specifically,
not a systemic gap — all of them were written in the same batch of
work, and all three needed the same fix: `EventRegistrationButton`
(both handlers — this is the one that was actually reported, but
withdrawing and then re-registering would have hit the mirror image of
the same bug), and `AdminEventStatusActions`'s publish/unpublish
handlers, which switch between "Publish" and "Revert to draft" the
same way. `AdminRemoveRegistrationButton` had the same gap but never
actually surfaced it visibly — that button's whole row disappears from
the list on success rather than switching to a different rendered
state, so the stale `pending` had nothing left to stick to. Fixed
anyway for consistency with the pattern everywhere else, and to close
the brief window before that refresh actually lands.

**Follow-up: that fix itself introduced a new, visible bug**, caught via
a screen recording rather than assumed fixed. Resetting `pending`
immediately after the action succeeds — before `router.refresh()`
actually completes — means the button briefly renders in its OLD,
pre-action state, since the new `isRegistered`/`status` prop hasn't
arrived yet. Frame-by-frame review of the recording showed exactly
this: click Register → "Registering…" → flashes back to "Register" for
roughly a second → finally settles on "Withdraw my registration" once
the refreshed data lands. `router.refresh()` returns `void`, confirmed
against this Next.js version's own type definitions — it isn't
awaitable, so there's no way to know from the call site when it's
actually done.

The actual fix, in both `EventRegistrationButton` and
`AdminEventStatusActions`: don't reset `pending` in the handler's
success path at all. Instead, a `useEffect` watches the server-provided
prop itself (`isRegistered`, `status`) and resets `pending` only once
that prop actually changes — which only happens when the refreshed data
has genuinely arrived. This ties the reset to real confirmed state
rather than a guess about timing, avoiding both failure modes at once:
the original stuck-forever bug (never resetting), and this flash (reset
too early). A `useEffect` (not `useLayoutEffect`, which would need to
avoid a Next.js SSR warning) fires after paint, so there's a
theoretical single-frame flash still possible in principle — accepted
as an imperceptible tradeoff against the multi-second, clearly visible
flash this replaces.

## Header-less card padding — three attempts, only the third one right

Worth documenting honestly, since it took three tries across several
sessions to actually fix, and the lesson generalizes: `CardContent`'s
own base classes are `p-4 pt-0 sm:p-6 sm:pt-0` — zero top padding at
every breakpoint, deliberately, because `CardContent` is normally used
right below a `CardHeader`, which already provides its own bottom
spacing. The two admin-only cards on the event page (the status-actions
toolbar and the register-a-player panel) have no `CardHeader` at all —
just a bare `CardContent` — so that zeroed top padding left their
content sitting flush against the top with a full padding's worth of
gap only at the bottom, looking top-aligned rather than centered.

**Attempt 1** added `className="pt-6"` (no breakpoint prefix) to
compensate. This looked like it helped in isolated review, but never
actually took effect at desktop width — `cn()` uses `tailwind-merge`,
which correctly overrides conflicting classes *at the same breakpoint*,
and a bare `pt-6` only overrides the bare `pt-0`, not `sm:pt-0`. Past
640px, `sm:pt-0` kept winning regardless.

**Attempt 2** removed the override entirely, reasoning that
`CardContent`'s own default must be correct — but the default is only
correct for the header-below-content case, not the header-less case
these two cards actually are. This didn't change anything either, for
the same underlying reason: neither attempt had ever touched `sm:pt-0`
at the breakpoint that mattered.

**Attempt 3**, found by the user directly in browser DevTools (editing
the computed `sm:pt-0` rule and watching the layout fix itself), is
`className="pt-4 sm:pt-6"` — matching `p-4`/`sm:p-6`'s own top-padding
value at each breakpoint, restoring symmetric padding on all four
sides. This is the one that's actually correct, applied to both
header-less cards. If another header-less `CardContent` gets added to
this app later, it needs the same explicit override — the bare
`CardContent` default is wrong for that shape by design, not by
oversight.

## Event sign-up PDF (`/events/<id>/pdf`)

For societies that still put a printed sheet on the noticeboard: admins
get a "Download sign-up sheet" link on a *published* event's page (not
shown for drafts — a draft's QR code would point at something invisible
to everyone but admins). The PDF has the event's details, a QR code
linking straight to that event's page, and a hand-write table at the
bottom for anyone who can't or won't use the app.

**First thing in this app to generate a PDF at all** — new dependencies
`@react-pdf/renderer` (the document itself, `lib/event-signup-pdf.tsx`)
and `qrcode` (`app/events/[id]/pdf/route.tsx`). This is a Route Handler,
not a Server Action — a Server Action can't hand back a binary file for
the browser to download the way a Route Handler's `Response` naturally
can. `requireAdmin()` is used here exactly as its own doc comment says
it's meant to be (Server Actions *and* Route Handlers), wrapped in a
try/catch since it throws rather than redirecting — appropriate for a
page, not for a file-download endpoint.

**The QR code's target URL only works because of a separate fix that
had to happen first**: scanning it while logged out needs to land back
on the event page after logging in or registering, not just the
dashboard — see "Login/register now honor a next redirect" below, which
this feature is the actual reason for building.

**The hand-write table's row count is capacity minus however many have
already registered through the app** (capped at 30 regardless, so a
large capacity doesn't produce an absurdly long printed page) — not the
full capacity. This sheet exists for people who can't use the app, so
rows for spots already filled by app registrations would overstate how
much room is actually left. Worth knowing: without the `Math.max(0,
...)` floor on this calculation, an admin-overbooked event (capacity
deliberately exceeded — see the earlier registration-override work)
would compute a *negative* row count, and `Array.from({ length:
negative })` throws in JavaScript rather than producing an empty array —
verified this specific case directly rather than assuming the floor was
unnecessary.

**Each blank row is numbered with its actual spot number, continuing
from wherever app registrations left off** — 16 spaces with none taken
prints rows 1–16; 16 spaces with 13 already registered through the app
prints rows 14–16, not 1–3. The number is `registeredCount + i + 1` for
each row's position in the printed list, not just a plain 1-to-N count
of however many rows happen to fit — these represent specific remaining
spots at the event, and a walk-up signing in spot "3" of a mostly-full
sheet would be misleading about how full the event actually is. Verified
against both of the exact examples above plus the overbooking edge case
(zero numbered rows, not a crash or negative numbers).

**An "Already signed up" table lists everyone registered through the
app**, above the hand-write section — just `#` and Name, numbered 1
through `registeredCount`. This is what makes the numbering above
genuinely continuous rather than two separately-numbered lists: someone
glancing at the sheet sees one sequential roster, spots 1 through
capacity, some filled in print and the rest blank for hand-writing.
Omitted entirely (not shown as an empty table) when nobody's registered
yet. Verified with a real compiled run of the actual template file
(not a reimplementation) against the exact 16-capacity/13-registered
example above, plus the zero-registered case to confirm the section
disappears cleanly rather than rendering an empty heading.

**The whole sheet always fits on one A4 page**, up to a real, tested
ceiling — this replaced an earlier, incorrect assumption. The original
30-row cap on blank rows was chosen before the "Already signed up" table
existed, and never accounted for it: once that table was added, the
combined content could genuinely overflow to a second page well below
that cap. Row height, cell padding, and body-cell font size in both
tables now scale down together (not row height alone, which would leave
text overflowing a now-shorter row) once the total row count — registered
shown plus blank shown, combined across both tables, since they share
the same page — exceeds a threshold, down to a legibility floor a
hand-write box can't usefully shrink past.

Both the "fits comfortably at full size" threshold (13 total rows) and
the "still fits at the legibility floor" ceiling (22 total rows) are
**measured, not calculated** — rendered real PDFs at increasing row
counts using the actual template file (compiled with esbuild, not a
reimplementation) and counted actual pages with `pdf-lib`, across short
names, long/wrapping names, and the all-registered/zero-blank edge case,
for both boundaries. 22 fits everywhere tested, 23 tips to a second page
everywhere tested. Beyond a total of 22, blank rows are trimmed first —
already-registered names always all get shown in full, even if an
unusually popular event (more than 22 people registered through the app
alone) means the sheet occasionally can't stay on one page after all;
hiding real registrations to force a page count would be a worse
tradeoff than that rare exception. If this template's other content
(header size, section text, margins) ever changes materially, both
numbers should be re-measured the same way, not adjusted by guess.

**Verification note, since this was genuinely new territory for the
app**: I don't have a live Next.js dev server or browser in the
environment I build in, so I couldn't click through the actual download
end to end. What I did do: tested the real QR-generation and
PDF-rendering calls directly under plain Node (not the project's `tsx`
test runner, which turned out to have its own unrelated ESM/CommonJS
resolution quirks with this exact package that don't reflect how
Next.js's own bundler handles it), confirmed the specific styling
patterns used here (style-array merging, borders, flexbox rows) render
correctly, ran the blank-row math against the overbooking edge case
above, and ran a full `tsc --noEmit` across the whole project with zero
errors. I also confirmed directly against Next.js's own documentation
that `@react-pdf/renderer` is on its built-in list of packages
automatically handled correctly for Server Components and Route
Handlers, and that the historical Next.js/react-pdf crash bug some
older setups hit only affected Next.js versions before 14.1.1 — this
app is on 15.5.25. That's a lot of indirect confidence, not a substitute
for actually clicking the button once this is deployed — worth doing
that deliberately as the first real test.

Also worth knowing: installing `qrcode` surfaced that it doesn't ship
its own TypeScript types, needing a separate `@types/qrcode` dev
dependency — caught by the same `tsc --noEmit` check, before it could
have failed a real Vercel build.

## Login/register now honor a `next` redirect param

This exists specifically to make the sign-up PDF's QR code work while
logged out: scanning it needs to land back on the event page after
authenticating, not just the dashboard. `LoginForm` already had
`useSearchParams` imported — unused, dead code, presumably from an
earlier unfinished attempt at this — and the "Register here" /
"Already registered? Log in" cross-links were plain anchors that
silently dropped any `next` param when switching between the two pages.
Fixed all of it: both forms now read and forward `next`, both
cross-links preserve it, and both `loginPlayer`/`registerPlayer`
redirect there via a shared `safeNextPath` helper instead of always
hardcoding `/dashboard`.

**`safeNextPath` never trusts the value outright** — honoring an
arbitrary `next` from a query string is a classic open-redirect
vulnerability, so only a same-app relative path is accepted. Verified
against 11 cases directly: absolute URLs, protocol-relative `//evil.com`
tricks, bare domains without a protocol, a `javascript:` scheme, and
redirecting back to `/login` or `/register` themselves (which would make
no sense as a post-login destination) are all rejected in favor of the
`/dashboard` default.

## A real Next.js security update, found by accident

Installing the PDF libraries for the feature above ran `npm audit` for
the first time in this entire project, surfacing something serious and
completely unrelated to PDFs: this app was on **Next.js 15.5.20**, the
last vulnerable release before Vercel patched a batch of CVEs on July
21, 2026 — including CVE-2026-64641, a high-severity Server Action
denial-of-service bug, and an SSRF issue, both directly applicable to
how this app is built (App Router, Server Actions throughout). Updated
to **15.5.25**, a patch-level bump with no breaking changes, not a risky
major-version jump.

`npm audit` still shows 9 remaining vulnerabilities after this fix, all
in dev-only tooling — the local Supabase CLI and the test runner — never
deployed to production. Resolving those fully would force breaking
version changes to unrelated tools as a side effect of a PDF feature, so
they're left as a documented, low-priority follow-up rather than forced
through here. Worth running `npm audit` again periodically going
forward, now that it's been done once — this app went its entire build
without anyone checking until this.

## Members page: sort by handicap

`/players` has a clickable "Handicap" header, same 3-state cycle and
URL-param approach as the rounds feed's Score sort
(`?sort=asc`/`?sort=desc`) — unsorted (alphabetical by last name) →
lowest/best handicap first → highest first → back to unsorted.
`current_handicap` is a direct column on `players` itself, so this is
simpler than the rounds feed's sort: no join/embedding to worry about at
all, since there's no related table involved.

`listAllPlayers()` takes the sort as an optional parameter specifically
so its other callers — the admin "log a round on behalf of" picker, the
rounds feed's player filter dropdown — keep their existing (unsorted,
alphabetical) behavior unchanged; only `/players` itself passes it.

## Admin-created players (`/players/new`)

Admins can create a player account directly, without the player
self-registering — `/players` shows an "Add player" button, admin-only
(gated both by the page hiding it and by `middleware.ts`'s
`ADMIN_PATH_PREFIXES`, which now includes `/players/new` specifically —
narrow enough that it doesn't accidentally gate `/players` itself or any
player's own profile at `/players/<uuid>`, since a real UUID can never
start with the literal string "new").

**The PIN is generated, not typed by the admin** — a deliberate choice.
`adminCreatePlayer` (in `app/actions/auth.ts`, alongside the self-service
`registerPlayer` it mirrors) creates the player with a random 4-digit PIN
and returns it in the result exactly once, for the admin to relay to the
new player. Nothing stores the plaintext PIN anywhere — only its bcrypt
hash is persisted, same as every other PIN in this app. If it's lost
before being passed along, or the player forgets it later, an admin can
generate a fresh one from `AdminResetPinPanel` on the player's own
profile page, sitting alongside the existing handicap-adjustment and
wipe-history admin panels.

Always creates as `role: "player"` — there's no role picker on this
form. Promoting to admin stays a deliberate manual step in Supabase
Studio's table editor (see "Seed data" above for the full promotion
walkthrough, including the re-login-required gotcha), by explicit
choice rather than oversight: this keeps who can become an admin a
decision made directly in the database, not exposed as an app feature.

**Closing self-registration.** The natural complement to admin-created
players: a "Players can register themselves" toggle in
`/admin/settings`, off by default meaning on (`playersCanSelfRegister`
defaults `true`, so nothing changes for an existing society until an
admin explicitly turns it off). Same two-layer pattern as
`playersCanLogOwnRounds` — `/register` hiding its form when this is off
is just UX; `registerPlayer` itself checking the setting, first thing,
before any other validation, is the actual boundary. Doesn't touch
`adminCreatePlayer` at all — that's a deliberately separate path, meant
to keep working as the only way in once self-registration is closed.

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
- **`/rounds` (the society feed) is now genuinely paginated** — 20 per
  page, via Supabase's `.range()` with an exact total count, replacing
  the earlier flat cap-at-50 with no way to see anything older.
- **The handicap timeline chart's starting point is back-calculated**
  (`first history entry's handicap_value minus its adjustment_amount`)
  rather than stored anywhere — there's no "initial handicap" row in
  `handicap_history` for the value set at registration, so the chart
  infers it. This means a brand-new player with zero approved rounds gets
  no chart at all (just a "no approved rounds yet" message) rather than a
  flat line at their starting handicap.
- **The chart's Y-axis had a fixed 32px width**, sized for a single
  digit — a two-digit handicap (or a negative "plus" handicap) got its
  leading character clipped off. Fixed by letting Recharts auto-size the
  axis based on the actual label content instead of a hardcoded guess,
  which also meant removing a `-16px` left margin that had been
  compensating for that old fixed width — left in place, it would have
  clipped the new, correctly-sized labels from the other side instead.
