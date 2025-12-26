import { ClaudeSettings } from './types';

export const DEFAULT_CLAUDE_SETTINGS: ClaudeSettings = {
  model: '',
  systemPrompt: '',
  systemPromptFile: '',
  appendSystemPrompt: '',
  outputFormat: '',
  addDirs: [],
  dangerouslySkipPermissions: false,
  alwaysThinkingEnabled: false,
  excludeSensitiveFiles: [],
  args: '',
};

const coerceList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
};

export const coerceClaudeSettings = (
  value: Partial<ClaudeSettings> | null
): ClaudeSettings => {
  if (!value) return DEFAULT_CLAUDE_SETTINGS;

  return {
    ...DEFAULT_CLAUDE_SETTINGS,
    ...value,
    addDirs: coerceList(value.addDirs),
    excludeSensitiveFiles: coerceList(value.excludeSensitiveFiles),
  };
};

export const listToText = (list: string[]): string => list.join('\n');

export const textToList = (value: string): string[] =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
