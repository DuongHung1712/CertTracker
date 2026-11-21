import { RECORD_STATUS_LABEL } from "@/components/status/labels";
import { HEADER_ALIASES, IMPORT_FIELD_LABEL, IMPORT_FIELDS, type ImportField } from "@/features/import/clean";
import { REFUND_STATUS_LABEL } from "@/features/records/schema";

/** Owner decision: no Kind column, so an import only ever creates exam certificates. */
export const EXAM_ONLY_NOTE = "Every new certificate created by an import is an exam certificate. Add course completions in the Catalogue.";

export type GuideColumn = {
  field: ImportField;
  /** The header the template uses. */
  header: string;
  required: boolean;
  description: string;
  example: string;
  /** Other header spellings the import reads (folded: no accents, lower case), straight from `HEADER_ALIASES`. */
  aliases: string[];
};

const orList = (items: string[]): string => `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;

const DETAILS: Record<ImportField, { required?: boolean; description: string; example: string }> = {
  email: { required: true, description: "The member's email. An existing member is found by it; an unknown one is created.", example: "jane@company.com" },
  recordType: {
    description: "Certificate for a result, Learning for a course or exam you are preparing. Blank: Completed rows are certificates, others learning.",
    example: "Learning",
  },
  courseName: { required: true, description: "The exam certificate (on a Learning row: the exam you are preparing for; optional when Course studied is set). A name that is not in the catalogue is created, which needs a Provider.", example: "AWS Certified Cloud Practitioner" },
  memberName: { description: "Needed to create a new member; an existing member keeps their name.", example: "Jane Nguyen" },
  team: { description: "A team that already exists in Organization. A new member without a team is created with none.", example: "Team Alpha" },
  provider: { description: "Needed to create a new certificate. Also picks one when several certificates share a name.", example: "AWS" },
  certType: { description: "The type of a new certificate. An existing certificate keeps its catalogue type.", example: "Cloud" },
  validityMonths: { description: "Months a new certificate stays valid: a number, \"3 years\" or \"no expiry\".", example: "36" },
  cost: { description: "Exam fee of a new certificate, as a number. Needs Currency.", example: "150" },
  costCurrency: { description: "VND or USD. Needs Cost.", example: "USD" },
  estHours: { description: "Study hours for a new certificate, a whole number above 0.", example: "40" },
  courseStudied: { description: "A course that already exists in the Catalogue. On a Learning row it is the course followed.", example: "AWS Cloud Practitioner Bootcamp" },
  status: { description: `${orList(Object.values(RECORD_STATUS_LABEL))}.`, example: RECORD_STATUS_LABEL.in_progress },
  progress: { description: "0 to 100, or 0 to 1 when every value in the column is between 0 and 1.", example: "50" },
  plannedExamDate: { description: "Date as dd/mm/yyyy.", example: "30/06/2027" },
  issuedDate: { description: "Date as dd/mm/yyyy. Needed when the status is Completed.", example: "15/03/2026" },
  certificateUrl: { description: "A link starting with http:// or https://.", example: "https://www.credly.com/badges/123" },
  viaCompany: { description: "Yes or No: whether the company registered the exam.", example: "Yes" },
  refundStatus: { description: `${orList(Object.values(REFUND_STATUS_LABEL))}.`, example: REFUND_STATUS_LABEL.pending },
  notes: { description: "Free text, up to 2000 characters.", example: "Retake in autumn" },
};

/** Required columns first, then in the order the template lists them. */
export const GUIDE_COLUMNS: GuideColumn[] = IMPORT_FIELDS.map((field) => ({
  field,
  header: IMPORT_FIELD_LABEL[field],
  required: DETAILS[field].required === true,
  description: DETAILS[field].description,
  example: DETAILS[field].example,
  aliases: HEADER_ALIASES[field].filter((alias) => alias !== IMPORT_FIELD_LABEL[field].toLowerCase()),
})).sort((a, b) => Number(b.required) - Number(a.required));
