import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";
import { signInAsSeedAdmin, signInAsSeedUser } from "./support/restore-seed";

// The Data Quality "Open" links (issueHref) land on these URLs; the findings themselves need data the seed does not have.
test("/members?search= opens the list already searched", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/members?search=Ch%C3%A2u");
  await expect(page.getByPlaceholder(/Search by name, code, email, team or career role/)).toHaveValue("Châu");
  // The name cell also holds the pending Level 5 badge, so match the start of its name.
  await expect(page.getByRole("cell", { name: /^Lê Minh Châu/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Trần Thị Bình", exact: true })).toHaveCount(0);
});

test("/courses?tab=certificates&search= searches the Certificates tab", async ({ page }) => {
  await signIn(page, "admin@certtracker.test");
  await page.goto("/courses?tab=certificates&search=NVIDIA");
  await expect(page.getByRole("tab", { name: /^Certificates/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByPlaceholder(/Search exam and course certificates/)).toHaveValue("NVIDIA");
  await expect(page.getByRole("cell", { name: "NVIDIA Generative AI LLMs", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "AWS Solutions Architect Associate", exact: true })).toHaveCount(0);
});

// A member-proposed course or certificate is a Data Quality row for the admin, who approves or rejects it in place.
test("the admin approves and rejects member proposals from Data Quality", async ({ page }) => {
  const stamp = Date.now();
  const approvedName = `E2E DQ Certificate ${stamp}`;
  const rejectedName = `E2E DQ Course ${stamp}`;
  const providerName = `E2E DQ Provider ${stamp}`;
  const member = await signInAsSeedUser("member@certtracker.test");
  const admin = await signInAsSeedAdmin();
  const { data: profile } = await member.from("profiles").select("member_id").maybeSingle();
  const proposal = { catalogue_status: "pending" as const, proposed_by: profile?.member_id ?? null, proposed_provider: providerName };
  try {
    expect((await member.from("certificates").insert({ name: approvedName, kind: "exam", ...proposal })).error).toBeNull();
    expect((await member.from("courses").insert({ name: rejectedName, ...proposal })).error).toBeNull();

    await signIn(page, "admin@certtracker.test");
    await page.goto("/courses");
    await expect(page.getByRole("tab", { name: /Courses/ })).toContainText("waiting for approval");

    await page.goto("/data-quality");
    await page.getByPlaceholder(/Search by name/).fill(String(stamp));
    const certificateRow = page.getByRole("row").filter({ hasText: approvedName });
    const courseRow = page.getByRole("row").filter({ hasText: rejectedName });
    await expect(certificateRow).toContainText("Certificate proposal");
    await expect(courseRow).toContainText("Course proposal");
    await expect(courseRow.getByRole("link", { name: /^Open Course proposal/ })).toHaveAttribute(
      "href",
      /^\/courses\?tab=courses&search=E2E%20DQ%20Course/,
    );

    await certificateRow.getByRole("button", { name: `Approve ${approvedName}` }).click();
    await expect(page.getByText(`Approved ${approvedName}`)).toBeVisible();
    await expect(certificateRow).toHaveCount(0);

    await courseRow.getByRole("button", { name: `Reject ${rejectedName}` }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Reject" }).click();
    await expect(page.getByText(`Rejected ${rejectedName}`)).toBeVisible();
    await expect(courseRow).toHaveCount(0);

    const certificate = await admin.from("certificates").select("catalogue_status").eq("name", approvedName).single();
    const course = await admin.from("courses").select("catalogue_status").eq("name", rejectedName).single();
    expect(certificate.data?.catalogue_status).toBe("approved");
    expect(course.data?.catalogue_status).toBe("rejected");
  } finally {
    await admin.from("certificates").delete().eq("name", approvedName);
    await admin.from("courses").delete().eq("name", rejectedName);
    await admin.from("providers").delete().eq("name", providerName);
  }
});
