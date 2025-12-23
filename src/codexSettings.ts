import { CodexSettings } from './types';

export const DEFAULT_CODEX_SETTINGS: CodexSettings = {
  runMode: 'tui',
  model: '',
  profile: '',
  sandbox: '',
  askForApproval: '',
  fullAuto: false,
  yolo: false,
  oss: false,
  search: false,
  skipGitRepoCheck: true,
  color: 'auto',
  json: false,
  outputSchema: '',
  outputLastMessage: '',
  addDirs: [],
  enableFeatures: [],
  disableFeatures: [],
  configOverrides: [],
  imagePaths: [],
};

const coerceList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
};

export const coerceCodexSettings = (
  value: Partial<CodexSettings> | null
): CodexSettings => {
  if (!value) return DEFAULT_CODEX_SETTINGS;

  return {
    ...DEFAULT_CODEX_SETTINGS,
    ...value,
    addDirs: coerceList(value.addDirs),
    enableFeatures: coerceList(value.enableFeatures),
    disableFeatures: coerceList(value.disableFeatures),
    configOverrides: coerceList(value.configOverrides),
    imagePaths: coerceList(value.imagePaths),
  };
};

export const listToText = (list: string[]): string => list.join('\n');

export const textToList = (value: string): string[] =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
