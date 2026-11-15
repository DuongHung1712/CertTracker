import { signInAsSeedAdmin } from "./restore-seed";

const SEED_PROVIDER_ID = "5eed0000-0000-0000-0000-00000000c101";
const SEED_CERT_TYPE_ID = "5eed0000-0000-0000-0000-00000000c001";

/** A course that grants a course completion, created for one test (the seed's copy may be missing from a database that was not reset). */
export async function createCompletionFixture() {
  const admin = await signInAsSeedAdmin();
  const stamp = Date.now();
  const courseName = `Completion course ${stamp}`;
  const certificateName = `Completion ${stamp}`;
  const course = await admin.from("courses").insert({ name: courseName, provider_id: SEED_PROVIDER_ID, refundable: false }).select("id").single();
  if (course.error) throw new Error(`create course: ${course.error.message}`);
  const certificate = await admin
    .from("certificates")
    .insert({ name: certificateName, kind: "completion", cert_type_id: SEED_CERT_TYPE_ID, provider_id: SEED_PROVIDER_ID, course_id: course.data.id })
    .select("id")
    .single();
  if (certificate.error) throw new Error(`create completion: ${certificate.error.message}`);

  return {
    courseId: course.data.id,
    certificateId: certificate.data.id,
    courseName,
    certificateName,
    optionName: certificateName,
    /** Records first (the foreign key restricts), then the completion, then its course. */
    async remove() {
      const results = [
        await admin.from("training_records").delete().eq("certificate_id", certificate.data.id),
        await admin.from("certificates").delete().eq("id", certificate.data.id),
        await admin.from("courses").delete().eq("id", course.data.id),
      ];
      for (const { error } of results) if (error) throw new Error(`remove completion fixture: ${error.message}`);
    },
  };
}

/**
 * Safety net for a fixture whose `finally` never ran (a test that timed out or a killed worker): removes every
 * "Completion <timestamp>" certificate, its records and its "Completion course <timestamp>" course. Call it from afterEach.
 */
export async function sweepCompletionFixtures() {
  // shortcut: the timestamp-only name pattern cannot tell a leftover from a fixture of a test running right now; that is safe only because playwright.config.ts sets workers: 1, so lift it before running specs in parallel.
  const admin = await signInAsSeedAdmin();
  const certificates = await admin.from("certificates").select("id").filter("name", "match", "^Completion [0-9]+$");
  if (certificates.error) throw new Error(`find leftover completions: ${certificates.error.message}`);
  const ids = certificates.data.map((row) => row.id);
  if (ids.length > 0) {
    const records = await admin.from("training_records").delete().in("certificate_id", ids);
    if (records.error) throw new Error(`sweep records: ${records.error.message}`);
    const removed = await admin.from("certificates").delete().in("id", ids);
    if (removed.error) throw new Error(`sweep completions: ${removed.error.message}`);
  }
  const courses = await admin.from("courses").delete().filter("name", "match", "^Completion course [0-9]+$");
  if (courses.error) throw new Error(`sweep courses: ${courses.error.message}`);
}
