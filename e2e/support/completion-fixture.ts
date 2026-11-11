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
    optionName: `${certificateName} · Course completion`,
    /** Records first (the foreign key restricts), then the completion, then its course. */
    async remove() {
      await admin.from("training_records").delete().eq("certificate_id", certificate.data.id);
      await admin.from("certificates").delete().eq("id", certificate.data.id);
      await admin.from("courses").delete().eq("id", course.data.id);
    },
  };
}
