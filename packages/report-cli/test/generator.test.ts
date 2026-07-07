import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { buildReport } from "../src/generator.js";

function zipEntries(buffer: Buffer) {
  const names: string[] = [];
  for (let offset = 0; offset < buffer.length - 4; offset += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) continue;
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    names.push(buffer.subarray(nameStart, nameStart + nameLength).toString("utf8"));
    offset = nameStart + nameLength + extraLength + commentLength - 1;
  }
  return names;
}

describe("report generator", () => {
  it("generates normalized report data from the minimal example", async () => {
    const root = path.resolve(import.meta.dirname, "../../..");
    const output = await mkdtemp(path.join(os.tmpdir(), "quality-report-"));
    const configPath = path.join(root, "examples/minimal/quality-report.yml");
    const config = await loadConfig(configPath);
    const report = await buildReport({
      config,
      configPath,
      inputPath: path.join(root, "examples/minimal/quality-artifacts"),
      outputPath: output
    });
    expect(report.tests.length).toBeGreaterThan(0);
    expect(report.summary.tests.byLayer.backend).toBeGreaterThan(0);
    expect(report.downloads.length).toBeGreaterThan(0);
  });

  it("keeps generated static output deterministic and free of local path leaks", async () => {
    const root = path.resolve(import.meta.dirname, "../../..");
    const output = await mkdtemp(path.join(os.tmpdir(), "quality-report-"));
    const configPath = path.join(root, "examples/minimal/quality-report.yml");
    const config = await loadConfig(configPath);
    await writeFile(path.join(output, "quality-report-stale.zip"), "stale");
    const report = await buildReport({
      config,
      configPath,
      inputPath: path.join(root, "examples/minimal/quality-artifacts"),
      outputPath: output,
      zip: true
    });
    const entries = await readdir(output);
    const zipFiles = entries.filter((entry) => /^quality-report.*\.zip$/i.test(entry));
    const manifest = await readFile(path.join(output, "data/manifest.json"), "utf8");
    const tests = await readFile(path.join(output, "data/tests-0.json"), "utf8");
    const combined = `${manifest}\n${tests}`;
    expect(zipFiles).toHaveLength(1);
    expect(zipFiles[0]).not.toBe("quality-report-stale.zip");
    expect(combined).not.toMatch(/[A-Za-z]:[\\/](?![\\/])/);
    expect(combined).not.toContain("file://");
    expect(combined).not.toContain("/home/");
    expect(report.downloads.some((download) => download.category === "report")).toBe(true);

    const zipBuffer = await readFile(path.join(output, zipFiles[0]!));
    expect(zipEntries(zipBuffer).some((entry) => /^quality-report.*\.zip$/i.test(path.basename(entry)))).toBe(false);
  });
});
