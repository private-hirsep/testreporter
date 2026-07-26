import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const root = path.resolve(import.meta.dirname, "..");

async function yamlFile(relativePath: string) {
  const content = await readFile(path.join(root, relativePath), "utf8");
  return { content, parsed: parse(content) as Record<string, unknown> };
}

describe("GitHub workflow and documentation contracts", () => {
  it("parses every repository workflow as valid YAML", async () => {
    const workflowDir = path.join(root, ".github/workflows");
    const workflows = (await readdir(workflowDir)).filter(
      (file) => file.endsWith(".yml") || file.endsWith(".yaml")
    );
    expect(workflows.length).toBeGreaterThan(0);
    for (const workflow of workflows) {
      await expect(yamlFile(path.join(".github/workflows", workflow))).resolves.toBeTruthy();
    }
  });

  it("keeps publish-quality-report as the canonical reusable workflow", async () => {
    const { content, parsed } = await yamlFile(".github/workflows/publish-quality-report.yml");
    const workflowCall = (
      parsed.on as {
        workflow_call?: { inputs?: Record<string, unknown>; outputs?: Record<string, unknown> };
      }
    ).workflow_call;
    expect(workflowCall).toBeTruthy();
    expect(Object.keys(workflowCall?.inputs ?? {}).sort()).toEqual([
      "artifact-path",
      "artifact-pattern",
      "config-path",
      "fail-on-quality-gate",
      "pr-comment-marker",
      "pr-comment-mode",
      "publish-mode",
      "quality-gates-path",
      "quality-profile",
      "report-title",
      "update-pr-comment"
    ]);
    expect(Object.keys(workflowCall?.outputs ?? {}).sort()).toEqual([
      "full-comment-path",
      "minimal-comment-path",
      "pages-url",
      "pr-comment-url",
      "quality-gate-status",
      "quality-profile",
      "report-path",
      "report-zip-path",
      "summary-json-path"
    ]);
    expect(parsed.permissions).toMatchObject({
      actions: "read",
      contents: "read",
      issues: "write",
      "pull-requests": "write",
      pages: "write",
      "id-token": "write"
    });
    expect(content).toContain("actions/download-artifact@v4");
    expect(content).toContain("actions/upload-artifact@v4");
    expect(content).toContain("actions/upload-pages-artifact@v3");
    expect(content).toContain("actions/deploy-pages@v4");
    expect(content).toContain("Post or update PR comment");
    expect(content).toContain("Fail on quality gate");
    expect(content).toContain("publish-mode");
    expect(content).toContain("pr-comment-mode");
  });

  it("keeps the deprecated reusable workflow as a wrapper only", async () => {
    const { content, parsed } = await yamlFile(
      ".github/workflows/reusable-publish-quality-report.yml"
    );
    const jobs = parsed.jobs as Record<string, { uses?: string }>;
    expect(content).toContain("Deprecated compatibility wrapper");
    expect(Object.keys(jobs)).toEqual(["forward"]);
    expect(jobs.forward?.uses).toBe("./.github/workflows/publish-quality-report.yml");
  });

  it("dogfoods real repository results with isolated trusted permissions", async () => {
    const { content, parsed } = await yamlFile(".github/workflows/dogfood-quality-report.yml");
    const jobs = parsed.jobs as Record<string, { permissions?: Record<string, string> }>;
    expect(content).toContain("npm run lint");
    expect(content).toContain("npm run typecheck");
    expect(content).toContain("npm run test:e2e");
    expect(content).toContain("bash scripts/prepare-quality-runner.sh");
    expect(content.indexOf("prepare-quality-runner.sh")).toBeLessThan(
      content.indexOf("npm run test:e2e")
    );
    expect(content).toContain("quality-report.yml");
    expect(content).toContain("github.run_attempt");
    expect(content.indexOf("persist-history.sh")).toBeLessThan(
      content.indexOf("actions/upload-pages-artifact@v3")
    );
    expect(content).toContain("test -f site/data/history.json");
    expect(jobs["build-and-report"]?.permissions).toEqual({ contents: "read" });
    expect(jobs["persist-history"]?.permissions).toEqual({ contents: "write" });
    expect(jobs["deploy-pages"]?.permissions).toEqual({
      pages: "write",
      "id-token": "write"
    });
    expect(content).not.toMatch(/push[^\n]*--force/);
  });

  it("keeps pull-request self reports artifact-only and read-only", async () => {
    const { content, parsed } = await yamlFile(
      ".github/workflows/pull-request-quality-report.yml"
    );
    expect(parsed.permissions).toEqual({ contents: "read" });
    expect(content).toContain("pull_request:");
    expect(content).toContain("not retained history");
    expect(content).toContain("actions/upload-artifact@v4");
    expect(content).not.toContain("persist-history.sh");
    expect(content).not.toContain("deploy-pages");
    expect(content).not.toContain("contents: write");
    expect(content).toContain("bash scripts/prepare-quality-runner.sh");
    expect(content.indexOf("prepare-quality-runner.sh")).toBeLessThan(
      content.indexOf("npm run test:e2e")
    );
    expect(content).not.toContain("pull_request_target");
  });

  it("keeps the workflow checker aligned with direct self-report contracts", async () => {
    const checker = await readFile(
      path.join(root, "scripts/check-workflows-docs.mjs"),
      "utf8"
    );
    expect(checker).toContain("trusted self-report workflow is missing");
    expect(checker).toContain("playwright install --with-deps chromium");
    expect(checker).toContain("test -f site/data/history.json");
    expect(checker).toContain("actions/deploy-pages@v4");
    expect(checker).not.toContain("quality-dogfood-artifacts");
    expect(checker).not.toContain(
      "dogfood workflow must call the canonical reusable workflow"
    );
  });

  it("documents valid action and reusable workflow inputs", async () => {
    const action = (await yamlFile("actions/generate-report/action.yml")).parsed as {
      inputs: Record<string, unknown>;
    };
    expect(Object.keys(action.inputs).sort()).toEqual([
      "config-path",
      "create-zip",
      "fail-on-quality-gate",
      "input-path",
      "output-path",
      "pr-comment-mode",
      "publish-mode",
      "quality-gates-path",
      "quality-profile"
    ]);

    const readme = await readFile(path.join(root, "README.md"), "utf8");
    const githubActions = await readFile(path.join(root, "docs/github-actions.md"), "utf8");
    const docs = `${readme}\n${githubActions}`;
    expect(docs).toContain("publish-quality-report.yml");
    expect(docs).toContain("reusable-publish-quality-report.yml");
    expect(docs).toContain("pull-requests: write");
    expect(docs).toContain("issues: write");
    expect(docs).toContain("pages: write");
    expect(docs).toContain("quality-profile");
    expect(docs).toContain("publish-mode");
    expect(docs).toContain("pr-comment-mode");
  });
});
