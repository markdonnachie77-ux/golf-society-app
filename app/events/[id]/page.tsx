import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getEventDetail, getEventLeaderboard } from "@/app/actions/events";
import { listAllPlayers } from "@/app/actions/players";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { BrandEyebrow } from "@/components/brand-eyebrow";
import { EventRegistrationButton } from "@/components/event-registration-button";
import {
  AdminEventRegistrationManager,
  AdminRemoveRegistrationButton,
} from "@/components/admin-event-registration-manager";
import { AdminEventStatusActions } from "@/components/admin-event-status-actions";
import { ConfirmLeaderboardButton } from "@/components/confirm-leaderboard-button";
import { EVENT_FORMAT_LABEL } from "@/lib/event-format";

function formatEventDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTeeTime(timeStr: string): string {
  // first_tee_time is a plain "HH:MM:SS" (or "HH:MM") string from
  // Postgres' time column — parsed against an arbitrary fixed date
  // purely to reuse toLocaleTimeString's formatting, the date part is
  // discarded entirely.
  const [hours, minutes] = timeStr.split(":");
  const d = new Date(2000, 0, 1, Number(hours), Number(minutes));
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const event = await getEventDetail(id);
  if (!event) {
    notFound();
  }

  const isAdmin = session.role === "admin";
  const isRegistered = event.registrations.some((r) => r.playerId === session.playerId);
  const isFull = event.registrations.length >= event.capacity;
  const registeredPlayerIds = new Set(event.registrations.map((r) => r.playerId));

  const [players, leaderboard] = await Promise.all([
    isAdmin ? listAllPlayers() : Promise.resolve([]),
    getEventLeaderboard(event.id),
  ]);

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <BrandEyebrow />
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-semibold">{event.name}</h1>
            {event.status === "draft" && (
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                Draft
              </span>
            )}
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              {EVENT_FORMAT_LABEL[event.format]}
            </span>
            {event.usesCompetitionHandicapIndex && (
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                Competition Handicap Index
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {event.courseName} · {formatEventDate(event.eventDate)} · First tee{" "}
            {formatTeeTime(event.firstTeeTime)}
          </p>
        </div>

        {isAdmin && (
          <Card className="mb-6">
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex flex-wrap items-center gap-2">
                <AdminEventStatusActions eventId={event.id} status={event.status} />
                {event.status === "published" && (
                  // Plain <a>, not next/link — this hits a Route Handler
                  // that returns a file with Content-Disposition:
                  // attachment, not a page. A real anchor tag gets a
                  // predictable browser-native download; Link's
                  // client-side routing is built for page transitions,
                  // not file downloads, and isn't the right tool here.
                  <a
                    href={`/events/${event.id}/pdf`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Download sign-up sheet
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Registration</CardTitle>
            <CardDescription>
              {event.registrations.length} / {event.capacity} spaces filled
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EventRegistrationButton
              eventId={event.id}
              isRegistered={isRegistered}
              isFull={isFull}
              selfRegistrationEnabled={event.selfRegistrationEnabled}
            />
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="mb-6">
            <CardContent className="pt-4 sm:pt-6">
              <AdminEventRegistrationManager
                eventId={event.id}
                players={players}
                registeredPlayerIds={registeredPlayerIds}
              />
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Leaderboard</CardTitle>
            <CardDescription>
              {EVENT_FORMAT_LABEL[event.format]} ·{" "}
              {event.format === "stroke_play" ? "lowest net score wins" : "highest points wins"} ·
              approved rounds only
            </CardDescription>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No approved rounds tagged to this event yet.
              </p>
            ) : (
              <ol className="space-y-2">
                {leaderboard.map((entry, i) => (
                  <li key={entry.scorecardId} className="flex items-center justify-between">
                    <span className="flex items-center gap-3">
                      <span className="font-numeral w-5 text-sm text-muted-foreground">{i + 1}</span>
                      <span className="text-sm">{entry.playerName}</span>
                    </span>
                    <span className="font-numeral text-sm font-semibold">
                      {entry.score}
                      {event.format === "stableford" ? " pts" : ""}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {event.leaderboardConfirmedAt ? (
              <p className="mt-4 rounded-lg bg-secondary px-3 py-2 text-sm">
                {event.winnerPlayerName ? (
                  <>
                    🏆 Winner: <span className="font-medium">{event.winnerPlayerName}</span>
                    {event.handicapCutForWinner > 0 && (
                      <> · handicap cut by {event.handicapCutForWinner}</>
                    )}
                  </>
                ) : (
                  <>Leaderboard confirmed — no single winner (empty leaderboard or a tie for first).</>
                )}
              </p>
            ) : (
              isAdmin &&
              event.status === "published" && (
                <div className="mt-4">
                  <ConfirmLeaderboardButton
                    eventId={event.id}
                    handicapCutForWinner={event.handicapCutForWinner}
                  />
                </div>
              )
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Who's registered</CardTitle>
          </CardHeader>
          <CardContent>
            {event.registrations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one has registered yet.</p>
            ) : (
              <>
                {/* Mirrors each row's own flex structure below exactly
                    (empty left side, same right-side flex+gap group) so
                    the label lines up with the numbers column rather
                    than sitting at the card's left edge like a generic
                    subtitle. The invisible "Remove" placeholder reserves
                    the same width the real link takes in the admin
                    view, so the label's position doesn't shift between
                    admin and non-admin. */}
                <div className="mb-1 flex items-center justify-between">
                  <span />
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {event.usesCompetitionHandicapIndex
                        ? `Competition Handicap (${event.teeColor === "white" ? "White" : "Yellow"} tees)`
                        : "Handicap"}
                    </span>
                    {isAdmin && (
                      <span className="invisible text-xs" aria-hidden="true">
                        Remove
                      </span>
                    )}
                  </span>
                </div>
                <ul className="space-y-2">
                  {event.registrations.map((r) => (
                    <li key={r.playerId} className="flex items-center justify-between">
                      <span className="text-sm">{r.playerName}</span>
                      <span className="flex items-center gap-3">
                        <span className="font-numeral text-sm text-muted-foreground">
                          {event.usesCompetitionHandicapIndex ? (
                            r.competitionHandicap !== null ? (
                              r.competitionHandicap
                            ) : (
                              <span className="text-xs italic">rating not set</span>
                            )
                          ) : (
                            r.handicap
                          )}
                        </span>
                        {isAdmin && (
                          <AdminRemoveRegistrationButton eventId={event.id} playerId={r.playerId} />
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
