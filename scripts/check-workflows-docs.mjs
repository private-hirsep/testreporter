import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parseDocument } from "yaml";

const root = process.cwd();
const workflowDir = path.join(root, ".github", "workflows");
const canonical = ".github/workflows/publish-quality-report.yml";
const legacy = ".github/workflows/reusable-publish-quality-report.yml";
const expectedInputs = [
  "artifact-pattern",
  "artifact-path",
  "config-path",
  "quality-gates-path",
  "quality-profile",
  "publish-mode",
  "pr-comment-mode",
  "pr-comment-marker",
  "update-pr-comment",
  "fail-on-quality-gate",
  "report-title"
];

async function readText(file) {
  return readFile(path.join(root, file), "utf8");
}

function fail(message) {
  throw new Error(message);
}

function parseYaml(file, content) {
  const doc = parseDocument(content, { prettyErrors: true });
  if (doc.errors.length > 0)
    fail(`${file} has YAML parse errors: ${doc.errors.map((error) => error.message).join("; ")}`);
  return doc.toJS();
}

function workflowCall(workflow) {
  return workflow?.on?.workflow_call ?? workflow?.["on"]?.workflow_call;
}

function collectWithKeys(yamlBlock) {
  const lines = yamlBlock.split(/\r?\n/);
  const keys = [];
  let inWith = false;
  let withIndent = 0;
  for (const line of lines) {
    const match = line.match(/^(\s*)with:\s*$/);
    if (match) {
      inWith = true;
      withIndent = match[1].length;
      continue;
    }
    if (!inWith) continue;
    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (line.trim() && indent <= withIndent) inWith = false;
    const keyMatch = line.match(/^(\s+)([A-Za-z0-9_-]+):/);
    if (inWith && keyMatch && keyMatch[1].length > withIndent) keys.push(keyMatch[2]);
  }
  return keys;
}

const workflowFiles = (await readdir(workflowDir)).filter(
  (file) => file.endsWith(".yml") || file.endsWith(".yaml")
);
const parsed = new Map();
for (const file of workflowFiles) {
  const relative = `.github/workflows/${file}`;
  parsed.set(relative, parseYaml(relative, await readText(relative)));
}

const canonicalWorkflow = parsed.get(canonical);
if (!canonicalWorkflow) fail(`${canonical} is required`);
const canonicalCall = workflowCall(canonicalWorkflow);
if (!canonicalCall) fail(`${canonical} must be a reusable workflow`);
const inputs = canonicalCall.inputs ?? {};
for (const input of expectedInputs) {
  if (!Object.hasOwn(inputs, input)) fail(`${canonical} is missing input ${input}`);
}

const legacyText = await readText(legacy);
if (!legacyText.includes("uses: ./.github/workflows/publish-quality-report.yml")) {
  fail(`${legacy} must be a wrapper around ${canonical}`);
}
if (
  (legacyText.match(/actions\/checkout|npm run quality-report|actions\/deploy-pages/g) ?? [])
    .length > 0
) {
  fail(`${legacy} contains implementation logic instead of only forwarding to ${canonical}`);
}

const dogfoodText = await readText(".github/workflows/dogfood-quality-report.yml");
const canonicalText = await readText(canonical);
const ciText = await readText(".github/workflows/ci.yml");
const generatorText = await readText("packages/report-cli/src/generator.ts");
const schemaText = await readText("packages/report-core/src/schema/report.ts");
if (!dogfoodText.includes("uses: ./.github/workflows/publish-quality-report.yml")) {
  fail("dogfood workflow must call the canonical reusable workflow");
}
if (
  !dogfoodText.includes("actions/upload-artifact@v4") ||
  !dogfoodText.includes("quality-dogfood-artifacts")
) {
  fail("dogfood workflow must upload example artifacts before invoking the reusable workflow");
}
if (dogfoodText.includes("pull_request_target"))
  fail("dogfood workflow must not use pull_request_target");
