// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  StyleProvider,
  useThemeStyle,
  getStoredThemeStyle,
  setStoredThemeStyle,
  toggleStoredThemeStyle,
  STYLE_STORAGE_KEY,
  STYLE_INIT_SCRIPT,
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
      <button onClick={() => setStyle("nordic")}>Set Nordic</button>
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

  it("defaults to classic style and exposes exactly 3 THEME_STYLES (classic, vault & nordic)", () => {
    render(
      <StyleProvider>
        <TestConsumer />
      </StyleProvider>,
    );

    expect(screen.getByTestId("current-style").textContent).toBe("classic");
    expect(screen.getByTestId("styles-count").textContent).toBe("3");
    expect(THEME_STYLES.map((s) => s.id)).toEqual(["classic", "vault", "nordic"]);
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

    await user.click(screen.getByRole("button", { name: "Set Nordic" }));
    expect(screen.getByTestId("current-style").textContent).toBe("nordic");
    expect(localStorage.getItem(STYLE_STORAGE_KEY)).toBe("nordic");
    expect(document.documentElement.getAttribute("data-style")).toBe("nordic");

    await user.click(screen.getByRole("button", { name: "Set Classic" }));
    expect(screen.getByTestId("current-style").textContent).toBe("classic");
    expect(localStorage.getItem(STYLE_STORAGE_KEY)).toBe("classic");
    expect(document.documentElement.getAttribute("data-style")).toBe("classic");
  });

  it("cycles between classic, vault, and nordic using toggleStyle", async () => {
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

    // Toggle 2: vault -> nordic
    await user.click(screen.getByRole("button", { name: "Toggle Style" }));
    expect(screen.getByTestId("current-style").textContent).toBe("nordic");
    expect(localStorage.getItem(STYLE_STORAGE_KEY)).toBe("nordic");
    expect(document.documentElement.getAttribute("data-style")).toBe("nordic");

    // Toggle 3: nordic -> classic
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

  it("cycles styles on Alt+V keyboard shortcut, but ignores keystrokes inside input fields", async () => {
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

    // Blur input and press Alt+V -> toggles to nordic
    await user.tab();
    await user.keyboard("{Alt>}v{/Alt}");
    expect(screen.getByTestId("current-style").textContent).toBe("nordic");

    // Press Alt+V again -> cycles back to classic
    await user.keyboard("{Alt>}v{/Alt}");
    expect(screen.getByTestId("current-style").textContent).toBe("classic");
  });

  it("handles rapid Alt+V shortcut keystrokes cleanly cycling through all 3 styles repeatedly", async () => {
    const user = userEvent.setup();
    render(
      <StyleProvider>
        <TestConsumer />
      </StyleProvider>,
    );

    expect(screen.getByTestId("current-style").textContent).toBe("classic");

    // Rapid double cycle: classic -> vault -> nordic -> classic -> vault -> nordic -> classic
    await user.keyboard("{Alt>}v{/Alt}");
    expect(screen.getByTestId("current-style").textContent).toBe("vault");
    await user.keyboard("{Alt>}v{/Alt}");
    expect(screen.getByTestId("current-style").textContent).toBe("nordic");
    await user.keyboard("{Alt>}v{/Alt}");
    expect(screen.getByTestId("current-style").textContent).toBe("classic");
    await user.keyboard("{Alt>}V{/Alt}"); // uppercase V test
    expect(screen.getByTestId("current-style").textContent).toBe("vault");
    await user.keyboard("{Alt>}V{/Alt}");
    expect(screen.getByTestId("current-style").textContent).toBe("nordic");
    await user.keyboard("{Alt>}v{/Alt}");
    expect(screen.getByTestId("current-style").textContent).toBe("classic");
  });

  it("does not cycle styles when Alt is accompanied by Ctrl or Meta keys", async () => {
    const user = userEvent.setup();
    render(
      <StyleProvider>
        <TestConsumer />
      </StyleProvider>,
    );

    expect(screen.getByTestId("current-style").textContent).toBe("classic");

    await user.keyboard("{Control>}{Alt>}v{/Alt}{/Control}");
    expect(screen.getByTestId("current-style").textContent).toBe("classic");

    await user.keyboard("{Meta>}{Alt>}v{/Alt}{/Meta}");
    expect(screen.getByTestId("current-style").textContent).toBe("classic");
  });

  describe("STYLE_INIT_SCRIPT inline anti-FOUC script", () => {
    it("sets data-style='nordic' before hydration when localStorage has 'nordic'", () => {
      localStorage.setItem(STYLE_STORAGE_KEY, "nordic");
      document.documentElement.removeAttribute("data-style");

      // Execute exact head script
      // eslint-disable-next-line no-eval
      eval(STYLE_INIT_SCRIPT);

      expect(document.documentElement.getAttribute("data-style")).toBe("nordic");
    });

    it("sets data-style='vault' before hydration when localStorage has 'vault'", () => {
      localStorage.setItem(STYLE_STORAGE_KEY, "vault");
      document.documentElement.removeAttribute("data-style");

      // eslint-disable-next-line no-eval
      eval(STYLE_INIT_SCRIPT);

      expect(document.documentElement.getAttribute("data-style")).toBe("vault");
    });

    it("sets data-style='classic' before hydration when localStorage has 'classic'", () => {
      localStorage.setItem(STYLE_STORAGE_KEY, "classic");
      document.documentElement.removeAttribute("data-style");

      // eslint-disable-next-line no-eval
      eval(STYLE_INIT_SCRIPT);

      expect(document.documentElement.getAttribute("data-style")).toBe("classic");
    });

    it("falls back to 'classic' when localStorage has unknown or obsolete value", () => {
      localStorage.setItem(STYLE_STORAGE_KEY, "aurora");
      document.documentElement.removeAttribute("data-style");

      // eslint-disable-next-line no-eval
      eval(STYLE_INIT_SCRIPT);

      expect(document.documentElement.getAttribute("data-style")).toBe("classic");
    });

    it("falls back to 'classic' on empty/null localStorage", () => {
      localStorage.removeItem(STYLE_STORAGE_KEY);
      document.documentElement.removeAttribute("data-style");

      // eslint-disable-next-line no-eval
      eval(STYLE_INIT_SCRIPT);

      expect(document.documentElement.getAttribute("data-style")).toBe("classic");
    });

    it("silently swallows exceptions when localStorage is disabled or throws", () => {
      document.documentElement.setAttribute("data-style", "classic");
      const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("SecurityError: Access is denied");
      });

      expect(() => {
        // eslint-disable-next-line no-eval
        eval(STYLE_INIT_SCRIPT);
      }).not.toThrow();

      getItemSpy.mockRestore();
    });
  });

  describe("standalone theme helper functions", () => {
    it("getStoredThemeStyle reads from DOM attribute first, then localStorage, defaulting to classic", () => {
      expect(getStoredThemeStyle()).toBe("classic");

      localStorage.setItem(STYLE_STORAGE_KEY, "vault");
      expect(getStoredThemeStyle()).toBe("vault");

      localStorage.setItem(STYLE_STORAGE_KEY, "nordic");
      expect(getStoredThemeStyle()).toBe("nordic");

      document.documentElement.setAttribute("data-style", "classic");
      expect(getStoredThemeStyle()).toBe("classic");

      document.documentElement.setAttribute("data-style", "vault");
      expect(getStoredThemeStyle()).toBe("vault");

      document.documentElement.setAttribute("data-style", "nordic");
      expect(getStoredThemeStyle()).toBe("nordic");
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

      setStoredThemeStyle("nordic");
      expect(document.documentElement.getAttribute("data-style")).toBe("nordic");
      expect(localStorage.getItem(STYLE_STORAGE_KEY)).toBe("nordic");
      expect(eventDetail).toBe("nordic");

      setStoredThemeStyle("classic");
      expect(document.documentElement.getAttribute("data-style")).toBe("classic");
      expect(localStorage.getItem(STYLE_STORAGE_KEY)).toBe("classic");
      expect(eventDetail).toBe("classic");

      window.removeEventListener("certtracker-style-change", listener);
    });

    it("syncs StyleProvider state when setStoredThemeStyle is called externally", () => {
      render(
        <StyleProvider>
          <TestConsumer />
        </StyleProvider>,
      );

      expect(screen.getByTestId("current-style").textContent).toBe("classic");

      act(() => {
        setStoredThemeStyle("vault");
      });

      expect(screen.getByTestId("current-style").textContent).toBe("vault");
      expect(document.documentElement.getAttribute("data-style")).toBe("vault");

      act(() => {
        setStoredThemeStyle("nordic");
      });

      expect(screen.getByTestId("current-style").textContent).toBe("nordic");
      expect(document.documentElement.getAttribute("data-style")).toBe("nordic");

      act(() => {
        setStoredThemeStyle("classic");
      });

      expect(screen.getByTestId("current-style").textContent).toBe("classic");
      expect(document.documentElement.getAttribute("data-style")).toBe("classic");
    });

    it("toggleStoredThemeStyle cycles between classic, vault, and nordic programmatically", () => {
      setStoredThemeStyle("classic");
      const next1 = toggleStoredThemeStyle();
      expect(next1).toBe("vault");
      expect(document.documentElement.getAttribute("data-style")).toBe("vault");

      const next2 = toggleStoredThemeStyle();
      expect(next2).toBe("nordic");
      expect(document.documentElement.getAttribute("data-style")).toBe("nordic");

      const next3 = toggleStoredThemeStyle();
      expect(next3).toBe("classic");
      expect(document.documentElement.getAttribute("data-style")).toBe("classic");
    });
  });
});
