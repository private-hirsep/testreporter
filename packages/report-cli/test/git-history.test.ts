import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { NormalizedTestCase } from "@quality-report/report-core";
import { collectGitHistory } from "../src/git-history.js";

function testCase(id: string, file: string): NormalizedTestCase {
  return {
    id,
    name: "test",
    framework: "vitest",
    layer: "frontend",
    status: "passed",
    retries: 0,
    requirements: [],
    defects: [],
    tags: [],
    links: [],
    labels: {},
    attachments: [],
    file
  };
}

describe("git history", () => {
  it("degrades outside git", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "qr-no-git-"));
    expect((await collectGitHistory(dir, [])).repository.available).toBe(false);
  });

  it("collects and caches file-level history per unique source", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "qr-git-"));
    execFileSync("git", ["init"], { cwd: dir });
    execFileSync("git", ["config", "user.name", "Test Author"], { cwd: dir });
    execFileSync("git", ["config", "user.email", "test@example.invalid"], { cwd: dir });
    await mkdir(path.join(dir, "tests"));
    await writeFile(path.join(dir, "tests", "sample.test.ts"), "test('one',()=>{})\n");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["commit", "-m", "create definition"], { cwd: dir });
    await writeFile(path.join(dir, "tests", "sample.test.ts"), "test('two',()=>{})\n");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["commit", "-m", "change definition"], { cwd: dir });

    const result = await collectGitHistory(dir, [
      testCase("T-1", "tests/sample.test.ts"),
      testCase("T-2", "tests/sample.test.ts")
    ]);
    expect(result.repository).toMatchObject({ available: true, shallow: false });
    expect(result.histories.get("T-1")).toMatchObject({ confidence: "file-level" });
    expect(result.histories.get("T-1")?.revisions.map((item) => item.message)).toEqual([
      "change definition",
      "create definition"
    ]);
    expect(result.histories.get("T-1")).toBe(result.histories.get("T-2"));
  });
});
