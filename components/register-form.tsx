"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { PinKeypad } from "@/components/pin-keypad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerPlayer } from "@/app/actions/auth";

type Step = "details" | "pin" | "confirm-pin";

export function RegisterForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [step, setStep] = React.useState<Step>("details");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [initialHandicap, setInitialHandicap] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [pinConfirm, setPinConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function handleDetailsNext(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    const hcp = Number(initialHandicap);
    if (Number.isNaN(hcp) || hcp < -10 || hcp > 54) {
      setError("Enter a valid handicap (e.g. 18.4).");
      return;
    }
    setStep("pin");
  }

  React.useEffect(() => {
    if (step === "pin" && pin.length === 4) {
      setStep("confirm-pin");
    }
  }, [pin, step]);

  React.useEffect(() => {
    async function submit() {
      if (step === "confirm-pin" && pinConfirm.length === 4) {
        if (pinConfirm !== pin) {
          setError("PINs don't match — let's try again.");
          setPin("");
          setPinConfirm("");
          setStep("pin");
          return;
        }
        setPending(true);
        setError(null);

        const formData = new FormData();
        formData.set("firstName", firstName.trim());
        formData.set("lastName", lastName.trim());
        formData.set("email", email.trim());
        formData.set("initialHandicap", initialHandicap);
        formData.set("pin", pin);
        formData.set("pinConfirm", pinConfirm);
        if (next) formData.set("next", next);

        const result = await registerPlayer(formData);
        if (result && !result.ok) {
          setError(result.error ?? "Something went wrong.");
          setPending(false);
          setPin("");
          setPinConfirm("");
          setStep("pin");
        }
      }
    }
    submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinConfirm]);

  if (step === "details") {
    return (
      <form onSubmit={handleDetailsNext} className="flex flex-col gap-5">
        <div className="flex gap-4">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email (optional)</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="initialHandicap">Initial handicap</Label>
          {/* type="text" + inputMode="decimal" instead of type="number"
              — see the comment on the playing handicap input in
              new-scorecard-form.tsx for why. */}
          <Input
            id="initialHandicap"
            type="text"
            inputMode="decimal"
            placeholder="e.g. 18.4"
            value={initialHandicap}
            onChange={(e) => setInitialHandicap(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" variant="accent" size="lg">
          Next: set your PIN
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {step === "pin" && (
        <PinKeypad value={pin} onChange={setPin} label="Choose a 4-digit PIN" disabled={pending} />
      )}
      {step === "confirm-pin" && (
        <PinKeypad
          value={pinConfirm}
          onChange={setPinConfirm}
          label="Confirm your PIN"
          disabled={pending}
        />
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {pending && <p className="text-sm text-muted-foreground">Creating your profile…</p>}
      <button
        type="button"
        onClick={() => {
          setStep("details");
          setPin("");
          setPinConfirm("");
          setError(null);
        }}
        className="text-sm text-muted-foreground underline underline-offset-2"
      >
        Back
      </button>
    </div>
  );
}
