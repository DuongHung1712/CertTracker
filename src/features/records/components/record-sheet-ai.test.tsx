// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeRecord } from "@/features/records/__fixtures__/record-row";
import { RecordSheet } from "@/features/records/components/record-sheet";

// jsdom has no ResizeObserver or scrollIntoView, which the Base UI popups call (same setup as record-sheet.test.tsx).
vi.mock("@/features/records/actions", () => ({ createRecord: vi.fn(), updateRecord: vi.fn(), uploadEvidence: vi.fn(), removeEvidence: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const CERTIFICATES = [
  { id: "e1", label: "AWS Associate", kind: "exam" as const, grantingCourse: null },
  { id: "c1", label: "Intro to LLMs", kind: "completion" as const, grantingCourse: { id: "k1", name: "LLM Course" } },
];

const base = {
  open: true,
  onOpenChange: () => {},
  memberOptions: [],
  certificateOptions: CERTIFICATES,
  studyCourses: [],
  showCompanyFields: false,
  fixedMemberId: "m1",
};

const png = (name = "cert.png") => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], name, { type: "image/png" });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const exam = { kind: "exam", certificateId: "e1", issuedDate: "2026-03-14", certificateUrl: "https://example.com/v", validUntil: null, readName: "AWS Associate", readProvider: "AWS", aiFields: ["certificateId", "issuedDate", "certificateUrl"] };
const empty = { kind: "exam", certificateId: null, issuedDate: null, certificateUrl: null, validUntil: null, readName: null, readProvider: null, aiFields: [] };
const unmatched = { kind: "completion", certificateId: null, issuedDate: null, certificateUrl: null, validUntil: null, readName: "Introduction to subagents", readProvider: "Anthropic", aiFields: [] };

const fileInput = () => document.getElementById("record-ai-file") as HTMLInputElement;
const chooseFile = (file = png()) => userEvent.upload(fileInput(), file);
const readAgain = () => userEvent.click(screen.getByRole("button", { name: /read again/i }));
const dateInput = () => document.getElementById("record-issued") as HTMLInputElement;
const urlInput = () => document.getElementById("record-url") as HTMLInputElement;
const certificateBox = () => screen.getByRole<HTMLInputElement>("combobox", { name: /certificate/i });
const saveButton = () => screen.getByRole<HTMLButtonElement>("button", { name: /^save/i });

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RecordSheet: where the file goes", () => {
  it("keeps the old Evidence field at the bottom and shows no card when the feature is off", () => {
    render(<RecordSheet {...base} editing={null} />);
    expect(screen.queryByText(/have your certificate file/i)).toBeNull();
    expect(document.getElementById("record-evidence")).toBeTruthy();
    expect(fileInput()).toBeNull();
  });

  it("keeps the old Evidence field and shows no card when editing, even with the feature on", () => {
    render(<RecordSheet {...base} editing={makeRecord({ id: "r1" })} aiReaderEnabled />);
    expect(screen.queryByText(/have your certificate file/i)).toBeNull();
    expect(document.getElementById("record-evidence")).toBeTruthy();
  });

  it("with the feature on, shows the card first and the only file input is the card's", () => {
    render(<RecordSheet {...base} editing={null} aiReaderEnabled />);
    expect(screen.getByText(/have your certificate file/i)).toBeTruthy();
    expect(document.querySelectorAll("input[type=file]")).toHaveLength(1);
    expect(document.getElementById("record-evidence")).toBeNull();
    const kindLabel = document.getElementById("record-kind-label") as HTMLElement;
    expect(fileInput().compareDocumentPosition(kindLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("RecordSheet: reading starts when the file is chosen", () => {
  it("fills the certificate, date and link and marks them as AI, with no button to press", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ suggestion: exam })));
    render(<RecordSheet {...base} editing={null} aiReaderEnabled />);
    await chooseFile();
    await waitFor(() => expect(dateInput().value).toBe("14/03/2026"));
    expect(certificateBox().value).toBe("AWS Associate");
    expect(urlInput().value).toBe("https://example.com/v");
    expect(screen.getAllByText("AI")).toHaveLength(3);
  });

  it("clears the AI mark of a field the member edits", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ suggestion: exam })));
    render(<RecordSheet {...base} editing={null} aiReaderEnabled />);
    await chooseFile();
    await waitFor(() => expect(screen.getAllByText("AI")).toHaveLength(3));
    await userEvent.type(urlInput(), "x");
    expect(screen.getAllByText("AI")).toHaveLength(2);
  });

  it("switches to the completion kind when the AI found a completion", async () => {
    const completion = { ...exam, kind: "completion", certificateId: "c1", issuedDate: "2026-02-01", certificateUrl: null, aiFields: ["certificateId", "issuedDate"] };
    vi.stubGlobal("fetch", vi.fn(async () => json({ suggestion: completion })));
    render(<RecordSheet {...base} editing={null} aiReaderEnabled />);
    await chooseFile();
    await waitFor(() => expect(screen.getByRole("tab", { name: "Course certificate" }).getAttribute("aria-selected")).toBe("true"));
    expect(screen.getByRole<HTMLInputElement>("combobox", { name: /course certificate/i }).value).toBe("Intro to LLMs");
    expect(dateInput().value).toBe("01/02/2026");
  });

  it("leaves the date empty when the suggestion has none, and does not mark it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ suggestion: { ...exam, issuedDate: null, aiFields: ["certificateId"] } })));
    render(<RecordSheet {...base} editing={null} aiReaderEnabled />);
    await chooseFile();
    await waitFor(() => expect(certificateBox().value).toBe("AWS Associate"));
    expect(dateInput().value).toBe("");
  });
});

