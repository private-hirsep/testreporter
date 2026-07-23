import { expect, test } from "@playwright/test";

async function select(page: import("@playwright/test").Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label }).press("ArrowDown");
  await page.getByRole("option", { name: option, exact: true }).click();
}

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

test("browser variants and execution snapshots remain distinct", async ({ page }) => {
  await page.goto("/#/tests");
  await expect(page.getByRole("button", { name: "All 48" })).toBeVisible();
  await page.getByRole("textbox", { name: "Search catalogue" }).fill("SHOP-TC-0043");
  await page.getByText("receipt is printable JIRA-302").first().click();
  await expect(page.getByText(/Conflicted canonical identity/)).toBeHidden();
  await expect(page.getByText("Insufficient history · 1 execution(s)")).toBeVisible();
  await page.getByRole("tab", { name: "Implementations" }).click();
  await expect(page.getByRole("cell", { name: /browser: chromium/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: /browser: firefox/ })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "automated" })).toHaveCount(2);
  await page.getByRole("tab", { name: "Executions" }).click();
  const automatedExecution = page.getByRole("row").filter({ hasText: "automated-" });
  await expect(automatedExecution).toContainText("740 ms");
  await expect(automatedExecution).toContainText("810 ms");
  await expect(automatedExecution).toContainText("Summed case implementation time: 1.55 s");
  await expect(automatedExecution).not.toContainText("summed test time");

  await page.goto("/#/diagnostics");
  const compatible = page.locator(".linked-list li").filter({ hasText: "SHOP-TC-0043" });
  await expect(compatible).toContainText("implementations");
  await expect(compatible).not.toContainText("Warning");
  const conflict = page.locator(".linked-list li").filter({ hasText: "SHOP-TC-0042" });
  await expect(conflict).toContainText("incompatible logical identities");
  await expect(
    page.getByRole("heading", { name: "Multiple compatible implementations" })
      .locator("..")
      .getByText("SHOP-TC-0042")
  ).toBeHidden();
  await conflict.getByRole("link", { name: "SHOP-TC-0042" }).click();
  await expect(page.getByText(/Stability unavailable due to identity conflict/)).toBeVisible();

  await page.goto("/#/executions/demo-release-17");
  await expect(page.getByRole("row").filter({ hasText: "DEMO-MT-0012" })).toContainText("Failed");
  await page.goto("/#/executions/demo-release-17-follow-up");
  await expect(page.getByRole("row").filter({ hasText: "DEMO-MT-0012" })).toContainText("Passed");
});

test("logical filters and manual requirement traceability work together", async ({ page }) => {
  await page.goto("/#/tests");
  await select(page, "Requirement", "JIRA-301");
  await select(page, "Tag", "critical");
  await expect(page.getByText("buyer can complete checkout JIRA-301 JIRA-501")).toBeVisible();
  await expect(page.getByText("receipt is printable JIRA-302")).toBeHidden();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await page.getByRole("columnheader", { name: /Status/ }).getByRole("button").click();
  await expect(page.getByRole("columnheader", { name: /Status/ })).toHaveAttribute(
    "aria-sort",
    "descending"
  );

  await page.goto("/#/requirements#requirement-DEMO-124");
  const requirement = page.locator("#requirement-DEMO-124");
  await expect(requirement).toBeFocused();
  await requirement.getByRole("link", { name: /Verify offline warning/ }).click();
  await expect(page.locator(".test-detail")).toContainText("DEMO-MT-0013");

  await page.goto("/#/history");
  await select(page, "Type", "manual");
  await select(page, "Environment", "staging");
  await expect(page.getByText("demo-release-17-follow-up")).toBeVisible();
  await page.getByText("demo-release-17-follow-up").click();
  await page.getByRole("link", { name: "Open evidence" }).click();
  await expect(page).toHaveURL(/#\/downloads#evidence-artifacts$/);
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

test("mixed current and older execution snapshots remain visible", async ({ page }) => {
  await page.route("**/data/manifest.json", async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as {
      unifiedExecutions?: Array<Record<string, unknown>>;
    };
    const current = body.unifiedExecutions?.find(
      (execution) => execution.type === "automated"
    );
    if (current) {
      const older = structuredClone(current);
      older.id = "legacy-automated-execution";
      older.reportedAt = "2026-07-01T10:00:00.000Z";
      delete older.caseResults;
      body.unifiedExecutions?.push(older);
    }
    await route.fulfill({ response, json: body });
  });
  await page.goto("/#/tests/SHOP-TC-0043");
  await page.getByRole("tab", { name: "Executions" }).click();
  await expect(
    page.getByText("Some older executions do not contain execution-specific case results.")
  ).toBeVisible();
  const currentRow = page
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name: /^automated-[a-f0-9]+$/ }) });
  const olderRow = page.getByRole("row").filter({ hasText: "legacy-automated-execution" });
  await expect(currentRow).toBeVisible();
  await expect(currentRow).toContainText("Passed");
  await expect(currentRow).toContainText("740 ms");
  await expect(currentRow).toContainText("810 ms");
  await expect(olderRow).toBeVisible();
  await expect(olderRow).toContainText("Unavailable");
  await expect(olderRow).toContainText(
    "Execution-specific case results are unavailable in this older report."
  );
  await expect(olderRow).toContainText("Not recorded");
  await expect(olderRow).not.toContainText("Passed");
  await olderRow.getByRole("link", { name: "legacy-automated-execution" }).click();
  await expect(
    page.getByText("Execution-specific case results are unavailable in this older report.")
  ).toBeVisible();
});
