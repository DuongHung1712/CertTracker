// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { saveAiReaderSettings } from "@/features/ai/actions";
import { AiReaderSettings } from "@/features/ai/components/ai-reader-settings";

vi.mock("@/features/ai/actions", () => ({ saveAiReaderSettings: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const settings = { enabled: false, dailyLimit: 10, callsToday: 4, provider: "deepseek" as const };

beforeEach(() => {
  vi.mocked(saveAiReaderSettings).mockResolvedValue({ ok: true, data: null });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AiReaderSettings", () => {
  it("shows the current state, the reads used today and the provider", () => {
    render(<AiReaderSettings settings={settings} />);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
    expect((screen.getByLabelText(/reads per member per day/i) as HTMLInputElement).value).toBe("10");
    expect(screen.getByText(/reads today: 4/i)).toBeTruthy();
    expect(screen.getByText(/DeepSeek/)).toBeTruthy();
  });

  it("saves the switch and the limit", async () => {
    render(<AiReaderSettings settings={settings} />);
    await userEvent.click(screen.getByRole("switch"));
    const limit = screen.getByLabelText(/reads per member per day/i);
    await userEvent.clear(limit);
    await userEvent.type(limit, "20");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(saveAiReaderSettings).toHaveBeenCalledWith({ enabled: true, dailyLimit: "20" }));
    expect(toast.success).toHaveBeenCalled();
  });

  it("disables Save until changed and shows inline error for invalid limits", async () => {
    render(<AiReaderSettings settings={settings} />);
    const save = screen.getByRole("button", { name: /save/i }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    const limit = screen.getByLabelText(/reads per member per day/i);
    await userEvent.clear(limit);
    await userEvent.type(limit, "0");
    expect(save.disabled).toBe(false);
    await userEvent.click(save);
    expect(screen.getByRole("alert").textContent).toContain("at least 1");
    expect(saveAiReaderSettings).not.toHaveBeenCalled();
  });

  it("shows the server message and keeps the form when saving fails", async () => {
    vi.mocked(saveAiReaderSettings).mockResolvedValue({ ok: false, error: "You do not have permission to do this." });
    render(<AiReaderSettings settings={settings} />);
    await userEvent.click(screen.getByRole("switch"));
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("You do not have permission to do this."));
    expect(screen.getByRole("alert").textContent).toContain("You do not have permission to do this.");
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
  });

  it("warns that members will not see the option when the provider is not configured", () => {
    render(<AiReaderSettings settings={{ ...settings, enabled: true, provider: "not-configured" }} />);
    expect(screen.getByText(/not configured/i)).toBeTruthy();
  });

  it("says it is sample answers only for the fake provider", () => {
    render(<AiReaderSettings settings={{ ...settings, provider: "fake" }} />);
    expect(screen.getByText(/sample answers/i)).toBeTruthy();
  });
});
