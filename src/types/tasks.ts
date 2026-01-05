export type TaskRunner = "codex" | "claude" | "claude-ui";

export type TaskStatus = "ready" | "queued" | "working" | "done" | "archived";

export interface TaskSection {
  filePath: string;
  lineStart: number;
  lineEnd: number;
}

export interface TaskSectionPreview {
  title: string;
  label: string;
  filePath: string;
  lineStart: number;
  content: string;
  loading: boolean;
  error: string | null;
}

export interface TaskDiffStats {
  added: number;
  removed: number;
  filesChanged: number;
  updatedAt: number;
}

export interface Task {
  id: string;
  name: string;
  section: TaskSection | null;
  gitBranch: string;
  worktreePath: string;
  diffStats: TaskDiffStats | null;
  status: TaskStatus;
  selected: boolean;
  sessionTabId: string | null;
}

export interface TaskGroup {
  id: string;
  name: string;
  prompt: string;
  runner: TaskRunner;
  runInWorktree: boolean;
  useGitSectionLabel: boolean;
  projectPath: string;
  baseBranch: string;
  tasks: Task[];
}
