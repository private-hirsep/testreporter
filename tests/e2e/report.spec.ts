import { expect, test } from "@playwright/test";

test("generated report loads dashboard and tests", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".gate-hero")).toBeVisible();
  await expect(page.locator(".gate-title")).toHaveText("Quality Gate PASSED");
  expect(await page.locator(".gate-check").count()).toBeGreaterThanOrEqual(3);
  await expect(page.locator(".gate-check").filter({ hasText: "Total coverage" })).toBeVisible();
  await expect(page.locator(".metrics")).toHaveCount(0);
  await expect(page.locator(".quality-areas")).toHaveCount(0);
  await expect(page.locator(".dashboard-overview .summary-panel")).toHaveCount(3);
  await expect(page.getByText("Test Health")).toBeVisible();
  await expect(page.getByText("Risk & Compliance")).toBeVisible();
  await page.getByRole("link", { name: "Tests" }).first().click();
  await expect(page.getByRole("heading", { name: "Tests" })).toBeVisible();
  await expect(page.getByText("creates user account JIRA-101")).toBeVisible();
});

test("navigation routes work with GitHub Pages hash fallback", async ({ page }) => {
  await page.goto("/404.html#/coverage");
  await expect(page.getByRole("heading", { name: "Coverage", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Requirements" }).first().click();
  await expect(page.getByRole("heading", { name: "Requirement Coverage" })).toBeVisible();
  await page.getByRole("link", { name: "Security" }).first().click();
  await expect(page.getByRole("heading", { name: "Security" })).toBeVisible();
  await page.getByRole("link", { name: "Downloads" }).first().click();
  await expect(page.getByRole("heading", { name: "Downloads" })).toBeVisible();
  await page.getByRole("link", { name: "History" }).first().click();
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
});

test("test filters and detail page make failures visible and safe", async ({ page }) => {
  await page.goto("/#/tests");
  await page.getByRole("button", { name: /Failed 3/ }).click();
  await expect(page.getByText("rejects duplicate email JIRA-102")).toBeVisible();
  await expect(page.getByText("creates user account JIRA-101")).toBeHidden();
  await page.getByRole("link", { name: /rejects duplicate email JIRA-102/ }).click();
  await expect(
    page.getByRole("heading", { name: "rejects duplicate email JIRA-102" })
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "UserServiceTest.java:67" })).toBeVisible();
  await expect(page.getByText("Parsed Stack Frames")).toBeVisible();
  await expect(page.locator(".trace-block")).toHaveText(
    /Expected duplicate email validation error/
  );
});

test("requirement links connect requirements and tests", async ({ page }) => {
  await page.goto("/#/requirements");
  await expect(page.locator("#requirement-JIRA-999")).toContainText("missing");
  await page.getByRole("button", { name: "Toggle linked tests for JIRA-401" }).click();
  const details = page.locator("#requirement-JIRA-401-details");
  await expect(details).toBeVisible();
  expect(await details.getByRole("link").count()).toBeGreaterThanOrEqual(3);
  await expect(details.getByRole("row").last()).toContainText(/passed|failed|broken|skipped/);
  await page.locator("#requirement-JIRA-101").getByRole("link").first().click();
  await expect(page.getByRole("heading", { name: /JIRA-101/ })).toBeVisible();
});

test("test detail shows multiple requirements, retry metadata, and attachments", async ({
  page
}) => {
  await page.goto("/#/tests");
  await page.getByText("locks account after suspicious signup JIRA-101 JIRA-401").click();
  await expect(
    page.getByRole("heading", { name: "locks account after suspicious signup JIRA-101 JIRA-401" })
  ).toBeVisible();
  await expect(page.locator(".test-detail")).toContainText("JIRA-101");
  await expect(page.locator(".test-detail")).toContainText("JIRA-401");
  await page.getByRole("link", { name: "Tests" }).first().click();
  await page.getByRole("button", { name: /Retried 1/ }).click();
  await page.getByText("payment decline shows recovery path JIRA-501").click();
  await expect(page.getByText("project: firefox-desktop")).toBeVisible();
  await expect(page.getByText("browser: firefox")).toBeVisible();
  await expect(page.getByText("attachments/payment-decline-retry-trace.zip")).toBeVisible();
  await expect(page.locator(".test-detail")).toContainText("Retries");
  await expect(page.locator(".test-detail .detail-section").first()).toContainText("1");
});

test("test detail and diagnostics show identity and traceability", async ({ page }) => {
  await page.goto("/#/tests");
  await page.getByText("buyer can complete checkout JIRA-301 JIRA-501").click();
  await expect(page.locator(".test-detail")).toContainText("SHOP-TC-0042");
  await expect(page.locator(".test-detail")).toContainText("explicit");
  await expect(page.locator(".test-detail")).toContainText("BUG-17");
  await expect(page.locator(".test-detail")).toContainText("critical");
  await page.goto("/#/diagnostics");
  await expect(page.getByRole("heading", { name: "Identity Health" })).toBeVisible();
  await expect(page.getByText("Generated IDs")).toBeVisible();
});

test("security details render enriched fields defensively", async ({ page }) => {
  await page.goto("/#/security");
  await expect(page.locator(".summary-strip")).toContainText("codeql");
  await expect(page.locator(".summary-strip .chart-row", { hasText: "Critical" })).toBeVisible();
  await page.getByText("Missing anti-clickjacking header").click();
  await expect(page.getByText("Rule ID")).toBeVisible();
  await expect(page.getByText("10020")).toBeVisible();
  await expect(page.getByText("http://localhost:3000/")).toBeVisible();
});

test("downloads listed in manifest resolve from static output", async ({ page, request }) => {
  const manifest = (await (await request.get("/data/manifest.json")).json()) as {
    downloads: Array<{ name: string; path: string }>;
  };
  expect(
    manifest.downloads.some((download) => download.name === "Full generated report ZIP")
  ).toBeTruthy();
  for (const download of manifest.downloads) {
    const response = await request.get(`/${download.path}`);
    expect(response.ok(), `${download.path} should resolve`).toBeTruthy();
  }
  await page.goto("/#/downloads");
  await expect(page.getByText("Full report")).toBeVisible();
  const hasHorizontalOverflow = await page
    .locator(".data-table")
    .evaluate((element) => element.scrollWidth > element.clientWidth + 1);
  expect(hasHorizontalOverflow).toBeFalsy();
});

test("coverage highlights low coverage files", async ({ page }) => {
  await page.goto("/#/coverage");
  await expect(page.getByText("low coverage file(s)")).toBeVisible();
  const lowPanel = page.locator(".low-coverage-panel");
  await expect(lowPanel).toBeVisible();
  await expect(lowPanel).toContainText("src/components/SecurityBanner.ts");
  await page.getByText("frontend coverage").click();
  const securityBannerRow = page
    .locator(".v-expansion-panel")
    .getByRole("row")
    .filter({ hasText: "src/components/SecurityBanner.ts" });
  await expect(securityBannerRow).toBeVisible();
  await expect(securityBannerRow).toContainText("25%");
});

test("tests table columns are sortable", async ({ page }) => {
  await page.goto("/#/tests");
  const statusHeader = page.getByRole("columnheader", { name: "Status" });
  await expect(statusHeader).toHaveAttribute("aria-sort", "ascending");
  const durationHeader = page.getByRole("columnheader", { name: "Duration" });
  await durationHeader.getByRole("button").click();
  await expect(durationHeader).toHaveAttribute("aria-sort", "descending");
  await expect(statusHeader).not.toHaveAttribute("aria-sort", /./);
  await durationHeader.getByRole("button").click();
  await expect(durationHeader).toHaveAttribute("aria-sort", "ascending");
});

test("diagnostics renders clean empty state without warnings", async ({ page, request }) => {
  const manifest = await (await request.get("/data/manifest.json")).json();
  await page.route("**/data/manifest.json", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ...manifest, warnings: [] })
    });
  });
  await page.goto("/#/diagnostics");
  await expect(page.getByText("No parser warnings were recorded for this run.")).toBeVisible();
  await expect(page.locator(".data-table")).toHaveCount(0);
});

