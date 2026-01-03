import { useState, useEffect, useCallback, useRef } from "react";
import {
  TerminalTab,
  CLIStatus,
  CLIStatusDetection,
  CLIStatusLogEntry,
} from "../types";
import { CLIStatusTracker } from "../utils/cliStatusDetector";
import {
  loadCliStatusLogs,
  saveCliStatusLogs,
  trimCliStatusLogs,
  truncateLogText,
} from "../utils/cliStatusLogs";

export interface UseTerminalManagerResult {
  terminalTabs: TerminalTab[];
  activeTerminalTabId: string | null;
  terminalWaitingTabs: Set<string>;
  terminalCLIStatus: Map<string, CLIStatus>;
  terminalSessionPaths: Map<string, string>;
  cliStatusLogs: CLIStatusLogEntry[];
  setActiveTerminalTabId: React.Dispatch<React.SetStateAction<string | null>>;
  createTerminalTab: (title?: string, type?: "terminal" | "claude") => string;
  setTerminalSessionPath: (tabId: string, path: string) => void;
  handleSelectTerminalTab: (tab: TerminalTab) => void;
  handleNewTerminalTab: () => void;
  handleCloseTerminalTab: (tabId: string) => void;
  handleRenameTerminalTab: (tabId: string, title: string) => void;
  handleTerminalOutput: (tabId: string, data: string) => void;
  handleClaudeStatusChange: (tabId: string, status: CLIStatus) => void;
  clearCliStatusLogs: () => void;
  setTerminalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  terminalOpen: boolean;
}

