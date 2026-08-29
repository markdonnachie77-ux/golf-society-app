import { requireAdmin } from "@/lib/auth";
import { listCoursesForRound } from "@/app/actions/scorecards";
import { NewEventForm } from "@/components/new-event-form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BrandEyebrow } from "@/components/brand-eyebrow";

export default async function NewEventPage() {
  await requireAdmin();
  const courses = await listCoursesForRound();

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-lg">
        <div className="mb-8">
          <BrandEyebrow />
          <h1 className="font-display mt-1 text-3xl font-semibold">New event</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Created as a draft — nothing is visible to players until you publish it.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Event details</CardTitle>
            <CardDescription>You can keep editing all of this after publishing too.</CardDescription>
          </CardHeader>
          <CardContent>
            <NewEventForm courses={courses} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
