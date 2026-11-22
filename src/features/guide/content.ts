import type { Role } from "@/components/status/labels";

export type GuideStep = { title: string; text: string };
export type Guide = { title: string; intro: string; steps: GuideStep[] };

/** What a person sees when they sign in, for their role. Plain words; each step names a place in the app. */
export const GUIDE: Record<Role, Guide> = {
  member: {
    title: "Welcome to CertTracker",
    intro: "Your certificates and learning in one place. Here is what to do first.",
    steps: [
      {
        title: "Add a certificate you hold",
        text: "Open My learning and choose Add certificate. If you have the file, upload it first: AI can fill in the form when your admin has switched it on. Check everything before you save.",
      },
      {
        title: "Plan what you are studying",
        text: "Use the Learning tab for an exam or a course you are working on, and update your progress as you go.",
      },
      {
        title: "Wait for approval",
        text: "Your manager checks each completed certificate. Only approved certificates count in your numbers.",
      },
      {
        title: "Not in the list?",
        text: "Propose it from the form. You can start using it straight away while an admin reviews it.",
      },
    ],
  },
  manager: {
    title: "Welcome to CertTracker",
    intro: "Your team's certificates in one place. Here is where to start.",
    steps: [
      {
        title: "See your team",
        text: "The dashboard shows who holds which certificates, what expires soon and who has none yet.",
      },
      {
        title: "Approve what members submit",
        text: "Open Learning and use the Waiting for approval filter. Approve a certificate, or return it with a note.",
      },
      {
        title: "Keep renewals on track",
        text: "Certificates close to expiry are listed on the dashboard, and you get email reminders.",
      },
    ],
  },
  admin: {
    title: "Welcome to CertTracker",
    intro: "Everything about certificates for the whole centre. Here is where to start.",
    steps: [
      {
        title: "Set up people",
        text: "Add members under Members, then build teams and give each manager their teams under Organisation.",
      },
      {
        title: "Keep the Catalogue",
        text: "The Catalogue lists the certificates and courses people can pick. Members can propose new ones: approve or reject them in Data quality or in the Catalogue tabs.",
      },
      {
        title: "Check data quality",
        text: "Data quality lists missing evidence, overdue exams and proposals waiting for you.",
      },
      {
        title: "Import and export",
        text: "Load existing certificates from a spreadsheet, or download the data, under Import / Export.",
      },
      {
        title: "Switch AI reading on or off",
        text: "Settings has the switch for reading certificate files with AI, and a daily limit for each person.",
      },
    ],
  },
};
