import Image from "next/image";
import { SOCIETY_NAME } from "@/lib/branding";

export function AuthHeroPhoto() {
  return (
    <div className="hidden flex-1 flex-col items-center justify-center gap-6 bg-primary p-10 md:flex">
      {/* aspect-[865/545] matches the source photo's own proportions
          exactly, so object-contain never has to crop anything — the
          whole group stays in frame regardless of viewport height. The
          brass border gives it a "framed photo on the clubhouse wall"
          treatment rather than a bleeding background image. */}
      <div className="relative aspect-[865/545] w-full max-w-lg overflow-hidden rounded-lg border-4 border-accent/70 shadow-lg">
        <Image
          src="/branding/society-photo.png"
          alt={`${SOCIETY_NAME} members`}
          fill
          priority
          sizes="(min-width: 768px) 512px, 100vw"
          className="object-contain"
        />
      </div>
      <div className="text-center">
        <p className="font-display text-3xl font-semibold text-primary-foreground">
          {SOCIETY_NAME}
        </p>
        <p className="mt-1 text-sm text-primary-foreground/80">
          Handicaps, scorecards, and society history — all in one place.
        </p>
      </div>
    </div>
  );
}
