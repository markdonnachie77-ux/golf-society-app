# Golf Society & Handicap Tracker — Technical Specification

## 1. Overview
A web application for managing a golf society. It allows players to self-register and log in using a 4-digit PIN. The app enables course setup (supporting **9-hole and 18-hole courses** with custom handicap adjustment multipliers), player tracking with handicap history, and interactive scorecard entry. 

Scorecard submissions generate calculated Stableford/Stroke Play scores and propose a handicap adjustment based on the course's difficulty settings. An **Admin Approval Queue** ensures all handicap changes and scorecards are verified before taking effect.

---

## 2. Tech Stack & Architecture
* **Framework:** Next.js (App Router, TypeScript)
* **Styling & UI:** Tailwind CSS + Shadcn UI (including keypad/number inputs)
* **Database & Auth:** Supabase (PostgreSQL + Row Level Security)
* **Session Management:** Secure HTTP-only cookies/JWTs storing player session state
* **Security:** `bcryptjs` or Web Crypto API for hashing 4-digit PINs

---

## 3. Data Model (Database Schema)

### `players`
* `id` (uuid, PK)
* `first_name` (text, required)
* `last_name` (text, required)
* `email` (text, optional)
* `current_handicap` (numeric, required)
* `pin_hash` (text, required — hashed 4-digit PIN)
* `role` (text, default: 'player' — 'player' | 'admin')
* `created_at` (timestamp)

### `handicap_history`
* `id` (uuid, PK)
* `player_id` (uuid, FK -> players.id)
* `scorecard_id` (uuid, FK -> scorecards.id, optional — linked if changed by round)
* `handicap_value` (numeric)
* `adjustment_amount` (numeric — e.g., `-0.4` or `+0.2`)
* `effective_date` (timestamp)
* `notes` (text, optional — e.g., "Round at St Andrews approved by Admin")

### `courses`
* `id` (uuid, PK)
* `name` (text, required)
* `location` (text, optional)
* `hole_count` (int, required — `9` or `18`, default: `18`)
* `handicap_cut_per_point` (numeric, default: `0.2` — handicap decrease per Stableford point > 36)
* `handicap_increase_per_point` (numeric, default: `0.1` — handicap increase per Stableford point < 36, or 0 if buffered)
* `created_at` (timestamp)

### `holes`
* `id` (uuid, PK)
* `course_id` (uuid, FK -> courses.id)
* `hole_number` (int, 1-18 for 18-hole courses; 1-9 for 9-hole courses)
* `par` (int, 3-5)
* `stroke_index` (int, 1-18 for 18-hole courses; 1-9 for 9-hole courses, unique per course)
* `white_yards` (int)
* `yellow_yards` (int)

### `scorecards`
* `id` (uuid, PK)
* `player_id` (uuid, FK -> players.id)
* `course_id` (uuid, FK -> courses.id)
* `tee_color` (text — 'white' | 'yellow')
* `round_type` (text — 'full_18' | 'front_9' | 'back_9')
* `playing_handicap` (numeric — exact playing handicap used for this round)
* `played_at` (date)
* `total_gross_stroke_play` (int, calculated)
* `total_net_stroke_play` (int, calculated)
* `total_stableford_points` (int, calculated)
* `proposed_handicap_change` (numeric, calculated — e.g., `-0.6` or `+0.2`)
* `status` (text, default: 'pending_approval' — 'pending_approval' | 'approved' | 'rejected')
* `reviewed_by` (uuid, FK -> players.id, optional)
* `reviewed_at` (timestamp, optional)

### `scores` (Hole-by-Hole Detail)
* `id` (uuid, PK)
* `scorecard_id` (uuid, FK -> scorecards.id)
* `hole_id` (uuid, FK -> holes.id)
* `gross_strokes` (int)
* `net_strokes` (int, calculated)
* `stableford_points` (int, calculated)

---

## 4. Calculation & Business Rules

### Playing Handicap & Stroke Allocation
Handicap strokes received on a given hole depend on the **Playing Handicap ($H$)**, the hole's **Stroke Index (SI)**, and whether a **18-hole** or **9-hole** round is being played:

* **For 18-Hole Rounds:**
  * Base extra strokes per hole = $\lfloor H / 18 \rfloor$
  * Additional +1 stroke if $\text{SI} \le (H \bmod 18)$

* **For 9-Hole Rounds:**
  * 9-hole Playing Handicap $H_9 = \lfloor H / 2 \rfloor$
  * Base extra strokes per hole = $\lfloor H_9 / 9 \rfloor$
  * Additional +1 stroke if $\text{SI} \le (H_9 \bmod 9)$

### Stableford Points Logic
Points per hole are calculated using the **Net Score** ($\text{Gross Strokes} - \text{Strokes Received}$):
* $\text{Net Par} = 2 \text{ points}$
* $\text{Net Birdie (-1)} = 3 \text{ points}$
* $\text{Net Eagle (-2)} = 4 \text{ points}$
* $\text{Net Albatross (-3)} = 5 \text{ points}$
* $\text{Net Bogey (+1)} = 1 \text{ point}$
* $\text{Net Double Bogey (+2) or worse} = 0 \text{ points}$

