import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const entry = path.join(repoRoot, "scripts", "mcp-task-server.cjs");
const outDir = path.join(repoRoot, "src-tauri", "resources");

const platformMap = {
  darwin: "macos",
  win32: "win",
  linux: "linux",
};

const archMap = {
  x64: "x64",
  arm64: "arm64",
};

const platform = platformMap[process.platform];
const arch = archMap[process.arch];

if (!platform) {
  throw new Error(`Unsupported platform for bundling: ${process.platform}`);
}
if (!arch) {
  throw new Error(`Unsupported arch for bundling: ${process.arch}`);
}

const targetVersion =
  process.env.DESKTOP_PROMPTER_MCP_PKG_NODE_VERSION ?? "node18";
const target = `${targetVersion}-${platform}-${arch}`;
const outputName = process.platform === "win32" ? "mcp-task-server.exe" : "mcp-task-server";
const outputPath = path.join(outDir, outputName);

const pkgBin = path.join(
  repoRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "pkg.cmd" : "pkg",
);

await fs.mkdir(outDir, { recursive: true });

execFileSync(pkgBin, ["--target", target, "--output", outputPath, entry], {
  stdio: "inherit",
});
