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
  the Supabase table editor for now. A proper admin-management screen isn't
  in the spec's roadmap, so flagging it here rather than adding scope
  unprompted.
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
