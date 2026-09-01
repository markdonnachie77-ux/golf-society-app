import { Suspense } from "react";
import { RegisterForm } from "@/components/register-form";
import { getAppSettings } from "@/lib/app-settings";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BrandEyebrow } from "@/components/brand-eyebrow";
import { AuthHeroPhoto } from "@/components/auth-hero-photo";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const settings = await getAppSettings();
  const { next } = await searchParams;
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <main className="flex min-h-screen">
      <AuthHeroPhoto photoUrl={settings.heroPhotoUrl} />
      <div className="flex flex-1 items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <BrandEyebrow />
            <h1 className="font-display mt-1 text-3xl font-semibold">Join the society</h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Register</CardTitle>
              {settings.playersCanSelfRegister && (
                <CardDescription>
                  Your details, then a 4-digit PIN you'll use to log in.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {settings.playersCanSelfRegister ? (
                <Suspense fallback={null}>
                  <RegisterForm />
                </Suspense>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Registration is currently closed. Contact an admin to be added.
                </p>
              )}
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already registered?{" "}
            <a href={loginHref} className="font-medium text-primary underline underline-offset-2">
              Log in
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
