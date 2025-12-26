import React, { useState, useEffect, useCallback, useRef } from "react";
import { Sidebar } from "./components/Sidebar";
import { PromptEditor } from "./components/PromptEditor";
import { ChatAssistant } from "./components/ChatAssistant";
import {
  PromptTemplate,
  SavedPrompt,
  ChatMessage,
  TerminalTab,
  CLIStatus,
  CLIStatusDetection,
  CLIStatusLogEntry,
} from "./types";
import { createChatSession, sendMessageStream } from "./services/geminiService";
import { Chat } from "@google/genai";
import { Menu } from "lucide-react";
import { resolvePromptRefs, generateTitleFromContent } from "./utils";
import { TerminalPanel } from "./components/TerminalPanel";
import { CodexSettingsPanel } from "./components/CodexSettings";
import { DEFAULT_CODEX_SETTINGS, coerceCodexSettings } from "./codexSettings";
import { DEFAULT_CLAUDE_SETTINGS, coerceClaudeSettings } from "./claudeSettings";
import { ClaudeSettings, CodexSettings } from "./types";
import {
  Group,
  Panel as ResizablePanel,
  Separator,
  type GroupImperativeHandle,
  type Layout,
} from "react-resizable-panels";
import { usePanelContext } from "./contexts/PanelContext";
import { CLIStatusTracker } from "./utils/cliStatusDetector";
import { IndicationLogsPanel } from "./components/IndicationLogsPanel";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { isTauri } from "@tauri-apps/api/core";
// import { UpdaterDialog } from "./components/UpdaterDialog";
import {
  loadCliStatusLogs,
  saveCliStatusLogs,
  trimCliStatusLogs,
  truncateLogText,
} from "./utils/cliStatusLogs";
import {
  loadLayoutSnapshot,
  loadWindowSize,
  saveLayoutSnapshot,
  saveWindowSize,
  type LayoutSnapshot,
} from "./utils/appSettings";

// Default Templates
const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    id: "t1",
    name: "Chain of Thought",
    category: "technique",
    content: `Let's think step by step.
1. First, analyze the request.
2. Second, break down the problem into sub-components.
3. Third, solve each component.
4. Finally, synthesize the answer.

Request: {{request}}`,
  },
  {
    id: "t2",
    name: "Persona: Senior Engineer",
    category: "user",
    content: `Act as a world-class Senior Software Engineer. You value clean, maintainable code, adhere to SOLID principles, and prioritize performance.
    
Task: {{task}}`,
  },
  {
    id: "t3",
    name: "Few-Shot Learning",
    category: "technique",
    content: `Classify the sentiment of the text.

Text: "I loved the movie!"
Sentiment: Positive

Text: "The food was terrible."
Sentiment: Negative

Text: "{{text}}"
Sentiment:`,
  },
  {
    id: "t4",
    name: "Review & Critique",
    category: "technique",
    content: `Review the following content for errors, logical fallacies, and clarity improvements. Provide a bulleted list of constructive feedback.

Content:
"""
{{content}}
"""`,
  },
];

