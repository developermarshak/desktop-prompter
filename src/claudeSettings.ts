import { ClaudeSettings } from './types';

export const DEFAULT_CLAUDE_SETTINGS: ClaudeSettings = {
  model: '',
  args: '',
};

export const coerceClaudeSettings = (
  value: Partial<ClaudeSettings> | null
): ClaudeSettings => {
  if (!value) return DEFAULT_CLAUDE_SETTINGS;

  return {
    ...DEFAULT_CLAUDE_SETTINGS,
    ...value,
    model: typeof value.model === 'string' ? value.model : '',
    args: typeof value.args === 'string' ? value.args : '',
  };
};
