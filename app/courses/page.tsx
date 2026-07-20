import Link from "next/link";
import { listCourses } from "@/app/actions/courses";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function CoursesPage() {
  const courses = await listCourses();

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="font-numeral text-xs uppercase tracking-widest text-accent">
              Society Handicap Register
            </p>
            <h1 className="font-display mt-1 text-3xl font-semibold">Courses</h1>
          </div>
          <Button asChild variant="accent">
            <Link href="/courses/new">+ New course</Link>
          </Button>
        </div>

        {courses.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No courses yet. Add your society's home course to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border border-border bg-card">
            {courses.map((course, i) => (
              <div key={course.id}>
                {i > 0 && <div className="ledger-rule" />}
                <Link
                  href={`/courses/${course.id}/edit`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-secondary"
                >
                  <div>
                    <p className="font-medium">{course.name}</p>
                    {course.location && (
                      <p className="text-sm text-muted-foreground">{course.location}</p>
                    )}
                  </div>
                  <div className="text-right font-numeral text-sm text-muted-foreground">
                    <p>{course.hole_count} holes</p>
                    <p>
                      cut {course.handicap_cut_per_point} / inc{" "}
                      {course.handicap_increase_per_point}
                    </p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
