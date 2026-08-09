import "server-only";
import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentSocietyId } from "@/lib/tenant";
import { isValidBrandColors, type BrandColors } from "@/lib/color";

/**
 * Known setting keys. Adding a new setting means: add its key here, add a
 * field + default to AppSettings/DEFAULTS below, and add a row for it in
 * getAppSettings' mapping. No migration needed — app_settings is a plain
 * key/value table (see 0014_app_settings.sql, re-keyed per-society in
 * 0015_future_proof_multi_tenancy.sql) — just insert/update a row.
 */
export type SettingKey =
  | "players_can_log_own_rounds"
  | "hero_photo_url"
  | "brand_colors"
  | "players_can_self_register";

export interface AppSettings {
  /** When false, only admins can log rounds — for a player, even their
   * own. Admins logging on behalf of another player are never affected
   * by this setting either way. */
  playersCanLogOwnRounds: boolean;
  /** Public URL of this society's login/register hero photo, or null if
   * they haven't uploaded one — in which case the hero panel renders
   * without a photo entirely (see components/auth-hero-photo.tsx), not a
   * fallback to any other society's image. */
  heroPhotoUrl: string | null;
  /** This society's custom Primary/Secondary/Accent brand colors, or null
   * to use the app's built-in "clubhouse ledger" palette. Expanded into
   * CSS custom properties (base + a readable foreground, light + dark) by
   * lib/color.ts and applied in app/layout.tsx. */
  brandColors: BrandColors | null;
  /** When false, /register shows a "closed" message instead of the form,
   * and registerPlayer itself rejects the attempt — the server action is
   * the actual boundary, same reasoning as playersCanLogOwnRounds (see
   * app/actions/scorecards.ts's createScorecard): the page hiding the
   * form is just UX, not what actually stops someone from registering.
   * Doesn't affect admin-created players (app/actions/auth.ts's
   * adminCreatePlayer) — that's a separate path entirely, meant to keep
   * working as the only way in once this is turned off. */
  playersCanSelfRegister: boolean;
}

const DEFAULTS: AppSettings = {
  playersCanLogOwnRounds: true,
  heroPhotoUrl: null,
  brandColors: null,
  playersCanSelfRegister: true,
};

/**
 * Deliberately NOT gated behind requireSession() — settings need to be
 * readable by a logged-out visitor, specifically so the login/register
 * pages can show this society's hero photo before anyone has
 * authenticated. Nothing stored here is sensitive (a boolean toggle, a
 * public photo URL, and brand colors), so this is safe to expose without a
 * session. Writing settings still requires admin (see updateSetting in
 * app/actions/settings.ts).
 *
 * Kept in its own plain module (not the "use server" actions file) so it
 * can be wrapped in React's cache() here — every Server Action export in a
 * "use server" file is registered as an invokable action, which a cached
 * data-fetcher has no business being. cache() then dedupes the several
 * independent calls a single request already makes (root layout,
 * generateMetadata, and whichever page is rendering) down to one query.
 */
export const getAppSettings = cache(async function getAppSettings(): Promise<AppSettings> {
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  // app_settings' primary key is (society_id, key) as of
  // 0015_future_proof_multi_tenancy.sql — without this filter, every
  // society's settings rows would come back mixed together, and the
  // byKey map below would end up keyed only by `key`, silently picking
  // up whichever society's row happened to arrive for it.
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .eq("society_id", societyId);

  if (error || !data) return { ...DEFAULTS };

  const byKey = new Map(data.map((row) => [row.key, row.value]));

  const rawBrandColors = byKey.get("brand_colors");

  return {
    playersCanLogOwnRounds:
      (byKey.get("players_can_log_own_rounds") as boolean | undefined) ??
      DEFAULTS.playersCanLogOwnRounds,
    heroPhotoUrl: (byKey.get("hero_photo_url") as string | undefined) ?? DEFAULTS.heroPhotoUrl,
    // Re-validated on read, not just on write — guards against a row that
    // was written by a future/older shape of this setting (or edited by
    // hand in Studio) silently producing malformed CSS variables.
    brandColors: isValidBrandColors(rawBrandColors) ? rawBrandColors : DEFAULTS.brandColors,
    playersCanSelfRegister:
      (byKey.get("players_can_self_register") as boolean | undefined) ??
      DEFAULTS.playersCanSelfRegister,
  };
});
