-- 0016_hero_photo_storage.sql
--
-- Lets each society upload their own login/register hero photo, replacing
-- the previously-hardcoded EVS team photo. This is the first thing in the
-- app to use Supabase Storage (see supabase/config.toml — Storage was
-- disabled entirely until now, since nothing else needed it).
--
-- Design: the uploaded photo's public URL is stored as a plain setting
-- (key 'hero_photo_url') in the same app_settings table every other
-- setting already lives in — no new table needed, this is exactly the
-- extensibility the key/value settings design was built for back in
-- 0014_app_settings.sql. A society with no hero_photo_url set gets a
-- clean, photo-less panel (just the fairway-green background + name) —
-- NOT a fallback to EVS's photo. Showing one society's actual members'
-- faces as another society's default branding would be a strange first
-- impression for a brand-new tenant.
--
-- EVS itself keeps its exact current look with zero action needed: this
-- migration seeds EVS's own hero_photo_url setting to point at the
-- existing static asset path, so nothing about EVS's login page changes
-- — the app just now treats that photo as their own configured setting
-- rather than a hardcoded default.

insert into storage.buckets (id, name, public)
values ('society-photos', 'society-photos', true)
on conflict (id) do nothing;

-- Uploads go through the server-role client (see lib/supabase/server.ts),
-- which bypasses storage.objects' RLS the same way it bypasses every
-- other table's — same reasoning as 0007_rls_policies.sql. Marking the
-- bucket "public" is what lets the uploaded photo be fetched by anyone
-- (including a logged-out visitor on the login page) via its public URL,
-- without needing a signed URL or auth check on every page load.

insert into app_settings (society_id, key, value)
values (
  '00000000-0000-0000-0000-000000000001',
  'hero_photo_url',
  '"/branding/society-photo.png"'::jsonb
)
on conflict (society_id, key) do nothing;
