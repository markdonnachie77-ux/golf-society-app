import { requireAdmin } from "@/lib/auth";

export default async function AdminApprovalsPage() {
  await requireAdmin();

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-semibold">Approval queue</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Built in Phase 6 — pending scorecards will list here for approve /
          override / reject.
        </p>
      </div>
    </main>
  );
}
