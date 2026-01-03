export * from './types/panels';

export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
  category: 'system' | 'user' | 'technique' | 'custom';
  description?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface SavedPrompt {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
}

export interface TerminalTab {
  id: string;
  title: string;
  type?: 'terminal' | 'claude';
}

export type CLIStatus = 'idle' | 'working' | 'question' | 'done';

export type CLIStatusDetectionReason = 'question' | 'done' | 'working' | 'carryover' | 'idle';

export interface CLIStatusDetectionMatch {
  group: 'question' | 'done' | 'working';
  source: 'lastLine' | 'recentOutput';
  pattern: string;
}

export interface CLIStatusDetection {
  status: CLIStatus;
  previousStatus: CLIStatus;
  reason: CLIStatusDetectionReason;
  match?: CLIStatusDetectionMatch;
  lastLine: string;
  recentOutput: string;
  bufferSize: number;
}

export interface CLIStatusLogEntry extends CLIStatusDetection {
  id: string;
  tabId: string;
  timestamp: number;
  statusChanged: boolean;
}

export type CodexRunMode = 'exec' | 'tui';
export type CodexSandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access';
export type CodexApprovalMode = 'untrusted' | 'on-failure' | 'on-request' | 'never';
export type CodexColorMode = 'auto' | 'always' | 'never';

export interface CodexSettings {
  runMode: CodexRunMode;
  model: string;
  profile: string;
  sandbox: CodexSandboxMode | '';
  askForApproval: CodexApprovalMode | '';
  fullAuto: boolean;
  yolo: boolean;
  oss: boolean;
  search: boolean;
  skipGitRepoCheck: boolean;
  color: CodexColorMode;
  json: boolean;
  outputSchema: string;
  outputLastMessage: string;
  addDirs: string[];
  enableFeatures: string[];
  disableFeatures: string[];
  configOverrides: string[];
  imagePaths: string[];
}

export interface ClaudeSettings {
  cliPath: string;
  model: string;
  systemPrompt: string;
  systemPromptFile: string;
  appendSystemPrompt: string;
  outputFormat: 'text' | 'json' | '';
  addDirs: string[];
  dangerouslySkipPermissions: boolean;
  alwaysThinkingEnabled: boolean;
  excludeSensitiveFiles: string[];
  args: string;
}

export interface WorktreeSettings {
  enabled: boolean;
  prefix: string;
  autoCleanup: boolean;
  cleanupAfterHours: number;
}