### Society Course-Specific Handicap Adjustment Logic
Standard baseline for 18 holes is **36 Stableford points** (or 18 points for 9 holes):

$$\text{Point Difference} = \text{Total Stableford Points} - \text{Target Points (36 or 18)}$$

* **If Points > Target (Player beat the course):**
  $$\text{Proposed Change} = -(\text{Point Difference} \times \text{course.handicap\_cut\_per\_point})$$
* **If Points < Target (Player played worse than handicap):**
  $$\text{Proposed Change} = +(\lvert\text{Point Difference}\rvert \times \text{course.handicap\_increase\_per\_point})$$

---

## 5. Core User Flows & Features

### A. Authentication & Registration
* **Self-Registration (`/register`):** Players register by providing First Name, Last Name, Initial Handicap, and setting a **4-digit PIN**.
* **PIN Login (`/login`):** Quick-login page with a searchable player list/dropdown and a 4-digit PIN keypad UI.
* **Roles:** `player` or `admin`.

### B. Course Management (Admin)
* Create/Edit courses with **9-hole or 18-hole** setting.
* Define difficulty factors:
  * **Cut Rate:** e.g., `0.2` or `0.5` per point over 36.
  * **Increase Rate:** e.g., `0.1` per point under 36.
* Input hole information (Par, SI 1–18 or 1–9, White & Yellow Yards).

### C. Scorecard Submission & Live Preview
* Player inputs 18 (or 9) hole scores.
* Live real-time preview shows:
  * Total Gross & Net
  * Total Stableford Points
  * **Estimated Handicap Change** (e.g., *"If approved, your handicap will change by -0.6"*).
* On submit, scorecard is saved in `pending_approval` state.

### D. Admin Approval Queue (`/admin/approvals`)
* List of all pending scorecards submitted by society members.
* Admin can click into a scorecard to inspect the full 18-hole grid.
* Admin can:
  * **Approve:** Applies the proposed handicap adjustment to `players.current_handicap`, creates an entry in `handicap_history`, and marks scorecard as `approved`.
  * **Override & Approve:** Adjust the proposed handicap change value manually before approving.
  * **Reject:** Marks scorecard as `rejected` (no handicap change occurs).

### E. Player Profile & Handicap Progression
* Player dashboard displaying profile details and current approved handicap.
* **Handicap Timeline:** Line chart showing handicap changes over time from approved rounds and manual admin adjustments.

---

## 6. Implementation Roadmap for Claude Code

Execute the project sequentially in the following phases:

- [ ] **Phase 1: Next.js Setup & Supabase Database Migration**
  - Initialize Next.js App Router project with TypeScript, Tailwind CSS, and Shadcn UI.
  - Create Supabase SQL migration files for all tables (`players`, `handicap_history`, `courses`, `holes`, `scorecards`, `scores`) including `handicap_cut_per_point`, `handicap_increase_per_point`, `proposed_handicap_change`, and `status`.
  - Generate database TypeScript type definitions.

- [ ] **Phase 2: Authentication & PIN System**
  - Build PIN hashing helper utilities (`lib/auth.ts`).
  - Create `/register` page (Name, Initial Handicap, 4-digit PIN).
  - Create `/login` page with player selector and numeric PIN keypad.
  - Implement Next.js Server Actions and session middleware for protected routes & admin roles.

- [ ] **Phase 3: Pure Golf Math Module & Unit Tests**
  - Implement `lib/golf-math.ts` with pure TypeScript functions:
    - Stroke index allowance calculation (18-hole and 9-hole).
    - Net score & Stableford point calculations.
    - Course-based proposed handicap adjustment math based on Stableford points and course cut/increase factors.
  - Add unit tests (using Vitest) verifying custom course multipliers (e.g., 0.2 vs 0.5 cuts).

- [ ] **Phase 4: Course Management UI (Admin)**
  - Create `/courses` list page and `/courses/new` admin form with 9/18 hole selection, SI validation, and custom handicap adjustment rate controls.

- [ ] **Phase 5: Interactive Scorecard Entry**
  - Create `/rounds/new` scorecard form with dynamic hole grid and live estimated handicap change preview.
  - Submit scorecards with default status `pending_approval`.

- [ ] **Phase 6: Admin Approval Queue & Workflow**
  - Create `/admin/approvals` queue page for reviewing pending scorecards.
  - Build approval modal/action to confirm or adjust the proposed handicap cut/increase.
  - Atomic transaction: Updating scorecard status, updating player's `current_handicap`, and adding to `handicap_history`.

- [ ] **Phase 7: Player Profiles, Charts & Society History**
  - Create `/players/[id]` profile view featuring a line chart of historical handicap changes.
  - Create `/rounds` society-wide feed showing approved scorecards and status badges.