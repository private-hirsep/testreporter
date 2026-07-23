import { expect, test } from "@playwright/test";

test("logical catalogue and unified execution workflow", async ({ page }) => {
  await page.goto("/#/tests");
  await page.getByRole("textbox", { name: "Search catalogue" }).fill("SHOP-TC-0042");
  await expect(page.getByText("Verify checkout with an assistive technology")).toBeVisible();
  await page.getByRole("combobox", { name: "Type" }).press("ArrowDown");
  await page.getByRole("option", { name: "hybrid" }).click();
  await page.getByText("buyer can complete checkout JIRA-301 JIRA-501").click();
  await expect(page.locator(".test-detail")).toContainText("hybrid");
  await page.getByRole("tab", { name: "Implementations" }).click();
  await expect(page.getByText("automated", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: /manual.*inactive/ })).toBeVisible();
  await page.getByRole("tab", { name: "Executions" }).click();
  const executionLink = page.locator(".test-detail").getByRole("link").filter({ hasText: /.+/ }).last();
  await executionLink.click();
  await expect(page.getByRole("heading", { name: "Test cases involved" })).toBeVisible();
  await page.getByRole("link", { name: "SHOP-TC-0042" }).click();
  await page.getByRole("tab", { name: "Traceability" }).click();
  await page.getByRole("link", { name: "JIRA-301" }).click();
  await expect(page.locator("#requirement-JIRA-301")).toBeFocused();

  await page.goto("/#/history");
  await expect(page.getByText(/Historical automated runs have not been merged yet/)).toBeVisible();
  await page.getByRole("combobox", { name: "Type" }).press("ArrowDown");
  await page.getByRole("option", { name: "manual" }).click();
  await expect(page.getByText("demo-release-17-follow-up")).toBeVisible();
  await page.getByText("demo-release-17-follow-up").click();
  await expect(page.getByText("Example Tester")).toBeVisible();
  await page.getByRole("link", { name: "Open evidence" }).click();
  await expect(page.getByRole("heading", { name: "Evidence" })).toBeVisible();
});

test("older report fallback remains readable", async ({ page }) => {
  await page.route("**/data/manifest.json", async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as Record<string, unknown>;
    delete body.testCaseCatalogue;
    delete body.unifiedExecutions;
    await route.fulfill({ response, json: body });
  });
  await page.goto("/#/tests");
  await expect(page.getByText(/Compatibility view/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Test Cases" })).toBeVisible();
  await page.goto("/#/history");
  await expect(page.getByText(/older report does not contain unified execution summaries/)).toBeVisible();
});
