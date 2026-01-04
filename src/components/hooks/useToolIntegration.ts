import { useState, useEffect, useRef } from 'react';
import { ClaudeSettings, CodexSettings, PromptTemplate, SavedPrompt, WorktreeSettings } from '../../types';
import { DEFAULT_CODEX_SETTINGS } from '../../codexSettings';
import { DEFAULT_CLAUDE_SETTINGS } from '../../claudeSettings';
import { DEFAULT_WORKTREE_SETTINGS, generateWorktreeName } from '../../worktreeSettings';
import { buildClaudeCommand, buildCodexCommand, shellEscape } from '../../utils/terminalCommands';
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
        ? buildClaudeCommand(resolvedContent, workingDir, !createWorktree, effectiveClaudeSettings)
        : buildCodexCommand(resolvedContent, workingDir, !createWorktree, effectiveCodexSettings);

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
