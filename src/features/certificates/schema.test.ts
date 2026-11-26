import { describe, expect, it } from "vitest";
import { certificateDeleteHint, certificateWithIdSchema, certificateSheetTitle, certificateSchema, courseWithCompletionSchema } from "@/features/certificates/schema";

const ID = "00000000-0000-0000-0000-000000000000";
const COURSE = "00000000-0000-0000-0000-000000000009";

const exam = {
  kind: "exam" as const,
  name: "AWS Solutions Architect Associate",
  certTypeId: ID,
  providerId: ID,
  level: "Associate",
  validityMonths: 36,
  url: "https://aws.amazon.com/certification/",
  courseId: null,
};

function messages(input: unknown) {
  const result = certificateSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => [i.path.join("."), i.message]);
}

describe("certificateSchema", () => {
  it("accepts a filled exam certificate", () => {
    expect(certificateSchema.safeParse(exam).success).toBe(true);
  });

  it("asks for a kind", () => {
    expect(messages({ ...exam, kind: "" })).toContainEqual(["kind", "Choose a kind"]);
  });

  it("asks for a name, a type and a provider", () => {
    expect(messages({ ...exam, name: "  ", certTypeId: "", providerId: "" })).toEqual([
      ["name", "Enter the name"],
      ["certTypeId", "Type is required"],
      ["providerId", "Provider is required"],
    ]);
  });

  it("rejects a validity of 0 and treats an empty one as no expiry", () => {
    expect(messages({ ...exam, validityMonths: 0 })).toEqual([["validityMonths", "Validity must be greater than 0"]]);
    expect(certificateSchema.parse({ ...exam, validityMonths: "" }).validityMonths).toBeNull();
  });

  it("level and link are optional; a bad link is rejected", () => {
    expect(certificateSchema.safeParse({ ...exam, level: "", url: "" }).success).toBe(true);
    expect(certificateSchema.safeParse({ ...exam, url: "not a url" }).success).toBe(false);
  });

  it("a completion needs the course that grants it", () => {
    expect(messages({ ...exam, kind: "completion", courseId: null })).toEqual([
      ["courseId", "Choose the course that grants this certificate"],
    ]);
    expect(certificateSchema.safeParse({ ...exam, kind: "completion", courseId: COURSE }).success).toBe(true);
  });

  it("never saves a validity for a completion, and keeps it for an exam", () => {
    const completion = { ...exam, kind: "completion" as const, courseId: COURSE };
    expect(certificateSchema.parse({ ...completion, validityMonths: 36 }).validityMonths).toBeNull();
    expect(certificateSchema.parse({ ...completion, validityMonths: "12" }).validityMonths).toBeNull();
    expect(certificateWithIdSchema.parse({ ...completion, id: ID, validityMonths: 36 }).validityMonths).toBeNull();
    expect(certificateSchema.parse(exam).validityMonths).toBe(36);
  });

  it("words the sheet title and the delete hint after the kind", () => {
    expect(certificateSheetTitle(false, "exam")).toBe("Add certificate");
    expect(certificateSheetTitle(false, "completion")).toBe("Add course certificate");
    expect(certificateSheetTitle(true, "completion")).toBe("Edit course certificate");
    expect(certificateDeleteHint("exam")).toBe("A certificate that members hold cannot be deleted. This cannot be undone.");
    expect(certificateDeleteHint("completion")).toBe("A course certificate that members hold cannot be deleted. This cannot be undone.");
  });

  it("an exam never keeps a course", () => {
    expect(certificateSchema.parse({ ...exam, courseId: COURSE }).courseId).toBeNull();
  });
});

describe("courseWithCompletionSchema", () => {
  const course = { name: "Intro", providerId: ID };

  it("needs a certificate type when the switch is on", () => {
    const result = courseWithCompletionSchema.safeParse({ ...course, grantsCompletion: true });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ path: ["completionCertTypeId"], message: "Type is required" });
    expect(courseWithCompletionSchema.safeParse({ ...course, grantsCompletion: true, completionCertTypeId: COURSE }).success).toBe(true);
  });

  it("ignores the type and link when the switch is off", () => {
    const result = courseWithCompletionSchema.safeParse({ ...course, grantsCompletion: false, completionCertTypeId: COURSE, completionUrl: "https://x.test" });
    expect(result.data).toMatchObject({ completionCertTypeId: "", completionUrl: null });
  });
});
