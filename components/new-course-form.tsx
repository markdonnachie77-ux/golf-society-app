"use client";

import { CourseForm } from "@/components/course-form";
import { createCourse } from "@/app/actions/courses";

export function NewCourseForm() {
  return <CourseForm onSubmit={createCourse} submitLabel="Create course" />;
}
