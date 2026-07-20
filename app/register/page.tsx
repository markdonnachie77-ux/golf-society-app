import { RegisterForm } from "@/components/register-form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-numeral text-xs uppercase tracking-widest text-accent">
            Society Handicap Register
          </p>
          <h1 className="font-display mt-1 text-3xl font-semibold">Join the society</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Register</CardTitle>
            <CardDescription>Your details, then a 4-digit PIN you'll use to log in.</CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterForm />
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already registered?{" "}
          <a href="/login" className="font-medium text-primary underline underline-offset-2">
            Log in
          </a>
        </p>
      </div>
    </main>
  );
}
