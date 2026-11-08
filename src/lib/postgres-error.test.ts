import { describe, expect, it } from "vitest";
import { mapPostgresError } from "@/lib/postgres-error";

describe("mapPostgresError", () => {
  it("maps a unique violation to a duplicate message", () => {
    expect(mapPostgresError({ code: "23505", message: "duplicate key" })).toBe("This already exists.");
  });

  it("prefers a caller-supplied duplicate message", () => {
    expect(
      mapPostgresError({ code: "23505", message: "duplicate key" }, { duplicate: 'Centre "HN" already exists.' }),
    ).toBe('Centre "HN" already exists.');
  });

  it("maps a foreign key violation to a restricted-delete message", () => {
    expect(mapPostgresError({ code: "23503", message: "violates foreign key" })).toBe(
      "This cannot be deleted because other data still uses it.",
    );
  });

  it("prefers a caller-supplied restricted message", () => {
    expect(
      mapPostgresError(
        { code: "23503", message: "violates foreign key" },
        { restricted: "This data centre has programs. Delete the programs first." },
      ),
    ).toBe("This data centre has programs. Delete the programs first.");
  });

  it("maps an RLS violation to a permission message", () => {
    expect(mapPostgresError({ code: "42501", message: "row-level security" })).toBe(
      "You do not have permission to do this.",
    );
  });

  it("falls back to a generic message for anything else", () => {
    expect(mapPostgresError({ code: "XX000", message: "boom" })).toBe("Something went wrong. Try again.");
    expect(mapPostgresError({ message: "boom" })).toBe("Something went wrong. Try again.");
  });

  it("maps a check violation to a rule message", () => {
    expect(mapPostgresError({ code: "23514", message: "violates check constraint" })).toBe(
      "These values break a rule of the system. Check them and try again.",
    );
    expect(mapPostgresError({ code: "23514", message: "x" }, { invalid: "Status and progress do not match." })).toBe(
      "Status and progress do not match.",
    );
  });
});
