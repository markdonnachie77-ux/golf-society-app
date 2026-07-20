-- 0003_create_holes.sql
-- Hole-by-hole detail for a course. hole_number and stroke_index must fall
-- within 1..course.hole_count (1-9 or 1-18) — enforced via trigger since a
-- plain CHECK constraint can't reference another table.

create table if not exists holes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  hole_number int not null check (hole_number between 1 and 18),
  par int not null check (par between 3 and 5),
  stroke_index int not null check (stroke_index between 1 and 18),
  white_yards int check (white_yards is null or white_yards > 0),
  yellow_yards int check (yellow_yards is null or yellow_yards > 0),
  unique (course_id, hole_number),
  unique (course_id, stroke_index)
);

create or replace function validate_hole_against_course()
returns trigger as $$
declare
  v_hole_count int;
begin
  select hole_count into v_hole_count from courses where id = new.course_id;

  if v_hole_count is null then
    raise exception 'Course % does not exist', new.course_id;
  end if;

  if new.hole_number < 1 or new.hole_number > v_hole_count then
    raise exception 'hole_number % is out of range for a %-hole course', new.hole_number, v_hole_count;
  end if;

  if new.stroke_index < 1 or new.stroke_index > v_hole_count then
    raise exception 'stroke_index % is out of range for a %-hole course', new.stroke_index, v_hole_count;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_validate_hole on holes;
create trigger trg_validate_hole
  before insert or update on holes
  for each row execute function validate_hole_against_course();

alter table holes enable row level security;
