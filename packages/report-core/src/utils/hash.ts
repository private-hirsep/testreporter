import { createHash } from "node:crypto";

export function stableId(parts: Array<string | number | undefined>): string {
  return createHash("sha256")
    .update(parts.filter((part) => part !== undefined && part !== "").join("\u001f"))
    .digest("hex")
    .slice(0, 16);
}
