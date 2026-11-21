import type { ComboboxOption } from "@/components/entity-combobox";
import type { CertificateChoice } from "@/features/records/certificate-course";

/** Exams a learning item can aim for: exam certificates the viewer can see, except rejected proposals. */
export const toExamOptions = (certificates: CertificateChoice[]): ComboboxOption[] =>
  certificates
    .filter((certificate) => certificate.kind === "exam" && certificate.catalogueStatus !== "rejected")
    .map(({ id, label, hint }) => ({ id, label, hint }));
