import { expect, test, type Page } from "@playwright/test";

const caseId = "1116d9ae2b5263c8";

function artifact() {
  return {
    schemaVersion: "1.0",
    project: { key: "DEMO", name: "Demo" },
    generatedAt: "2026-07-24T00:00:00.000Z",
    retention: {
      maxRuns: 50,
      maxAgeDays: 180,
      maxManualExecutions: 200,
      prunedRuns: 0,
      prunedManualExecutions: 0
    },
    availability: "available",
    runs: [
      {
        id: "historical-auto",
        type: "automated",
        projectKey: "DEMO",
        release: "1.0",
        branch: "main",
        environment: "ci",
        commit: "abc123",
        workflowRun: "123",
        workflowAttempt: 2,
        reportedAt: "2026-07-23T00:00:00.000Z",
        status: "failed",
        counts: {
          total: 1,
          passed: 0,
          failed: 1,
          broken: 0,
          blocked: 0,
          skipped: 0,
          notRun: 0,
          unknown: 0
        },
        caseResults: [
          {
            testCaseId: caseId,
            implementationId: "historical-implementation",
            status: "failed",
            durationMs: 1200,
            identity: { source: "explicit", stable: true, conflict: false }
          }
        ],
        sourceReport: { url: "https://example.test/report" }
      }
    ],
    manualExecutions: [
      {
        executionId: "historical-manual",
        projectKey: "DEMO",
        release: "1.0",
        environment: "staging",
        tester: "Tester",
        startedAt: "2026-07-22T00:00:00.000Z",
        completedAt: "2026-07-22T01:00:00.000Z",
        status: "passed",
        caseResults: [{ testCaseId: caseId, status: "passed" }]
      }
    ],
    cases: [
      {
        testCaseId: caseId,
        samples: [
          {
            executionId: "historical-auto",
            type: "automated",
            at: "2026-07-23T00:00:00.000Z",
            status: "failed",
            presence: "present",
            branch: "main",
            environment: "ci"
          },
          {
            executionId: "latest-auto",
            type: "automated",
            at: "2026-07-24T00:00:00.000Z",
            status: "absent",
            presence: "absent",
            branch: "main",
            environment: "ci"
          }
        ],
        previousStatus: "failed",
        transition: "removed-or-missing",
        sampleSize: 1,
        passed: 0,
        failed: 1,
        consecutiveFailures: 1,
        identityConfidence: "trusted",
        stability: "insufficient-history",
        passFailTransitions: 0
      }
    ],
    trends: {
      runCount: 2,
      newFailures: 0,
      persistentFailures: 0,
      recovered: 0,
      removedOrMissing: 1,
      unstable: 0,
      slowRegressions: 0
    },
    diagnostics: []
  };
}

async function provideHistory(page: Page, body: unknown = artifact()) {
  await page.route("**/data/history.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) })
  );
}

test("historical automated and manual executions open from the unified list", async ({ page }) => {
  await provideHistory(page);
  await page.goto("/#/history");
  await page.getByRole("link", { name: "historical-auto" }).click();
  await expect(page.getByRole("heading", { name: "historical-auto" })).toBeVisible();
  await expect(page.getByText("historical-implementation")).toBeVisible();
  await expect(page.getByText("Workflow attempt").locator("..")).toContainText("2");
  await page.screenshot({
    path: "docs/screenshots/pr28-corrections/historical-execution.png",
    fullPage: true
  });
  await page.goto("/#/history");
  await page.getByRole("link", { name: "historical-manual" }).click();
  await expect(page.getByRole("heading", { name: "historical-manual" })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "Tester" })).toBeVisible();
});

test("removed case and missing execution states remain honest", async ({ page }) => {
  await provideHistory(page);
  await page.goto(`/#/tests/${caseId}`);
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(page.getByText("absent", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/screenshots/pr28-corrections/removed-case-mobile.png",
    fullPage: true
  });
  await page.goto("/#/executions/does-not-exist");
  await expect(page.getByText("Execution was not found in this report.")).toBeVisible();
});

test("invalid optional history leaves the current report usable", async ({ page }) => {
  await provideHistory(page, { schemaVersion: "99" });
  await page.goto("/#/diagnostics");
  await expect(page.getByRole("heading", { name: "Diagnostics", exact: true })).toBeVisible();
  await expect(page.getByText(/Unsupported history schema version/)).toBeVisible();
  await page.goto("/#/history");
  await expect(page.getByText("demo-release-17-follow-up")).toBeVisible();
});
