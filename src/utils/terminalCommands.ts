import { ClaudeSettings, CodexSettings } from "../types";
import { DEFAULT_CLAUDE_SETTINGS } from "../claudeSettings";
import { DEFAULT_CODEX_SETTINGS } from "../codexSettings";

export const shellEscape = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

// ANSI-C quoting for prompts - works better with PTY than traditional escaping
export const ansiCQuote = (value: string) => {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `$'${escaped}'`;
};

export const buildCodexCommand = (
  prompt: string,
  cwd: string,
  useShellCd: boolean,
  codexSettings?: CodexSettings,
) => {
  const settings = codexSettings ?? DEFAULT_CODEX_SETTINGS;
  const args: string[] = ["codex"];

  if (settings.runMode === "exec") {
    args.push("exec");
  }

  const pushFlag = (flag: string) => args.push(flag);
  const pushValue = (flag: string, value: string) => {
    args.push(flag, shellEscape(value));
  };

  if (settings.model.trim()) pushValue("--model", settings.model.trim());
  if (settings.profile.trim()) pushValue("--profile", settings.profile.trim());
  if (settings.sandbox) pushValue("--sandbox", settings.sandbox);
  if (settings.askForApproval) pushValue("--ask-for-approval", settings.askForApproval);
  if (settings.fullAuto) pushFlag("--full-auto");
  if (settings.yolo) pushFlag("--dangerously-bypass-approvals-and-sandbox");
  if (settings.oss) pushFlag("--oss");
  if (settings.search) pushFlag("--search");
  if (cwd && !useShellCd) pushValue("--cd", cwd);

  if (settings.runMode === "exec") {
    if (settings.skipGitRepoCheck) pushFlag("--skip-git-repo-check");
    if (settings.outputSchema.trim()) {
      pushValue("--output-schema", settings.outputSchema.trim());
    }
    if (settings.outputLastMessage.trim()) {
      pushValue("--output-last-message", settings.outputLastMessage.trim());
    }
    if (settings.color) pushValue("--color", settings.color);
    if (settings.json) pushFlag("--json");
  }

  settings.addDirs.forEach((dir) => pushValue("--add-dir", dir));
  settings.enableFeatures.forEach((feature) => pushValue("--enable", feature));
  settings.disableFeatures.forEach((feature) => pushValue("--disable", feature));
  settings.configOverrides.forEach((override) => pushValue("-c", override));
  settings.imagePaths.forEach((path) => pushValue("--image", path));

  const baseCommand = args.join(" ");

  if (settings.runMode === "exec") {
    let label = "CODEX_PROMPT";
    while (prompt.includes(label)) {
      label = `CODEX_PROMPT_${Math.random().toString(36).slice(2, 8)}`;
    }
    const execCommand = `${baseCommand} - <<'${label}'\n${prompt}\n${label}`;
    if (!cwd || !useShellCd) return execCommand;
    return `cd ${shellEscape(cwd)}\n${execCommand}`;
  }

  if (prompt.trim()) {
    args.push(ansiCQuote(prompt));
  }
  const tuiCommand = args.join(" ");
  if (!cwd || !useShellCd) return tuiCommand;
  return `cd ${shellEscape(cwd)}\n${tuiCommand}`;
};

export const buildClaudeCommand = (
  prompt: string,
  cwd: string,
  useShellCd: boolean,
  claudeSettings?: ClaudeSettings,
) => {
  const settings = claudeSettings ?? DEFAULT_CLAUDE_SETTINGS;
  const args: string[] = ["claude"];
  const pushValue = (flag: string, value: string) => {
    args.push(flag, shellEscape(value));
  };

  if (settings.model.trim()) pushValue("--model", settings.model.trim());
  if (settings.args.trim()) args.push(settings.args.trim());

  if (prompt.trim()) {
    args.push(ansiCQuote(prompt));
  }

  const baseCommand = args.join(" ");
  if (!cwd || !useShellCd) return baseCommand;
  return `cd ${shellEscape(cwd)}\n${baseCommand}`;
};
