import { NewCourseForm } from "@/components/new-course-form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function NewCoursePage() {
  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <p className="font-numeral text-xs uppercase tracking-widest text-accent">
            Society Handicap Register
          </p>
          <h1 className="font-display mt-1 text-3xl font-semibold">New course</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Course details</CardTitle>
            <CardDescription>
              Set the hole count first — it determines how many rows appear below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewCourseForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
