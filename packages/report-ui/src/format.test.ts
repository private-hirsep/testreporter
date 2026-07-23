import { describe, expect, it } from "vitest";
import { formatBytes } from "./format";

describe("formatBytes", () => {
  it("formats byte, kilobyte, and megabyte ranges", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("uses a neutral label for unrecorded sizes without guessing from a path", () => {
    // formatBytes only ever sees a number or undefined — it has no path to
    // infer from, so an extensionless directory and a not-yet-sized file
    // (e.g. the report ZIP, written after the manifest) are indistinguishable
    // and must not be mislabeled as "directory".
    expect(formatBytes(undefined)).toBe("size not recorded");
    expect(formatBytes()).toBe("size not recorded");
  });
});
