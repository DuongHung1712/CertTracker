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
  const { style, setStyle, styles } = useThemeStyle();
  return (
    <div>
      <span data-testid="current-style">{style}</span>
      <div data-testid="styles-count">{styles.length}</div>
      <button onClick={() => setStyle("aurora")}>Set Aurora</button>
      <button onClick={() => setStyle("tactile")}>Set Tactile</button>
      <button onClick={() => setStyle("classic")}>Set Classic</button>
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

  it("defaults to classic style and exposes THEME_STYLES", () => {
    render(
      <StyleProvider>
        <TestConsumer />
      </StyleProvider>,
    );

    expect(screen.getByTestId("current-style").textContent).toBe("classic");
    expect(screen.getByTestId("styles-count").textContent).toBe(String(THEME_STYLES.length));
    expect(document.documentElement.getAttribute("data-style")).toBe("classic");
  });

  it("loads stored style from localStorage on mount", () => {
    localStorage.setItem(STYLE_STORAGE_KEY, "aurora");

    render(
      <StyleProvider>
        <TestConsumer />
      </StyleProvider>,
    );

    expect(screen.getByTestId("current-style").textContent).toBe("aurora");
    expect(document.documentElement.getAttribute("data-style")).toBe("aurora");
  });

  it("updates state, localStorage, and html[data-style] on style change", async () => {
    const user = userEvent.setup();
    render(
      <StyleProvider>
        <TestConsumer />
      </StyleProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Set Aurora" }));
    expect(screen.getByTestId("current-style").textContent).toBe("aurora");
    expect(localStorage.getItem(STYLE_STORAGE_KEY)).toBe("aurora");
    expect(document.documentElement.getAttribute("data-style")).toBe("aurora");

    await user.click(screen.getByRole("button", { name: "Set Tactile" }));
    expect(screen.getByTestId("current-style").textContent).toBe("tactile");
    expect(localStorage.getItem(STYLE_STORAGE_KEY)).toBe("tactile");
    expect(document.documentElement.getAttribute("data-style")).toBe("tactile");

    await user.click(screen.getByRole("button", { name: "Set Classic" }));
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
          newValue: "tactile",
        }),
      );
    });

    expect(screen.getByTestId("current-style").textContent).toBe("tactile");
    expect(document.documentElement.getAttribute("data-style")).toBe("tactile");
  });
});