describe("RecordSheet: a second read", () => {
  it("clears what the first read filled when the second has nothing for it, so no AI guess is left unmarked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ suggestion: exam })).mockResolvedValueOnce(json({ suggestion: empty })));
    render(<RecordSheet {...base} editing={null} aiReaderEnabled />);
    await chooseFile();
    await waitFor(() => expect(dateInput().value).toBe("14/03/2026"));
    await readAgain();
    await waitFor(() => expect(dateInput().value).toBe(""));
    expect(urlInput().value).toBe("");
    expect(certificateBox().value).toBe("");
    expect(screen.queryByText("AI")).toBeNull();
  });

  it("keeps a value the member typed over an AI one when the second read has nothing for that field", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ suggestion: exam })).mockResolvedValueOnce(json({ suggestion: empty })));
    render(<RecordSheet {...base} editing={null} aiReaderEnabled />);
    await chooseFile();
    await waitFor(() => expect(screen.getAllByText("AI")).toHaveLength(3));
    await userEvent.type(urlInput(), "x");
    await readAgain();
    await waitFor(() => expect(dateInput().value).toBe(""));
    expect(urlInput().value).toBe("https://example.com/vx");
  });

  it("ignores the answer for a file that was replaced while it was being read", async () => {
    let releaseFirst: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(() => new Promise<Response>((resolve) => (releaseFirst = resolve)))
        .mockResolvedValueOnce(json({ suggestion: { ...exam, issuedDate: "2026-05-05" } })),
    );
    render(<RecordSheet {...base} editing={null} aiReaderEnabled />);
    await chooseFile(png("first.png"));
    await chooseFile(png("second.png"));
    await waitFor(() => expect(dateInput().value).toBe("05/05/2026"));
    releaseFirst(json({ suggestion: { ...exam, issuedDate: "2026-01-01" } }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(dateInput().value).toBe("05/05/2026");
  });
});

describe("RecordSheet: when the AI cannot help", () => {
  it("leaves the form untouched, shows the message and still lets the member save", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "The AI could not read this file." }, 422)));
    render(<RecordSheet {...base} editing={null} aiReaderEnabled />);
    await chooseFile();
    await screen.findByText("The AI could not read this file.");
    expect(dateInput().value).toBe("");
    expect(screen.queryByText("AI")).toBeNull();
    expect(saveButton().disabled).toBe(false);
  });

  it("disables Save while a file is being read and enables it afterwards", async () => {
    let release: (response: Response) => void = () => undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => (release = resolve))));
    render(<RecordSheet {...base} editing={null} aiReaderEnabled />);
    await chooseFile();
    await waitFor(() => expect(saveButton().disabled).toBe(true));
    release(json({ suggestion: exam }));
    await waitFor(() => expect(saveButton().disabled).toBe(false));
  });
});

