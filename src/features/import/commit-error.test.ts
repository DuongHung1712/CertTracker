import { describe, expect, it } from "vitest";
import { mapCommitError } from "@/features/import/commit-error";

describe("mapCommitError", () => {
  it("maps a discarded batch", () => {
    expect(mapCommitError({ code: "55000", message: "import batch was discarded" })).toBe("This batch was discarded, so it cannot be imported.");
  });

  it("maps an incomplete batch (interrupted upload) to a re-upload instruction", () => {
    const text = mapCommitError({ code: "22023", message: "import batch is incomplete: 500 of 1200 rows stored" });
    expect(text).toBe("This batch was not fully uploaded, so it cannot be imported. Discard the batch and upload the file again.");
    expect(text).not.toContain("500");
  });

  it("maps a missing batch", () => {
    expect(mapCommitError({ code: "P0002", message: "import batch not found" })).toBe("Import batch not found.");
  });

  it("maps a statement timeout", () => {
    expect(mapCommitError({ code: "57014", message: "canceling statement due to statement timeout" })).toContain("timed out");
  });

  it("adds the Excel row number for a check violation", () => {
    const text = mapCommitError({ code: "23514", message: 'import row 7: new row violates check constraint "x"' });
    expect(text).toBe("Row 7: Status, progress and issue date do not match. Nothing was imported.");
  });

  it("maps duplicate and FK failures with the row number", () => {
    expect(mapCommitError({ code: "23505", message: "import row 12: duplicate key" })).toMatch(/^Row 12: The data duplicates/);
    expect(mapCommitError({ code: "23503", message: "import row 3: fk" })).toMatch(/^Row 3: Reference data changed/);
  });

  it("never leaks the raw database message", () => {
    const text = mapCommitError({ code: "XX000", message: "import row 9: secret_table detail" });
    expect(text).toBe("Row 9: Something went wrong. Try again. Nothing was imported.");
    expect(text).not.toContain("secret_table");
  });

  it("has no row prefix for an error without one", () => {
    expect(mapCommitError({ code: "42501", message: "only admins can commit an import" })).toBe(
      "You do not have permission to do this. Nothing was imported.",
    );
  });
});
