import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { NormalizedTestCase } from "@quality-report/report-core";
const runFile = promisify(execFile);
async function git(cwd: string, args: string[]) { return (await runFile("git", args, { cwd, timeout: 5000, maxBuffer: 1024 * 1024, windowsHide: true })).stdout.trim(); }
function safePath(root: string, value: string) { const relative = path.relative(root, path.resolve(root, value)); return relative && !relative.startsWith("..") && !path.isAbsolute(relative) ? relative.replace(/\\/g, "/") : undefined; }
function parseEntries(value: string, template?: string) { return value.split("\u001e").map((line) => line.trim()).filter(Boolean).map((line) => { const [hash = "", author = "", date = "", ...message] = line.split("\u001f"); return { hash, author, date, message: message.join("\u001f"), ...(template ? { url: template.replace("{commit}", hash) } : {}) }; }); }
export async function collectGitHistory(repositoryPath: string, tests: NormalizedTestCase[], options: { maxRevisions?: number; commitUrlTemplate?: string } = {}) {
  const root = path.resolve(repositoryPath);
  try {
    await git(root, ["rev-parse", "--is-inside-work-tree"]);
    const [commit, branch, tags, dirty, shallow, head] = await Promise.all([git(root, ["rev-parse", "HEAD"]), git(root, ["branch", "--show-current"]), git(root, ["tag", "--points-at", "HEAD"]), git(root, ["status", "--porcelain"]), git(root, ["rev-parse", "--is-shallow-repository"]), git(root, ["show", "-s", "--format=%an%x1f%aI%x1f%s", "HEAD"])]);
    const [author, timestamp, ...message] = head.split("\u001f");
    const histories = new Map<string, NormalizedTestCase["definitionHistory"]>();
    for (const test of tests) {
      const source = test.file ? safePath(root, test.file) : undefined;
      if (!source) { histories.set(test.id, { confidence: "unavailable", revisions: [] }); continue; }
      try { const revisions = parseEntries(await git(root, ["log", `-${options.maxRevisions ?? 10}`, "--follow", "--format=%H%x1f%an%x1f%aI%x1f%s%x1e", "--", source]), options.commitUrlTemplate); histories.set(test.id, { confidence: "file-level", sourcePath: source, latest: revisions[0], earliest: revisions.at(-1), revisions }); }
      catch { histories.set(test.id, { confidence: "unavailable", sourcePath: source, revisions: [] }); }
    }
    return { repository: { available: true, shallow: shallow === "true", commit, branch: branch || undefined, tags: tags.split(/\r?\n/).filter(Boolean), dirty: Boolean(dirty), author, timestamp, message: message.join("\u001f") }, histories };
  } catch (error) { return { repository: { available: false, shallow: false, tags: [], warning: error instanceof Error ? error.message : "Git unavailable" }, histories: new Map<string, NormalizedTestCase["definitionHistory"]>() }; }
}