describe("RecordSheet: what is still needed", () => {
  it("lists the empty required fields after a read and moves focus to the one chosen", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ suggestion: { ...exam, issuedDate: null, aiFields: ["certificateId"] } })));
    render(<RecordSheet {...base} editing={null} aiReaderEnabled />);
    expect(screen.queryByText(/still needed/i)).toBeNull();
    await chooseFile();
    await screen.findByText(/still needed/i);
    expect(screen.queryByRole("button", { name: "Certificate" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Date passed" }));
    expect(document.activeElement?.id).toBe("record-issued");
  });

  it("shows no red error before the member presses Save", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ suggestion: { ...empty, issuedDate: null } })));
    render(<RecordSheet {...base} editing={null} aiReaderEnabled />);
    await chooseFile();
    await screen.findByText(/still needed/i);
    expect(screen.queryByText(/choose a certificate/i)).toBeNull();
    expect(screen.queryByText(/needs a date/i)).toBeNull();
  });
});

describe("RecordSheet: a certificate that is not in the catalogue", () => {
  it("shows what the AI read and opens the proposal with it filled in", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ suggestion: unmatched })));
    render(<RecordSheet {...base} editing={null} aiReaderEnabled />);
    await chooseFile();
    await waitFor(() => expect(screen.getByText(/not in the catalogue/i)).toBeTruthy());
    expect(screen.getByText(/Introduction to subagents/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /propose it/i }));
    expect(((await screen.findByLabelText(/^Course certificate name/)) as HTMLInputElement).value).toBe("Introduction to subagents");
    expect((screen.getByLabelText(/^Provider name/) as HTMLInputElement).value).toBe("Anthropic");
  });

  it("preselects a provider that already exists", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ suggestion: unmatched })));
    render(<RecordSheet {...base} editing={null} aiReaderEnabled providers={[{ id: "00000000-0000-0000-0000-0000000000a9", name: "anthropic" }]} />);
    await chooseFile();
    await userEvent.click(await screen.findByRole("button", { name: /propose it/i }));
    await waitFor(() => expect(document.getElementById("propose-provider-select")?.textContent).toContain("anthropic"));
  });

  it("shows no 'not in the catalogue' note when the certificate matched", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ suggestion: exam })));
    render(<RecordSheet {...base} editing={null} aiReaderEnabled />);
    await chooseFile();
    await waitFor(() => expect(dateInput().value).toBe("14/03/2026"));
    expect(screen.queryByText(/not in the catalogue/i)).toBeNull();
  });

  it("drops the note when a second read matches", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ suggestion: unmatched })).mockResolvedValueOnce(json({ suggestion: exam })));
    render(<RecordSheet {...base} editing={null} aiReaderEnabled />);
    await chooseFile();
    await waitFor(() => expect(screen.getByText(/not in the catalogue/i)).toBeTruthy());
    await readAgain();
    await waitFor(() => expect(screen.queryByText(/not in the catalogue/i)).toBeNull());
  });
});

describe("RecordSheet: the AI never replaces what the member typed", () => {
  it("keeps a typed date and link, fills only the empty certificate, and counts what it really filled", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ suggestion: exam })));
    render(<RecordSheet {...base} editing={null} aiReaderEnabled />);
    await userEvent.type(dateInput(), "01012026");
    await userEvent.type(urlInput(), "https://mine.example/x");
    await chooseFile();
    await waitFor(() => expect(certificateBox().value).toBe("AWS Associate"));
    expect(dateInput().value).toBe("01/01/2026");
    expect(urlInput().value).toBe("https://mine.example/x");
    expect(screen.getAllByText("AI")).toHaveLength(1);
    await screen.findByText("AI filled 1 field. Check them before saving.");
  });

  it("Read again keeps a link the member corrected, and still refreshes what is still the AI's", async () => {
    const second = { ...exam, issuedDate: "2026-05-05", certificateUrl: "https://example.com/other" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ suggestion: exam })).mockResolvedValueOnce(json({ suggestion: second })));
    render(<RecordSheet {...base} editing={null} aiReaderEnabled />);
    await chooseFile();
    await waitFor(() => expect(screen.getAllByText("AI")).toHaveLength(3));
    await userEvent.type(urlInput(), "x");
    await readAgain();
    await waitFor(() => expect(dateInput().value).toBe("05/05/2026"));
    expect(urlInput().value).toBe("https://example.com/vx");
  });
});

