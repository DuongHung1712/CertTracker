import { describe, expect, it } from "vitest";
import { parseBreakdown, parseKpis, parseRanking } from "@/features/dashboard/schema";

const kpiRow = {
  total_members: 5, total_records: 8, done_records: 5, in_progress_records: 2, not_started_records: 1,
  active_certs: 2, expiring_60_certs: 0, expiring_soon_certs: 1, expired_certs: 1, no_expiry_certs: 1,
};

describe("parseKpis", () => {
  it("maps the single RPC row to camelCase", () => {
    expect(parseKpis([kpiRow])).toEqual({
      totalMembers: 5, totalRecords: 8, doneRecords: 5, inProgressRecords: 2, notStartedRecords: 1,
      activeCerts: 2, expiring60Certs: 0, expiringSoonCerts: 1, expiredCerts: 1, noExpiryCerts: 1,
    });
  });
  it("rejects anything but exactly one row, negatives and wrong types", () => {
    expect(() => parseKpis([])).toThrow();
    expect(() => parseKpis([kpiRow, kpiRow])).toThrow();
    expect(() => parseKpis([{ ...kpiRow, total_records: -1 }])).toThrow();
    expect(() => parseKpis([{ ...kpiRow, done_records: "5" }])).toThrow();
    expect(() => parseKpis(null)).toThrow();
  });
});

describe("parseBreakdown", () => {
  const row = {
    group_key: "5eed0000-0000-0000-0000-00000000a001", group_label: "Team Cloud", headcount: 2, people: 2,
    records: 2, done: 1, in_progress: 0, not_started: 1, valid: 1, expired: 0,
  };
  it("maps rows and keeps a null headcount (non-team dimensions)", () => {
    expect(parseBreakdown([row, { ...row, group_key: "none", headcount: null }])).toEqual([
      { key: row.group_key, label: "Team Cloud", headcount: 2, people: 2, records: 2, done: 1, inProgress: 0, notStarted: 1, valid: 1, expired: 0 },
      { key: "none", label: "Team Cloud", headcount: null, people: 2, records: 2, done: 1, inProgress: 0, notStarted: 1, valid: 1, expired: 0 },
    ]);
  });
  it("accepts an empty list and rejects malformed rows", () => {
    expect(parseBreakdown([])).toEqual([]);
    expect(() => parseBreakdown([{ ...row, people: -1 }])).toThrow();
    expect(() => parseBreakdown([{ ...row, group_label: null }])).toThrow();
  });
});

describe("parseRanking", () => {
  const row = {
    member_id: "5eed0000-0000-0000-0000-00000000b001", member_code: "M001", full_name: "Nguyễn Văn An",
    team_name: null, valid_certs: 1, done_certs: 1, in_progress: 0, rank: 1,
  };
  it("accepts non-RFC4122 seed ids and a null team", () => {
    expect(parseRanking([row])).toEqual([
      { memberId: row.member_id, memberCode: "M001", fullName: "Nguyễn Văn An", teamName: null, validCerts: 1, doneCerts: 1, inProgress: 0, rank: 1 },
    ]);
  });
  it("rejects a rank below 1 and a non-id member_id", () => {
    expect(() => parseRanking([{ ...row, rank: 0 }])).toThrow();
    expect(() => parseRanking([{ ...row, member_id: "nope" }])).toThrow();
  });
});
