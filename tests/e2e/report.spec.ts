import { expect, test } from "@playwright/test";

test("generated report loads dashboard and tests", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Quality Gate")).toBeVisible();
  await page.getByRole("link", { name: "Tests" }).click();
  await expect(page.getByRole("heading", { name: "Tests" })).toBeVisible();
  await expect(page.getByText("creates user RFL-101")).toBeVisible();
});

test("github pages fallback redirects clean paths to hash routes", async ({ page }) => {
  await page.goto("/tests");
  await expect(page).toHaveURL(/#\/tests$/);
  await expect(page.getByRole("heading", { name: "Tests" })).toBeVisible();
});
