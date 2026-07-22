import { requireAdmin } from "@/lib/auth";
import { getAppSettings } from "@/lib/app-settings";
import { SettingToggle } from "@/components/admin-setting-toggle";
import { AdminHeroPhotoSetting } from "@/components/admin-hero-photo-setting";
import { AdminBrandColorsSetting } from "@/components/admin-brand-colors-setting";
import { BrandEyebrow } from "@/components/brand-eyebrow";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getAppSettings();

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <BrandEyebrow />
          <h1 className="font-display mt-1 text-3xl font-semibold">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Application-wide settings for the whole society.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <SettingToggle
            settingKey="players_can_log_own_rounds"
            label="Players can log their own rounds"
            description="Turn off to require every round to go through an admin instead — self-submitted scores stay off, admins can still log a round on behalf of any player."
            initialValue={settings.playersCanLogOwnRounds}
          />
          <div className="ledger-rule" />
          <AdminHeroPhotoSetting currentPhotoUrl={settings.heroPhotoUrl} />
          <div className="ledger-rule" />
          <AdminBrandColorsSetting currentColors={settings.brandColors} />
        </div>
      </div>
    </main>
  );
}
