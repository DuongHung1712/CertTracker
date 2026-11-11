import { describe, expect, it } from "vitest";
import { courseAfterCertificateChange, studyCoursesFor, type CertificateChoice, type StudyCourse } from "@/features/records/certificate-course";

const exam: CertificateChoice = { id: "saa", label: "SAA · Exam", kind: "exam", grantingCourse: null };
const otherExam: CertificateChoice = { id: "gcp", label: "GCP · Exam", kind: "exam", grantingCourse: null };
const completion: CertificateChoice = { id: "ml", label: "ML · Course completion", kind: "completion", grantingCourse: { id: "c-ml", name: "ML" } };
const courses: StudyCourse[] = [
  { id: "c-udemy", name: "Udemy SAA", preparesForId: "saa" },
  { id: "c-gcp", name: "GCP prep", preparesForId: "gcp" },
];

describe("studyCoursesFor", () => {
  it("lists only the courses that prepare for the certificate", () => {
    expect(studyCoursesFor(courses, "saa").map((course) => course.id)).toEqual(["c-udemy"]);
    expect(studyCoursesFor(courses, "ml")).toEqual([]);
  });
});

describe("courseAfterCertificateChange", () => {
  it("is empty until a certificate is chosen", () => {
    expect(courseAfterCertificateChange(undefined, courses, "c-udemy")).toBe("");
  });

  it("keeps a course that prepares for the new exam", () => {
    expect(courseAfterCertificateChange(exam, courses, "c-udemy")).toBe("c-udemy");
  });

  it("clears a course that prepares for another exam", () => {
    expect(courseAfterCertificateChange(otherExam, courses, "c-udemy")).toBe("");
  });

  it("uses the granting course for a completion", () => {
    expect(courseAfterCertificateChange(completion, courses, "c-udemy")).toBe("c-ml");
  });
});
