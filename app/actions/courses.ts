"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { validateHoleSet, type HoleRowInput } from "@/lib/course-validation";
import type { ActionResult } from "@/app/actions/auth";

const courseDetailsSchema = z.object({
  name: z.string().trim().min(1, "Course name is required").max(120),
  location: z.string().trim().max(160).optional(),
  holeCount: z.union([z.literal(9), z.literal(18)]),
  handicapCutPerPoint: z
    .number({ invalid_type_error: "Cut rate must be a number" })
    .min(0, "Cut rate can't be negative")
    .max(9.99, "Cut rate looks too high"),
  handicapIncreasePerPoint: z
    .number({ invalid_type_error: "Increase rate must be a number" })
    .min(0, "Increase rate can't be negative")
    .max(9.99, "Increase rate looks too high"),
});

const holeRowSchema = z.object({
  holeNumber: z.number().int().min(1),
  par: z.number().int(),
  strokeIndex: z.number().int(),
  whiteYards: z.number().int().positive().nullable(),
  yellowYards: z.number().int().positive().nullable(),
});

function parseCourseFormData(formData: FormData) {
  const holeCountRaw = Number(formData.get("holeCount"));
  const detailsParsed = courseDetailsSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    location: String(formData.get("location") ?? "") || undefined,
    holeCount: holeCountRaw,
    handicapCutPerPoint: Number(formData.get("handicapCutPerPoint")),
    handicapIncreasePerPoint: Number(formData.get("handicapIncreasePerPoint")),
  });

  let holes: HoleRowInput[] = [];
  const holesRaw = String(formData.get("holesJson") ?? "");
  try {
    const parsedJson = JSON.parse(holesRaw);
    const holesParsed = z.array(holeRowSchema).safeParse(parsedJson);
    if (holesParsed.success) {
      holes = holesParsed.data;
    }
  } catch {
    // fall through — validateHoleSet below will catch the empty array
  }

  return { detailsParsed, holes };
}

export async function createCourse(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const { detailsParsed, holes } = parseCourseFormData(formData);
  if (!detailsParsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of detailsParsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const details = detailsParsed.data;
  const holeErrors = validateHoleSet(holes, details.holeCount);
  if (holeErrors.length > 0) {
    return { ok: false, error: holeErrors.join(" ") };
  }

  const supabase = createServiceClient();

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .insert({
      name: details.name,
      location: details.location ?? null,
      hole_count: details.holeCount,
      handicap_cut_per_point: details.handicapCutPerPoint,
      handicap_increase_per_point: details.handicapIncreasePerPoint,
    })
    .select("id")
    .single();

  if (courseError || !course) {
    return { ok: false, error: "Could not create the course. Please try again." };
  }

  const { error: holesError } = await supabase.from("holes").insert(
    holes.map((h) => ({
      course_id: course.id,
      hole_number: h.holeNumber,
      par: h.par,
      stroke_index: h.strokeIndex,
      white_yards: h.whiteYards,
      yellow_yards: h.yellowYards,
    }))
  );

  if (holesError) {
    // Compensating rollback — supabase-js doesn't expose a cross-table
    // transaction for plain inserts, so we clean up manually on failure.
    await supabase.from("courses").delete().eq("id", course.id);
    return {
      ok: false,
      error:
        "Could not save the hole details (check stroke indices are all unique and in range).",
    };
  }

  redirect("/courses");
}

export async function updateCourse(courseId: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const { detailsParsed, holes } = parseCourseFormData(formData);
  if (!detailsParsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of detailsParsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const details = detailsParsed.data;
  const holeErrors = validateHoleSet(holes, details.holeCount);
  if (holeErrors.length > 0) {
    return { ok: false, error: holeErrors.join(" ") };
  }

  const supabase = createServiceClient();

  const { error: courseError } = await supabase
    .from("courses")
    .update({
      name: details.name,
      location: details.location ?? null,
      hole_count: details.holeCount,
      handicap_cut_per_point: details.handicapCutPerPoint,
      handicap_increase_per_point: details.handicapIncreasePerPoint,
    })
    .eq("id", courseId);

  if (courseError) {
    return { ok: false, error: "Could not update the course. Please try again." };
  }

  // Simplest correct approach for an edit: replace the whole hole set.
  // Holes have no independent identity the rest of the app depends on
  // (scores reference hole_id, so editing an existing course's holes
  // after rounds have been recorded against it will orphan those old
  // hole references — acceptable for pre-season setup, but worth knowing
  // if you edit a course mid-season with existing scorecards on it).
  const { error: deleteError } = await supabase.from("holes").delete().eq("course_id", courseId);
  if (deleteError) {
    return { ok: false, error: "Could not update hole details. Please try again." };
  }

  const { error: holesError } = await supabase.from("holes").insert(
    holes.map((h) => ({
      course_id: courseId,
      hole_number: h.holeNumber,
      par: h.par,
      stroke_index: h.strokeIndex,
      white_yards: h.whiteYards,
      yellow_yards: h.yellowYards,
    }))
  );

  if (holesError) {
    return {
      ok: false,
      error:
        "Could not save the hole details (check stroke indices are all unique and in range).",
    };
  }

  redirect("/courses");
}

export async function listCourses() {
  await requireAdmin();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, location, hole_count, handicap_cut_per_point, handicap_increase_per_point")
    .order("name", { ascending: true });

  if (error) return [];
  return data;
}

export async function getCourseWithHoles(courseId: string) {
  await requireAdmin();
  const supabase = createServiceClient();

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  if (courseError || !course) return null;

  const { data: holes, error: holesError } = await supabase
    .from("holes")
    .select("*")
    .eq("course_id", courseId)
    .order("hole_number", { ascending: true });

  if (holesError) return null;

  return { course, holes: holes ?? [] };
}
