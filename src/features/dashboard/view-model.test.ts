import { describe, expect, it } from "vitest";
import type { TabResult } from "@/features/dashboard/components/explorer/types";
import { buildExplorerTabs, resolveMemberProfile } from "./view-model";

const member = { fullName: "Member Row", teamName: "Team M", careerRoleName: "Role M", yoeYears: 3 };
const firstRecord = { memberName: "Record Name", teamName: "Team R" };
const career = { careerRoleName: "Role C", yoeYears: 5 };

describe("resolveMemberProfile", () => {
  it("prefers the member row for name and team, and career for role and YoE", () => {
    expect(resolveMemberProfile({ member, firstRecord, career, email: "a@b.test" })).toEqual({
      fullName: "Member Row",
      teamName: "Team M",
      careerRoleName: "Role C",
      yoeYears: 5,
    });
  });

  it("falls back to the member row for role and YoE when career has none", () => {
    const p = resolveMemberProfile({
      member,
      firstRecord,
      career: { careerRoleName: null, yoeYears: null },
      email: "a@b.test",
    });
    expect([p.careerRoleName, p.yoeYears]).toEqual(["Role M", 3]);
  });

  it("falls back to the first record, then the e-mail", () => {
    expect(resolveMemberProfile({ member: null, firstRecord, career: null, email: "a@b.test" })).toMatchObject({
      fullName: "Record Name",
      teamName: "Team R",
    });
    expect(resolveMemberProfile({ member: null, firstRecord: undefined, career: null, email: "a@b.test" })).toEqual({
      fullName: "a@b.test",
      teamName: null,
      careerRoleName: null,
      yoeYears: null,
    });
  });
});

describe("buildExplorerTabs", () => {
  it("returns the four tabs in display order with their results", () => {
    const failed = (error: string): TabResult => ({ ok: false, error });
    const tabs = buildExplorerTabs({
      teams: failed("t"),
      certTypes: failed("c"),
      providers: failed("p"),
      courses: failed("o"),
    });
    expect(tabs.map((t) => t.id)).toEqual(["team", "cert_type", "provider", "certificate"]);
    expect(tabs.map((t) => (t.result.ok ? "" : t.result.error))).toEqual(["t", "c", "p", "o"]);
  });
});
