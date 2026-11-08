import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

test("admin sees admin-only sections", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await expect(page.getByRole("link", { name: "Organisation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Import / Export" })).toBeVisible();
});

test("member sees only personal sections", async ({ page }) => {
  await signIn(page, "member@certtracker.test");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link", { name: "My certificates" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Organisation" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Members" })).toHaveCount(0);
});

test("sidebar link navigates, marks the breadcrumb and the active item", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  // Scoped to the sidebar nav: the active breadcrumb item also has role
  // "link" (it's a disabled <span role="link">), so an unscoped query for
  // "Courses" matches both.
  const link = page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Courses" });
  await link.click();
  await expect(page).toHaveURL(/\/courses$/);
  await expect(page.getByRole("heading", { name: "Courses" })).toBeVisible();
  await expect(page.locator('[data-slot="breadcrumb-page"]')).toHaveText("Courses");
  await expect(link).toHaveAttribute("aria-current", "page");
});

// ---------------------------------------------------------------------------
// Page speed (M1 Task 8): loading feedback on every page.
// ---------------------------------------------------------------------------

const MAIN_NAV = { name: "Main navigation" } as const;

/** Sidebar routes: link label, route, h1 text, who sees it, and a different page to start from. */
const ROUTES = [
  { link: "Dashboard", href: "/dashboard", heading: "Dashboard", user: "admin", from: "Courses" },
  { link: "My certificates", href: "/me", heading: "My certificates", user: "member", from: "Courses" },
  { link: "Members", href: "/members", heading: "Members", user: "admin", from: "Courses" },
  { link: "Certificates", href: "/records", heading: "Certificates", user: "admin", from: "Courses" },
  { link: "Data quality", href: "/data-quality", heading: "Data quality", user: "admin", from: "Courses" },
  { link: "Courses", href: "/courses", heading: "Courses", user: "admin", from: "Members" },
  { link: "Organisation", href: "/org", heading: "Organisation", user: "admin", from: "Courses" },
  { link: "Import / Export", href: "/import", heading: "Import / Export", user: "admin", from: "Courses" },
  { link: "Settings", href: "/settings", heading: "Settings", user: "admin", from: "Courses" },
] as const;

/** Holds every client-side (RSC) navigation request to `pathPart` for `ms`, except prefetches. */
async function delayNavigation(page: Page, pathPart: string, ms: number) {
  await page.route(`**${pathPart}?*`, async (route) => {
    const headers = route.request().headers();
    if (headers["rsc"] && !headers["next-router-prefetch"]) {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
    await route.continue();
  });
}

const sidebarLink = (page: Page, name: string) =>
  page.getByRole("navigation", MAIN_NAV).getByRole("link", { name, exact: true });

for (const route of ROUTES) {
  test(`${route.href}: skeleton or heading within 300 ms of the click`, async ({ page }) => {
    await signIn(page, `${route.user}@certtracker.test`);
    // Visit the start page and the target once so the dev server has compiled both.
    await sidebarLink(page, route.from).click();
    await expect(page.getByRole("heading", { level: 1, name: route.from, exact: true })).toBeVisible();
    await sidebarLink(page, route.link).click();
    await expect(page.getByRole("heading", { level: 1, name: route.heading, exact: true })).toBeVisible();
    await sidebarLink(page, route.from).click();
    await expect(page.getByRole("heading", { level: 1, name: route.from, exact: true })).toBeVisible();

    // The start page's heading is a different one, so only the target's skeleton or heading satisfies this.
    await sidebarLink(page, route.link).click();
    const feedback = page
      .locator('[role="status"][aria-busy="true"]')
      .or(page.getByRole("heading", { level: 1, name: route.heading, exact: true }))
      .first();
    await expect(feedback).toBeVisible({ timeout: 300 });
    // Let the navigation finish so the test does not end with a request in flight.
    await expect(page.getByRole("heading", { level: 1, name: route.heading, exact: true })).toBeVisible();
  });
}

test("top bar shows while a navigation is pending and goes idle when the page is there", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await delayNavigation(page, "/courses", 1000);
  const bar = page.getByTestId("nav-progress");
  await expect(bar).toHaveAttribute("data-state", "idle");

  await sidebarLink(page, "Courses").click();
  await expect(bar).toHaveAttribute("data-state", "loading", { timeout: 100 });
  await expect(page.getByRole("heading", { level: 1, name: "Courses", exact: true })).toBeVisible();
  await expect(bar).toHaveAttribute("data-state", "idle");
  await expect(bar).toHaveAttribute("aria-hidden", "true");
});

test("top bar crawls with an animation while loading (normal motion)", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await delayNavigation(page, "/courses", 1000);
  const bar = page.getByTestId("nav-progress");

  await sidebarLink(page, "Courses").click();
  await expect(bar).toHaveAttribute("data-state", "loading", { timeout: 100 });
  const animationName = await bar.evaluate((el) => getComputedStyle(el).animationName);
  expect(animationName).not.toBe("none");
  await expect(page.getByRole("heading", { level: 1, name: "Courses", exact: true })).toBeVisible();
});

test("reduced motion: top bar has no animation or transition and is full width while loading", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, "admin@certtracker.test");
  await delayNavigation(page, "/courses", 1000);
  const bar = page.getByTestId("nav-progress");

  await sidebarLink(page, "Courses").click();
  await expect(bar).toHaveAttribute("data-state", "loading", { timeout: 100 });
  const style = await bar.evaluate((el) => {
    const css = getComputedStyle(el);
    return { animationName: css.animationName, transitionProperty: css.transitionProperty, width: el.getBoundingClientRect().width };
  });
  expect(style.animationName).toBe("none");
  expect(style.transitionProperty).toBe("none");
  expect(style.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 1);
  await expect(page.getByRole("heading", { level: 1, name: "Courses", exact: true })).toBeVisible();
  await expect(bar).toHaveAttribute("data-state", "idle");
});
