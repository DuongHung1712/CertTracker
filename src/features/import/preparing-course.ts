type PreparingCourse = { id: string; name: string; prepares_for_id: string | null; cost: number | null };

/**
 * The one course whose cost and hours stand for an exam when a row names no course studied. An exam can have
 * several preparation courses: prefer the one named like the exam (the self-preparing course), then the first
 * that carries a cost, then the first. `courses` arrive ordered by id, so the choice is stable.
 */
export function preparingCourseByCertificate<C extends PreparingCourse>(
  courses: C[],
  certificateNames: ReadonlyMap<string, string>,
): Map<string, C> {
  const chosen = new Map<string, C>();
  for (const course of courses) {
    const certificateId = course.prepares_for_id;
    if (!certificateId) continue;
    const current = chosen.get(certificateId);
    if (!current || rank(course, certificateNames.get(certificateId)) > rank(current, certificateNames.get(certificateId))) {
      chosen.set(certificateId, course);
    }
  }
  return chosen;
}

function rank(course: PreparingCourse, certificateName: string | undefined): number {
  if (course.name === certificateName) return 2;
  return course.cost !== null ? 1 : 0;
}
