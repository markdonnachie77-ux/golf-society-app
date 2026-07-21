"use server";

import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentSocietyId } from "@/lib/tenant";
import type { ActionResult } from "@/app/actions/auth";

/**
 * Known setting keys. Adding a new setting means: add its key here, add a
 * field + default to AppSettings/DEFAULTS below, and add a row for it in
 * getAppSettings' mapping. No migration needed — app_settings is a plain
 * key/value table (see 0014_app_settings.sql, re-keyed per-society in
 * 0015_future_proof_multi_tenancy.sql) — just insert/update a row.
 */
export type SettingKey = "players_can_log_own_rounds" | "hero_photo_url";

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
}

const DEFAULTS: AppSettings = {
  playersCanLogOwnRounds: true,
  heroPhotoUrl: null,
};

/**
 * Deliberately NOT gated behind requireSession() — settings need to be
 * readable by a logged-out visitor, specifically so the login/register
 * pages can show this society's hero photo before anyone has
 * authenticated. Nothing stored here is sensitive (a boolean toggle and
 * a public photo URL), so this is safe to expose without a session.
 * Writing settings still requires admin — see updateSetting below.
 */
export async function getAppSettings(): Promise<AppSettings> {
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

  return {
    playersCanLogOwnRounds:
      (byKey.get("players_can_log_own_rounds") as boolean | undefined) ??
      DEFAULTS.playersCanLogOwnRounds,
    heroPhotoUrl: (byKey.get("hero_photo_url") as string | undefined) ?? DEFAULTS.heroPhotoUrl,
  };
}

export async function updateSetting(
  key: SettingKey,
  value: boolean | string | null
): Promise<ActionResult> {
  const session = await requireAdmin();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  // onConflict must match the table's actual unique constraint —
  // (society_id, key), not `key` alone, since 0015 re-keyed this table
  // specifically so each society can set this independently. Using the
  // old "key" onConflict target here would either error (no matching
  // constraint) or, worse, silently upsert against the wrong constraint
  // if one still existed — this was a real, easy-to-miss consequence of
  // the earlier schema change that needed catching here.
  const { error } = await supabase.from("app_settings").upsert(
    {
      key,
      value,
      society_id: societyId,
      updated_by: session.playerId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "society_id,key" }
  );

  if (error) {
    return { ok: false, error: error.message || "Could not save this setting." };
  }

  return { ok: true };
}

// ---------- Hero photo upload ----------

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];

export async function uploadHeroPhoto(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const societyId = await getCurrentSocietyId();

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image to upload." };
  }
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return { ok: false, error: "Please upload a PNG, JPEG, or WebP image." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "That image is too large — please keep it under 5MB." };
  }

  const supabase = createServiceClient();

  // Fixed path per society (no extension) rather than preserving the
  // original filename — re-uploading always replaces the same object
  // (upsert: true), so there's exactly one current photo per society to
  // look up, with no need to track which extension is "current".
  const path = `${societyId}/hero-photo`;

  const { error: uploadError } = await supabase.storage
    .from("society-photos")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { ok: false, error: uploadError.message || "Could not upload the photo." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("society-photos").getPublicUrl(path);

  // Cache-bust the URL so next/image and the browser don't keep showing
  // a previously-cached image after a re-upload replaces the same path.
  const bustedUrl = `${publicUrl}?t=${Date.now()}`;

  return updateSetting("hero_photo_url", bustedUrl);
}
