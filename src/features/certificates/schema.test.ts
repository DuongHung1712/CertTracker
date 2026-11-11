import { describe, expect, it } from "vitest";
import { certificateSchema } from "@/features/certificates/schema";

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
      ["name", "Enter the certificate name"],
      ["certTypeId", "Choose a certificate type"],
      ["providerId", "Choose a provider"],
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
      ["courseId", "Choose the course that grants this completion"],
    ]);
    expect(certificateSchema.safeParse({ ...exam, kind: "completion", courseId: COURSE }).success).toBe(true);
  });

  it("an exam never keeps a course", () => {
    expect(certificateSchema.parse({ ...exam, courseId: COURSE }).courseId).toBeNull();
  });
});
