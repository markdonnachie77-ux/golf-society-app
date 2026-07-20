-- supabase/seed.sql
-- Local dev convenience only. The admin PIN below is 0000 — bcrypt hash
-- shown is illustrative; regenerate with lib/auth.ts's hashPin() rather
-- than trusting this literal hash long-term (bcrypt salts differ per run).
--
-- Run: supabase db reset (applies migrations then this seed)

insert into players (first_name, last_name, current_handicap, pin_hash, role)
values ('Society', 'Admin', 12.0, '$2a$10$examplehashreplacewithrealbcrypthash', 'admin')
on conflict do nothing;

with new_course as (
  insert into courses (name, location, hole_count, handicap_cut_per_point, handicap_increase_per_point)
  values ('Sample Links', 'Society Home Course', 18, 0.2, 0.1)
  returning id
)
insert into holes (course_id, hole_number, par, stroke_index, white_yards, yellow_yards)
select
  new_course.id,
  n,
  case when n in (3, 7, 12, 15) then 3
       when n in (5, 9, 14, 18) then 5
       else 4 end as par,
  -- arbitrary but valid 1..18 permutation for stroke index
  (array[5,13,1,17,9,3,15,7,11,6,18,2,10,16,4,12,8,14])[n] as stroke_index,
  300 + (n * 7) as white_yards,
  280 + (n * 7) as yellow_yards
from new_course, generate_series(1, 18) as n;
