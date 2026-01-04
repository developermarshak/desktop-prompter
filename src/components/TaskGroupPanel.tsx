import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  Archive,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FolderOpen,
  GitBranch,
  Play,
  Plus,
  Square,
  Trash2,
} from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  ClaudeSettings,
  CodexSettings,
  PromptTemplate,
  SavedPrompt,
  Task,
  TaskGroup,
  TaskStatus,
} from "../types";
import { resolvePromptRefs } from "../utils";
import { buildClaudeCommand, buildCodexCommand, shellEscape } from "../utils/terminalCommands";
import { enqueueTerminalWrite } from "../terminalQueue";
import { generateWorktreeName } from "../worktreeSettings";
import { TaskDiffModal } from "./TaskDiffModal";
import type { GitDiffResponse } from "../types/git";

interface FileSectionResponse {
  content: string;
  path: string;
  startLine: number;
  endLine: number;
}

interface DiffStatsResponse {
  added: number;
  removed: number;
  filesChanged: number;
}

interface TaskGroupPanelProps {
  group: TaskGroup;
  templates: PromptTemplate[];
  savedPrompts: SavedPrompt[];
  codexSettings: CodexSettings;
  claudeSettings: ClaudeSettings;
  onUpdateGroup: (groupId: string, patch: Partial<TaskGroup>) => void;
  onCreateTask: (groupId: string) => void;
  onUpdateTask: (groupId: string, taskId: string, patch: Partial<Task>) => void;
  onDeleteTasks: (groupId: string, taskIds: string[]) => void;
  onSetTasksStatus: (groupId: string, taskIds: string[], status: TaskStatus) => void;
  onSetTasksSelected: (
    groupId: string,
    taskIds: string[],
    selected: boolean,
  ) => void;
  onClearSelection: (groupId: string) => void;
  onRequestTerminal: (title?: string, type?: "terminal" | "claude") => string | null;
  onSaveTerminalSessionPath?: (tabId: string, path: string) => void;
  onOpenSession: (tabId: string) => void;
}

const statusOrder: TaskStatus[] = [
  "ready",
  "queued",
  "working",
  "done",
  "archived",
];

const statusLabels: Record<TaskStatus, string> = {
  ready: "Ready",
  queued: "Queued",
  working: "Working",
  done: "Done",
  archived: "Archived",
};

const formatSectionLabel = (task: Task) => {
  if (!task.section || !task.section.filePath) {
    return "No section set";
  }
  return `${task.section.filePath}:${task.section.lineStart}-${task.section.lineEnd}`;
};

const buildWorktreeCommand = (
  baseDir: string,
  baseBranch: string,
  branchName: string,
) => {
  const parentDir = baseDir.replace(/\/[^/]+\/?$/, "") || baseDir;
  const worktreeName = generateWorktreeName("task-");
  const worktreePath = `${parentDir}/${worktreeName}`;
  const baseRef = baseBranch.trim() || "HEAD";

  const command = [
    `cd ${shellEscape(baseDir)}`,
    `git worktree add -b ${shellEscape(branchName)} ${shellEscape(
      worktreePath,
    )} ${shellEscape(baseRef)}`,
    `cd ${shellEscape(worktreePath)}`,
  ].join(" && ");

  return { worktreePath, command };
};

