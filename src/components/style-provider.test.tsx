// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  StyleProvider,
  useThemeStyle,
  STYLE_STORAGE_KEY,
  THEME_STYLES,
  type ThemeStyle,
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

  it("coordinates cursor coordinates on vault-spotlight cards when vault style is active", async () => {
    const user = userEvent.setup();
    render(
      <StyleProvider>
        <TestConsumer />
        <div data-testid="target-kpi" data-slot="kpi-tile" className="vault-spotlight">
          KPI Content
        </div>
      </StyleProvider>,
    );

    const kpi = screen.getByTestId("target-kpi");
    kpi.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 100,
        right: 300,
        bottom: 200,
        width: 200,
        height: 100,
        x: 100,
        y: 100,
        toJSON: () => {},
      }) as DOMRect;

    // In classic mode, pointermove does nothing
    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: 150, clientY: 130 }));
    });
    expect(kpi.style.getPropertyValue("--mouse-x")).toBe("");

    // Switch to vault mode
    await user.click(screen.getByRole("button", { name: "Set Vault" }));

    // Now pointermove on the kpi card updates CSS variables
    act(() => {
      const event = new PointerEvent("pointermove", { clientX: 150, clientY: 130, bubbles: true });
      kpi.dispatchEvent(event);
    });

    expect(kpi.style.getPropertyValue("--mouse-x")).toBe("50px");
    expect(kpi.style.getPropertyValue("--mouse-y")).toBe("30px");
  });
});
