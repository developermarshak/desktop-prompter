import { useCallback, useEffect, useMemo, useState } from "react";
import { Task, TaskGroup, TaskStatus } from "../types";

const STORAGE_KEY = "promptArchitect_taskGroups";

const createEmptyTask = (): Task => ({
  id: crypto.randomUUID(),
  name: "New Task",
  section: {
    filePath: "",
    lineStart: 1,
    lineEnd: 1,
  },
  gitBranch: "",
  worktreePath: "",
  diffStats: null,
  status: "ready",
  selected: false,
  sessionTabId: null,
});

const createEmptyTaskGroup = (): TaskGroup => ({
  id: crypto.randomUUID(),
  name: "New Task Group",
  prompt: "",
  runner: "codex",
  runInWorktree: false,
  projectPath: "",
  baseBranch: "main",
  tasks: [],
});

export interface UseTaskGroupsManagerResult {
  taskGroups: TaskGroup[];
  activeTaskGroupId: string | null;
  activeTaskGroup: TaskGroup | null;
  setActiveTaskGroupId: (id: string | null) => void;
  createTaskGroup: () => void;
  updateTaskGroup: (groupId: string, patch: Partial<TaskGroup>) => void;
  deleteTaskGroup: (groupId: string) => void;
  renameTaskGroup: (groupId: string, name: string) => void;
  createTask: (groupId: string) => void;
  updateTask: (groupId: string, taskId: string, patch: Partial<Task>) => void;
  deleteTasks: (groupId: string, taskIds: string[]) => void;
  setTasksStatus: (
    groupId: string,
    taskIds: string[],
    status: TaskStatus,
  ) => void;
  setTasksSelected: (groupId: string, taskIds: string[], selected: boolean) => void;
  clearTaskSelection: (groupId: string) => void;
}

export const useTaskGroupsManager = (): UseTaskGroupsManagerResult => {
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
  const [activeTaskGroupId, setActiveTaskGroupId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return;
    }
    try {
      const parsed = JSON.parse(stored) as TaskGroup[];
      setTaskGroups(parsed);
      if (parsed.length > 0) {
        setActiveTaskGroupId(parsed[0].id);
      }
    } catch (error) {
      console.error("Failed to parse task groups", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(taskGroups));
  }, [taskGroups]);

  const activeTaskGroup = useMemo(
    () => taskGroups.find((group) => group.id === activeTaskGroupId) ?? null,
    [taskGroups, activeTaskGroupId],
  );

  const createTaskGroup = useCallback(() => {
    const group = createEmptyTaskGroup();
    setTaskGroups((prev) => [...prev, group]);
    setActiveTaskGroupId(group.id);
  }, []);

  const updateTaskGroup = useCallback(
    (groupId: string, patch: Partial<TaskGroup>) => {
      setTaskGroups((prev) =>
        prev.map((group) =>
          group.id === groupId ? { ...group, ...patch } : group,
        ),
      );
    },
    [],
  );

  const renameTaskGroup = useCallback(
    (groupId: string, name: string) => {
      updateTaskGroup(groupId, { name });
    },
    [updateTaskGroup],
  );

  const deleteTaskGroup = useCallback(
    (groupId: string) => {
      setTaskGroups((prev) => prev.filter((group) => group.id !== groupId));
      setActiveTaskGroupId((prev) => (prev === groupId ? null : prev));
    },
    [],
  );

  const createTask = useCallback((groupId: string) => {
    setTaskGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? { ...group, tasks: [...group.tasks, createEmptyTask()] }
          : group,
      ),
    );
  }, []);

  const updateTask = useCallback(
    (groupId: string, taskId: string, patch: Partial<Task>) => {
      setTaskGroups((prev) =>
        prev.map((group) =>
          group.id === groupId
            ? {
                ...group,
                tasks: group.tasks.map((task) =>
                  task.id === taskId ? { ...task, ...patch } : task,
                ),
              }
            : group,
        ),
      );
    },
    [],
  );

  const deleteTasks = useCallback((groupId: string, taskIds: string[]) => {
    const taskIdSet = new Set(taskIds);
    setTaskGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? {
              ...group,
              tasks: group.tasks.filter((task) => !taskIdSet.has(task.id)),
            }
          : group,
      ),
    );
  }, []);

  const setTasksStatus = useCallback(
    (groupId: string, taskIds: string[], status: TaskStatus) => {
      const taskIdSet = new Set(taskIds);
      setTaskGroups((prev) =>
        prev.map((group) =>
          group.id === groupId
            ? {
                ...group,
                tasks: group.tasks.map((task) =>
                  taskIdSet.has(task.id) ? { ...task, status } : task,
                ),
              }
            : group,
        ),
      );
    },
    [],
  );

  const setTasksSelected = useCallback(
    (groupId: string, taskIds: string[], selected: boolean) => {
      const taskIdSet = new Set(taskIds);
      setTaskGroups((prev) =>
        prev.map((group) =>
          group.id === groupId
            ? {
                ...group,
                tasks: group.tasks.map((task) =>
                  taskIdSet.has(task.id) ? { ...task, selected } : task,
                ),
              }
            : group,
        ),
      );
    },
    [],
  );

  const clearTaskSelection = useCallback((groupId: string) => {
    setTaskGroups((prev) =>
      prev.map((group) =>
        group.id === groupId
          ? {
              ...group,
              tasks: group.tasks.map((task) =>
                task.selected ? { ...task, selected: false } : task,
              ),
            }
          : group,
      ),
    );
  }, []);

  return {
    taskGroups,
    activeTaskGroupId,
    activeTaskGroup,
    setActiveTaskGroupId,
    createTaskGroup,
    updateTaskGroup,
    deleteTaskGroup,
    renameTaskGroup,
    createTask,
    updateTask,
    deleteTasks,
    setTasksStatus,
    setTasksSelected,
    clearTaskSelection,
  };
};