export const TaskGroupPanel = ({
  group,
  templates,
  savedPrompts,
  codexSettings,
  claudeSettings,
  onUpdateGroup,
  onCreateTask,
  onUpdateTask,
  onDeleteTasks,
  onSetTasksStatus,
  onSetTasksSelected,
  onClearSelection,
  onRequestTerminal,
  onSaveTerminalSessionPath,
  onOpenSession,
}: TaskGroupPanelProps) => {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [sectionModalTask, setSectionModalTask] = useState<Task | null>(null);
  const [sectionModalContent, setSectionModalContent] = useState<string>("");
  const [sectionModalLoading, setSectionModalLoading] = useState(false);
  const [sectionModalError, setSectionModalError] = useState<string | null>(null);
  const [diffModalTask, setDiffModalTask] = useState<Task | null>(null);
  const [diffModalResponse, setDiffModalResponse] = useState<GitDiffResponse | null>(null);
  const [diffModalLoading, setDiffModalLoading] = useState(false);
  const [diffModalError, setDiffModalError] = useState<string | null>(null);

  const selectedTaskIds = useMemo(
    () => group.tasks.filter((task) => task.selected).map((task) => task.id),
    [group.tasks],
  );

  const allSelected =
    group.tasks.length > 0 && selectedTaskIds.length === group.tasks.length;

  const loadSectionContent = useCallback(
    async (task: Task) => {
      if (!task.section || !task.section.filePath) {
        return "";
      }
      if (!isTauri()) {
        return "";
      }
      try {
        const response = await invoke<FileSectionResponse>("get_file_section", {
          root_path: group.projectPath,
          file_path: task.section.filePath,
          line_start: task.section.lineStart,
          line_end: task.section.lineEnd,
        });
        return response.content;
      } catch (error) {
        console.error("Failed to load file section", error);
        return "";
      }
    },
    [group.projectPath],
  );

  const buildTaskPrompt = useCallback(
    async (task: Task) => {
      const placeholderToken = "<<TASK_SECTION_PLACEHOLDER>>";
      const basePrompt = group.prompt.replace(
        /\{\{\s*section\s*\}\}/gi,
        placeholderToken,
      );
      const resolvedPrompt = resolvePromptRefs(
        basePrompt,
        templates,
        savedPrompts,
      );

      if (!resolvedPrompt.includes(placeholderToken)) {
        return resolvedPrompt;
      }

      const sectionContent = await loadSectionContent(task);
      const sectionLabel = formatSectionLabel(task);
      const formattedSection = sectionContent
        ? `Section (${sectionLabel}):\n\`\`\`\n${sectionContent}\n\`\`\``
        : `Section (${sectionLabel}):\n(section content unavailable)`;

      return resolvedPrompt.replace(placeholderToken, formattedSection);
    },
    [group.prompt, loadSectionContent, savedPrompts, templates],
  );

  const handleBrowseProjectPath = useCallback(async () => {
    if (!isTauri()) {
      const path = prompt("Enter project path:");
      if (path) {
        onUpdateGroup(group.id, { projectPath: path });
      }
      return;
    }
    try {
      const selection = await openDialog({ directory: true, multiple: false });
      if (typeof selection === "string" && selection) {
        onUpdateGroup(group.id, { projectPath: selection });
      }
      if (Array.isArray(selection) && selection[0]) {
        onUpdateGroup(group.id, { projectPath: selection[0] });
      }
    } catch (error) {
      console.error("Failed to select directory", error);
    }
  }, [group.id, onUpdateGroup]);

  const refreshDiffStats = useCallback(
    async (task: Task) => {
      if (!isTauri()) {
        return;
      }
      const repoPath = group.runInWorktree
        ? task.worktreePath || group.projectPath
        : group.projectPath;
      if (!repoPath || !group.baseBranch.trim()) {
        return;
      }
      try {
        const response = await invoke<DiffStatsResponse>(
          "get_git_diff_stats",
          {
            path: repoPath,
            base_branch: group.baseBranch.trim(),
          },
        );
        onUpdateTask(group.id, task.id, {
          diffStats: {
            added: response.added,
            removed: response.removed,
            filesChanged: response.filesChanged,
            updatedAt: Date.now(),
          },
        });
      } catch (error) {
        console.error("Failed to load diff stats", error);
      }
    },
    [group.baseBranch, group.id, group.projectPath, group.runInWorktree, onUpdateTask],
  );

  const refreshAllDiffStats = useCallback(async () => {
    await Promise.all(group.tasks.map((task) => refreshDiffStats(task)));
  }, [group.tasks, refreshDiffStats]);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }
    if (!group.baseBranch.trim() || !group.projectPath.trim()) {
      return;
    }
    const tasksNeedingStats = group.tasks.filter(
      (task) => !task.diffStats,
    );
    if (tasksNeedingStats.length === 0) {
      return;
    }
    void Promise.all(tasksNeedingStats.map((task) => refreshDiffStats(task)));
  }, [group.baseBranch, group.projectPath, group.tasks, refreshDiffStats]);

  const openSectionModal = useCallback(
    async (task: Task) => {
      setSectionModalTask(task);
      setSectionModalContent("");
      setSectionModalError(null);
      setSectionModalLoading(true);
      try {
        const content = await loadSectionContent(task);
        const label = formatSectionLabel(task);
        setSectionModalContent(
          content
            ? `Section (${label})\n\n${content}`
            : `Section (${label})\n\n(section content unavailable)`,
        );
      } catch (error) {
        setSectionModalError("Failed to load section content.");
      } finally {
        setSectionModalLoading(false);
      }
    },
    [loadSectionContent],
  );

  const openDiffModal = useCallback(
    async (task: Task) => {
      setDiffModalTask(task);
      setDiffModalLoading(true);
      setDiffModalError(null);
      setDiffModalResponse(null);
      if (!isTauri()) {
        setDiffModalError("Diff is available only in the Tauri app.");
        setDiffModalLoading(false);
        return;
      }
      try {
        const repoPath = group.runInWorktree
          ? task.worktreePath || group.projectPath
          : group.projectPath;
        if (!repoPath || !group.baseBranch.trim()) {
          throw new Error("Missing repo path or base branch.");
        }
        const response = await invoke<GitDiffResponse>("get_git_diff_base", {
          path: repoPath,
          base_branch: group.baseBranch.trim(),
        });
        setDiffModalResponse(response);
      } catch (error) {
        console.error("Failed to load diff", error);
        setDiffModalError("Failed to load diff.");
      } finally {
        setDiffModalLoading(false);
      }
    },
    [group.baseBranch, group.projectPath, group.runInWorktree],
  );

  const handleRunTask = useCallback(
    async (task: Task) => {
      if (!isTauri()) {
        alert("Terminal execution is only available in the Tauri app.");
        return;
      }
      if (!group.projectPath.trim()) {
        alert("Set a project path for the task group first.");
        return;
      }

      const prompt = await buildTaskPrompt(task);
      if (!prompt.trim()) {
        alert("Task group prompt is empty.");
        return;
      }

      let workingDir = group.projectPath.trim();
      let worktreePrefix = "";
      let nextTask = task;

      if (group.runner === "claude-ui") {
        if (group.runInWorktree && !task.worktreePath.trim()) {
          alert("Set a worktree path before running Claude UI.");
          return;
        }
        if (group.runInWorktree && task.worktreePath.trim()) {
          workingDir = task.worktreePath.trim();
        }
        localStorage.setItem("promptArchitect_claudeSessionPrompt", prompt);
        localStorage.setItem(
          "promptArchitect_claudeSessionDirectory",
          workingDir,
        );
        const tabId = onRequestTerminal(`${nextTask.name} (Claude)`, "claude");
        if (tabId) {
          onUpdateTask(group.id, task.id, {
            status: "working",
            sessionTabId: tabId,
          });
        }
        return;
      }

      if (group.runInWorktree) {
        if (!task.worktreePath.trim()) {
          const fallbackBranch =
            task.gitBranch.trim() || `task-${task.id.slice(0, 8)}`;
          const { worktreePath, command } = buildWorktreeCommand(
            group.projectPath.trim(),
            group.baseBranch,
            fallbackBranch,
          );
          workingDir = worktreePath;
          worktreePrefix = `${command} && `;
          nextTask = {
            ...task,
            worktreePath,
            gitBranch: fallbackBranch,
          };
          onUpdateTask(group.id, task.id, {
            worktreePath,
            gitBranch: fallbackBranch,
          });
        } else {
          workingDir = task.worktreePath.trim();
        }
      }

      const tabId = onRequestTerminal(nextTask.name, "terminal");
      if (!tabId) {
        alert("Select a terminal tab first.");
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 60));
      onSaveTerminalSessionPath?.(tabId, workingDir);

      const useShellCd = worktreePrefix.length === 0;
      const toolCommand =
        group.runner === "claude"
          ? buildClaudeCommand(prompt, workingDir, useShellCd, claudeSettings)
          : buildCodexCommand(prompt, workingDir, useShellCd, codexSettings);

      const finalCommand = worktreePrefix ? `${worktreePrefix}${toolCommand}` : toolCommand;

      enqueueTerminalWrite(tabId, `${finalCommand}\n`);
      onUpdateTask(group.id, task.id, {
        status: "working",
        sessionTabId: tabId,
      });
    },
    [
      buildTaskPrompt,
      claudeSettings,
      codexSettings,
      group.baseBranch,
      group.id,
      group.projectPath,
      group.runInWorktree,
      group.runner,
      onRequestTerminal,
      onSaveTerminalSessionPath,
      onUpdateTask,
    ],
  );

  const handleRunSelected = useCallback(async () => {
    for (const task of group.tasks.filter((task) => task.selected)) {
      if (task.status === "archived") {
        continue;
      }
      await handleRunTask(task);
    }
  }, [group.tasks, handleRunTask]);

  const handleArchiveSelected = useCallback(() => {
    if (selectedTaskIds.length === 0) {
      return;
    }
    onSetTasksStatus(group.id, selectedTaskIds, "archived");
    onClearSelection(group.id);
  }, [group.id, onClearSelection, onSetTasksStatus, selectedTaskIds]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedTaskIds.length === 0) {
      return;
    }
    const confirmed = confirm(
      `Delete ${selectedTaskIds.length} selected task(s)?`,
    );
    if (!confirmed) {
      return;
    }
    onDeleteTasks(group.id, selectedTaskIds);
  }, [group.id, onDeleteTasks, selectedTaskIds]);

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900 shrink-0">
        <div className="flex items-center gap-2 text-zinc-200 font-semibold">
          <span>Task Group</span>
        </div>
        <span className="text-[10px] text-zinc-500 max-w-[180px] truncate">
          {group.name}
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-zinc-950/40">
        <div className="p-4 border-b border-zinc-800 space-y-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
            Task Group Settings
          </div>
          <div className="grid grid-cols-1 gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-400 w-24">Runner</label>
            <select
              value={group.runner}
              onChange={(event) =>
                onUpdateGroup(group.id, {
                  runner: event.target.value as TaskGroup["runner"],
                })
              }
              className="flex-1 bg-zinc-950 border border-zinc-700 rounded-md px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="codex">Codex</option>
              <option value="claude">Claude</option>
              <option value="claude-ui">Claude UI</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-400 w-24">Project</label>
            <input
              type="text"
              value={group.projectPath}
              onChange={(event) =>
                onUpdateGroup(group.id, { projectPath: event.target.value })
              }
              placeholder="Path to repository"
              className="flex-1 bg-zinc-950 border border-zinc-700 rounded-md px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={handleBrowseProjectPath}
              className="p-1.5 bg-zinc-900 border border-zinc-700 rounded-md text-zinc-400 hover:text-white transition-colors"
              title="Browse"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-400 w-24">Base branch</label>
            <input
              type="text"
              value={group.baseBranch}
              onChange={(event) =>
                onUpdateGroup(group.id, { baseBranch: event.target.value })
              }
              placeholder="main"
              className="flex-1 bg-zinc-950 border border-zinc-700 rounded-md px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={group.runInWorktree}
              onChange={(event) =>
                onUpdateGroup(group.id, { runInWorktree: event.target.checked })
              }
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-950 text-indigo-500 focus:ring-indigo-500/50 focus:ring-offset-0"
            />
            Run in worktree
          </label>
          <p className="text-[10px] text-zinc-500">
            Tip: use &#123;&#123;section&#125;&#125; in the prompt to inject task
            sections.
          </p>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="text-sm font-semibold text-zinc-200">Tasks</div>
          <button
            onClick={() => onCreateTask(group.id)}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>

        <div className="px-4 py-2 border-b border-zinc-800 flex flex-wrap gap-2 items-center">
          <button
            onClick={() =>
              onSetTasksSelected(
                group.id,
                group.tasks.map((task) => task.id),
                !allSelected,
              )
            }
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
          >
            {allSelected ? (
              <CheckSquare className="w-3.5 h-3.5" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          <div className="h-4 w-px bg-zinc-800" />
          <button
            onClick={handleRunSelected}
            disabled={selectedTaskIds.length === 0}
            className="flex items-center gap-1 text-xs text-emerald-300 hover:text-white disabled:text-zinc-600"
          >
            <Play className="w-3.5 h-3.5" />
            Run selected
          </button>
          <button
            onClick={handleArchiveSelected}
            disabled={selectedTaskIds.length === 0}
            className="flex items-center gap-1 text-xs text-amber-300 hover:text-white disabled:text-zinc-600"
          >
            <Archive className="w-3.5 h-3.5" />
            Archive
          </button>
          <button
            onClick={handleDeleteSelected}
            disabled={selectedTaskIds.length === 0}
            className="flex items-center gap-1 text-xs text-rose-300 hover:text-white disabled:text-zinc-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
          <div className="h-4 w-px bg-zinc-800" />
          <button
            onClick={refreshAllDiffStats}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh diffs
          </button>
        </div>

        <div className="pb-6">
          {group.tasks.length === 0 ? (
            <div className="p-6 text-sm text-zinc-600 italic">
              No tasks yet. Add one to get started.
            </div>
          ) : (
            group.tasks.map((task) => {
              const isExpanded = expandedTaskId === task.id;
              const diffStats = task.diffStats;
              const diffLabel = diffStats
                ? `+${diffStats.added} -${diffStats.removed}`
                : "--";
              const hasDiff =
                diffStats && (diffStats.added > 0 || diffStats.removed > 0);
              return (
                <div
                  key={task.id}
                  className="border-b border-zinc-900/70 px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={task.selected}
                      onChange={(event) =>
                        onSetTasksSelected(group.id, [task.id], event.target.checked)
                      }
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-950 text-indigo-500 focus:ring-indigo-500/50 focus:ring-offset-0"
                    />
                    <button
                      onClick={() =>
                        setExpandedTaskId(isExpanded ? null : task.id)
                      }
                      className="text-zinc-500 hover:text-white"
                      title={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    <input
                      type="text"
                      value={task.name}
                      onChange={(event) =>
                        onUpdateTask(group.id, task.id, { name: event.target.value })
                      }
                      className="flex-1 bg-transparent text-sm text-zinc-100 focus:outline-none"
                    />
                    <select
                      value={task.status}
                      onChange={(event) =>
                        onUpdateTask(group.id, task.id, {
                          status: event.target.value as TaskStatus,
                        })
                      }
                      className="bg-zinc-950 border border-zinc-700 rounded-md px-2 py-1 text-[10px] text-zinc-300 uppercase tracking-wide"
                    >
                      {statusOrder.map((status) => (
                        <option key={status} value={status}>
                          {statusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span>{formatSectionLabel(task)}</span>
                    <span className="text-zinc-600">|</span>
                    <span className="font-mono">{diffLabel}</span>
                    {task.gitBranch && (
                      <>
                        <span className="text-zinc-600">|</span>
                        <span className="inline-flex items-center gap-1">
                          <GitBranch className="w-3 h-3" />
                          {task.gitBranch}
                        </span>
                      </>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-3 grid grid-cols-1 gap-3 text-xs text-zinc-400">
                      <div className="grid grid-cols-1 gap-2">
                        <label className="text-[10px] uppercase text-zinc-500">
                          Section
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                          <input
                            type="text"
                            value={task.section?.filePath ?? ""}
                            onChange={(event) =>
                              onUpdateTask(group.id, task.id, {
                                section: {
                                  filePath: event.target.value,
                                  lineStart: task.section?.lineStart ?? 1,
                                  lineEnd: task.section?.lineEnd ?? 1,
                                },
                              })
                            }
                            placeholder="relative/path/to/file.ts"
                            className="bg-zinc-950 border border-zinc-700 rounded-md px-2 py-1 text-xs text-zinc-200"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              min={1}
                              value={task.section?.lineStart ?? 1}
                              onChange={(event) =>
                                onUpdateTask(group.id, task.id, {
                                  section: {
                                    filePath: task.section?.filePath ?? "",
                                    lineStart: Number(event.target.value),
                                    lineEnd: task.section?.lineEnd ?? 1,
                                  },
                                })
                              }
                              placeholder="Start line"
                              className="bg-zinc-950 border border-zinc-700 rounded-md px-2 py-1 text-xs text-zinc-200"
                            />
                            <input
                              type="number"
                              min={1}
                              value={task.section?.lineEnd ?? 1}
                              onChange={(event) =>
                                onUpdateTask(group.id, task.id, {
                                  section: {
                                    filePath: task.section?.filePath ?? "",
                                    lineStart: task.section?.lineStart ?? 1,
                                    lineEnd: Number(event.target.value),
                                  },
                                })
                              }
                              placeholder="End line"
                              className="bg-zinc-950 border border-zinc-700 rounded-md px-2 py-1 text-xs text-zinc-200"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <label className="text-[10px] uppercase text-zinc-500">
                          Git branch
                        </label>
                        <input
                          type="text"
                          value={task.gitBranch}
                          onChange={(event) =>
                            onUpdateTask(group.id, task.id, {
                              gitBranch: event.target.value,
                            })
                          }
                          placeholder="feature/task-branch"
                          className="bg-zinc-950 border border-zinc-700 rounded-md px-2 py-1 text-xs text-zinc-200"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <label className="text-[10px] uppercase text-zinc-500">
                          Worktree path
                        </label>
                        <input
                          type="text"
                          value={task.worktreePath}
                          onChange={(event) =>
                            onUpdateTask(group.id, task.id, {
                              worktreePath: event.target.value,
                            })
                          }
                          placeholder="Optional worktree path"
                          className="bg-zinc-950 border border-zinc-700 rounded-md px-2 py-1 text-xs text-zinc-200"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleRunTask(task)}
                          disabled={task.status === "archived"}
                          className="flex items-center gap-1 text-xs text-emerald-300 hover:text-white disabled:text-zinc-600"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Run
                        </button>
                        <button
                          onClick={() => openSectionModal(task)}
                          className="flex items-center gap-1 text-xs text-zinc-300 hover:text-white"
                        >
                          Show section
                        </button>
                        <button
                          onClick={() => openDiffModal(task)}
                          disabled={!hasDiff}
                          className="flex items-center gap-1 text-xs text-zinc-300 hover:text-white disabled:text-zinc-600"
                        >
                          Show diff
                        </button>
                        <button
                          onClick={() => {
                            if (task.status !== "done" || !task.sessionTabId) {
                              return;
                            }
                            onOpenSession(task.sessionTabId);
                          }}
                          disabled={task.status !== "done" || !task.sessionTabId}
                          className="flex items-center gap-1 text-xs text-zinc-300 hover:text-white disabled:text-zinc-600"
                        >
                          Open session
                        </button>
                        <button
                          onClick={() => refreshDiffStats(task)}
                          className="flex items-center gap-1 text-xs text-zinc-300 hover:text-white"
                        >
                          Refresh diff
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {sectionModalTask && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[70vh] overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
              <div className="text-sm text-zinc-200">
                {sectionModalTask.name}
              </div>
              <button
                onClick={() => setSectionModalTask(null)}
                className="text-zinc-500 hover:text-white"
              >
                X
              </button>
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar text-xs text-zinc-300 font-mono whitespace-pre-wrap">
              {sectionModalLoading
                ? "Loading section..."
                : sectionModalError
                ? sectionModalError
                : sectionModalContent}
            </div>
          </div>
        </div>
      )}

      <TaskDiffModal
        open={Boolean(diffModalTask)}
        title={
          diffModalTask
            ? `${diffModalTask.name} diff vs ${group.baseBranch}`
            : "Diff"
        }
        diff={diffModalResponse}
        loading={diffModalLoading}
        error={diffModalError}
        onClose={() => setDiffModalTask(null)}
      />
    </div>
  );
};
