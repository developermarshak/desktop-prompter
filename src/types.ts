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
