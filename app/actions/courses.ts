"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentSocietyId } from "@/lib/tenant";
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
  const societyId = await getCurrentSocietyId();

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
      society_id: societyId,
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
      society_id: societyId,
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
  const societyId = await getCurrentSocietyId();

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

  // Scoping the UPDATE itself by society_id — not just id — means an
  // admin can never edit a course belonging to a different tenant, even
  // if they somehow obtained its id. If the id exists but belongs to
  // another society, this matches zero rows rather than affecting
  // someone else's data; .select() lets us detect that and stop before
  // touching holes at all.
  const { data: updatedCourse, error: courseError } = await supabase
    .from("courses")
    .update({
      name: details.name,
      location: details.location ?? null,
      hole_count: details.holeCount,
      handicap_cut_per_point: details.handicapCutPerPoint,
      handicap_increase_per_point: details.handicapIncreasePerPoint,
    })
    .eq("id", courseId)
    .eq("society_id", societyId)
    .select("id");

  if (courseError) {
    return { ok: false, error: "Could not update the course. Please try again." };
  }
  if (!updatedCourse || updatedCourse.length === 0) {
    return { ok: false, error: "Course not found." };
  }

  // Upsert (not delete+insert) — matches existing hole rows by
  // (course_id, hole_number), the unique constraint from
  // 0003_create_holes.sql, and updates them in place, preserving their
  // `id`. This matters because scores.hole_id has ON DELETE RESTRICT (see
  // 0005_create_scores.sql): once a round has been played on this course,
  // its scores rows reference specific hole ids, and deleting those hole
  // rows — the previous delete-then-reinsert approach — gets rejected by
  // Postgres with a foreign-key violation. That was a real bug, not a
  // hypothetical: editing just the cut/increase rate on a course that
  // already had a round recorded against it failed here.
  //
  // society_id is already confirmed correct by the update check above —
  // courseId couldn't have matched a row above if it belonged to a
  // different tenant, so it's safe to use directly here.
  const { error: upsertError } = await supabase.from("holes").upsert(
    holes.map((h) => ({
      course_id: courseId,
      hole_number: h.holeNumber,
      par: h.par,
      stroke_index: h.strokeIndex,
      white_yards: h.whiteYards,
      yellow_yards: h.yellowYards,
      society_id: societyId,
    })),
    { onConflict: "course_id,hole_number" }
  );

  if (upsertError) {
    return {
      ok: false,
      error:
        "Could not save the hole details (check stroke indices are all unique and in range).",
    };
  }

  // If the hole count went down (e.g. 18 -> 9), any now-excess holes
  // (hole_number beyond the new count) need removing. This can still hit
  // the same ON DELETE RESTRICT if a round was already played using one
  // of those specific holes — surfaced as a clear, specific reason rather
  // than a generic failure, since silently reassigning or losing that
  // round's hole detail isn't a safe default to pick automatically.
  const { error: excessHolesError } = await supabase
    .from("holes")
    .delete()
    .eq("course_id", courseId)
    .eq("society_id", societyId)
    .gt("hole_number", details.holeCount);

  if (excessHolesError) {
    return {
      ok: false,
      error:
        "Reduced the hole count, but couldn't remove the extra holes — a round has likely already been recorded using one of them, so this course can't shrink below holes that are already in use.",
    };
  }

  redirect("/courses");
}

export async function listCourses() {
  await requireAdmin();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, location, hole_count, handicap_cut_per_point, handicap_increase_per_point")
    .eq("society_id", societyId)
    .order("name", { ascending: true });

  if (error) return [];
  return data;
}

export async function getCourseWithHoles(courseId: string) {
  await requireAdmin();
  const societyId = await getCurrentSocietyId();
  const supabase = createServiceClient();

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .eq("society_id", societyId)
    .single();

  if (courseError || !course) return null;

  // holes are already implicitly scoped correctly here — course_id was
  // just confirmed to belong to the caller's society above — but
  // filtering by society_id here too costs nothing and matches the
  // "every query redundantly correct, not reliant on getting one earlier
  // check right" approach used throughout this file.
  const { data: holes, error: holesError } = await supabase
    .from("holes")
    .select("*")
    .eq("course_id", courseId)
    .eq("society_id", societyId)
    .order("hole_number", { ascending: true });

  if (holesError) return null;

  return { course, holes: holes ?? [] };
}
