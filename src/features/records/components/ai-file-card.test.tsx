// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiFileCard } from "@/features/records/components/ai-file-card";
import type { CertificateSuggestion } from "@/features/records/ai-read";

const suggestion = (over: Partial<CertificateSuggestion> = {}): CertificateSuggestion => ({
  kind: "exam",
  certificateId: "e1",
  issuedDate: "2026-03-14",
  certificateUrl: null,
  validUntil: null,
  readName: "AWS SAA",
  readProvider: "AWS",
  aiFields: ["certificateId", "issuedDate"],
  ...over,
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const png = (name = "cert.png") => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], name, { type: "image/png" });

/** The card controlled by a tiny parent, like the sheet does: it owns the chosen file. */
function Harness(props: {
  onSuggestion?: (s: CertificateSuggestion) => void;
  onReadingChange?: (reading: boolean) => void;
  missing?: { label: string; fieldId: string }[];
}) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <>
      <input id="field-a" aria-label="Field A" />
      <AiFileCard
        file={file}
        onFileChange={setFile}
        onSuggestion={props.onSuggestion ?? (() => {})}
        onReadingChange={props.onReadingChange ?? (() => {})}
        onReject={() => {}}
        missing={props.missing ?? []}
        fileError={null}
      />
    </>
  );
}
const choose = (file = png()) => userEvent.upload(document.querySelector("input[type=file]") as HTMLInputElement, file);

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AiFileCard", () => {
  it("explains the feature, says where the file goes and offers the manual way", () => {
    render(<Harness />);
    expect(screen.getByText(/have your certificate file/i)).toBeTruthy();
    expect(screen.getByText(/AI fills in the form for you/i)).toBeTruthy();
    expect(screen.getByText(/sent to an AI service \(DeepSeek\)/i)).toBeTruthy();
    expect(screen.getByText(/skip this and fill in the form below/i)).toBeTruthy();
  });

  it("reads the file as soon as it is chosen, once", async () => {
    const fetchMock = vi.fn(async () => json({ suggestion: suggestion() }));
    vi.stubGlobal("fetch", fetchMock);
    const onSuggestion = vi.fn();
    render(<Harness onSuggestion={onSuggestion} />);
    await choose();
    await waitFor(() => expect(onSuggestion).toHaveBeenCalledWith(suggestion()));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/records/ai-read");
    expect((init.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("says how many fields the AI filled, in singular and plural", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ suggestion: suggestion() })).mockResolvedValueOnce(json({ suggestion: suggestion({ aiFields: ["issuedDate"] }) })));
    render(<Harness />);
    await choose();
    await screen.findByText("AI filled 2 fields. Check them before saving.");
    await userEvent.click(screen.getByRole("button", { name: /read again/i }));
    await screen.findByText("AI filled 1 field. Check them before saving.");
  });

  it("says so when the AI filled nothing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ suggestion: suggestion({ aiFields: [] }) })));
    render(<Harness />);
    await choose();
    await screen.findByText(/could not fill any field/i);
  });

  it("shows the failure message and retries on Read again", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ error: "The AI took too long to answer." }, 422))
      .mockResolvedValueOnce(json({ suggestion: suggestion() }));
    vi.stubGlobal("fetch", fetchMock);
    render(<Harness />);
    await choose();
    await screen.findByText("The AI took too long to answer.");
    await userEvent.click(screen.getByRole("button", { name: /read again/i }));
    await screen.findByText(/AI filled 2 fields/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows a plain message when the request itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    render(<Harness />);
    await choose();
    await screen.findByText(/could not be reached/i);
  });

  it("reports reading true then false", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ suggestion: suggestion() })));
    const onReadingChange = vi.fn();
    render(<Harness onReadingChange={onReadingChange} />);
    await choose();
    await waitFor(() => expect(onReadingChange).toHaveBeenLastCalledWith(false));
    expect(onReadingChange.mock.calls.map(([value]) => value)).toEqual([true, false]);
  });

  it("ignores the answer for a file the member replaced while it was being read", async () => {
    let releaseFirst: (response: Response) => void = () => undefined;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (releaseFirst = resolve)))
      .mockResolvedValueOnce(json({ suggestion: suggestion({ certificateId: "second" }) }));
    vi.stubGlobal("fetch", fetchMock);
    const onSuggestion = vi.fn();
    render(<Harness onSuggestion={onSuggestion} />);
    await choose(png("first.png"));
    await choose(png("second.png"));
    await waitFor(() => expect(onSuggestion).toHaveBeenCalledTimes(1));
    releaseFirst(json({ suggestion: suggestion({ certificateId: "first" }) }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onSuggestion).toHaveBeenCalledTimes(1);
    expect(onSuggestion).toHaveBeenCalledWith(expect.objectContaining({ certificateId: "second" }));
  });

  it("ignores a pending answer and clears the status when the file is removed", async () => {
    let release: (response: Response) => void = () => undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => (release = resolve))));
    const onSuggestion = vi.fn();
    const onReadingChange = vi.fn();
    render(<Harness onSuggestion={onSuggestion} onReadingChange={onReadingChange} />);
    await choose();
    await screen.findByText(/reading your file/i);
    await userEvent.click(screen.getByRole("button", { name: /remove file/i }));
    expect(screen.queryByText(/reading your file/i)).toBeNull();
    release(json({ suggestion: suggestion() }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onSuggestion).not.toHaveBeenCalled();
    expect(onReadingChange).toHaveBeenLastCalledWith(false);
  });

  it("lists what is still needed after a read and moves focus to the field", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ suggestion: suggestion() })));
    render(<Harness missing={[{ label: "Issue date", fieldId: "field-a" }]} />);
    expect(screen.queryByText(/still needed/i)).toBeNull();
    await choose();
    await screen.findByText(/still needed/i);
    await userEvent.click(screen.getByRole("button", { name: "Issue date" }));
    expect(document.activeElement?.id).toBe("field-a");
  });
});
