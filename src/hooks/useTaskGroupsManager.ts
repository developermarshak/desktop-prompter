import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
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
  useGitSectionLabel: false,
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
  migrationNotice: string | null;
  clearMigrationNotice: () => void;
}

interface TaskGroupStoreResponse {
  taskGroups: TaskGroup[];
  exists: boolean;
}

export const useTaskGroupsManager = (): UseTaskGroupsManagerResult => {
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
  const [activeTaskGroupId, setActiveTaskGroupId] = useState<string | null>(
    null,
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const [migrationNotice, setMigrationNotice] = useState<string | null>(null);
  const lastSavedSnapshot = useRef<string | null>(null);
  const taskGroupsRef = useRef<TaskGroup[]>([]);
  const activeTaskGroupIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const applyGroups = (groups: TaskGroup[]) => {
      if (!mounted) return;
      setTaskGroups(groups);
      setActiveTaskGroupId(groups.length > 0 ? groups[0].id : null);
    };

    const loadFromLocalStorage = () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return { groups: [], raw: null as string | null };
      }
      try {
        return { groups: JSON.parse(stored) as TaskGroup[], raw: stored };
      } catch (error) {
        console.error("Failed to parse task groups", error);
        return { groups: [], raw: null as string | null };
      }
    };

    const loadGroups = async () => {
      if (!isTauri()) {
        applyGroups(loadFromLocalStorage().groups);
        setIsLoaded(true);
        return;
      }

      try {
        const response = await invoke<TaskGroupStoreResponse>("load_task_groups");
        if (response.exists && response.taskGroups.length > 0) {
          const snapshot = JSON.stringify(response.taskGroups);
          lastSavedSnapshot.current = snapshot;
          applyGroups(response.taskGroups);
          setIsLoaded(true);
          return;
        }

        const localState = loadFromLocalStorage();
        if (localState.groups.length > 0) {
          await invoke("save_task_groups", { taskGroups: localState.groups });
          if (localState.raw) {
            localStorage.setItem(`${STORAGE_KEY}_backup`, localState.raw);
            localStorage.removeItem(STORAGE_KEY);
          }
          setMigrationNotice(
            "Migrated task groups to ~/.prompter/task-groups.json (backup saved to localStorage).",
          );
          lastSavedSnapshot.current = JSON.stringify(localState.groups);
          applyGroups(localState.groups);
        }
      } catch (error) {
        console.error("Failed to load task groups store", error);
        applyGroups(loadFromLocalStorage().groups);
      } finally {
        setIsLoaded(true);
      }
    };

    void loadGroups();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    if (!isTauri()) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(taskGroups));
      return;
    }
    const snapshot = JSON.stringify(taskGroups);
    if (snapshot === lastSavedSnapshot.current) {
      return;
    }
    lastSavedSnapshot.current = snapshot;
    void invoke("save_task_groups", { taskGroups: taskGroups });
  }, [isLoaded, taskGroups]);

  useEffect(() => {
    taskGroupsRef.current = taskGroups;
  }, [taskGroups]);

  useEffect(() => {
    activeTaskGroupIdRef.current = activeTaskGroupId;
  }, [activeTaskGroupId]);

  useEffect(() => {
    if (!isLoaded || !isTauri()) {
      return;
    }
    let mounted = true;
    const poll = async () => {
      try {
        const response = await invoke<TaskGroupStoreResponse>("load_task_groups");
        const snapshot = JSON.stringify(response.taskGroups);
        const localSnapshot = JSON.stringify(taskGroupsRef.current);
        if (!mounted || snapshot === localSnapshot) {
          return;
        }
        lastSavedSnapshot.current = snapshot;
        setTaskGroups(response.taskGroups);
        if (response.taskGroups.length === 0) {
          setActiveTaskGroupId(null);
        } else if (
          !response.taskGroups.some(
            (group) => group.id === activeTaskGroupIdRef.current,
          )
        ) {
          setActiveTaskGroupId(response.taskGroups[0].id);
        }
      } catch (error) {
        console.error("Failed to refresh task groups store", error);
      }
    };
    const interval = window.setInterval(poll, 5000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [isLoaded]);

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
    migrationNotice,
    clearMigrationNotice: () => setMigrationNotice(null),
  };
};
