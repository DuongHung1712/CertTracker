import { render } from "@react-email/components";
import type { ReactElement } from "react";

// Without this the plain text runs table cells together ("Chứng chỉHạnCòn lại") and shouts every heading in capitals.
const PLAIN_TEXT = {
  htmlToTextOptions: {
    selectors: [
      { selector: "table", format: "dataTable", options: { uppercaseHeaderCells: false, colSpacing: 3, maxColumnWidth: 80 } },
      { selector: "h1", options: { uppercase: false } },
      { selector: "h2", options: { uppercase: false } },
    ],
  },
} as const;

/** HTML for the mail client plus a plain-text alternative (spam filters penalise HTML-only mail). */
export async function renderEmail(element: ReactElement): Promise<{ html: string; text: string }> {
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true, ...PLAIN_TEXT })]);
  return { html, text };
}
