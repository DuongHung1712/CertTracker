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
  it("maps every status to a tone and a Vietnamese label", () => {
    expect(expiryMeta("Active")).toEqual({ tone: "active", label: "Còn hiệu lực" });
    expect(expiryMeta("Expiring in 60d")).toEqual({ tone: "expiring-60", label: "Hết hạn trong 60 ngày" });
    expect(expiryMeta("Expiring Soon")).toEqual({ tone: "expiring-soon", label: "Sắp hết hạn" });
    expect(expiryMeta("Expired")).toEqual({ tone: "expired", label: "Đã hết hạn" });
    expect(expiryMeta("No Expiry")).toEqual({ tone: "no-expiry", label: "Không thời hạn" });
    expect(expiryMeta("N/A")).toEqual({ tone: "na", label: "Chưa cấp" });
  });
});

describe("expiryDetail", () => {
  it("counts days left", () => {
    expect(expiryDetail({ status: "Expiring Soon", daysToExpiry: 23, expiryDate: "2026-10-19" })).toBe(
      "Còn 23 ngày · hết hạn 19/10/2026",
    );
  });

  it("says today on the expiry day", () => {
    expect(expiryDetail({ status: "Expiring Soon", daysToExpiry: 0, expiryDate: "2026-10-19" })).toBe(
      "Hết hạn hôm nay · 19/10/2026",
    );
  });

  it("counts days since expiry", () => {
    expect(expiryDetail({ status: "Expired", daysToExpiry: -5, expiryDate: "2026-10-19" })).toBe(
      "Đã hết hạn 5 ngày · 19/10/2026",
    );
  });

  it("explains missing dates", () => {
    expect(expiryDetail({ status: "No Expiry", daysToExpiry: null, expiryDate: null })).toBe(
      "Chứng chỉ không có thời hạn",
    );
    expect(expiryDetail({ status: "N/A", daysToExpiry: null, expiryDate: null })).toBe("Chưa có ngày cấp");
  });
});
