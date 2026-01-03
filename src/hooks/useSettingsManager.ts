import { useState, useEffect } from "react";
import { ClaudeSettings, CodexSettings, WorktreeSettings } from "../types";
import { DEFAULT_CODEX_SETTINGS, coerceCodexSettings } from "../codexSettings";
import { DEFAULT_CLAUDE_SETTINGS, coerceClaudeSettings } from "../claudeSettings";
import { DEFAULT_WORKTREE_SETTINGS, coerceWorktreeSettings } from "../worktreeSettings";

export interface UseSettingsManagerResult {
  codexSettings: CodexSettings;
  claudeSettings: ClaudeSettings;
  worktreeSettings: WorktreeSettings;
  setCodexSettings: React.Dispatch<React.SetStateAction<CodexSettings>>;
  setClaudeSettings: React.Dispatch<React.SetStateAction<ClaudeSettings>>;
  setWorktreeSettings: React.Dispatch<React.SetStateAction<WorktreeSettings>>;
  resetAllSettings: () => void;
}

export function useSettingsManager(): UseSettingsManagerResult {
  const [codexSettings, setCodexSettings] = useState<CodexSettings>(
    DEFAULT_CODEX_SETTINGS
  );
  const [claudeSettings, setClaudeSettings] = useState<ClaudeSettings>(
    DEFAULT_CLAUDE_SETTINGS
  );
  const [worktreeSettings, setWorktreeSettings] = useState<WorktreeSettings>(
    DEFAULT_WORKTREE_SETTINGS
  );

  // Load Codex Settings
  useEffect(() => {
    const storedSettings = localStorage.getItem("promptArchitect_codexSettings");
    if (storedSettings) {
      try {
        setCodexSettings(coerceCodexSettings(JSON.parse(storedSettings)));
      } catch (e) {
        console.error("Failed to parse codex settings", e);
      }
    }
  }, []);

  // Load Claude Settings
  useEffect(() => {
    const storedSettings = localStorage.getItem("promptArchitect_claudeSettings");
    if (storedSettings) {
      try {
        setClaudeSettings(coerceClaudeSettings(JSON.parse(storedSettings)));
      } catch (e) {
        console.error("Failed to parse claude settings", e);
      }
    }
  }, []);

  // Load Worktree Settings
  useEffect(() => {
    const storedSettings = localStorage.getItem("promptArchitect_worktreeSettings");
    if (storedSettings) {
      try {
        setWorktreeSettings(coerceWorktreeSettings(JSON.parse(storedSettings)));
      } catch (e) {
        console.error("Failed to parse worktree settings", e);
      }
    }
  }, []);

  // Persist Codex Settings
  useEffect(() => {
    localStorage.setItem(
      "promptArchitect_codexSettings",
      JSON.stringify(codexSettings)
    );
  }, [codexSettings]);

  // Persist Claude Settings
  useEffect(() => {
    localStorage.setItem(
      "promptArchitect_claudeSettings",
      JSON.stringify(claudeSettings)
    );
  }, [claudeSettings]);

  // Persist Worktree Settings
  useEffect(() => {
    localStorage.setItem(
      "promptArchitect_worktreeSettings",
      JSON.stringify(worktreeSettings)
    );
  }, [worktreeSettings]);

  const resetAllSettings = () => {
    setCodexSettings(DEFAULT_CODEX_SETTINGS);
    setClaudeSettings(DEFAULT_CLAUDE_SETTINGS);
    setWorktreeSettings(DEFAULT_WORKTREE_SETTINGS);
  };

  return {
    codexSettings,
    claudeSettings,
    worktreeSettings,
    setCodexSettings,
    setClaudeSettings,
    setWorktreeSettings,
    resetAllSettings,
  };
}
