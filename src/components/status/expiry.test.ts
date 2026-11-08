import { describe, expect, it } from "vitest";
import { EXPIRY_STATUSES, expiryDetail, expiryMeta, toExpiryStatus } from "@/components/status/expiry";

describe("toExpiryStatus", () => {
  it("keeps known statuses", () => {
    for (const status of EXPIRY_STATUSES) expect(toExpiryStatus(status)).toBe(status);
  });

  it("falls back to N/A for null or unknown values", () => {
    expect(toExpiryStatus(null)).toBe("N/A");
    expect(toExpiryStatus("Expiring")).toBe("N/A");
  });
});

describe("expiryMeta", () => {
  it("maps every status to a tone and an English label", () => {
    expect(expiryMeta("Active")).toEqual({ tone: "active", label: "Valid" });
    expect(expiryMeta("Expiring in 60d")).toEqual({ tone: "expiring-60", label: "Expires in 31–60 days" });
    expect(expiryMeta("Expiring Soon")).toEqual({ tone: "expiring-soon", label: "Expires within 30 days" });
    expect(expiryMeta("Expired")).toEqual({ tone: "expired", label: "Expired" });
    expect(expiryMeta("No Expiry")).toEqual({ tone: "no-expiry", label: "No expiry" });
    expect(expiryMeta("N/A")).toEqual({ tone: "na", label: "Not issued yet" });
  });
});

describe("expiryDetail", () => {
  it("counts days left", () => {
    expect(expiryDetail({ status: "Expiring Soon", daysToExpiry: 23, expiryDate: "2026-10-19" })).toBe(
      "23 days left · expires 19/10/2026",
    );
  });

  it("uses the singular for one day", () => {
    expect(expiryDetail({ status: "Expiring Soon", daysToExpiry: 1, expiryDate: "2026-10-19" })).toBe(
      "1 day left · expires 19/10/2026",
    );
    expect(expiryDetail({ status: "Expired", daysToExpiry: -1, expiryDate: "2026-10-19" })).toBe(
      "Expired 1 day ago · 19/10/2026",
    );
  });

  it("says today on the expiry day", () => {
    expect(expiryDetail({ status: "Expiring Soon", daysToExpiry: 0, expiryDate: "2026-10-19" })).toBe(
      "Expires today · 19/10/2026",
    );
  });

  it("counts days since expiry", () => {
    expect(expiryDetail({ status: "Expired", daysToExpiry: -5, expiryDate: "2026-10-19" })).toBe(
      "Expired 5 days ago · 19/10/2026",
    );
  });

  it("explains missing dates", () => {
    expect(expiryDetail({ status: "No Expiry", daysToExpiry: null, expiryDate: null })).toBe(
      "This certificate does not expire",
    );
    expect(expiryDetail({ status: "N/A", daysToExpiry: null, expiryDate: null })).toBe("Not issued yet");
  });
});
