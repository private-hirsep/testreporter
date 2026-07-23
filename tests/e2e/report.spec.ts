import { expect, test } from "@playwright/test";

test("manual case runner restores progress and exports a validated result", async ({ page }) => {
  await page.goto("/#/manual");
  await expect(page.getByRole("heading", { name: "Manual testing" })).toBeVisible();
  await expect(page.getByText("DEMO-MT-0012 — Verify report draft usability")).toBeVisible();
  await page.getByRole("button", { name: "Run case" }).first().click();
  await expect(page.getByLabel("Execution ID")).toBeEditable();
  await page.getByLabel("Tester").fill("E2E Tester");
  await page.getByRole("button", { name: "passed" }).nth(0).click();
  await page.getByRole("button", { name: "passed" }).nth(1).click();
  await page.getByRole("button", { name: "passed" }).nth(2).click();
  await page.getByTestId("case-status").click();
  await page.getByRole("option", { name: "passed" }).click();
  await page.reload();
  await expect(page.getByText("1 completed · 1 remaining")).toBeVisible();
  await page.getByRole("button", { name: "Save and next" }).click();
  await page.getByRole("button", { name: "skipped" }).click();
  await page.getByTestId("case-status").click();
  await page.getByRole("option", { name: "skipped" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export validated JSON" }).click();
  expect((await download).suggestedFilename()).toMatch(/^manual-result-.*\.json$/);
});

test("overview prioritizes readiness, required actions, and the quality gate", async ({
  page
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.locator(".context-header")).toContainText("Minimal Quality Example");
  await expect(page.locator(".context-header")).toContainText("Release 1.1.7");
  await expect(page.locator(".context-header")).toContainText("staging");
  await expect(page.locator(".context-header")).toContainText(/Generated \d{2} \w{3} \d{4}/);
  await expect(page.locator(".context-header")).not.toContainText("Last tested");
  await expect(page.locator(".context-header .status-chip")).toContainText("Blocked");
  await expect(page.getByRole("heading", { name: "Required actions" })).toBeVisible();
  expect(await page.locator(".attention-list li").count()).toBeGreaterThanOrEqual(5);
  await expect(page.locator(".summary-cards .metric-card")).toHaveCount(4);
  expect(await page.locator(".gate-check").count()).toBeGreaterThanOrEqual(3);
  await expect(page.locator(".gate-check").filter({ hasText: "Total coverage" })).toBeVisible();
  await expect(
    page.getByText("Historical execution trends are not available in this report yet", {
      exact: false
    })
  ).toBeVisible();
  await page.getByRole("link", { name: "Test Cases" }).first().click();
  await expect(page.getByRole("heading", { name: "Test Cases" })).toBeVisible();
  await expect(page.getByText("creates user account JIRA-101")).toBeVisible();
});

test("a readiness action on the overview leads to the affected test", async ({ page }) => {
  await page.goto("/");
  const action = page.locator(".attention-list a").first();
  await expect(action).toContainText(/failed/);
  await action.click();
  await expect(page.locator(".test-detail")).toBeVisible();
});

test("release readiness explains a blocker and links to its test", async ({ page }) => {
  await page.goto("/#/readiness");
  await expect(page.getByRole("heading", { name: "Release Readiness" })).toBeVisible();
  await expect(page.locator(".page-heading .status-chip")).toContainText("Blocked");
  await expect(page.getByRole("heading", { name: "Why this status" })).toBeVisible();
  await expect(page.locator(".reason-list li").filter({ hasText: /Test .* failed\./ }).first())
    .toBeVisible();
  await expect(page.getByRole("heading", { name: "Accepted risks" })).toBeVisible();
  await expect(page.locator(".risk-list")).toContainText("RISK-004");
  const failed = page.getByRole("link", { name: /Test .* failed\./ }).first();
  await expect(failed).toBeVisible();
  await failed.click();
  await expect(page.locator(".test-detail")).toBeVisible();
});

test("test detail separates definition and execution history", async ({ page }) => {
  await page.goto("/#/tests"); await page.getByText("creates user account JIRA-101").click();
  await expect(page.getByRole("heading", { name: "Execution History" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Definition History" })).toBeVisible();
  await expect(page.getByText(/unavailable/).last()).toBeVisible();
});

test("audit evidence manifest and checksums are inspectable", async ({ request }) => {
  const manifest=await request.get("/evidence-manifest.json"); expect(manifest.ok()).toBeTruthy();
  const value=await manifest.json() as {includedEvidence:Array<{sha256:string}>}; expect(value.includedEvidence.length).toBeGreaterThan(0);
  const checksums=await request.get("/checksums.sha256"); expect(checksums.ok()).toBeTruthy(); expect(await checksums.text()).toMatch(/[a-f0-9]{64}/);
});

test("navigation reaches every major section with GitHub Pages hash fallback", async ({
  page
}) => {
  await page.goto("/404.html#/coverage");
  await expect(page.getByRole("heading", { name: "Coverage", exact: true })).toBeVisible();
  const sections: Array<[string, string | RegExp]> = [
    ["Overview", "Overview"],
    ["Test Cases", "Test Cases"],
    ["Executions", "Executions"],
    ["Release Readiness", "Release Readiness"],
    ["Requirements", "Requirements"],
    ["Manual Testing", "Manual Testing"],
    ["Coverage", "Coverage"],
    ["Security", "Security"],
    ["Evidence", "Evidence"],
    ["Diagnostics", "Diagnostics"]
  ];
  for (const [link, heading] of sections) {
    await page.getByRole("link", { name: link, exact: true }).first().click();
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
  }
});

test("legacy route paths keep working as aliases", async ({ page }) => {
  await page.goto("/#/downloads");
  await expect(page.getByRole("heading", { name: "Evidence" })).toBeVisible();
  await expect(page).toHaveTitle("Evidence · Quality Report");
  await page.goto("/#/evidence");
  await expect(page.getByRole("heading", { name: "Evidence" })).toBeVisible();
  await expect(page).toHaveTitle("Evidence · Quality Report");
  await page.goto("/#/executions");
  await expect(page.getByRole("heading", { name: "Executions", level: 1 })).toBeVisible();
  await page.goto("/#/history");
  await expect(page.getByRole("heading", { name: "Executions", level: 1 })).toBeVisible();
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
  await expect(page.locator("#requirement-JIRA-999")).toContainText(/missing/i);
  await page.getByRole("button", { name: "Toggle linked tests for JIRA-401" }).click();
  const details = page.locator("#requirement-JIRA-401-details");
  await expect(details).toBeVisible();
  expect(await details.getByRole("link").count()).toBeGreaterThanOrEqual(3);
  await expect(details.getByRole("row").last()).toContainText(/passed|failed|broken|skipped/i);
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
  await expect(page.getByRole("heading", { name: "Evidence", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Audit package" })).toBeVisible();
  await expect(page.getByText("Full generated report ZIP")).toBeVisible();
  const overflows = await page
    .locator(".data-table")
    .evaluateAll((elements) =>
      elements.map((element) => element.scrollWidth > element.clientWidth + 1)
    );
  expect(overflows.every((overflow) => !overflow)).toBeTruthy();
});

test("evidence page verifies audit integrity files", async ({ page }) => {
  await page.goto("/#/downloads");
  await expect(page.getByRole("heading", { name: "Audit integrity" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Evidence manifest" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Checksums" })).toBeVisible();
  expect(await page.locator(".status-chip").filter({ hasText: "present" }).count()).toBe(2);
  const zipRow = page.getByRole("row", { name: /Full generated report ZIP/ });
  await expect(zipRow).toContainText("size not recorded");
  await expect(zipRow).not.toContainText("directory");
});

test("an extensionless download with no recorded size is not mislabeled as a directory", async ({
  page,
  request
}) => {
  const manifest = await (await request.get("/data/manifest.json")).json();
  await page.route("**/data/manifest.json", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ...manifest,
        downloads: [
          ...manifest.downloads,
          { id: "synthetic-raw-dir", name: "raw-report", category: "raw", path: "raw/raw-report" }
        ]
      })
    });
  });
  await page.goto("/#/downloads");
  const row = page.getByRole("row", { name: /raw-report/ });
  await expect(row).toContainText("size not recorded");
  await expect(row).not.toContainText("directory");
});

test("quality gate checks show actual and expected values", async ({ page }) => {
  await page.goto("/");
  const coverageCheck = page.locator(".gate-check").filter({ hasText: "Total coverage" });
  await expect(coverageCheck).toContainText("72.4%");
  await expect(coverageCheck).toContainText("(>= 70%)");
  const failedCheck = page.locator(".gate-check").filter({ hasText: "Failed tests" });
  await expect(failedCheck).toContainText("(<= 3)");
});

test("test result filters expose their pressed state", async ({ page }) => {
  await page.goto("/#/tests");
  const all = page.getByRole("button", { name: /All 46/ });
  const failed = page.getByRole("button", { name: /Failed 3/ });
  await expect(all).toHaveAttribute("aria-pressed", "true");
  await expect(failed).toHaveAttribute("aria-pressed", "false");
  await failed.click();
  await expect(failed).toHaveAttribute("aria-pressed", "true");
  await expect(all).toHaveAttribute("aria-pressed", "false");
});

test("readiness explains an empty release scope instead of hiding it", async ({
  page,
  request
}) => {
  const manifest = await (await request.get("/data/manifest.json")).json();
  await page.route("**/data/manifest.json", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ...manifest,
        readiness: {
          ...manifest.readiness,
          requirements: { covered: 0, uncovered: 0, excluded: 0, uncoveredIds: [], excludedIds: [] }
        }
      })
    });
  });
  await page.goto("/#/readiness");
  await expect(page.getByRole("heading", { name: "Scoped requirements" })).toBeVisible();
  await expect(
    page.getByText("The release scope declares no requirements", { exact: false }).first()
  ).toBeVisible();

  await page.goto("/#/");
  await expect(page.getByRole("heading", { name: "Requirement gaps" })).toBeVisible();
  await expect(page.getByText("No requirements are included in this release scope")).toBeVisible();
  await expect(page.getByText("Every requirement in the release scope has evidence")).toHaveCount(
    0
  );
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
  await expect(page.getByRole("heading", { name: "Test Cases" })).toBeVisible();
});

