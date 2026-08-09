import { requireAdmin } from "@/lib/auth";
import { CreatePlayerForm } from "@/components/create-player-form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BrandEyebrow } from "@/components/brand-eyebrow";

export default async function NewPlayerPage() {
  await requireAdmin();

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-lg">
        <div className="mb-8">
          <BrandEyebrow />
          <h1 className="font-display mt-1 text-3xl font-semibold">Add a player</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Creates their account with a generated PIN — you'll see it once to pass along, and can
            reset it later from their profile if needed.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Player details</CardTitle>
            <CardDescription>Created as a regular player — role changes stay a manual step.</CardDescription>
          </CardHeader>
          <CardContent>
            <CreatePlayerForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
