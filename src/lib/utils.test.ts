import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("keeps a design-system text size next to a text colour", () => {
    expect(cn("text-caption", "text-status-active-fg")).toBe("text-caption text-status-active-fg");
    expect(cn("text-label uppercase", "text-muted-foreground")).toBe("text-label uppercase text-muted-foreground");
  });

  it("still lets a later text size win over an earlier one", () => {
    expect(cn("text-table", "text-caption")).toBe("text-caption");
    expect(cn("text-sm", "text-body")).toBe("text-body");
  });
});
