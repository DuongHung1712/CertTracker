import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { calculateMemberKpis } from "@/features/dashboard/member-metrics";
import { doneRecord, makeRecord } from "@/features/records/__fixtures__/record-row";
import { MemberKpiCards } from "./member-kpi-cards";

// Copy WP6: the figure reads "{rate} valid ({valid} of {total})" ("Compliant" is not a term the app uses).
const compliance = (html: string) => /([^>\s]*) valid \(\d+ of \d+\)/.exec(html)?.[1];

// Review #5: the compliance figure must follow `ratePercent` (decision #31): rounded down,
// 100 only when everything counts, and "—" (formatRate(null)) when there is nothing to divide.
describe("MemberKpiCards compliance figure", () => {
  it("[RED on 4a89dfd] 199 valid of 200 done shows 99%, never 100%", () => {
    const records = [
      ...Array.from({ length: 199 }, (_, i) => doneRecord(120, { id: `v${i}` })),
      doneRecord(-1, { id: "x" }),
    ];
    expect(compliance(renderToStaticMarkup(<MemberKpiCards kpis={calculateMemberKpis(records)} />))).toBe("99%");
  });

  it("[RED on 4a89dfd] with no records shows — instead of 100%", () => {
    expect(compliance(renderToStaticMarkup(<MemberKpiCards kpis={calculateMemberKpis([])} />))).toBe("—");
  });

  it("with only unfinished records never claims 100%", () => {
    // The denominator (all records vs done records) is an owner decision (#5); either gives 0% or —.
    const kpis = calculateMemberKpis([makeRecord({ status: "in_progress", daysToExpiry: null, expiryStatus: "N/A" })]);
    expect(["0%", "—"]).toContain(compliance(renderToStaticMarkup(<MemberKpiCards kpis={kpis} />)));
  });

  it("all valid shows 100%", () => {
    const kpis = calculateMemberKpis([doneRecord(120, { id: "a" }), doneRecord(0, { id: "b" })]);
    expect(compliance(renderToStaticMarkup(<MemberKpiCards kpis={kpis} />))).toBe("100%");
  });
});