const App: React.FC = () => {
  // State
  const [promptContent, setPromptContent] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [customTemplates, setCustomTemplates] = useState<PromptTemplate[]>([]);
  const [modifiedDefaultTemplates, setModifiedDefaultTemplates] = useState<
    PromptTemplate[]
  >([]);
  const [deletedDefaultTemplateIds, setDeletedDefaultTemplateIds] = useState<
    Set<string>
  >(new Set());
  const [archivedTemplates, setArchivedTemplates] = useState<PromptTemplate[]>(
    []
  );
  const [archivedPrompts, setArchivedPrompts] = useState<SavedPrompt[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false); // Default to closed for cleaner UI
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalTabs, setTerminalTabs] = useState<TerminalTab[]>(() => []);
  const [activeTerminalTabId, setActiveTerminalTabId] = useState<string | null>(
    null
  );
  const [terminalWaitingTabs, setTerminalWaitingTabs] = useState<Set<string>>(
    new Set()
  );
  const [terminalCLIStatus, setTerminalCLIStatus] = useState<Map<string, CLIStatus>>(
    new Map()
  );
  const [indicationLogsOpen, setIndicationLogsOpen] = useState(false);
  const [cliStatusLogs, setCliStatusLogs] = useState<CLIStatusLogEntry[]>(() =>
    loadCliStatusLogs()
  );
  const [activeView, setActiveView] = useState<"editor" | "settings">("editor");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    "saved"
  );
  const [codexSettings, setCodexSettings] = useState<CodexSettings>(
    DEFAULT_CODEX_SETTINGS
  );
  const [claudeSettings, setClaudeSettings] = useState<ClaudeSettings>(
    DEFAULT_CLAUDE_SETTINGS
  );

  // Active Prompt State
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState<string>("");
  const [isTemplate, setIsTemplate] = useState<boolean>(false);

  // Refs
  const chatSessionRef = useRef<Chat | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cliStatusTrackersRef = useRef<Map<string, CLIStatusTracker>>(new Map());
  const mainGroupRef = useRef<GroupImperativeHandle | null>(null);
  const verticalGroupRef = useRef<GroupImperativeHandle | null>(null);
  const layoutSnapshotRef = useRef<LayoutSnapshot>({ main: {}, vertical: {} });
  const layoutSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const windowSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [layoutLoaded, setLayoutLoaded] = useState(false);

  useEffect(() => {
    if (!activeTerminalTabId && terminalTabs.length > 0) {
      setActiveTerminalTabId(terminalTabs[0].id);
    }
  }, [activeTerminalTabId, terminalTabs]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'promptArchitect_cliStatusLogs') {
        setCliStatusLogs(loadCliStatusLogs());
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const scheduleLayoutSave = useCallback(() => {
    if (layoutSaveTimerRef.current) {
      clearTimeout(layoutSaveTimerRef.current);
    }
    layoutSaveTimerRef.current = setTimeout(() => {
      void saveLayoutSnapshot(layoutSnapshotRef.current);
    }, 400);
  }, []);

  const handleMainLayoutChange = useCallback(
    (layout: Layout) => {
      layoutSnapshotRef.current = {
        ...layoutSnapshotRef.current,
        main: layout,
      };
      if (layoutLoaded) {
        scheduleLayoutSave();
      }
    },
    [layoutLoaded, scheduleLayoutSave]
  );

  const handleVerticalLayoutChange = useCallback(
    (layout: Layout) => {
      layoutSnapshotRef.current = {
        ...layoutSnapshotRef.current,
        vertical: layout,
      };
      if (layoutLoaded) {
        scheduleLayoutSave();
      }
    },
    [layoutLoaded, scheduleLayoutSave]
  );

  useEffect(() => {
    let cancelled = false;

    const restoreLayoutAndWindow = async () => {
      const [storedLayout, storedWindow] = await Promise.all([
        loadLayoutSnapshot(),
        loadWindowSize(),
      ]);

      if (cancelled) {
        return;
      }

      if (storedLayout) {
        layoutSnapshotRef.current = storedLayout;
      }

      if (storedWindow && isTauri()) {
        const appWindow = getCurrentWindow();
        await appWindow.setSize(
          new LogicalSize(storedWindow.width, storedWindow.height)
        );
      }

      setLayoutLoaded(true);
    };

    void restoreLayoutAndWindow();

    return () => {
      cancelled = true;
      if (layoutSaveTimerRef.current) {
        clearTimeout(layoutSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!layoutLoaded) {
      return;
    }

    const applyStoredLayout = (
      groupRef: React.RefObject<GroupImperativeHandle | null>,
      storedLayout: Layout,
      key: keyof LayoutSnapshot
    ) => {
      const group = groupRef.current;
      if (!group) {
        return;
      }

      const current = group.getLayout();
      if (Object.keys(storedLayout).length === 0) {
        layoutSnapshotRef.current = {
          ...layoutSnapshotRef.current,
          [key]: current,
        };
        scheduleLayoutSave();
        return;
      }

      const filtered = Object.fromEntries(
        Object.entries(storedLayout).filter(([panelId]) => panelId in current)
      );

      const merged = { ...current, ...filtered };
      group.setLayout(merged);
      layoutSnapshotRef.current = {
        ...layoutSnapshotRef.current,
        [key]: merged,
      };
    };

    applyStoredLayout(mainGroupRef, layoutSnapshotRef.current.main, 'main');
    applyStoredLayout(verticalGroupRef, layoutSnapshotRef.current.vertical, 'vertical');
  }, [layoutLoaded, scheduleLayoutSave]);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let unlisten: (() => void) | null = null;

    const handleResize = async () => {
      const appWindow = getCurrentWindow();
      unlisten = await appWindow.onResized(({ payload }) => {
        if (windowSaveTimerRef.current) {
          clearTimeout(windowSaveTimerRef.current);
        }
        windowSaveTimerRef.current = setTimeout(() => {
          void saveWindowSize({
            width: payload.width,
            height: payload.height,
          });
        }, 250);
      });
    };

    void handleResize();

    return () => {
      unlisten?.();
      if (windowSaveTimerRef.current) {
        clearTimeout(windowSaveTimerRef.current);
      }
    };
  }, []);

  const handleCLIDetection = useCallback(
    (tabId: string, detection: CLIStatusDetection) => {
      const shouldLog =
        detection.reason !== 'carryover' ||
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
    const currentTabIds = new Set(terminalTabs.map(tab => tab.id));

    // Remove trackers for deleted tabs
    currentTrackers.forEach((tracker, tabId) => {
      if (!currentTabIds.has(tabId)) {
        tracker.destroy();
        currentTrackers.delete(tabId);
        setTerminalCLIStatus(prev => {
          const next = new Map(prev);
          next.delete(tabId);
          return next;
        });
      }
    });

    // Create trackers for new tabs
    terminalTabs.forEach(tab => {
      if (!currentTrackers.has(tab.id)) {
        const tracker = new CLIStatusTracker(
          (status) => {
            setTerminalCLIStatus(prev => {
              const next = new Map(prev);
              next.set(tab.id, status);
              return next;
            });
          },
          (detection) => handleCLIDetection(tab.id, detection),
        );
        currentTrackers.set(tab.id, tracker);
        setTerminalCLIStatus(prev => {
          const next = new Map(prev);
          next.set(tab.id, 'question');
          return next;
        });
      }
    });

    return () => {
      // Cleanup on unmount
      currentTrackers.forEach(tracker => tracker.destroy());
      currentTrackers.clear();
    };
  }, [handleCLIDetection, terminalTabs]);

  // Initial Load
  useEffect(() => {
    // 1. Load Saved Prompts List
    const storedPrompts = localStorage.getItem("savedPrompts");
    if (storedPrompts) {
      try {
        setSavedPrompts(JSON.parse(storedPrompts));
      } catch (e) {
        console.error("Failed to parse saved prompts", e);
      }
    }

    // Load Custom Templates
    const storedTemplates = localStorage.getItem(
      "promptArchitect_customTemplates"
    );
    if (storedTemplates) {
      try {
        setCustomTemplates(JSON.parse(storedTemplates));
      } catch (e) {
        console.error("Failed to parse custom templates", e);
      }
    }

    // Load Modified Default Templates
    const storedModifiedDefaults = localStorage.getItem(
      "promptArchitect_modifiedDefaultTemplates"
    );
    if (storedModifiedDefaults) {
      try {
        setModifiedDefaultTemplates(JSON.parse(storedModifiedDefaults));
      } catch (e) {
        console.error("Failed to parse modified default templates", e);
      }
    }

    // Load Deleted Default Template IDs
    const storedDeletedDefaults = localStorage.getItem(
      "promptArchitect_deletedDefaultTemplates"
    );
    if (storedDeletedDefaults) {
      try {
        const deletedIds = JSON.parse(storedDeletedDefaults);
        setDeletedDefaultTemplateIds(new Set(deletedIds));
      } catch (e) {
        console.error("Failed to parse deleted default templates", e);
      }
    }

    // Load Archived Templates
    const storedArchivedTemplates = localStorage.getItem(
      "promptArchitect_archivedTemplates"
    );
    if (storedArchivedTemplates) {
      try {
        setArchivedTemplates(JSON.parse(storedArchivedTemplates));
      } catch (e) {
        console.error("Failed to parse archived templates", e);
      }
    }

    // Load Archived Prompts
    const storedArchivedPrompts = localStorage.getItem(
      "promptArchitect_archivedPrompts"
    );
    if (storedArchivedPrompts) {
      try {
        setArchivedPrompts(JSON.parse(storedArchivedPrompts));
      } catch (e) {
        console.error("Failed to parse archived prompts", e);
      }
    }

    // 2. Load Current Draft (Work in Progress)
    const storedDraft = localStorage.getItem("promptArchitect_draft");
    if (storedDraft) {
      try {
        const {
          content,
          activeId,
          activeTemplateId: storedTemplateId,
          title,
          isTemplate: storedIsTemplate,
        } = JSON.parse(storedDraft);
        setPromptContent(content || "");
        setActivePromptId(activeId || null);
        // Prevent both being set; prompt takes precedence
        setActiveTemplateId(activeId ? null : storedTemplateId || null);
        setDraftTitle(title || "");
        setIsTemplate(activeId ? false : Boolean(storedTemplateId || storedIsTemplate));
      } catch (e) {
        console.error("Failed to parse draft", e);
      }
    }

    // 3. Initialize Chat
    chatSessionRef.current = createChatSession();
  }, []);

  useEffect(() => {
    const storedSettings = localStorage.getItem("promptArchitect_codexSettings");
    if (storedSettings) {
      try {
        setCodexSettings(coerceCodexSettings(JSON.parse(storedSettings)));
      } catch (e) {
        console.error("Failed to parse codex settings", e);
      }
    }
  }, []);

  useEffect(() => {
    const storedSettings = localStorage.getItem("promptArchitect_claudeSettings");
    if (storedSettings) {
      try {
        setClaudeSettings(coerceClaudeSettings(JSON.parse(storedSettings)));
      } catch (e) {
        console.error("Failed to parse claude settings", e);
      }
    }
  }, []);

  // Persist Saved Prompts List
  useEffect(() => {
    localStorage.setItem("savedPrompts", JSON.stringify(savedPrompts));
  }, [savedPrompts]);

  // Persist Custom Templates
  useEffect(() => {
    localStorage.setItem(
      "promptArchitect_customTemplates",
      JSON.stringify(customTemplates)
    );
  }, [customTemplates]);

  // Persist Modified Default Templates
  useEffect(() => {
    localStorage.setItem(
      "promptArchitect_modifiedDefaultTemplates",
      JSON.stringify(modifiedDefaultTemplates)
    );
  }, [modifiedDefaultTemplates]);

  // Persist Deleted Default Template IDs
  useEffect(() => {
    localStorage.setItem(
      "promptArchitect_deletedDefaultTemplates",
      JSON.stringify(Array.from(deletedDefaultTemplateIds))
    );
  }, [deletedDefaultTemplateIds]);

  // Persist Archived Templates
  useEffect(() => {
    localStorage.setItem(
      "promptArchitect_archivedTemplates",
      JSON.stringify(archivedTemplates)
    );
  }, [archivedTemplates]);

  // Persist Archived Prompts
  useEffect(() => {
    localStorage.setItem(
      "promptArchitect_archivedPrompts",
      JSON.stringify(archivedPrompts)
    );
  }, [archivedPrompts]);

  useEffect(() => {
    localStorage.setItem(
      "promptArchitect_codexSettings",
      JSON.stringify(codexSettings)
    );
  }, [codexSettings]);

  useEffect(() => {
    localStorage.setItem(
      "promptArchitect_claudeSettings",
      JSON.stringify(claudeSettings)
    );
  }, [claudeSettings]);

  const createNewPrompt = useCallback((content: string, title?: string) => {
    const resolvedTitle =
      title?.trim() ||
      (content.trim().length > 0
        ? generateTitleFromContent(content)
        : "Untitled Prompt");
    const newId = crypto.randomUUID();
    const newPrompt: SavedPrompt = {
      id: newId,
      title: resolvedTitle,
      content,
      updatedAt: Date.now(),
    };
    setSavedPrompts((prev) => [newPrompt, ...prev]);
    setActivePromptId(newId);
    setActiveTemplateId(null);
    setIsTemplate(false);
    setDraftTitle(resolvedTitle);
    setSaveStatus("saved");
  }, []);

  // Autosave Draft (Local Work in Progress) & Continuous Save for Existing Prompts
  useEffect(() => {
    // Always save draft state to LS immediately
    const draftState = {
      content: promptContent,
      activeId: activePromptId,
      activeTemplateId,
      title: draftTitle,
      isTemplate,
    };
    localStorage.setItem("promptArchitect_draft", JSON.stringify(draftState));

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    // If we are editing an EXISTING Saved Prompt, auto-update the record
    if (activePromptId) {
      setSaveStatus("saving");

      autoSaveTimerRef.current = setTimeout(() => {
        setSavedPrompts((prev) =>
          prev.map((p) =>
            p.id === activePromptId
              ? { ...p, content: promptContent, updatedAt: Date.now() }
              : p
          )
        );
        setSaveStatus("saved");
      }, 1000); // 1 second debounce
    } else if (activeTemplateId) {
      setSaveStatus("saving");

      autoSaveTimerRef.current = setTimeout(() => {
        let updatedCustom = false;

        setCustomTemplates((prev) => {
          const idx = prev.findIndex((t) => t.id === activeTemplateId);
          if (idx !== -1) {
            updatedCustom = true;
            const next = [...prev];
            const existing = next[idx];
            next[idx] = {
              ...existing,
              name: draftTitle || existing.name,
              content: promptContent,
            };
            return next;
          }
          return prev;
        });

        if (!updatedCustom) {
          setModifiedDefaultTemplates((prev) => {
            const baseTemplate =
              prev.find((t) => t.id === activeTemplateId) ||
              DEFAULT_TEMPLATES.find((t) => t.id === activeTemplateId);

            if (!baseTemplate) return prev;

            const updatedTemplate = {
              ...baseTemplate,
              name: draftTitle || baseTemplate.name,
              content: promptContent,
            };

            const idx = prev.findIndex((t) => t.id === activeTemplateId);
            if (idx !== -1) {
              const next = [...prev];
              next[idx] = updatedTemplate;
              return next;
            }
            return [...prev, updatedTemplate];
          });
        }

        setSaveStatus("saved");
      }, 1000);
    } else if (!isTemplate && promptContent.trim().length > 0) {
      createNewPrompt(promptContent);
    } else {
      setSaveStatus("saved");
    }

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [
    promptContent,
    activePromptId,
    activeTemplateId,
    draftTitle,
    isTemplate,
    createNewPrompt,
  ]);

  const mergedDefaultTemplates = DEFAULT_TEMPLATES.filter(
    (t) => !deletedDefaultTemplateIds.has(t.id)
  ).map((t) => {
    const override = modifiedDefaultTemplates.find((m) => m.id === t.id);
    return override ? { ...t, ...override } : t;
  });

  const allTemplates = [...mergedDefaultTemplates, ...customTemplates];

  // Handlers
  const handleSelectTerminalTab = (tab: TerminalTab) => {
    setActiveTerminalTabId(tab.id);
    setTerminalOpen(true);
  };

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

  const handleTerminalOutput = useCallback((tabId: string, data: string) => {
    // Clear the waiting indicator
    clearTerminalWaiting(tabId);

    // Feed output to CLI status tracker
    const tracker = cliStatusTrackersRef.current.get(tabId);
    if (tracker) {
      tracker.addOutput(data);
    } else {
      console.warn(`No CLI status tracker found for tab ${tabId}`);
    }
  }, [clearTerminalWaiting]);

  const createTerminalTab = useCallback((title?: string) => {
    const id = crypto.randomUUID();
    setTerminalTabs((prev) => [
      ...prev,
      {
        id,
        title: title ?? `Terminal ${prev.length + 1}`,
      },
    ]);
    setActiveTerminalTabId(id);
    setTerminalOpen(true);
    return id;
  }, []);

  const handleNewTerminalTab = () => {
    createTerminalTab();
  };

  const handleRenameTerminalTab = useCallback((tabId: string, title: string) => {
    setTerminalTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, title } : tab))
    );
  }, []);

  const handleCloseTerminalTab = (tabId: string) => {
    setTerminalWaitingTabs((prev) => {
      if (!prev.has(tabId)) {
        return prev;
      }
      const next = new Set(prev);
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
  };

  const handleSelectTemplate = (template: PromptTemplate) => {
    // Templates are starting points - allow free switching without alerts
    setPromptContent(template.content);
    setDraftTitle(template.name);
    setActivePromptId(null);
    setActiveTemplateId(template.id);
    setSaveStatus("saved");
    setIsTemplate(true);
    // Ensure on mobile or small screens we don't need to close anything manually
  };

  const handleTitleChange = (newTitle: string) => {
    if (activePromptId) {
      // Update immediately for saved prompts
      setSavedPrompts((prev) =>
        prev.map((p) =>
          p.id === activePromptId
            ? { ...p, title: newTitle, updatedAt: Date.now() }
            : p
        )
      );
    } else if (activeTemplateId) {
      setDraftTitle(newTitle);
      let updatedCustom = false;

      setCustomTemplates((prev) => {
        const idx = prev.findIndex((t) => t.id === activeTemplateId);
        if (idx !== -1) {
          updatedCustom = true;
          const next = [...prev];
          const existing = next[idx];
          next[idx] = { ...existing, name: newTitle || existing.name };
          return next;
        }
        return prev;
      });

      if (!updatedCustom) {
        setModifiedDefaultTemplates((prev) => {
          const baseTemplate =
            prev.find((t) => t.id === activeTemplateId) ||
            DEFAULT_TEMPLATES.find((t) => t.id === activeTemplateId);

          if (!baseTemplate) return prev;

          const updated = { ...baseTemplate, name: newTitle || baseTemplate.name };
          const idx = prev.findIndex((t) => t.id === activeTemplateId);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = updated;
            return next;
          }
          return [...prev, updated];
        });
      }
      setSaveStatus("saving");
    } else {
      setDraftTitle(newTitle);
    }
  };

  const handleDeleteSavedPrompt = (id: string) => {
    const prompt = savedPrompts.find((p) => p.id === id);
    if (prompt && confirm("Archive this prompt?")) {
      setArchivedPrompts((prev) => [...prev, prompt]);
      setSavedPrompts((prev) => prev.filter((p) => p.id !== id));
      if (activePromptId === id) {
        setActivePromptId(null);
        setPromptContent("");
        setDraftTitle("");
        setSaveStatus("saved");
      }
    }
  };

  const handleDeleteTemplate = (id: string) => {
    const templateToArchive = allTemplates.find((t) => t.id === id);
    if (!templateToArchive) return;

    const isCustom = templateToArchive.category === "custom";
    const confirmMessage = isCustom
      ? "Archive this custom template?"
      : "Archive this default template?";

    if (!confirm(confirmMessage)) return;

    setArchivedTemplates((prev) => [...prev, templateToArchive]);

    if (isCustom) {
      setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
    } else {
      setDeletedDefaultTemplateIds((prev) => new Set([...prev, id]));
      setModifiedDefaultTemplates((prev) => prev.filter((t) => t.id !== id));
    }

    if (activeTemplateId === id) {
      setActiveTemplateId(null);
      setPromptContent("");
      setDraftTitle("");
      setSaveStatus("saved");
      setIsTemplate(false);
    }
  };

  const handleRestoreTemplate = (template: PromptTemplate) => {
    if (template.category === "custom") {
      setCustomTemplates((prev) => [...prev, template]);
    } else {
      setDeletedDefaultTemplateIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(template.id);
        return newSet;
      });
      setModifiedDefaultTemplates((prev) => {
        const idx = prev.findIndex((t) => t.id === template.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = template;
          return next;
        }
        return [...prev, template];
      });
    }
    setArchivedTemplates((prev) => prev.filter((t) => t.id !== template.id));
  };

  const handleRestorePrompt = (prompt: SavedPrompt) => {
    setSavedPrompts((prev) => [prompt, ...prev]);
    setArchivedPrompts((prev) => prev.filter((p) => p.id !== prompt.id));
  };

  const handleDuplicatePrompt = (prompt: SavedPrompt) => {
    const newId = crypto.randomUUID();
    const duplicatedPrompt: SavedPrompt = {
      id: newId,
      title: `${prompt.title} (Copy)`,
      content: prompt.content,
      updatedAt: Date.now(),
    };
    setSavedPrompts((prev) => [duplicatedPrompt, ...prev]);
    // Optionally open the duplicated prompt
    setPromptContent(duplicatedPrompt.content);
    setActivePromptId(newId);
    setActiveTemplateId(null);
    setIsTemplate(false);
    setDraftTitle(duplicatedPrompt.title);
  };

  const handleDuplicateTemplate = (template: PromptTemplate) => {
    const newId = crypto.randomUUID();
    const duplicatedTemplate: PromptTemplate = {
      id: newId,
      name: `${template.name} (Copy)`,
      content: template.content,
      category: "custom", // Duplicated templates are always custom
    };
    setCustomTemplates((prev) => [duplicatedTemplate, ...prev]);
    // Optionally open the duplicated template
    setPromptContent(duplicatedTemplate.content);
    setActiveTemplateId(newId);
    setActivePromptId(null);
    setIsTemplate(true);
    setDraftTitle(duplicatedTemplate.name);
  };

  const handleSelectSavedPrompt = (prompt: SavedPrompt) => {
    setPromptContent(prompt.content);
    setActivePromptId(prompt.id);
    setActiveTemplateId(null);
    setIsTemplate(false);
  };

  const handleNewPrompt = () => {
    setPromptContent("");
    createNewPrompt("", "Untitled Prompt");
  };

  const handleSendMessage = async (text: string) => {
    setChatLoading(true);
    const userMsgId = crypto.randomUUID();
    const botMsgId = crypto.randomUUID();

    const userMessage: ChatMessage = {
      id: userMsgId,
      role: "user",
      text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      if (!chatSessionRef.current) {
        chatSessionRef.current = createChatSession();
      }

      const stream = await sendMessageStream(chatSessionRef.current, text);

      setMessages((prev) => [
        ...prev,
        {
          id: botMsgId,
          role: "model",
          text: "",
          timestamp: Date.now(),
        },
      ]);

      let accumulatedText = "";
      for await (const chunk of stream) {
        const chunkText = chunk.text || "";
        accumulatedText += chunkText;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId ? { ...m, text: accumulatedText } : m
          )
        );
      }
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "model",
          text: "I'm having trouble connecting right now. Please try again.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleImproveSelection = useCallback(
    (selection: string) => {
      if (!chatOpen) setChatOpen(true);

      const expandedSelection = resolvePromptRefs(
        selection,
        allTemplates,
        savedPrompts
      );

      const contextMessage = `I'm working on this specific part of my prompt:
    
"""
${expandedSelection}
"""

How can I improve this snippet?`;
      handleSendMessage(contextMessage);
    },
    [chatOpen, savedPrompts, allTemplates]
  );

  const activePrompt = savedPrompts.find((p) => p.id === activePromptId);
  const activeTemplate = allTemplates.find((t) => t.id === activeTemplateId);
  const currentDisplayTitle = activePrompt
    ? activePrompt.title
    : activeTemplate
    ? activeTemplate.name
    : draftTitle;

  const sidebarContent = (
    <Sidebar
      isOpen={true}
      templates={allTemplates}
      savedPrompts={savedPrompts}
      archivedTemplates={archivedTemplates}
      archivedPrompts={archivedPrompts}
      terminalTabs={terminalTabs}
      waitingTerminalTabIds={terminalWaitingTabs}
      terminalCLIStatus={terminalCLIStatus}
      activeTerminalTabId={activeTerminalTabId}
      activePromptId={activePromptId}
      activeTemplateId={activeTemplateId}
      showArchive={showArchive}
      onSelectTerminalTab={handleSelectTerminalTab}
      onNewTerminalTab={handleNewTerminalTab}
      onCloseTerminalTab={handleCloseTerminalTab}
      onRenameTerminalTab={handleRenameTerminalTab}
      onSelectTemplate={handleSelectTemplate}
      onDeleteTemplate={handleDeleteTemplate}
      onDuplicateTemplate={handleDuplicateTemplate}
      onSelectSavedPrompt={handleSelectSavedPrompt}
      onDeleteSavedPrompt={handleDeleteSavedPrompt}
      onDuplicatePrompt={handleDuplicatePrompt}
      onRestoreTemplate={handleRestoreTemplate}
      onRestorePrompt={handleRestorePrompt}
      onToggleArchive={() => setShowArchive(!showArchive)}
      onNewPrompt={handleNewPrompt}
      activeView={activeView}
      onOpenSettings={() =>
        setActiveView((prev) => (prev === "settings" ? "editor" : "settings"))
      }
    />
  );

  const mainContent = activeView === "settings" ? (
    <CodexSettingsPanel
      settings={codexSettings}
      claudeSettings={claudeSettings}
      onChange={setCodexSettings}
      onClaudeChange={setClaudeSettings}
      onClose={() => setActiveView("editor")}
      onReset={() => {
        setCodexSettings(DEFAULT_CODEX_SETTINGS);
        setClaudeSettings(DEFAULT_CLAUDE_SETTINGS);
      }}
    />
  ) : (
    <PromptEditor
      value={promptContent}
      activeTitle={currentDisplayTitle}
      saveStatus={saveStatus}
      onChange={setPromptContent}
      onTitleChange={handleTitleChange}
      onImproveSelection={handleImproveSelection}
      templates={allTemplates}
      savedPrompts={savedPrompts}
      isChatOpen={chatOpen}
      onRequestTerminal={createTerminalTab}
      promptTitle={currentDisplayTitle}
      activeTerminalTabId={activeTerminalTabId}
      codexSettings={codexSettings}
      claudeSettings={claudeSettings}
      isTemplate={isTemplate}
      onToggleTemplate={() => setIsTemplate(!isTemplate)}
    />
  );

  const { detachPanel, isDetached } = usePanelContext();

  const handleDetachTerminal = async () => {
    await detachPanel('terminal');
    setTerminalOpen(false);
  };

  const handleDetachIndicationLogs = async () => {
    await detachPanel('indication-logs');
    setIndicationLogsOpen(false);
  };

  const terminalContent = (
    <TerminalPanel
      tabs={terminalTabs}
      activeTabId={activeTerminalTabId}
      onTerminalOutput={handleTerminalOutput}
      onPopOut={handleDetachTerminal}
      onToggleLogs={() => setIndicationLogsOpen((prev) => !prev)}
      logsOpen={indicationLogsOpen}
      isDetached={isDetached('terminal')}
      cliStatus={activeTerminalTabId ? (terminalCLIStatus.get(activeTerminalTabId) || 'question') : 'question'}
      onRenameTab={handleRenameTerminalTab}
    />
  );

  return (
    <div className="h-screen bg-black overflow-hidden">
      <Group
        orientation="horizontal"
        id="desktop-prompter-main-layout"
        className="h-full"
        groupRef={mainGroupRef}
        onLayoutChange={handleMainLayoutChange}
      >
        {/* Sidebar Panel */}
        {sidebarOpen && (
          <>
            <ResizablePanel
              id="sidebar"
              defaultSize="20%"
              minSize="15%"
              maxSize="40%"
              collapsible={true}
            >
              <div className="h-full bg-zinc-900 border-r border-zinc-800">
                {sidebarContent}
              </div>
            </ResizablePanel>
            <Separator className="w-1 bg-zinc-800 hover:bg-indigo-500 transition-colors cursor-col-resize" />
          </>
        )}

        {/* Main Content Panel */}
        <ResizablePanel id="main-content" minSize="30%">
          <div className="h-full flex flex-col relative">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="absolute top-4 left-4 z-20 p-2 bg-zinc-800 rounded-md text-zinc-400 hover:text-white"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <Group
              orientation="vertical"
              id="desktop-prompter-vertical-layout"
              className="h-full"
              groupRef={verticalGroupRef}
              onLayoutChange={handleVerticalLayoutChange}
            >
              {/* Editor Panel */}
              <ResizablePanel id="editor" minSize="20%">
                <div className="h-full bg-zinc-950">{mainContent}</div>
              </ResizablePanel>

              {terminalOpen && (
                <>
                  <Separator className="h-1 bg-zinc-800 hover:bg-indigo-500 transition-colors cursor-row-resize" />
                  {/* Terminal Panel */}
                  <ResizablePanel
                    id="terminal"
                    defaultSize="30%"
                    minSize="10%"
                    maxSize="70%"
                    collapsible={true}
                  >
                    <div className="h-full bg-zinc-950 border-t border-zinc-800">
                      {terminalContent}
                    </div>
                  </ResizablePanel>
                </>
              )}

              {indicationLogsOpen && (
                <>
                  <Separator className="h-1 bg-zinc-800 hover:bg-indigo-500 transition-colors cursor-row-resize" />
                  <ResizablePanel
                    id="indication-logs"
                    defaultSize="25%"
                    minSize="10%"
                    maxSize="60%"
                    collapsible={true}
                  >
                    <div className="h-full bg-zinc-950 border-t border-zinc-800">
                      <IndicationLogsPanel
                        logs={cliStatusLogs}
                        onClear={() => {
                          setCliStatusLogs([]);
                          saveCliStatusLogs([]);
                        }}
                        onClose={() => setIndicationLogsOpen(false)}
                        onPopOut={handleDetachIndicationLogs}
                        isDetached={isDetached('indication-logs')}
                      />
                    </div>
                  </ResizablePanel>
                </>
              )}
            </Group>
          </div>
        </ResizablePanel>

        {/* Chat Assistant Panel (Right Column) */}
        {chatOpen && (
          <>
            <Separator className="w-1 bg-zinc-800 hover:bg-indigo-500 transition-colors cursor-col-resize" />
            <ResizablePanel
              id="chat"
              defaultSize="25%"
              minSize="15%"
              maxSize="50%"
              collapsible={true}
            >
              <div className="h-full bg-zinc-900 border-l border-zinc-800">
                <ChatAssistant
                  messages={messages}
                  isLoading={chatLoading}
                  onSendMessage={handleSendMessage}
                  onClose={() => setChatOpen(false)}
                />
              </div>
            </ResizablePanel>
          </>
        )}
      </Group>

      {/* Updater temporarily disabled - TODO: fix signature generation */}
      {/* {import.meta.env.PROD && <UpdaterDialog checkOnMount={true} />} */}
    </div>
  );
};

export default App;
