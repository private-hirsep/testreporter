import { readFileSync } from "node:fs";

const packageMetadata = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
) as { version?: unknown };

if (typeof packageMetadata.version !== "string" || !packageMetadata.version)
  throw new Error("report-cli package version is missing or invalid");

export const TOOL_VERSION = packageMetadata.version;
