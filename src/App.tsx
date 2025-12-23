import React, { useState, useEffect, useCallback, useRef } from "react";
import { Sidebar } from "./components/Sidebar";
import { PromptEditor } from "./components/PromptEditor";
import { ChatAssistant } from "./components/ChatAssistant";
import { PromptTemplate, SavedPrompt, ChatMessage, TerminalTab } from "./types";
import { createChatSession, sendMessageStream } from "./services/geminiService";
import { Chat } from "@google/genai";
import { Menu, X, FileBadge } from "lucide-react";
import { resolvePromptRefs, generateTitleFromContent } from "./utils";
import { TerminalPanel } from "./components/TerminalPanel";
import { CodexSettingsPanel } from "./components/CodexSettings";
import {
  DEFAULT_CODEX_SETTINGS,
  coerceCodexSettings,
} from "./codexSettings";
import { CodexSettings } from "./types";

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
  const [terminalTabs, setTerminalTabs] = useState<TerminalTab[]>(() => [
    { id: crypto.randomUUID(), title: "Terminal 1" },
  ]);
  const [activeTerminalTabId, setActiveTerminalTabId] = useState<string | null>(
    null
  );
  const [activeView, setActiveView] = useState<"editor" | "settings">("editor");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    "saved"
  );
  const [codexSettings, setCodexSettings] = useState<CodexSettings>(
    DEFAULT_CODEX_SETTINGS
  );

  // Active Prompt State
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState<string>("");
  const [isTemplate, setIsTemplate] = useState<boolean>(false);

  // Modal State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [savePromptTitle, setSavePromptTitle] = useState("");

  // Refs
  const chatSessionRef = useRef<Chat | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeTerminalTabId && terminalTabs.length > 0) {
      setActiveTerminalTabId(terminalTabs[0].id);
    }
  }, [activeTerminalTabId, terminalTabs]);

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
    } else {
      setSaveStatus(promptContent.length > 0 ? "unsaved" : "saved");
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

  const handleNewTerminalTab = () => {
    setTerminalTabs((prev) => {
      const newTab: TerminalTab = {
        id: crypto.randomUUID(),
        title: `Terminal ${prev.length + 1}`,
      };
      setActiveTerminalTabId(newTab.id);
      return [...prev, newTab];
    });
    setTerminalOpen(true);
  };

  const handleCloseTerminalTab = (tabId: string) => {
    setTerminalTabs((prev) => {
      const nextTabs = prev.filter((tab) => tab.id !== tabId);
      if (nextTabs.length === 0) {
        const fallback = {
          id: crypto.randomUUID(),
          title: "Terminal 1",
        };
        setActiveTerminalTabId(fallback.id);
        return [fallback];
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

  const handleOpenSaveModal = () => {
    const current = savedPrompts.find((p) => p.id === activePromptId);
    const titleToUse = current
      ? current.title
      : draftTitle || generateTitleFromContent(promptContent);
    setSavePromptTitle(titleToUse);
    setIsSaveModalOpen(true);
  };

  const executeSave = () => {
    const titleToUse =
      savePromptTitle.trim() || generateTitleFromContent(promptContent);

    if (activePromptId) {
      // Update existing prompt (Manual Trigger just updates title/content again to be safe)
      setSavedPrompts((prev) =>
        prev.map((p) =>
          p.id === activePromptId
            ? {
                ...p,
                title: titleToUse,
                content: promptContent,
                updatedAt: Date.now(),
              }
            : p
        )
      );
    } else {
      // Create new prompt
      const newId = crypto.randomUUID();
      const newPrompt: SavedPrompt = {
        id: newId,
        title: titleToUse,
        content: promptContent,
        updatedAt: Date.now(),
      };
      setSavedPrompts((prev) => [newPrompt, ...prev]);
      setActivePromptId(newId);
    }
    setActiveTemplateId(null);
    setIsTemplate(false);
    setSaveStatus("saved");
    setIsSaveModalOpen(false);
  };

  const handleSaveAsNew = () => {
    const titleToUse =
      savePromptTitle.trim() || generateTitleFromContent(promptContent);

    const newId = crypto.randomUUID();
    const newPrompt: SavedPrompt = {
      id: newId,
      title: titleToUse,
      content: promptContent,
      updatedAt: Date.now(),
    };
    setSavedPrompts((prev) => [newPrompt, ...prev]);
    setActivePromptId(newId);
    setActiveTemplateId(null);
    setIsTemplate(false);
    setSaveStatus("saved");
    setIsSaveModalOpen(false);
  };

  const handleSaveAsTemplate = () => {
    const titleToUse = savePromptTitle.trim() || "Untitled Template";
    const newTemplate: PromptTemplate = {
      id: crypto.randomUUID(),
      name: titleToUse,
      content: promptContent,
      category: "custom",
    };
    setCustomTemplates((prev) => [...prev, newTemplate]);
    setActiveTemplateId(newTemplate.id);
    setActivePromptId(null);
    setDraftTitle(newTemplate.name);
    setIsTemplate(true);
    setSaveStatus("saved");
    setIsSaveModalOpen(false);
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
        setSaveStatus("unsaved");
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
      setSaveStatus("unsaved");
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
    if (promptContent.trim().length > 0 && saveStatus === "unsaved") {
      if (!confirm("Clear unsaved editor for a new prompt?")) return;
    }
    setPromptContent("");
    setActivePromptId(null);
    setActiveTemplateId(null);
    setDraftTitle("");
    setSaveStatus("saved"); // Empty is considered saved
    setIsTemplate(false);
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

  return (
    <div className="flex h-screen bg-black overflow-hidden">
      {/* Sidebar Panel */}
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } transition-all duration-300 overflow-hidden relative shrink-0 border-r border-zinc-800 bg-zinc-900`}
      >
        <div className="w-64 h-full">
          <Sidebar
            isOpen={true}
            templates={allTemplates}
            savedPrompts={savedPrompts}
            archivedTemplates={archivedTemplates}
            archivedPrompts={archivedPrompts}
            terminalTabs={terminalTabs}
            activeTerminalTabId={activeTerminalTabId}
            activePromptId={activePromptId}
            activeTemplateId={activeTemplateId}
            showArchive={showArchive}
            onSelectTerminalTab={handleSelectTerminalTab}
            onNewTerminalTab={handleNewTerminalTab}
            onCloseTerminalTab={handleCloseTerminalTab}
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
            onSavePrompt={handleOpenSaveModal}
            activeView={activeView}
            onOpenSettings={() =>
              setActiveView((prev) => (prev === "settings" ? "editor" : "settings"))
            }
          />
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-zinc-950 relative">
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-4 left-4 z-20 p-2 bg-zinc-800 rounded-md text-zinc-400 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        {activeView === "settings" ? (
          <CodexSettingsPanel
            settings={codexSettings}
            onChange={setCodexSettings}
            onClose={() => setActiveView("editor")}
            onReset={() => setCodexSettings(DEFAULT_CODEX_SETTINGS)}
          />
        ) : (
          <>
            <div className="flex-1 min-h-0">
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
                isTerminalOpen={terminalOpen}
                onToggleTerminal={() => setTerminalOpen((prev) => !prev)}
                onRequestTerminal={() => setTerminalOpen(true)}
                activeTerminalTabId={activeTerminalTabId}
                codexSettings={codexSettings}
                isTemplate={isTemplate}
                onToggleTemplate={() => setIsTemplate(!isTemplate)}
                onSavePrompt={handleOpenSaveModal}
              />
            </div>
            {terminalOpen && (
              <div className="h-64 border-t border-zinc-800 bg-zinc-950">
                <TerminalPanel
                  tabs={terminalTabs}
                  activeTabId={activeTerminalTabId}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Chat Assistant Panel (Right Column) */}
      {chatOpen && (
        <div className="w-[400px] border-l border-zinc-800 bg-zinc-900 shrink-0 transition-all">
          <ChatAssistant
            messages={messages}
            isLoading={chatLoading}
            onSendMessage={handleSendMessage}
            onClose={() => setChatOpen(false)}
          />
        </div>
      )}

      {/* Save Modal */}
      {isSaveModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">Save</h3>
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Name
              </label>
              <input
                type="text"
                value={savePromptTitle}
                onChange={(e) => setSavePromptTitle(e.target.value)}
                placeholder="e.g., Marketing Email Generator"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder:text-zinc-600"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") executeSave();
                  if (e.key === "Escape") setIsSaveModalOpen(false);
                }}
              />
              <p className="text-xs text-zinc-500 mt-2">
                {activePromptId ? "Updating existing prompt." : "Creating new item."}
              </p>
            </div>
            <div className="px-6 py-4 bg-zinc-950/50 border-t border-zinc-800 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={handleSaveAsTemplate}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 border border-zinc-700 rounded-lg transition-colors"
              >
                <FileBadge className="w-3.5 h-3.5" />
                Save as Template
              </button>

              {activePromptId ? (
                <>
                  <button
                    onClick={handleSaveAsNew}
                    className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 border border-zinc-700 rounded-lg transition-colors"
                  >
                    Save as New
                  </button>
                  <button
                    onClick={executeSave}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-900/20 transition-all"
                  >
                    Update
                  </button>
                </>
              ) : (
                <button
                  onClick={executeSave}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-900/20 transition-all"
                >
                  Save Prompt
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
