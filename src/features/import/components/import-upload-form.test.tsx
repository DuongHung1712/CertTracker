// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImportUploadForm } from "@/features/import/components/import-upload-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(cleanup);

const input = () => screen.getByLabelText<HTMLInputElement>("Excel file");
const submit = () => screen.getByRole<HTMLButtonElement>("button", { name: "Upload and check" });
const xlsx = (name = "plan.xlsx", size = 2048) => new File([new Uint8Array(size)], name);

describe("ImportUploadForm file picker", () => {
  it("starts with Upload disabled", () => {
    render(<ImportUploadForm />);
    expect(submit().disabled).toBe(true);
  });

  it("shows the chosen file with its size, enables Upload, and Remove file clears it", async () => {
    render(<ImportUploadForm />);
    await userEvent.upload(input(), xlsx());
    expect(screen.getByText("plan.xlsx")).toBeTruthy();
    expect(screen.getByText("(2 KB)")).toBeTruthy();
    expect(submit().disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Remove file" }));
    expect(screen.queryByText("plan.xlsx")).toBeNull();
    expect(submit().disabled).toBe(true);
  });

  it("accepts a dropped file", () => {
    render(<ImportUploadForm />);
    fireEvent.drop(input().parentElement!, { dataTransfer: { files: [xlsx("dropped.xls")] } });
    expect(screen.getByText("dropped.xls")).toBeTruthy();
  });

  it.each([
    ["notes.csv", 100, "Only Excel files (.xlsx or .xls) are accepted."],
    ["big.xlsx", 4 * 1024 * 1024 + 1, "The file is larger than 4 MB. Split it and import it in parts."],
    ["empty.xlsx", 0, "The file is empty."],
  ])("rejects %s with its message and keeps Upload disabled", (name, size, message) => {
    render(<ImportUploadForm />);
    // fireEvent.drop skips the input's `accept` filter, as a real drop does.
    fireEvent.drop(input().parentElement!, { dataTransfer: { files: [xlsx(name, size)] } });
    expect(screen.getByRole("alert").textContent).toContain(message);
    expect(submit().disabled).toBe(true);
  });
});
