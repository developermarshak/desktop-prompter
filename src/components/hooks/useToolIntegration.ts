import { useState, useEffect, useRef } from 'react';
import { ClaudeSettings, CodexSettings, PromptTemplate, SavedPrompt } from '../../types';
import { DEFAULT_CODEX_SETTINGS } from '../../codexSettings';
import { DEFAULT_CLAUDE_SETTINGS } from '../../claudeSettings';
import { resolvePromptRefs } from '../../utils';
import { open } from '@tauri-apps/plugin-dialog';
import { isTauri } from '@tauri-apps/api/core';
import { enqueueTerminalWrite } from '../../terminalQueue';

interface UseToolIntegrationProps {
  value: string;
  templates: PromptTemplate[];
  savedPrompts: SavedPrompt[];
  onRunInTerminal?: (title?: string) => string | null;
  promptTitle?: string;
  terminalTabId?: string | null;
  codexSettings?: CodexSettings;
  claudeSettings?: ClaudeSettings;
}

export const useToolIntegration = ({
  value,
  templates,
  savedPrompts,
  onRunInTerminal,
  promptTitle,
  terminalTabId,
  codexSettings,
  claudeSettings,
}: UseToolIntegrationProps) => {
  const [showRunDropdown, setShowRunDropdown] = useState(false);
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [selectedTool, setSelectedTool] = useState<'codex' | 'claude' | null>(null);
  const [selectedDirectory, setSelectedDirectory] = useState<string>('');
  const runDropdownRef = useRef<HTMLDivElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const effectiveCodexSettings = codexSettings ?? DEFAULT_CODEX_SETTINGS;
  const effectiveClaudeSettings = claudeSettings ?? DEFAULT_CLAUDE_SETTINGS;

  const shellEscape = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;
  const doubleQuoteEscape = (value: string) => `"${value.replace(/["\\$`]/g, '\\$&')}"`;

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

    if (settings.runMode !== 'exec' && prompt.trim()) {
      args.push(shellEscape(prompt));
    }

    const baseCommand = args.join(' ');

    if (settings.runMode === 'exec') {
      let label = 'CODEX_PROMPT';
      while (prompt.includes(label)) {
        label = `CODEX_PROMPT_${Math.random().toString(36).slice(2, 8)}`;
      }
      const execCommand = `${baseCommand} - <<'${label}'\n${prompt}\n${label}`;
      if (!cwd || !useShellCd) return execCommand;
      return `cd ${shellEscape(cwd)}\n${execCommand}`;
    }

    if (!cwd || !useShellCd) return baseCommand;
    return `cd ${shellEscape(cwd)}\n${baseCommand}`;
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
    args.push(doubleQuoteEscape(prompt));

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

  const handleRunWithTool = (tool: 'codex' | 'claude') => {
    const resolvedContent = resolvePromptRefs(value, templates, savedPrompts);

    if (!resolvedContent.trim()) {
      alert('Please write a prompt first.');
      return;
    }

    setSelectedTool(tool);
    setShowRunDropdown(false);
    setShowDirectoryModal(true);
  };

  const handleBrowseDirectory = async () => {
    const runningInTauri = isTauri();

    if (runningInTauri) {
      try {
        const selection = await open({ directory: true, multiple: false });
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
      const runTabId = onRunInTerminal?.(promptTitle) ?? terminalTabId ?? null;
      if (!runTabId) {
        alert('Select a terminal tab first.');
        setShowDirectoryModal(false);
        setSelectedTool(null);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 60));
      const command = selectedTool === 'claude'
        ? buildClaudeCommand(resolvedContent, dir, true)
        : buildCodexCommand(resolvedContent, dir, true);
      enqueueTerminalWrite(runTabId, `${command}\n`);
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
    runDropdownRef,
    directoryInputRef,
    setShowRunDropdown,
    setShowDirectoryModal,
    setSelectedTool,
    setSelectedDirectory,
    handleRunWithTool,
    handleBrowseDirectory,
    handleConfirmRun,
  };
};
