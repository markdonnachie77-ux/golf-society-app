-- 0023_event_deposit_balance.sql
--
-- Two purely informational fields on an event: deposit and remaining
-- balance, both in GBP. Nothing in this app calculates or reasons
-- about these values — they're captured and displayed, same as an
-- event's name or course, not tied to registration, capacity, or any
-- payment processing.
--
-- Both nullable, no default: an event may not track a deposit/balance
-- at all (a free event, or one where payment isn't handled this way),
-- and an admin may not have the figures to hand yet when first setting
-- an event up. Null means "not set", not "£0" — the display layer
-- treats these differently (an unset field is simply omitted, not
-- shown as a zero amount, which would misleadingly imply "nothing
-- owed" rather than "not tracked").

alter table events
  add column if not exists deposit_gbp numeric(8, 2)
    check (deposit_gbp is null or deposit_gbp >= 0);

alter table events
  add column if not exists remaining_balance_gbp numeric(8, 2)
    check (remaining_balance_gbp is null or remaining_balance_gbp >= 0);

comment on column events.deposit_gbp is
  'Purely informational, in GBP. Null means not set, not £0 — shown on the event page and sign-up PDF when present.';
comment on column events.remaining_balance_gbp is
  'Purely informational, in GBP. Null means not set, not £0 — shown on the event page and sign-up PDF when present.';