if (!canonicalText.includes('--publish-mode "${{ steps.resolve.outputs.publish-mode }}"')) {
  fail("canonical workflow must pass resolved publish mode to the CLI");
}
if (!canonicalText.includes('--pr-comment-mode "${{ steps.resolve.outputs.pr-comment-mode }}"')) {
  fail("canonical workflow must pass resolved PR comment mode to the CLI");
}
if (!schemaText.includes("publishMode: z.string().optional()")) {
  fail("generated manifest metadata must include publishMode");
}
if (!schemaText.includes("prCommentMode: z.string().optional()")) {
  fail("generated manifest metadata must include prCommentMode");
}
if (
  !generatorText.includes('DEFAULT_PR_COMMENT_MARKER = "<!-- quality-report-platform:summary -->"')
) {
  fail("generated PR comments must use the platform summary marker by default");
}
if (!canonicalText.includes('default: "<!-- quality-report-platform:summary -->"')) {
  fail("workflow PR comment marker default must match generated comment marker");
}
if (!canonicalText.includes('jq -r --arg marker "$PR_COMMENT_MARKER"')) {
  fail("workflow lookup must pass the PR comment marker as a jq argument");
}
if (!canonicalText.includes('.user.login == "github-actions[bot]"')) {
  fail("workflow lookup must only update comments created by github-actions[bot]");
}
if (!canonicalText.includes("path: ${{ steps.paths.outputs.report-zip-path }}")) {
  fail("artifact mode must upload the generated report ZIP");
}
if (
  !canonicalText.includes("uses: actions/upload-pages-artifact@v3") ||
  !canonicalText.includes("path: dist/report")
) {
  fail("Pages mode must upload the extracted static report");
}
if (!canonicalText.includes("if-no-artifacts-found: error")) {
  fail("artifact download must fail clearly when no artifacts match");
}
if (!canonicalText.includes("github.event.pull_request.head.repo.full_name == github.repository")) {
  fail("PR comments must be fork-safe");
}
if (!ciText.includes("--quality-profile strict --no-fail-on-quality-gate --zip")) {
  fail("strict CI generation must explicitly disable early quality-gate failure");
}
if (!ciText.includes("dist/example-report-strict/meta/quality-summary.json")) {
  fail("CI must smoke check strict report metadata");
}
if (!ciText.includes('test "$strict_status" = "failed"')) {
  fail("CI must assert strict summary status is failed");
}

const readme = await readText("README.md");
if (readme.includes("reusable-publish-quality-report.yml")) {
  fail("README must not recommend the deprecated reusable workflow name");
}
for (const required of [
  "Dogfood Quality Report",
  "issues: write",
  "pages: write",
  "pull requests should usually use `pr-comment-mode: minimal`",
  "`pages-and-artifact`",
  "<!-- quality-report-platform:summary -->",
  "Fork PRs are skipped by default",
  "Publish Example Pages Report"
]) {
  if (!readme.includes(required)) fail(`README is missing required guidance: ${required}`);
}

const allowedInputs = new Set(expectedInputs);
const markdownFiles = [
  "README.md",
  ...(await readdir(path.join(root, "docs")))
    .filter((file) => file.endsWith(".md"))
    .map((file) => `docs/${file}`)
];
for (const file of markdownFiles) {
  const content = await readText(file);
  const codeBlocks = [...content.matchAll(/```ya?ml\n([\s\S]*?)```/g)].map((match) => match[1]);
  for (const block of codeBlocks.filter((item) =>
    item.includes(".github/workflows/publish-quality-report.yml")
  )) {
    for (const key of collectWithKeys(block)) {
      if (!allowedInputs.has(key))
        fail(`${file} example uses unknown reusable workflow input: ${key}`);
    }
  }
}

console.log(
  `Checked ${workflowFiles.length} workflow file(s) and ${markdownFiles.length} Markdown file(s).`
);
