// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  StyleProvider,
  useThemeStyle,
  getStoredThemeStyle,
  setStoredThemeStyle,
  toggleStoredThemeStyle,
  STYLE_STORAGE_KEY,
  THEME_STYLES,
} from "./style-provider";

function TestConsumer() {
  const { style, setStyle, toggleStyle, styles } = useThemeStyle();
  return (
    <div>
      <span data-testid="current-style">{style}</span>
      <div data-testid="styles-count">{styles.length}</div>
      <button onClick={() => setStyle("vault")}>Set Vault</button>
      <button onClick={() => setStyle("classic")}>Set Classic</button>
      <button onClick={toggleStyle}>Toggle Style</button>
      <input data-testid="test-input" placeholder="type here" />
    </div>
  );
}

describe("StyleProvider & useThemeStyle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-style");
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.removeAttribute("data-style");
  });

  it("throws when useThemeStyle is used outside of StyleProvider", () => {
    expect(() => renderHook(() => useThemeStyle())).toThrow(
      "useThemeStyle must be used within a StyleProvider",
    );
  });

  it("defaults to classic style and exposes exactly 2 THEME_STYLES (classic & vault)", () => {
    render(
      <StyleProvider>
        <TestConsumer />
      </StyleProvider>,
    );

    expect(screen.getByTestId("current-style").textContent).toBe("classic");
    expect(screen.getByTestId("styles-count").textContent).toBe("2");
    expect(THEME_STYLES.map((s) => s.id)).toEqual(["classic", "vault"]);
    expect(document.documentElement.getAttribute("data-style")).toBe("classic");
  });

  it("loads stored style from localStorage on mount", () => {
    localStorage.setItem(STYLE_STORAGE_KEY, "vault");

    render(
      <StyleProvider>
        <TestConsumer />
      </StyleProvider>,
    );

    expect(screen.getByTestId("current-style").textContent).toBe("vault");
    expect(document.documentElement.getAttribute("data-style")).toBe("vault");
  });

  it("updates state, localStorage, and html[data-style] on style change", async () => {
    const user = userEvent.setup();
    render(
      <StyleProvider>
        <TestConsumer />
      </StyleProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Set Vault" }));
    expect(screen.getByTestId("current-style").textContent).toBe("vault");
    expect(localStorage.getItem(STYLE_STORAGE_KEY)).toBe("vault");
    expect(document.documentElement.getAttribute("data-style")).toBe("vault");

    await user.click(screen.getByRole("button", { name: "Set Classic" }));
    expect(screen.getByTestId("current-style").textContent).toBe("classic");
    expect(localStorage.getItem(STYLE_STORAGE_KEY)).toBe("classic");
    expect(document.documentElement.getAttribute("data-style")).toBe("classic");
  });

  it("toggles between classic and vault using toggleStyle", async () => {
    const user = userEvent.setup();
    render(
      <StyleProvider>
        <TestConsumer />
      </StyleProvider>,
    );

    expect(screen.getByTestId("current-style").textContent).toBe("classic");

    // Toggle 1: classic -> vault
    await user.click(screen.getByRole("button", { name: "Toggle Style" }));
    expect(screen.getByTestId("current-style").textContent).toBe("vault");
    expect(localStorage.getItem(STYLE_STORAGE_KEY)).toBe("vault");
    expect(document.documentElement.getAttribute("data-style")).toBe("vault");

    // Toggle 2: vault -> classic
    await user.click(screen.getByRole("button", { name: "Toggle Style" }));
    expect(screen.getByTestId("current-style").textContent).toBe("classic");
    expect(localStorage.getItem(STYLE_STORAGE_KEY)).toBe("classic");
    expect(document.documentElement.getAttribute("data-style")).toBe("classic");
  });

  it("syncs style when storage event fires from another tab", () => {
    render(
      <StyleProvider>
        <TestConsumer />
      </StyleProvider>,
    );

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STYLE_STORAGE_KEY,
          newValue: "vault",
        }),
      );
    });

    expect(screen.getByTestId("current-style").textContent).toBe("vault");
    expect(document.documentElement.getAttribute("data-style")).toBe("vault");
  });

  it("reverts to defaultStyle when storage key is removed in another tab", () => {
    localStorage.setItem(STYLE_STORAGE_KEY, "vault");
    render(
      <StyleProvider defaultStyle="classic">
        <TestConsumer />
      </StyleProvider>,
    );
    expect(screen.getByTestId("current-style").textContent).toBe("vault");

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STYLE_STORAGE_KEY,
          newValue: null,
        }),
      );
    });

    expect(screen.getByTestId("current-style").textContent).toBe("classic");
    expect(document.documentElement.getAttribute("data-style")).toBe("classic");
  });

  it("strictly rejects obsolete exploratory styles (aurora, tactile) and unknown strings", () => {
    const { result } = renderHook(() => useThemeStyle(), {
      wrapper: ({ children }) => <StyleProvider>{children}</StyleProvider>,
    });

    act(() => {
      // @ts-expect-error verifying obsolete aurora is strictly rejected
      result.current.setStyle("aurora");
    });
    expect(result.current.style).toBe("classic");
    expect(document.documentElement.getAttribute("data-style")).toBe("classic");

    act(() => {
      // @ts-expect-error verifying obsolete tactile is strictly rejected
      result.current.setStyle("tactile");
    });
    expect(result.current.style).toBe("classic");
    expect(document.documentElement.getAttribute("data-style")).toBe("classic");

    act(() => {
      // @ts-expect-error testing runtime guard against unknown style
      result.current.setStyle("neon-cyberpunk");
    });
    expect(result.current.style).toBe("classic");
    expect(document.documentElement.getAttribute("data-style")).toBe("classic");

    // also test invalid storage event
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STYLE_STORAGE_KEY,
          newValue: "corrupted-value",
        }),
      );
    });

    expect(result.current.style).toBe("classic");
  });

  it("toggles style on Alt+V keyboard shortcut, but ignores keystrokes inside input fields", async () => {
    const user = userEvent.setup();
    render(
      <StyleProvider>
        <TestConsumer />
      </StyleProvider>,
    );

    expect(screen.getByTestId("current-style").textContent).toBe("classic");

    // Alt+V outside input -> toggles to vault
    await user.keyboard("{Alt>}v{/Alt}");
    expect(screen.getByTestId("current-style").textContent).toBe("vault");

    // Focus input and press Alt+V -> should NOT toggle
    const input = screen.getByTestId("test-input");
    await user.click(input);
    await user.keyboard("{Alt>}v{/Alt}");
    expect(screen.getByTestId("current-style").textContent).toBe("vault");

    // Blur input and press Alt+V -> toggles back to classic
    await user.tab();
    await user.keyboard("{Alt>}v{/Alt}");
    expect(screen.getByTestId("current-style").textContent).toBe("classic");
  });

  describe("standalone theme helper functions", () => {
    it("getStoredThemeStyle reads from DOM attribute first, then localStorage, defaulting to classic", () => {
      expect(getStoredThemeStyle()).toBe("classic");

      localStorage.setItem(STYLE_STORAGE_KEY, "vault");
      expect(getStoredThemeStyle()).toBe("vault");

      document.documentElement.setAttribute("data-style", "classic");
      expect(getStoredThemeStyle()).toBe("classic");

      document.documentElement.setAttribute("data-style", "vault");
      expect(getStoredThemeStyle()).toBe("vault");
    });

    it("setStoredThemeStyle updates DOM, localStorage, and dispatches certtracker-style-change event", () => {
      let eventDetail: string | null = null;
      const listener = (e: Event) => {
        eventDetail = (e as CustomEvent).detail;
      };
      window.addEventListener("certtracker-style-change", listener);

      setStoredThemeStyle("vault");
      expect(document.documentElement.getAttribute("data-style")).toBe("vault");
      expect(localStorage.getItem(STYLE_STORAGE_KEY)).toBe("vault");
      expect(eventDetail).toBe("vault");

      setStoredThemeStyle("classic");
      expect(document.documentElement.getAttribute("data-style")).toBe("classic");
      expect(localStorage.getItem(STYLE_STORAGE_KEY)).toBe("classic");
      expect(eventDetail).toBe("classic");

      window.removeEventListener("certtracker-style-change", listener);
    });

    it("toggleStoredThemeStyle toggles between classic and vault programmatically", () => {
      setStoredThemeStyle("classic");
      const next1 = toggleStoredThemeStyle();
      expect(next1).toBe("vault");
      expect(document.documentElement.getAttribute("data-style")).toBe("vault");

      const next2 = toggleStoredThemeStyle();
      expect(next2).toBe("classic");
      expect(document.documentElement.getAttribute("data-style")).toBe("classic");
    });
  });
});
