import { expect, test } from "@playwright/test";

test("generated report loads dashboard and tests", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.locator(".gate-title")).toHaveText("Quality Gate PASSED");
  await expect(page.getByText("Total Tests")).toBeVisible();
  await expect(page.getByText("Parser Warnings")).toBeVisible();
  await page.getByRole("link", { name: "Tests" }).first().click();
  await expect(page.getByRole("heading", { name: "Tests" })).toBeVisible();
  await expect(page.getByText("creates user RFL-101")).toBeVisible();
});

test("navigation routes work with GitHub Pages hash fallback", async ({ page }) => {
  await page.goto("/404.html#/coverage");
  await expect(page.getByRole("heading", { name: "Coverage" })).toBeVisible();
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
  await page.getByRole("button", { name: /Failed 1/ }).click();
  await expect(page.getByText("rejects duplicate email RFL-102")).toBeVisible();
  await expect(page.getByText("creates user RFL-101")).toBeHidden();
  await page.getByRole("link", { name: /rejects duplicate email RFL-102/ }).click();
  await expect(page.getByRole("heading", { name: "rejects duplicate email RFL-102" })).toBeVisible();
  await expect(page.getByText("AssertionError: expected duplicate error")).toBeVisible();
  await expect(page.locator(".trace-block")).toHaveText(/Expected duplicate error/);
});

test("requirement links connect requirements and tests", async ({ page }) => {
  await page.goto("/#/requirements");
  await expect(page.locator("#requirement-RFL-999")).toContainText("missing");
  await page.locator("#requirement-RFL-101").getByRole("link").first().click();
  await expect(page.getByRole("heading", { name: "creates user RFL-101" })).toBeVisible();
});

test("security details render enriched fields defensively", async ({ page }) => {
  await page.goto("/#/security");
  await expect(page.getByText("codeql Summary")).toBeVisible();
  await page.getByText("Missing anti-clickjacking header").click();
  await expect(page.getByText("Rule ID")).toBeVisible();
  await expect(page.getByText("10020")).toBeVisible();
  await expect(page.getByText("http://localhost:3000/")).toBeVisible();
});

test("downloads listed in manifest resolve from static output", async ({ page, request }) => {
  const manifest = (await (await request.get("/data/manifest.json")).json()) as {
    downloads: Array<{ name: string; path: string }>;
  };
  expect(manifest.downloads.some((download) => download.name === "Full generated report ZIP")).toBeTruthy();
  for (const download of manifest.downloads) {
    const response = await request.get(`/${download.path}`);
    expect(response.ok(), `${download.path} should resolve`).toBeTruthy();
  }
  await page.goto("/#/downloads");
  await expect(page.getByText("Full report")).toBeVisible();
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
