import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { calculateMemberKpis } from "@/features/dashboard/member-metrics";
import { doneRecord, makeRecord } from "@/features/records/__fixtures__/record-row";
import { MemberKpiCards } from "./member-kpi-cards";

const render = (records: Parameters<typeof calculateMemberKpis>[0]) =>
  renderToStaticMarkup(<MemberKpiCards kpis={calculateMemberKpis(records)} />);

// Value of the tile whose `dt` text is exactly `label` (the e2e lookup works the same way).
function tileValue(html: string, label: string): string | undefined {
  const tile = new RegExp(`<dt[^>]*>.*?>\\s*${label}\\s*</a></dt>.*?<dd[^>]*>(\\d+)</dd>`, "s").exec(html);
  return tile?.[1];
}

describe("MemberKpiCards tiles", () => {
  it("shows the four tiles and links each one to /me narrowed to its items (or /courses when nothing in progress)", () => {
    const htmlEmpty = render([]);
    expect(htmlEmpty).toContain('href="/me?view=held"');
    expect(htmlEmpty).toContain('href="/me?view=needs-action"');
    expect(htmlEmpty).toContain('href="/courses"');
    expect(htmlEmpty).toContain("Explore catalogue →");
    expect(htmlEmpty).toContain('href="/me?view=up-next"');

    const htmlWithProgress = render([
      makeRecord({ id: "p1", status: "in_progress", progress: 30, certificateName: "AWS Dev" }),
    ]);
    expect(htmlWithProgress).toContain('href="/me?view=in-progress"');
    expect(htmlWithProgress).not.toMatch(/Study hours|Profile health|Active credentials/);
  });

  it("Held counts valid exams and finished course completions, not unfinished ones", () => {
    const html = render([
      doneRecord(120, { id: "a" }),
      makeRecord({ id: "b", certificateKind: "completion", expiryStatus: "No Expiry", daysToExpiry: null }),
      makeRecord({ id: "c", certificateKind: "completion", status: "in_progress", expiryStatus: "N/A", daysToExpiry: null }),
    ]);
    expect(tileValue(html, "Held")).toBe("2");
    expect(html).toContain("1 exam certificate · 1 course completion");
  });

  it("Held says None yet when nothing is held", () => {
    const html = render([]);
    expect(tileValue(html, "Held")).toBe("0");
    expect(html).toContain("None yet");
  });

  it("Needs action adds expired and expiring exams and names the nearest expiry", () => {
    const expired = render([doneRecord(-3, { id: "a" })]);
    expect(tileValue(expired, "Needs action")).toBe("1");
    expect(expired).toContain("1 expired exam");
    const expiring = render([doneRecord(1, { id: "a" }), doneRecord(-2, { id: "b" })]);
    expect(tileValue(expiring, "Needs action")).toBe("2");
    const soon = render([doneRecord(20, { id: "a" })]);
    expect(soon).toContain("Next: AWS Solutions Architect Associate");
    expect(soon).toContain("20 days left");
    expect(render([doneRecord(300)])).toContain("Nothing to renew");
  });

  it("In progress names the item furthest along with its percentage", () => {
    const html = render([
      makeRecord({ id: "a", status: "in_progress", progress: 25, certificateName: "Slow", expiryStatus: "N/A", daysToExpiry: null }),
      makeRecord({ id: "b", status: "in_progress", progress: 60, certificateName: "Fast", expiryStatus: "N/A", daysToExpiry: null }),
    ]);
    expect(tileValue(html, "In progress")).toBe("2");
    expect(html).toContain("Fast");
    expect(html).toContain("60%");
    expect(render([])).toContain("Nothing in progress");
  });

  it("Up next counts not-started items and shows the nearest planned exam date or asks for one", () => {
    const planned = render([
      makeRecord({ id: "a", status: "not_started", plannedExamDate: "2026-12-12", certificateName: "Later", expiryStatus: "N/A", daysToExpiry: null }),
      makeRecord({ id: "b", status: "not_started", plannedExamDate: "2026-11-30", certificateName: "Sooner", expiryStatus: "N/A", daysToExpiry: null }),
    ]);
    expect(tileValue(planned, "Up next")).toBe("2");
    expect(planned).toContain("Sooner");
    expect(planned).toContain("30/11/2026");
    const undated = render([makeRecord({ id: "a", status: "not_started", plannedExamDate: null, expiryStatus: "N/A", daysToExpiry: null })]);
    expect(undated).toContain("No exam date set");
    expect(undated).toContain("Set a date");
    expect(render([])).toContain("Nothing planned");
  });
});

describe("MemberKpiCards: waiting for approval", () => {
  const waiting = makeRecord({ id: "w", certificateKind: "completion", expiryStatus: "No Expiry", daysToExpiry: null, approval: "waiting" });

  it("Held leaves out the waiting item and its summary says how many wait", () => {
    const html = render([doneRecord(120, { id: "a" }), waiting]);
    expect(tileValue(html, "Held")).toBe("1");
    expect(html).toContain("1 exam certificate · 0 course completions · 1 waiting for approval");
  });

  it("links the waiting part to the waiting view", () => {
    expect(render([waiting])).toContain('href="/me?view=waiting"');
    expect(render([doneRecord(120, { id: "a" })])).not.toContain("view=waiting");
  });

  it("says None yet and the waiting line when only waiting items exist", () => {
    expect(render([waiting])).toContain("None yet · 1 waiting for approval");
  });

  it("shows no waiting line when nothing waits", () => {
    expect(render([doneRecord(120, { id: "a" })])).not.toContain("waiting for approval");
  });
});
