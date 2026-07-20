import { notFound } from "next/navigation";
import { getCourseWithHoles } from "@/app/actions/courses";
import { EditCourseForm } from "@/components/edit-course-form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BrandEyebrow } from "@/components/brand-eyebrow";

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getCourseWithHoles(id);

  if (!result) {
    notFound();
  }

  const { course, holes } = result;

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <BrandEyebrow />
          <h1 className="font-display mt-1 text-3xl font-semibold">Edit course</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{course.name}</CardTitle>
            <CardDescription>
              Editing the hole grid replaces all hole records for this course.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EditCourseForm
              courseId={course.id}
              initial={{
                name: course.name,
                location: course.location ?? "",
                holeCount: course.hole_count as 9 | 18,
                handicapCutPerPoint: course.handicap_cut_per_point,
                handicapIncreasePerPoint: course.handicap_increase_per_point,
                holes: holes.map((h) => ({
                  holeNumber: h.hole_number,
                  par: h.par,
                  strokeIndex: h.stroke_index,
                  whiteYards: h.white_yards,
                  yellowYards: h.yellow_yards,
                })),
              }}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
