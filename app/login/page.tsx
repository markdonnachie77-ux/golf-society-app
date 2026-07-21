import { Suspense } from "react";
import { listPlayersForLogin } from "@/app/actions/auth";
import { getAppSettings } from "@/app/actions/settings";
import { LoginForm } from "@/components/login-form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BrandEyebrow } from "@/components/brand-eyebrow";
import { AuthHeroPhoto } from "@/components/auth-hero-photo";

export default async function LoginPage() {
  const [players, settings] = await Promise.all([listPlayersForLogin(), getAppSettings()]);

  return (
    <main className="flex min-h-screen">
      <AuthHeroPhoto photoUrl={settings.heroPhotoUrl} />
      <div className="flex flex-1 items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <BrandEyebrow />
            <h1 className="font-display mt-1 text-3xl font-semibold">Welcome back</h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Log in</CardTitle>
              <CardDescription>Find your name, then enter your PIN.</CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={null}>
                <LoginForm players={players} />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
