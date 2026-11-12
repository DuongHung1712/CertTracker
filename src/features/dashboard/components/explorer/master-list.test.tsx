import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MasterList } from "@/features/dashboard/components/explorer/master-list";
import type { BreakdownRow } from "@/features/dashboard/schema";

// C1 (cleanup-review.md): the approved design has a SOLID teal selected row. Keyboard focus is shown only by an
// offset `focus-visible` ring, so the ring reaches 3:1 against the card gap, not against the teal fill.

function row(key: string, label: string): BreakdownRow {
  return { key, label, headcount: 4, people: 3, records: 5, done: 3, inProgress: 1, notStarted: 1, valid: 2, expired: 1 };
}

const html = renderToStaticMarkup(
  <MasterList
    rows={[row("a", "Team Cloud"), row("b", "Team Data")]}
    activeKey="a"
    onSelectKey={() => {}}
    groupLabel="Team"
    tabLabel="By team"
    onClearFilters={() => {}}
  />,
);

/** Every `role="option"` element: its class list and its markup up to the next option. */
function options(): { selected: boolean; classes: string[]; html: string }[] {
  const tags = [...html.matchAll(/<div[^>]*role="option"[^>]*>/g)];
  return tags.map((m, i) => ({
    selected: m[0].includes('aria-selected="true"'),
    classes: /class="([^"]*)"/.exec(m[0])?.[1].split(/\s+/) ?? [],
    html: html.slice(m.index, tags[i + 1]?.index),
  }));
}

/** Class list of the first element in `chunk` whose own text content is `text`. */
function classesOf(chunk: string, text: string): string[] {
  const m = new RegExp(`<(\\w+)[^>]*class="([^"]*)"[^>]*>${text}</\\1>`).exec(chunk);
  expect(m, `element with text ${text}`).not.toBeNull();
  return m![2].split(/\s+/);
}

const FILL = /^bg-/;

describe("explorer master list: header", () => {
  it("does not repeat the group label in the count column of the Popular certificates tab", () => {
    const certificates = renderToStaticMarkup(
      <MasterList rows={[row("a", "AWS SAA")]} activeKey="a" onSelectKey={() => {}} groupLabel="Certificate" tabLabel="Popular certificates" onClearFilters={() => {}} />,
    );
    expect(certificates).toContain("<span>Certificate</span><span>Total</span>");
  });
});

describe("explorer master list: count chip", () => {
  it("counts members under a certificate group, certificates elsewhere", () => {
    const render = (groupLabel: string) =>
      renderToStaticMarkup(
        // A certificate group has one row per member, so people equals records.
        <MasterList rows={[{ ...row("a", "AWS SAA"), headcount: null, people: 5 }]} activeKey="a" onSelectKey={() => {}} groupLabel={groupLabel} tabLabel="t" onClearFilters={() => {}} />,
      );
    expect(render("Certificate")).toContain("5 members");
    expect(render("Certificate")).not.toContain("5 certificates");
    expect(render("Certificate")).toContain("3 completed");
    expect(render("Provider")).toContain("5 certificates");
  });
});

describe("explorer master list: selected row", () => {
  const all = options();
  const selected = all.find((o) => o.selected)!;
  const unselected = all.find((o) => !o.selected)!;

  it("renders one selected and one unselected option", () => {
    expect(all).toHaveLength(2);
    expect(selected).toBeDefined();
    expect(unselected).toBeDefined();
  });

  it("paints the selected row solid teal with light text", () => {
    expect(selected.classes).toContain("bg-primary");
    expect(selected.classes).toContain("text-primary-foreground");
    expect(selected.classes).not.toContain("bg-primary/10");
    expect(unselected.classes).not.toContain("bg-primary");
  });

  it("never draws a ring on the selected row outside keyboard focus", () => {
    const bareRing = selected.classes.filter((c) => /^ring-/.test(c));
    expect(bareRing).toEqual([]);
  });

  it.each(["selected", "unselected"] as const)("the %s row has an offset focus-visible ring on the card", (which) => {
    const classes = which === "selected" ? selected.classes : unselected.classes;
    for (const c of [
      "focus-visible:ring-2",
      "focus-visible:ring-ring",
      "focus-visible:ring-offset-2",
      "focus-visible:ring-offset-card",
    ]) {
      expect(classes, c).toContain(c);
    }
  });

  it("outlines the count chip on the selected row without a fill", () => {
    const chip = classesOf(selected.html, "5 certificates");
    expect(chip).toContain("border");
    expect(chip.filter((c) => FILL.test(c))).toEqual([]);
  });

  it("outlines the avatar on the selected row without a fill", () => {
    const avatar = classesOf(selected.html, "TC");
    expect(avatar).toContain("border");
    expect(avatar.filter((c) => FILL.test(c))).toEqual([]);
  });
});
