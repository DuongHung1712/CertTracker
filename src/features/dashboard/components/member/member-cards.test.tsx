import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuditVerificationCard } from "./audit-verification-card";
import { ComplianceCopilotCard } from "./compliance-copilot-card";
import { MemberProfileCard } from "./member-profile-card";
import { QuarterlyTargetCard } from "./quarterly-target-card";
import { SkillsMatrixCard } from "./skills-matrix-card";
import { TargetRoleCard } from "./target-role-card";

// Copy WP6 (ux-copy-audit.md §3): every Coming soon card is a `ComingSoonCard` with the chip "Coming soon",
// a plain title and one line ending "Not available yet.", disabled controls and no fake data.
const CARDS: { name: string; element: ReactElement; title: string; description: string }[] = [
  {
    name: "ComplianceCopilotCard",
    element: <ComplianceCopilotCard />,
    title: "Ask about certificates",
    description: "Ask questions about exam refunds, renewals and approved courses. Not available yet.",
  },
  {
    name: "SkillsMatrixCard",
    element: <SkillsMatrixCard />,
    title: "My skills",
    description: "See your skill levels next to your team&#x27;s standards. Not available yet.",
  },
  {
    name: "QuarterlyTargetCard",
    element: <QuarterlyTargetCard />,
    title: "Quarterly goals",
    description: "Set a certificate goal for each quarter and follow it with your team. Not available yet.",
  },
  {
    name: "TargetRoleCard",
    element: <TargetRoleCard />,
    title: "Next career role",
    description: "See what your next role needs: certificates, experience and skills. Not available yet.",
  },
  {
    name: "AuditVerificationCard",
    element: <AuditVerificationCard />,
    title: "Certificate review",
    description: "Your manager will check your evidence and confirm each certificate. Not available yet.",
  },
  {
    name: "MemberProfileCard (focus area)",
    element: <MemberProfileCard fullName="Lê Minh Châu" teamName="Team Cloud" careerRoleName="Engineer" yoeYears={3} />,
    title: "Focus area",
    description: "Choose the area you want to grow in, such as cloud or security. Not available yet.",
  },
];

/** Placeholder data that looks real: a status, a count, a date, an invented checklist or a value for everyone. */
const FAKE = [
  "All clear",
  "0 Pending",
  "Pending",
  "Q1 2027",
  "Q1 compliance objective",
  "Get 2 certificates in Cloud by Q1",
  "1 of 2 completed",
  "Staff engineer",
  "Lead cloud migration project",
  "Cloud Architecture",
  "Kubernetes",
  "Progress meter",
  ">SOON<",
  "Compliance copilot",
  "Specialization",
];

/** The markup of the `<section aria-label="{title} (Coming soon)">` element, up to its closing tag. */
function cardHtml(html: string, title: string): string {
  const start = html.indexOf(`<section aria-label="${title} (Coming soon)"`);
  expect(start, `ComingSoonCard "${title}" is rendered`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (const m of html.slice(start).matchAll(/<(\/?)section\b[^>]*>/g)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, start + m.index + m[0].length);
  }
  return html.slice(start);
}

describe("[copy] Coming soon cards", () => {
  it.each(CARDS)("$name is a ComingSoonCard titled $title", ({ element, title, description }) => {
    const card = cardHtml(renderToStaticMarkup(element), title);
    expect(card).toContain(`<h3 class="text-body font-semibold text-foreground">${title}</h3>`);
    expect(card).toContain("<span>Coming soon</span>");
    expect(card.match(/Coming soon</g)).toHaveLength(1);
    expect(card).toContain(`>${description}<`);
    expect(card).toContain("Not available yet.");
  });

  it.each(CARDS)("$name has no enabled control", ({ element, title }) => {
    const card = cardHtml(renderToStaticMarkup(element), title);
    expect(card, "a Coming soon card links nowhere").not.toMatch(/<a\s/);
    for (const [tag] of card.matchAll(/<(?:input|button|textarea|select)\b[^>]*>/g)) {
      expect(tag, tag).toMatch(/\sdisabled=""/);
      expect(tag, tag).toContain('aria-disabled="true"');
    }
  });

  it("the Ask card keeps its disabled question box (the loop above is vacuous without it)", () => {
    const card = cardHtml(renderToStaticMarkup(CARDS[0].element), CARDS[0].title);
    const box = /<input\b[^>]*aria-label="Your question"[^>]*>/.exec(card)?.[0];
    expect(box, "question box").toBeDefined();
    expect(box).toMatch(/\sdisabled=""/);
    expect(box).toContain('aria-disabled="true"');
  });

  it.each(CARDS)("$name shows no fake data", ({ element }) => {
    const html = renderToStaticMarkup(element);
    for (const fake of FAKE) expect(html, fake).not.toContain(fake);
  });

  it("the profile card states experience in plain words, not tenure", () => {
    const html = renderToStaticMarkup(CARDS[5].element);
    expect(html).toContain("3 years of experience");
    expect(html).not.toContain("tenure");
  });
});
