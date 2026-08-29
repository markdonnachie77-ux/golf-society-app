import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { listEvents } from "@/app/actions/events";
import { Button } from "@/components/ui/button";
import { BrandEyebrow } from "@/components/brand-eyebrow";

function formatEventDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function EventRow({ event }: { event: Awaited<ReturnType<typeof listEvents>>[number] }) {
  const spotsLeft = event.capacity - event.registered_count;
  return (
    <Link
      href={`/events/${event.id}`}
      className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-secondary"
    >
      <div>
        <p className="font-medium">
          {event.name}
          {event.status === "draft" && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">draft</span>
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          {event.course_name} · {formatEventDate(event.event_date)}
        </p>
      </div>
      <span className="font-numeral text-sm text-muted-foreground">
        {event.registered_count}/{event.capacity}
        {spotsLeft <= 0 && event.status === "published" && (
          <span className="ml-1 text-destructive">full</span>
        )}
      </span>
    </Link>
  );
}

export default async function EventsPage() {
  const session = await requireSession();
  const events = await listEvents();

  // listEvents sorts ascending by date, which — left as one flat list —
  // would put every past event before every upcoming one. Splitting
  // here and reversing the past half (most recent first) keeps what
  // people actually want to see — what's coming up — at the top,
  // without needing a second query or changing what the action itself
  // returns.
  const today = todayDateString();
  const upcoming = events.filter((e) => e.event_date >= today);
  const past = events
    .filter((e) => e.event_date < today)
    .sort((a, b) => (a.event_date < b.event_date ? 1 : -1));

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <BrandEyebrow />
            <h1 className="font-display mt-1 text-3xl font-semibold">Events</h1>
          </div>
          {session.role === "admin" && (
            <Button asChild size="sm">
              <Link href="/events/new">New event</Link>
            </Button>
          )}
        </div>

        <section className="mb-8">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Upcoming
          </h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming events.</p>
          ) : (
            <div className="rounded-lg border border-border bg-card">
              {upcoming.map((event, i) => (
                <div key={event.id}>
                  {i > 0 && <div className="ledger-rule" />}
                  <EventRow event={event} />
                </div>
              ))}
            </div>
          )}
        </section>

        {past.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Past
            </h2>
            <div className="rounded-lg border border-border bg-card">
              {past.map((event, i) => (
                <div key={event.id}>
                  {i > 0 && <div className="ledger-rule" />}
                  <EventRow event={event} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