test("diagnostics renders parser warnings when present", async ({ page, request }) => {
  const manifest = await (await request.get("/data/manifest.json")).json();
  await page.route("**/data/manifest.json", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ...manifest,
        warnings: [
          {
            sourcePath: "security/codeql/broken.sarif",
            code: "artifact.parse-failed",
            message: "Malformed SARIF fixture"
          }
        ]
      })
    });
  });
  await page.goto("/#/diagnostics");
  await expect(page.getByRole("heading", { name: "Diagnostics" })).toBeVisible();
  await expect(page.locator(".data-table")).toBeVisible();
  await expect(page.getByText("Malformed SARIF fixture")).toBeVisible();
});

test("generated data does not leak absolute paths or embed raw html", async ({ request }) => {
  const manifestText = await (await request.get("/data/manifest.json")).text();
  const testsText = await (await request.get("/data/tests-0.json")).text();
  const html = await (await request.get("/index.html")).text();
  const combined = `${manifestText}\n${testsText}`;
  expect(combined).not.toMatch(/[A-Za-z]:[\\/](?![\\/])/);
  expect(combined).not.toContain("file://");
  expect(combined).not.toContain("/home/");
  expect(html).toContain('<div id="app"></div>');
  expect(html).not.toContain("<iframe");
});

test("github pages fallback redirects clean paths to hash routes", async ({ page }) => {
  await page.goto("/tests");
  await expect(page).toHaveURL(/#\/tests$/);
  await expect(page.getByRole("heading", { name: "Tests" })).toBeVisible();
});
