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
  let awaitingCanonicalWith = false;
  for (const line of lines) {
    const usesMatch = line.match(/^(\s*)uses:\s*(.+)$/);
    if (usesMatch) {
      awaitingCanonicalWith = usesMatch[2].includes(".github/workflows/publish-quality-report.yml");
      inWith = false;
      continue;
    }
    const match = line.match(/^(\s*)with:\s*$/);
    if (match) {
      inWith = awaitingCanonicalWith;
      withIndent = match[1].length;
      awaitingCanonicalWith = false;
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
const cliConfigText = await readText("packages/report-cli/src/config.ts");
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
if (!readme.includes("compatibility wrapper only")) {
  fail("README must describe the deprecated wrapper only as compatibility");
}
if (
  readme.includes("Publish Example Pages Report") ||
  readme.includes("publish-example-report.yml")
) {
  fail("README must not reference removed example publishing workflows");
}
for (const required of [
  "Dogfood Quality Report",
  "issues: write",
  "pages: write",
  "Pull requests should usually use `pr-comment-mode: minimal`",
  "`pages-and-artifact`",
  "<!-- quality-report-platform:summary -->",
  "Fork PR comments are skipped",
  "Current CLI profile definitions are direct profile objects"
]) {
  if (!readme.includes(required)) fail(`README is missing required guidance: ${required}`);
}
for (const [profile, pattern] of [
  ["relaxed", /relaxed:\s*{[\s\S]*?allowFailed:\s*3,\s*allowBroken:\s*2[\s\S]*?totalMinimum:\s*60/],
  [
    "standard",
    /standard:\s*{[\s\S]*?allowFailed:\s*0,\s*allowBroken:\s*0[\s\S]*?totalMinimum:\s*70/
  ],
  [
    "strict",
    /strict:\s*{[\s\S]*?allowFailed:\s*0,\s*allowBroken:\s*0[\s\S]*?totalMinimum:\s*85,\s*backendMinimum:\s*85,\s*frontendMinimum:\s*80/
  ],
  [
    "release",
    /release:\s*{[\s\S]*?allowFailed:\s*0,\s*allowBroken:\s*0[\s\S]*?totalMinimum:\s*90,\s*backendMinimum:\s*90,\s*frontendMinimum:\s*85/
  ]
]) {
  if (!pattern.test(cliConfigText))
    fail(`CLI profile source changed; update docs check for ${profile}`);
}
for (const [profile, pattern] of [
  [
    "relaxed",
    /\|\s*`relaxed`\s*\|\s*Early adoption and noisy projects\s*\|\s*<= 3\s*\|\s*<= 2\s*\|\s*>= 60%[\s\S]*?\|\s*>= 60%/
  ],
  [
    "standard",
    /\|\s*`standard`\s*\|\s*Normal pull request default\s*\|\s*0\s*\|\s*0\s*\|\s*>= 70%[\s\S]*?\|\s*>= 75%/
  ],
  [
    "strict",
    /\|\s*`strict`\s*\|\s*Merge queue and mature branches\s*\|\s*0\s*\|\s*0\s*\|\s*>= 85%\s*\|\s*>= 85%\s*\|\s*>= 80%\s*\|\s*>= 90%/
  ],
  [
    "release",
    /\|\s*`release`\s*\|\s*Release readiness\s*\|\s*0\s*\|\s*0\s*\|\s*>= 90%\s*\|\s*>= 90%\s*\|\s*>= 85%\s*\|\s*100%/
  ]
]) {
  if (!pattern.test(readme))
    fail(`README profile table is missing current CLI threshold row for ${profile}`);
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
  if (
    content.includes("publish-example-report.yml") ||
    content.includes("Publish Example Pages Report")
  ) {
    fail(`${file} references removed example publishing workflow`);
  }
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
