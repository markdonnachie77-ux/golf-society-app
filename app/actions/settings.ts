"use server";

import { requireSession, requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/auth";

/**
 * Known setting keys. Adding a new setting means: add its key here, add a
 * field + default to AppSettings/DEFAULTS below, and add a row for it in
 * getAppSettings' mapping. No migration needed — app_settings is a plain
 * key/value table (see 0014_app_settings.sql) — just insert/update a row.
 */
export type SettingKey = "players_can_log_own_rounds";

export interface AppSettings {
  /** When false, only admins can log rounds — for a player, even their
   * own. Admins logging on behalf of another player are never affected
   * by this setting either way. */
  playersCanLogOwnRounds: boolean;
}

const DEFAULTS: AppSettings = {
  playersCanLogOwnRounds: true,
};

/** Any authenticated session can read settings — needed to decide what
 * to show/allow on ordinary pages (e.g. whether to show "Log a round").
 * Only admins can WRITE (see updateSetting below). Missing rows fall back
 * to DEFAULTS, so a fresh database with no settings rows yet behaves
 * exactly like today — nothing silently breaks for an existing install. */
export async function getAppSettings(): Promise<AppSettings> {
  await requireSession();
  const supabase = createServiceClient();

  const { data, error } = await supabase.from("app_settings").select("key, value");

  if (error || !data) return { ...DEFAULTS };

  const byKey = new Map(data.map((row) => [row.key, row.value]));

  return {
    playersCanLogOwnRounds:
      (byKey.get("players_can_log_own_rounds") as boolean | undefined) ??
      DEFAULTS.playersCanLogOwnRounds,
  };
}

export async function updateSetting(key: SettingKey, value: boolean): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase.from("app_settings").upsert(
    {
      key,
      value,
      updated_by: session.playerId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) {
    return { ok: false, error: error.message || "Could not save this setting." };
  }

  return { ok: true };
}
