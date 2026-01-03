import { WorktreeSettings } from './types';

export const DEFAULT_WORKTREE_SETTINGS: WorktreeSettings = {
  enabled: false,
  prefix: 'wt-',
  autoCleanup: false,
  cleanupAfterHours: 24,
};

export const coerceWorktreeSettings = (
  value: Partial<WorktreeSettings> | null
): WorktreeSettings => {
  if (!value) return DEFAULT_WORKTREE_SETTINGS;

  return {
    ...DEFAULT_WORKTREE_SETTINGS,
    ...value,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_WORKTREE_SETTINGS.enabled,
    prefix: typeof value.prefix === 'string' ? value.prefix : DEFAULT_WORKTREE_SETTINGS.prefix,
    autoCleanup: typeof value.autoCleanup === 'boolean' ? value.autoCleanup : DEFAULT_WORKTREE_SETTINGS.autoCleanup,
    cleanupAfterHours: typeof value.cleanupAfterHours === 'number' && value.cleanupAfterHours > 0
      ? value.cleanupAfterHours
      : DEFAULT_WORKTREE_SETTINGS.cleanupAfterHours,
  };
};

export const generateWorktreeName = (prefix: string): string => {
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const timestamp = Date.now().toString(36);
  return `${prefix}${timestamp}-${randomSuffix}`;
};
