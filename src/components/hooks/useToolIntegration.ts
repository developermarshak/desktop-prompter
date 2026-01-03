import { useState, useEffect, useRef } from 'react';
import { ClaudeSettings, CodexSettings, PromptTemplate, SavedPrompt, WorktreeSettings } from '../../types';
import { DEFAULT_CODEX_SETTINGS } from '../../codexSettings';
import { DEFAULT_CLAUDE_SETTINGS } from '../../claudeSettings';
import { DEFAULT_WORKTREE_SETTINGS, generateWorktreeName } from '../../worktreeSettings';
import { resolvePromptRefs } from '../../utils';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import { isTauri } from '@tauri-apps/api/core';
import { enqueueTerminalWrite } from '../../terminalQueue';

interface UseToolIntegrationProps {
  value: string;
  templates: PromptTemplate[];
  savedPrompts: SavedPrompt[];
  onRunInTerminal?: (title?: string, type?: 'terminal' | 'claude') => string | null;
  onSaveSessionPath?: (tabId: string, path: string) => void;
  promptTitle?: string;
  terminalTabId?: string | null;
  codexSettings?: CodexSettings;
  claudeSettings?: ClaudeSettings;
  worktreeSettings?: WorktreeSettings;
}

export const useToolIntegration = ({
  value,
  templates,
  savedPrompts,
  onRunInTerminal,
  onSaveSessionPath,
  promptTitle,
  terminalTabId,
  codexSettings,
  claudeSettings,
  worktreeSettings,
}: UseToolIntegrationProps) => {
  const [showRunDropdown, setShowRunDropdown] = useState(false);
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [selectedTool, setSelectedTool] = useState<'codex' | 'claude' | 'claude-ui' | null>(null);
  const [selectedDirectory, setSelectedDirectory] = useState<string>('');
  const [createWorktree, setCreateWorktree] = useState(false);
  const runDropdownRef = useRef<HTMLDivElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const effectiveCodexSettings = codexSettings ?? DEFAULT_CODEX_SETTINGS;
  const effectiveClaudeSettings = claudeSettings ?? DEFAULT_CLAUDE_SETTINGS;
  const effectiveWorktreeSettings = worktreeSettings ?? DEFAULT_WORKTREE_SETTINGS;

  const shellEscape = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

  // ANSI-C quoting for prompts - works better with PTY than traditional escaping
  const ansiCQuote = (value: string) => {
    const escaped = value
      .replace(/\\/g, '\\\\')  // Escape backslashes first
      .replace(/'/g, "\\'")     // Escape single quotes
      .replace(/\n/g, '\\n')    // Escape newlines
      .replace(/\r/g, '\\r')    // Escape carriage returns
      .replace(/\t/g, '\\t');   // Escape tabs
    return `$'${escaped}'`;
  };

  const buildCodexCommand = (
    prompt: string,
    cwd: string,
    useShellCd: boolean
  ) => {
    const args: string[] = ['codex'];
    const settings = effectiveCodexSettings;

    if (settings.runMode === 'exec') {
      args.push('exec');
    }

    const pushFlag = (flag: string) => args.push(flag);
    const pushValue = (flag: string, value: string) => {
      args.push(flag, shellEscape(value));
    };

    if (settings.model.trim()) pushValue('--model', settings.model.trim());
    if (settings.profile.trim()) pushValue('--profile', settings.profile.trim());
    if (settings.sandbox) pushValue('--sandbox', settings.sandbox);
    if (settings.askForApproval) pushValue('--ask-for-approval', settings.askForApproval);
    if (settings.fullAuto) pushFlag('--full-auto');
    if (settings.yolo) pushFlag('--dangerously-bypass-approvals-and-sandbox');
    if (settings.oss) pushFlag('--oss');
    if (settings.search) pushFlag('--search');
    if (cwd && !useShellCd) pushValue('--cd', cwd);

    if (settings.runMode === 'exec') {
      if (settings.skipGitRepoCheck) pushFlag('--skip-git-repo-check');
      if (settings.outputSchema.trim()) {
        pushValue('--output-schema', settings.outputSchema.trim());
      }
      if (settings.outputLastMessage.trim()) {
        pushValue('--output-last-message', settings.outputLastMessage.trim());
      }
      if (settings.color) pushValue('--color', settings.color);
      if (settings.json) pushFlag('--json');
    }

    settings.addDirs.forEach((dir) => pushValue('--add-dir', dir));
    settings.enableFeatures.forEach((feature) => pushValue('--enable', feature));
    settings.disableFeatures.forEach((feature) => pushValue('--disable', feature));
    settings.configOverrides.forEach((override) => pushValue('-c', override));
    settings.imagePaths.forEach((path) => pushValue('--image', path));

    const baseCommand = args.join(' ');

    if (settings.runMode === 'exec') {
      // Use heredoc for exec mode
      let label = 'CODEX_PROMPT';
      while (prompt.includes(label)) {
        label = `CODEX_PROMPT_${Math.random().toString(36).slice(2, 8)}`;
      }
      const execCommand = `${baseCommand} - <<'${label}'\n${prompt}\n${label}`;
      if (!cwd || !useShellCd) return execCommand;
      return `cd ${shellEscape(cwd)}\n${execCommand}`;
    }

    // Use ANSI-C quoting for TUI mode to preserve stdin as terminal
    if (prompt.trim()) {
      args.push(ansiCQuote(prompt));
    }
    const tuiCommand = args.join(' ');
    if (!cwd || !useShellCd) return tuiCommand;
    return `cd ${shellEscape(cwd)}\n${tuiCommand}`;
  };

  const buildClaudeCommand = (
    prompt: string,
    cwd: string,
    useShellCd: boolean
  ) => {
    const settings = effectiveClaudeSettings;
    const args: string[] = ['claude'];
    const pushValue = (flag: string, value: string) => {
      args.push(flag, shellEscape(value));
    };

    if (settings.model.trim()) pushValue('--model', settings.model.trim());
    if (settings.args.trim()) args.push(settings.args.trim());

    // Use ANSI-C quoting for prompt to avoid quote escaping issues
    if (prompt.trim()) {
      args.push(ansiCQuote(prompt));
    }

    const baseCommand = args.join(' ');
    if (!cwd || !useShellCd) return baseCommand;
    return `cd ${shellEscape(cwd)}\n${baseCommand}`;
  };

  useEffect(() => {
    const savedDir = localStorage.getItem('promptArchitect_selectedDirectory');
    if (savedDir) {
      setSelectedDirectory(savedDir);
    }
  }, []);

  // Initialize createWorktree from settings when modal opens
  useEffect(() => {
    if (showDirectoryModal) {
      setCreateWorktree(effectiveWorktreeSettings.enabled);
    }
  }, [showDirectoryModal, effectiveWorktreeSettings.enabled]);

  // Build the git worktree creation command
  const buildWorktreeCommand = (baseDir: string): { worktreePath: string; command: string } => {
    const worktreeName = generateWorktreeName(effectiveWorktreeSettings.prefix);
    // Create worktree as sibling directory to the base directory
    const parentDir = baseDir.replace(/\/[^/]+\/?$/, '') || baseDir;
    const worktreePath = `${parentDir}/${worktreeName}`;

    // Get current branch and create a new branch for the worktree based on it
    const command = [
      `cd ${shellEscape(baseDir)}`,
      `CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)`,
      `git worktree add -b ${shellEscape(worktreeName)} ${shellEscape(worktreePath)} "$CURRENT_BRANCH"`,
      `cd ${shellEscape(worktreePath)}`,
    ].join(' && ');

    return { worktreePath, command };
  };

  useEffect(() => {
    if (selectedDirectory) {
      localStorage.setItem('promptArchitect_selectedDirectory', selectedDirectory);
    }
  }, [selectedDirectory]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (runDropdownRef.current && !runDropdownRef.current.contains(event.target as Node)) {
        setShowRunDropdown(false);
      }
    };

    if (showRunDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showRunDropdown]);

  const handleRunWithTool = (tool: 'codex' | 'claude' | 'claude-ui') => {
    const resolvedContent = resolvePromptRefs(value, templates, savedPrompts);

    if (!resolvedContent.trim()) {
      alert('Please write a prompt first.');
      return;
    }

    // Store the resolved prompt for all tools
    if (tool === 'claude-ui') {
      localStorage.setItem('promptArchitect_claudeSessionPrompt', resolvedContent);
    }

    setSelectedTool(tool);
    setShowRunDropdown(false);
    setShowDirectoryModal(true);
  };

  const handleOpenInWeb = (target: 'chatgpt' | 'claude') => {
    const resolvedContent = resolvePromptRefs(value, templates, savedPrompts);

    if (!resolvedContent.trim()) {
      alert('Please write a prompt first.');
      return;
    }

    const encodedPrompt = encodeURIComponent(resolvedContent);
    const url = target === 'chatgpt'
      ? `https://chatgpt.com/?q=${encodedPrompt}`
      : `https://claude.ai/?q=${encodedPrompt}`;
    setShowRunDropdown(false);
    if (isTauri()) {
      void openUrl(url);
      return;
    }
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      window.location.href = url;
    }
  };

  const handleBrowseDirectory = async () => {
    const runningInTauri = isTauri();

    if (runningInTauri) {
      try {
        const selection = await openDialog({ directory: true, multiple: false });
        if (typeof selection === 'string' && selection) {
          setSelectedDirectory(selection);
        }
        if (Array.isArray(selection) && selection[0]) {
          setSelectedDirectory(selection[0]);
        }
        return;
      } catch (error) {
        console.error('Error selecting directory via Tauri dialog:', error);
      }
    }

    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        const dirName = dirHandle.name;
        setSelectedDirectory(dirName);
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Error selecting directory:', error);
        }
      }
      return;
    }

    const path = prompt('Enter directory path:');
    if (path) {
      setSelectedDirectory(path);
    }
  };

  const handleConfirmRun = async () => {
    if (!selectedTool) return;

    const resolvedContent = resolvePromptRefs(value, templates, savedPrompts);
    const dir = selectedDirectory.trim();
    const runningInTauri = isTauri();

    if (!runningInTauri) {
      alert('Terminal execution is only available in the Tauri app.');
      setShowDirectoryModal(false);
      setSelectedTool(null);
      return;
    }

    try {
      // For Claude UI, create a Claude session tab
      if (selectedTool === 'claude-ui') {
        // Store the directory for the Claude session
        localStorage.setItem('promptArchitect_claudeSessionDirectory', dir);
        if (onRunInTerminal) {
          onRunInTerminal(promptTitle || 'Claude Session', 'claude');
        }
        setShowDirectoryModal(false);
        setSelectedTool(null);
        return;
      }

      // Determine working directory - either worktree or original
      let workingDir = dir;
      let worktreePrefix = '';

      if (createWorktree && dir) {
        const { worktreePath, command: worktreeCommand } = buildWorktreeCommand(dir);
        workingDir = worktreePath;
        worktreePrefix = `${worktreeCommand} && `;
      }

      const runTabId = onRunInTerminal?.(promptTitle) ?? terminalTabId ?? null;
      if (!runTabId) {
        alert('Select a terminal tab first.');
        setShowDirectoryModal(false);
        setSelectedTool(null);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 60));

      if (workingDir) {
        onSaveSessionPath?.(runTabId, workingDir);
      }

      const toolCommand = selectedTool === 'claude'
        ? buildClaudeCommand(resolvedContent, workingDir, !createWorktree)
        : buildCodexCommand(resolvedContent, workingDir, !createWorktree);

      // If using worktree, prepend the worktree creation command
      const finalCommand = createWorktree && dir
        ? `${worktreePrefix}${toolCommand}`
        : toolCommand;

      enqueueTerminalWrite(runTabId, `${finalCommand}\n`);
    } catch (error) {
      console.error('Failed to run prompt in terminal:', error);
      alert('Failed to send prompt to the terminal.');
    } finally {
      setShowDirectoryModal(false);
      setSelectedTool(null);
    }
  };

  return {
    showRunDropdown,
    showDirectoryModal,
    selectedTool,
    selectedDirectory,
    createWorktree,
    runDropdownRef,
    directoryInputRef,
    setShowRunDropdown,
    setShowDirectoryModal,
    setSelectedTool,
    setSelectedDirectory,
    setCreateWorktree,
    handleRunWithTool,
    handleOpenInWeb,
    handleBrowseDirectory,
    handleConfirmRun,
  };
};
