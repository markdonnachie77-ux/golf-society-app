import Image from "next/image";
import { SOCIETY_NAME } from "@/lib/branding";

export function AuthHeroPhoto() {
  return (
    <div className="relative hidden flex-1 md:block">
      <Image
        src="/branding/society-photo.png"
        alt={`${SOCIETY_NAME} members`}
        fill
        priority
        sizes="50vw"
        className="object-cover"
      />
      {/* Fairway-green gradient rather than plain black — ties the photo
          into the same palette as the rest of the app instead of a
          generic dark-overlay-for-legibility treatment. */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/10 to-transparent" />
      <div className="absolute bottom-10 left-10 right-10">
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