test("requirement deep links scroll to and focus the requirement row", async ({ page }) => {
  await page.goto("/#/requirements#requirement-JIRA-999");
  const row = page.locator("#requirement-JIRA-999");
  await expect(row).toBeInViewport();
  await expect(row).toBeFocused();
  await page.goto("/#/tests");
  await page.getByRole("link", { name: "JIRA-601", exact: true }).first().click();
  await expect(page.locator("#requirement-JIRA-601")).toBeInViewport();
});

test("scope-only requirement chips are not rendered as dead links", async ({ page }) => {
  await page.goto("/");
  const gapChips = page.locator(".gap-chips .v-chip");
  await expect(gapChips.first()).toContainText("DEMO-123");
  expect(await page.locator(".gap-chips a").count()).toBe(0);
  await page.goto("/#/readiness");
  await expect(page.getByText("Uncovered:")).toBeVisible();
  expect(
    await page.locator(".portal-card", { hasText: "Scoped requirements" }).locator("a").count()
  ).toBe(0);
});

test("skip link focuses main content without breaking the route", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/$/);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("main-content");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});

test("diagnostics groups warnings by category", async ({ page }) => {
  await page.goto("/#/diagnostics");
  await expect(page.getByRole("heading", { name: "Identity health" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Configuration \(2\)/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Data compatibility \(1\)/ })).toBeVisible();
  await expect(page.getByText("Unexpected end of JSON input")).toBeVisible();
});

test("narrow viewports keep the workspace usable through the drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.locator(".context-header")).toContainText("Release 1.1.7");
  const toggle = page.getByRole("button", { name: "Open navigation" });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await page.getByRole("link", { name: "Manual Testing", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Manual Testing", level: 1 })).toBeVisible();
  await toggle.click();
  await page.getByRole("link", { name: "Test Cases", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Test Cases", level: 1 })).toBeVisible();
  const bodyOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  expect(bodyOverflow).toBeFalsy();
});
