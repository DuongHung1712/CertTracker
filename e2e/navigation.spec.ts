import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("admin sees admin-only sections", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await expect(page.getByRole("link", { name: "Organisation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Import / Export" })).toBeVisible();
});

test("member sees only personal sections", async ({ page }) => {
  await signIn(page, "member@certtracker.test");
  await expect(page.getByRole("link", { name: "My certificates" })).toBeVisible();
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
