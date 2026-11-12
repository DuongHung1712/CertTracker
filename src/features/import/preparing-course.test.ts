import { describe, expect, it } from "vitest";
import { preparingCourseByCertificate } from "@/features/import/preparing-course";

const course = (id: string, name: string, cost: number | null, prepares = "az900") => ({ id, name, prepares_for_id: prepares, cost });
const names = new Map([["az900", "Azure Fundamentals (AZ-900)"]]);

describe("preparingCourseByCertificate", () => {
  it("prefers the course named like the exam, whatever the order", () => {
    const own = course("2", "Azure Fundamentals (AZ-900)", 50);
    const learn = course("3", "AZ-900 Part 1", null);
    expect(preparingCourseByCertificate([learn, own], names).get("az900")).toBe(own);
    expect(preparingCourseByCertificate([own, learn], names).get("az900")).toBe(own);
  });

  it("otherwise takes the first course with a cost, then the first course", () => {
    const free = course("1", "Part 1", null);
    const priced = course("2", "Part 2", 30);
    const pricedLater = course("3", "Part 3", 40);
    expect(preparingCourseByCertificate([free, priced, pricedLater], names).get("az900")).toBe(priced);
    expect(preparingCourseByCertificate([free, course("2", "Part 2", null)], names).get("az900")).toBe(free);
  });

  it("ignores courses that prepare for nothing", () => {
    const loose = { id: "1", name: "Loose", prepares_for_id: null, cost: 5 };
    expect(preparingCourseByCertificate([loose], names).size).toBe(0);
  });
});
