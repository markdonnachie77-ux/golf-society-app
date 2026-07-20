import { Suspense } from "react";
import { listPlayersForLogin } from "@/app/actions/auth";
import { LoginForm } from "@/components/login-form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default async function LoginPage() {
  const players = await listPlayersForLogin();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-numeral text-xs uppercase tracking-widest text-accent">
            Society Handicap Register
          </p>
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
    </main>
  );
}
