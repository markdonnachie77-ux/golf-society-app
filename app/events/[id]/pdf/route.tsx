import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireAdmin } from "@/lib/auth";
import { getEventDetail } from "@/app/actions/events";
import { EVENT_FORMAT_LABEL } from "@/lib/event-format";
import { EventSignUpPdf } from "@/lib/event-signup-pdf";

function formatEventDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTeeTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":");
  const d = new Date(2000, 0, 1, Number(hours), Number(minutes));
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * GET, not a Server Action — a Server Action can't hand back a binary
 * file for the browser to download the way a Route Handler's Response
 * naturally can. requireAdmin() throws rather than redirecting (it's
 * designed for exactly this — Server Actions and Route Handlers, per
 * its own doc comment in lib/auth.ts), so it's wrapped here rather than
 * left to bubble up into a generic 500.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { id } = await params;
  const event = await getEventDetail(id);

  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  if (event.status !== "published") {
    return NextResponse.json(
      { error: "Publish this event before generating a sign-up sheet — a draft isn't visible or registerable yet." },
      { status: 400 }
    );
  }

  // Same host-derived protocol heuristic as app/layout.tsx's
  // generateMetadata, for consistency — localhost/127.0.0.1 in local
  // dev, https everywhere else (Vercel always terminates TLS).
  const host = request.headers.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
  const signUpUrl = `${protocol}://${host}/events/${event.id}`;

  const qrDataUrl = await QRCode.toDataURL(signUpUrl, { margin: 1, width: 400 });

  const pdfBuffer = await renderToBuffer(
    <EventSignUpPdf
      eventName={event.name}
      courseName={event.courseName}
      eventDateFormatted={formatEventDate(event.eventDate)}
      firstTeeTimeFormatted={formatTeeTime(event.firstTeeTime)}
      formatLabel={EVENT_FORMAT_LABEL[event.format]}
      capacity={event.capacity}
      registeredCount={event.registrations.length}
      qrDataUrl={qrDataUrl}
      signUpUrl={signUpUrl}
    />
  );

  // Slugified event name for the downloaded filename — spaces and
  // anything non-alphanumeric collapse to a single hyphen, so "Summer
  // Cup 2026!" becomes "summer-cup-2026.pdf" rather than a filename with
  // characters that could confuse a browser or filesystem.
  const filenameSlug = event.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filenameSlug || "event"}-signup.pdf"`,
    },
  });
}
