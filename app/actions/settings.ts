"use server";

import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentSocietyId } from "@/lib/tenant";
import { isValidBrandColors, type BrandColors } from "@/lib/color";
import type { SettingKey } from "@/lib/app-settings";
import type { ActionResult } from "@/app/actions/auth";

// The read-only fetch (getAppSettings) lives in lib/app-settings.ts, not
// here — Next.js requires every export of a "use server" file to be an
// async function declaration, which rules out both a cache()-wrapped
// function and a re-export. Import getAppSettings/AppSettings/SettingKey
// from "@/lib/app-settings" directly rather than from this file.

export async function updateSetting(
  key: SettingKey,
  value: boolean | string | BrandColors
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

/**
 * Removes a setting row entirely rather than writing a null `value` —
 * app_settings.value is `not null` (0014_app_settings.sql), so a setting
 * with no override is represented by the row being absent, not by a null
 * value in it. getAppSettings() already falls back to DEFAULTS for any
 * key with no row, so deleting is the correct "reset to default."
 */
export async function deleteSetting(key: SettingKey): Promise<ActionResult> {
  await requireAdmin();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("app_settings")
    .delete()
    .eq("society_id", societyId)
    .eq("key", key);

  if (error) {
    return { ok: false, error: error.message || "Could not reset this setting." };
  }

  return { ok: true };
}

// ---------- Brand colors ----------

/**
 * Validates before writing even though updateSetting's caller here is
 * typed to BrandColors | null — `value` still arrives from a client
 * component's fetch/serialization boundary, so a malformed payload (a
 * missing key, a non-hex string) must be rejected here rather than trusted
 * and later crashing app/layout.tsx's CSS-variable derivation for every
 * visitor to this society, not just the admin who saved it.
 */
export async function updateBrandColors(colors: BrandColors | null): Promise<ActionResult> {
  if (colors === null) {
    return deleteSetting("brand_colors");
  }

  if (!isValidBrandColors(colors)) {
    return { ok: false, error: "Invalid color values." };
  }

  return updateSetting("brand_colors", colors);
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
