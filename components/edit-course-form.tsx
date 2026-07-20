"use client";

import { CourseForm, type CourseFormInitialData } from "@/components/course-form";
import { updateCourse } from "@/app/actions/courses";

export function EditCourseForm({
  courseId,
  initial,
}: {
  courseId: string;
  initial: CourseFormInitialData;
}) {
  return (
    <CourseForm
      initial={initial}
      submitLabel="Save changes"
      onSubmit={(formData) => updateCourse(courseId, formData)}
    />
  );
}
