import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { discoverArtifacts } from "../src/discovery.js";

describe("CLI config and discovery", () => {
  it("loads a valid quality-report.yml with project metadata and custom gates", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "quality-config-"));
    const configPath = path.join(dir, "quality-report.yml");
    await writeFile(
      configPath,
      [
        "project:",
        "  name: Example Project",
        "  repository: example-org/example-repo",
        "requirements:",
        "  keyPattern: REQ-[0-9]+",
        "qualityGates:",
        "  tests:",
        "    allowFailed: 2",
        "  coverage:",
        "    totalMinimum: 75",
        "  security:",
        "    maxCritical: 0",
        "    maxHigh: 1"
      ].join("\n")
    );

    const config = await loadConfig(configPath);

    expect(config.project.repository).toBe("example-org/example-repo");
    expect(config.requirements.keyPattern).toBe("REQ-[0-9]+");
    expect(config.qualityGates.tests.allowFailed).toBe(2);
    expect(config.qualityGates.tests.allowBroken).toBe(0);
    expect(config.qualityGates.coverage.totalMinimum).toBe(75);
    expect(config.qualityGates.security.maxHigh).toBe(1);
  });

  it("rejects invalid YAML and invalid custom requirement regex", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "quality-config-invalid-"));
    const invalidYaml = path.join(dir, "invalid-yaml.yml");
    const invalidRegex = path.join(dir, "invalid-regex.yml");
    await writeFile(invalidYaml, "project:\n  name: [");
    await writeFile(invalidRegex, "project:\n  name: Bad\nrequirements:\n  keyPattern: '['\n");

    await expect(loadConfig(invalidYaml)).rejects.toThrow();
    await expect(loadConfig(invalidRegex)).rejects.toThrow(/valid regular expression/);
  });

  it("discovers configured required and optional artifact paths without crashing when optional paths are absent", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "quality-discovery-"));
    await mkdir(path.join(dir, "quality-artifacts", "tests", "backend", "junit"), {
      recursive: true
    });
    await mkdir(path.join(dir, "quality-artifacts", "raw"), { recursive: true });
    await writeFile(
      path.join(dir, "quality-artifacts", "tests", "backend", "junit", "backend.xml"),
      "<testsuite />"
    );
    await writeFile(path.join(dir, "quality-artifacts", "raw", "log.txt"), "log");
    const configPath = path.join(dir, "quality-report.yml");
    await writeFile(
      configPath,
      [
        "project:",
        "  name: Discovery",
        "artifacts:",
        "  tests:",
        "    backend:",
        "      junit: tests/backend/junit/**/*.xml",
        "    frontend:",
        "      vitestJson: tests/frontend/vitest/**/*.json",
        "  raw: raw/**/*"
      ].join("\n")
    );

    const config = await loadConfig(configPath);
    const artifacts = await discoverArtifacts(config, path.join(dir, "quality-artifacts"));

    expect(artifacts.map((artifact) => artifact.kind).sort()).toEqual(["junit", "rawHtml"]);
    expect(artifacts.find((artifact) => artifact.kind === "junit")?.layer).toBe("backend");
  });
});
