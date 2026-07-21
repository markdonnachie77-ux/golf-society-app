import Image from "next/image";
import { SOCIETY_NAME } from "@/lib/branding";

export function AuthHeroPhoto({ photoUrl }: { photoUrl: string | null }) {
  return (
    <div className="hidden flex-1 flex-col items-center justify-center gap-6 bg-primary p-10 md:flex">
      {photoUrl && (
        // aspect-[3/2] is a generic landscape-photo ratio, not tuned to
        // any one photo's exact dimensions — since this now renders
        // whatever a society uploads (arbitrary dimensions), object-
        // contain guarantees nothing gets cropped regardless of the
        // actual photo's proportions, letterboxing gracefully if needed
        // rather than cutting people out of a group photo. The brass
        // border gives it a "framed photo on the clubhouse wall"
        // treatment rather than a bleeding background image.
        <div className="relative aspect-[3/2] w-full max-w-lg overflow-hidden rounded-lg border-4 border-accent/70 shadow-lg">
          <Image
            src={photoUrl}
            alt={`${SOCIETY_NAME} members`}
            fill
            priority
            sizes="(min-width: 768px) 512px, 100vw"
            className="object-contain"
          />
        </div>
      )}
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
