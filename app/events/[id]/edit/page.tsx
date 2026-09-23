import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getEventDetail } from "@/app/actions/events";
import { listCoursesForRound } from "@/app/actions/scorecards";
import { EditEventForm } from "@/components/edit-event-form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BrandEyebrow } from "@/components/brand-eyebrow";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const [event, courses] = await Promise.all([getEventDetail(id), listCoursesForRound()]);

  if (!event) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-lg">
        <div className="mb-8">
          <BrandEyebrow />
          <h1 className="font-display mt-1 text-3xl font-semibold">Edit event</h1>
          <p className="mt-1 text-sm text-muted-foreground">{event.name}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Event details</CardTitle>
            <CardDescription>
              {event.status === "published"
                ? "This event is already published — changes take effect immediately."
                : "Still a draft — nothing here is visible to players yet."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EditEventForm
              eventId={id}
              initial={{
                name: event.name,
                courseId: event.courseId,
                eventDate: event.eventDate,
                firstTeeTime: event.firstTeeTime,
                capacity: event.capacity,
                selfRegistrationEnabled: event.selfRegistrationEnabled,
                format: event.format,
                handicapCutForWinner: event.handicapCutForWinner,
                usesCompetitionHandicapIndex: event.usesCompetitionHandicapIndex,
                teeColor: event.teeColor,
                depositGbp: event.depositGbp,
                remainingBalanceGbp: event.remainingBalanceGbp,
                overrideHandicapRates: event.overrideHandicapRates,
                handicapCutPerPointOverride: event.handicapCutPerPointOverride,
                handicapIncreasePerPointOverride: event.handicapIncreasePerPointOverride,
                cutTargetOverride: event.cutTargetOverride,
                increaseThresholdOverride: event.increaseThresholdOverride,
              }}
              courses={courses}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
