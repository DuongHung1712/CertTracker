import { describe, expect, it } from "vitest";
import { makeRecord } from "@/features/records/__fixtures__/record-row";
import { filterByKind, kindCounts, plannedDateHeader, plannedDateLabel } from "@/features/records/kind";

const exam = makeRecord({ id: "e1", certificateKind: "exam" });
const completion = makeRecord({ id: "c1", certificateKind: "completion" });
const rows = [exam, completion, makeRecord({ id: "e2", certificateKind: "exam" })];

describe("kind filter", () => {
  it("keeps every row for all and only the matching kind otherwise", () => {
    expect(filterByKind(rows, "all")).toHaveLength(3);
    expect(filterByKind(rows, "exam").map((r) => r.id)).toEqual(["e1", "e2"]);
    expect(filterByKind(rows, "completion").map((r) => r.id)).toEqual(["c1"]);
  });

  it("counts so that exam + completion = all", () => {
    expect(kindCounts(rows)).toEqual({ all: 3, exam: 2, completion: 1 });
  });

  it("names the planned date by kind", () => {
    expect(plannedDateLabel("exam")).toBe("Planned exam date");
    expect(plannedDateLabel("completion")).toBe("Planned finish date");
    expect(plannedDateHeader("all")).toBe("Planned date");
    expect(plannedDateHeader("exam")).toBe("Planned exam date");
  });
});
