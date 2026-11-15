// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EvidenceCell } from "@/features/records/components/evidence-cell";

afterEach(cleanup);
const base = { id: "r1", hasEvidence: false, certificateUrl: null, status: "done" as const };

describe("EvidenceCell", () => {
  it("file attached: a link to the proof", () => {
    render(<EvidenceCell record={{ ...base, hasEvidence: true, certificateUrl: "https://x.test" }} />);
    expect(screen.getByRole("link", { name: "Proof file attached" }).getAttribute("href")).toBe("/api/records/r1/evidence");
  });
  it("link only: a link to the URL", () => {
    render(<EvidenceCell record={{ ...base, certificateUrl: "https://x.test" }} />);
    expect(screen.getByRole("link", { name: "Link only" }).getAttribute("href")).toBe("https://x.test");
  });
  it("completed without proof: a visible gap", () => {
    render(<EvidenceCell record={base} />);
    expect(screen.getByText("No proof yet")).toBeTruthy();
  });
  it("not completed, no proof: none", () => {
    render(<EvidenceCell record={{ ...base, status: "in_progress" }} />);
    expect(screen.getByText("None")).toBeTruthy();
  });
});