export function useTerminalManager(): UseTerminalManagerResult {
  const [terminalTabs, setTerminalTabs] = useState<TerminalTab[]>([]);
  const [activeTerminalTabId, setActiveTerminalTabId] = useState<string | null>(
    null
  );
  const [terminalWaitingTabs, setTerminalWaitingTabs] = useState<Set<string>>(
    new Set()
  );
  const [terminalCLIStatus, setTerminalCLIStatus] = useState<
    Map<string, CLIStatus>
  >(new Map());
  const [terminalSessionPaths, setTerminalSessionPaths] = useState<
    Map<string, string>
  >(new Map());
  const [cliStatusLogs, setCliStatusLogs] = useState<CLIStatusLogEntry[]>(() =>
    loadCliStatusLogs()
  );
  const [terminalOpen, setTerminalOpen] = useState(false);

  const cliStatusTrackersRef = useRef<Map<string, CLIStatusTracker>>(new Map());

  // Sync active tab when tabs change
  useEffect(() => {
    if (!activeTerminalTabId && terminalTabs.length > 0) {
      setActiveTerminalTabId(terminalTabs[0].id);
    }
  }, [activeTerminalTabId, terminalTabs]);

  // Listen for storage events (cross-tab sync)
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "promptArchitect_cliStatusLogs") {
        setCliStatusLogs(loadCliStatusLogs());
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const handleCLIDetection = useCallback(
    (tabId: string, detection: CLIStatusDetection) => {
      const shouldLog =
        detection.reason !== "carryover" ||
        detection.status !== detection.previousStatus;

      if (!shouldLog) {
        return;
      }

      const entry: CLIStatusLogEntry = {
        ...detection,
        id: crypto.randomUUID(),
        tabId,
        timestamp: Date.now(),
        statusChanged: detection.status !== detection.previousStatus,
        lastLine: truncateLogText(detection.lastLine, 400),
        recentOutput: truncateLogText(detection.recentOutput, 1200),
      };

      setCliStatusLogs((prev) => {
        const next = trimCliStatusLogs([entry, ...prev]);
        saveCliStatusLogs(next);
        return next;
      });
    },
    []
  );

  // Manage CLI Status Trackers for each terminal tab
  useEffect(() => {
    const currentTrackers = cliStatusTrackersRef.current;
    const currentTabIds = new Set(terminalTabs.map((tab) => tab.id));

    // Remove trackers for deleted tabs
    currentTrackers.forEach((tracker, tabId) => {
      if (!currentTabIds.has(tabId)) {
        tracker.destroy();
        currentTrackers.delete(tabId);
        setTerminalCLIStatus((prev) => {
          const next = new Map(prev);
          next.delete(tabId);
          return next;
        });
      }
    });

    // Create trackers for new tabs
    terminalTabs.forEach((tab) => {
      if (!currentTrackers.has(tab.id)) {
        const tracker = new CLIStatusTracker(
          (status) => {
            setTerminalCLIStatus((prev) => {
              const next = new Map(prev);
              next.set(tab.id, status);
              return next;
            });
          },
          (detection) => handleCLIDetection(tab.id, detection)
        );
        currentTrackers.set(tab.id, tracker);
        setTerminalCLIStatus((prev) => {
          const next = new Map(prev);
          next.set(tab.id, "question");
          return next;
        });
      }
    });

    return () => {
      // Cleanup on unmount
      currentTrackers.forEach((tracker) => tracker.destroy());
      currentTrackers.clear();
    };
  }, [handleCLIDetection, terminalTabs]);

  const clearTerminalWaiting = useCallback((tabId: string) => {
    setTerminalWaitingTabs((prev) => {
      if (!prev.has(tabId)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(tabId);
      return next;
    });
  }, []);

  const setTerminalSessionPath = useCallback((tabId: string, path: string) => {
    const trimmed = path.trim();
    setTerminalSessionPaths((prev) => {
      const next = new Map(prev);
      if (!trimmed) {
        next.delete(tabId);
        return next;
      }
      next.set(tabId, trimmed);
      return next;
    });
  }, []);

  const handleTerminalOutput = useCallback(
    (tabId: string, data: string) => {
      clearTerminalWaiting(tabId);

      const tracker = cliStatusTrackersRef.current.get(tabId);
      if (tracker) {
        tracker.addOutput(data);
      } else {
        console.warn(`No CLI status tracker found for tab ${tabId}`);
      }
    },
    [clearTerminalWaiting]
  );

  const createTerminalTab = useCallback(
    (title?: string, type?: "terminal" | "claude") => {
      const id = crypto.randomUUID();
      setTerminalTabs((prev) => [
        ...prev,
        {
          id,
          title:
            title ??
            `${type === "claude" ? "Claude Session" : "Terminal"} ${prev.length + 1}`,
          type: type || "terminal",
        },
      ]);
      setActiveTerminalTabId(id);
      setTerminalOpen(true);
      return id;
    },
    []
  );

  const handleSelectTerminalTab = useCallback((tab: TerminalTab) => {
    setActiveTerminalTabId(tab.id);
    setTerminalOpen(true);
  }, []);

  const handleNewTerminalTab = useCallback(() => {
    createTerminalTab();
  }, [createTerminalTab]);

  const handleRenameTerminalTab = useCallback(
    (tabId: string, title: string) => {
      setTerminalTabs((prev) =>
        prev.map((tab) => (tab.id === tabId ? { ...tab, title } : tab))
      );
    },
    []
  );

  const handleCloseTerminalTab = useCallback(
    (tabId: string) => {
      setTerminalWaitingTabs((prev) => {
        if (!prev.has(tabId)) {
          return prev;
        }
        const next = new Set(prev);
        next.delete(tabId);
        return next;
      });
      setTerminalSessionPaths((prev) => {
        if (!prev.has(tabId)) {
          return prev;
        }
        const next = new Map(prev);
        next.delete(tabId);
        return next;
      });
      setTerminalTabs((prev) => {
        const nextTabs = prev.filter((tab) => tab.id !== tabId);
        if (nextTabs.length === 0) {
          setActiveTerminalTabId(null);
          return [];
        }
        if (activeTerminalTabId === tabId) {
          setActiveTerminalTabId(nextTabs[0].id);
        }
        return nextTabs;
      });
    },
    [activeTerminalTabId]
  );

  const handleClaudeStatusChange = useCallback(
    (tabId: string, status: CLIStatus) => {
      setTerminalCLIStatus((prev) => {
        const next = new Map(prev);
        next.set(tabId, status);
        return next;
      });
    },
    []
  );

  const clearCliStatusLogs = useCallback(() => {
    setCliStatusLogs([]);
    saveCliStatusLogs([]);
  }, []);

  return {
    terminalTabs,
    activeTerminalTabId,
    terminalWaitingTabs,
    terminalCLIStatus,
    terminalSessionPaths,
    cliStatusLogs,
    setActiveTerminalTabId,
    createTerminalTab,
    setTerminalSessionPath,
    handleSelectTerminalTab,
    handleNewTerminalTab,
    handleCloseTerminalTab,
    handleRenameTerminalTab,
    handleTerminalOutput,
    handleClaudeStatusChange,
    clearCliStatusLogs,
    setTerminalOpen,
    terminalOpen,
  };
}
