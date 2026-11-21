import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// The Data Quality "Open" links (issueHref) land on these URLs; the findings themselves need data the seed does not have.
test("/members?search= opens the list already searched", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/members?search=Ch%C3%A2u");
  await expect(page.getByPlaceholder(/Search by name, code or email/)).toHaveValue("Châu");
  await expect(page.getByRole("cell", { name: "Lê Minh Châu", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Trần Thị Bình", exact: true })).toHaveCount(0);
});

test("/courses?tab=certificates&search= searches the Certificates tab", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/courses?tab=certificates&search=NVIDIA");
  await expect(page.getByRole("tab", { name: "Certificates", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByPlaceholder(/Search certificates/)).toHaveValue("NVIDIA");
  await expect(page.getByRole("cell", { name: "NVIDIA Generative AI LLMs", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "AWS Solutions Architect Associate", exact: true })).toHaveCount(0);
});
