import { copyFile, mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const output = path.join(root, "dist", "release");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const packages = [
  "@quality-report/report-core",
  "@quality-report/adapters",
  "@quality-report/report-cli"
];

function run(command, args, cwd = root) {
  const executable =
    process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : command;
  const commandArgs =
    process.platform === "win32" ? ["/d", "/s", "/c", command, ...args] : args;
  const result = spawnSync(executable, commandArgs, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.join(" ")} failed:\n${result.error ?? ""}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`
    );
  return result.stdout.trim();
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const tarballs = [];
for (const workspace of packages) {
  const packed = JSON.parse(
    run(npm, [
      "pack",
      "--json",
      "--workspace",
      workspace,
      "--pack-destination",
      output
    ])
  );
  const item = packed[0];
  if (!item?.filename) throw new Error(`npm pack returned no filename for ${workspace}`);
  const names = new Set(item.files.map((file) => file.path));
  for (const required of ["package.json", "README.md", "LICENSE"])
    if (!names.has(required)) throw new Error(`${workspace} tarball lacks ${required}`);
  if ([...names].some((name) => /(^|\/)(src|test|tests|fixtures)\//.test(name)))
    throw new Error(`${workspace} tarball contains source-only or test material`);
  tarballs.push(path.join(output, item.filename));
}

const smoke = await mkdtemp(path.join(os.tmpdir(), "testreporter-release-smoke-"));
try {
  run(npm, ["init", "-y"], smoke);
  const localTarballs = [];
  for (const tarball of tarballs) {
    const local = path.join(smoke, path.basename(tarball));
    await copyFile(tarball, local);
    localTarballs.push(`./${path.basename(local)}`);
  }
  run(npm, ["install", "--ignore-scripts", ...localTarballs], smoke);
  const lock = await readFile(path.join(smoke, "package-lock.json"), "utf8");
  if (lock.includes("file:../") || lock.includes(root))
    throw new Error("clean installation resolved a dependency through the monorepo");
  const version = run(npx, ["--no-install", "quality-report", "--version"], smoke);
  if (version !== "1.0.0-rc.1")
    throw new Error(`unexpected CLI version: ${version}`);
  run(
    npx,
    [
      "--no-install",
      "quality-report",
      "validate",
      "--config",
      path.join(root, "examples", "minimal", "quality-report.yml"),
      "--input",
      path.join(root, "examples", "minimal", "quality-artifacts")
    ],
    smoke
  );
  console.log(`Clean release installation passed: ${version}`);
  console.log(tarballs.map((file) => path.relative(root, file)).join("\n"));
} finally {
  await rm(smoke, { recursive: true, force: true });
}