describe("RecordSheet: typing while the file is being read", () => {
  it("keeps what the member types or picks during the read; the answer fills only what is still empty", async () => {
    let release: (response: Response) => void = () => undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => (release = resolve))));
    render(<RecordSheet {...base} editing={null} aiReaderEnabled />);
    await chooseFile();
    await userEvent.type(dateInput(), "01012026");
    release(json({ suggestion: exam }));
    await waitFor(() => expect(certificateBox().value).toBe("AWS Associate"));
    expect(dateInput().value).toBe("01/01/2026");
    expect(urlInput().value).toBe("https://example.com/v");
    expect(screen.getAllByText("AI")).toHaveLength(2);
  });
});

describe("RecordSheet: a certificate the member picks themselves", () => {
  it("is not replaced by the AI's earlier match when the kind is switched away and back", async () => {
    const two = [
      { id: "e1", label: "AWS Associate", kind: "exam" as const, grantingCourse: null },
      { id: "e2", label: "Azure Fundamentals", kind: "exam" as const, grantingCourse: null },
      { id: "c1", label: "Intro to LLMs", kind: "completion" as const, grantingCourse: { id: "k1", name: "LLM Course" } },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => json({ suggestion: exam })));
    render(<RecordSheet {...base} certificateOptions={two} editing={null} aiReaderEnabled />);
    await chooseFile();
    await waitFor(() => expect(certificateBox().value).toBe("AWS Associate"));

    await userEvent.click(certificateBox());
    await userEvent.click(await screen.findByRole("option", { name: /Azure Fundamentals/ }));
    await waitFor(() => expect(certificateBox().value).toBe("Azure Fundamentals"));

    await userEvent.click(screen.getByRole("tab", { name: "Course certificate" }));
    await userEvent.click(screen.getByRole("tab", { name: "Exam certificate" }));
    expect(certificateBox().value).toBe("");
  });
});

describe("RecordSheet: switching the kind keeps the AI's match", () => {
  it("brings the matched certificate back when the member returns to the kind the AI found", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ suggestion: exam })));
    render(<RecordSheet {...base} editing={null} aiReaderEnabled />);
    await chooseFile();
    await waitFor(() => expect(certificateBox().value).toBe("AWS Associate"));

    await userEvent.click(screen.getByRole("tab", { name: "Course certificate" }));
    expect(screen.getByRole<HTMLInputElement>("combobox", { name: /course certificate/i }).value).toBe("");
    // The card no longer claims the certificate it just lost.
    await screen.findByText("AI filled 2 fields. Check them before saving.");

    await userEvent.click(screen.getByRole("tab", { name: "Exam certificate" }));
    await waitFor(() => expect(certificateBox().value).toBe("AWS Associate"));
    await screen.findByText("AI filled 3 fields. Check them before saving.");
  });
});

describe("RecordSheet: leaving with unsaved input", () => {
  const cancel = () => screen.getByRole("button", { name: "Cancel" });

  it("asks before Cancel throws typed text away; Keep editing keeps it and Discard closes", async () => {
    const onOpenChange = vi.fn();
    render(<RecordSheet {...base} onOpenChange={onOpenChange} editing={null} />);
    await userEvent.type(urlInput(), "https://x.example");
    await userEvent.click(cancel());
    expect(await screen.findByText("Discard your changes?")).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(urlInput().value).toBe("https://x.example");
    expect(onOpenChange).not.toHaveBeenCalled();

    await userEvent.click(cancel());
    await userEvent.click(await screen.findByRole("button", { name: "Discard" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("asks when the only thing at stake is a chosen file (the read failed, nothing typed)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "The AI could not read this file." }, 422)));
    render(<RecordSheet {...base} editing={null} aiReaderEnabled />);
    await chooseFile();
    await screen.findByText("The AI could not read this file.");
    await userEvent.click(cancel());
    expect(await screen.findByText("Discard your changes?")).toBeTruthy();
  });

  it("closes at once when nothing was entered", async () => {
    const onOpenChange = vi.fn();
    render(<RecordSheet {...base} onOpenChange={onOpenChange} editing={null} />);
    await userEvent.click(cancel());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Discard your changes?")).toBeNull();
  });
});
