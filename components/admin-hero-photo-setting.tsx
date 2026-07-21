"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { uploadHeroPhoto } from "@/app/actions/settings";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export function AdminHeroPhotoSetting({ currentPhotoUrl }: { currentPhotoUrl: string | null }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please choose a PNG, JPEG, or WebP image.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That image is too large — please keep it under 5MB.");
      e.target.value = "";
      return;
    }

    setPending(true);
    const formData = new FormData();
    formData.set("photo", file);

    const result = await uploadHeroPhoto(formData);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      setPending(false);
      e.target.value = "";
      return;
    }

    setPending(false);
    e.target.value = "";
    router.refresh();
  }

  return (
    <div className="px-5 py-4">
      <p className="font-medium">Login page photo</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Shown on the login and registration pages. PNG, JPEG, or WebP, up to 5MB.
      </p>

      {currentPhotoUrl && (
        <div className="relative mt-3 aspect-[3/2] w-full max-w-xs overflow-hidden rounded-md border border-border">
          <Image src={currentPhotoUrl} alt="Current login page photo" fill className="object-contain" />
        </div>
      )}

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <div className="mt-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          disabled={pending}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? "Uploading…" : currentPhotoUrl ? "Replace photo" : "Upload a photo"}
        </Button>
      </div>
    </div>
  );
}
