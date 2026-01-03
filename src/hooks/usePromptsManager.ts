import { useState, useEffect, useCallback, useRef } from "react";
import { PromptTemplate, SavedPrompt } from "../types";
import { DEFAULT_TEMPLATES } from "../constants/defaultTemplates";
import { generateTitleFromContent } from "../utils";

export interface UsePromptsManagerResult {
  // State
  promptContent: string;
  savedPrompts: SavedPrompt[];
  customTemplates: PromptTemplate[];
  archivedTemplates: PromptTemplate[];
  archivedPrompts: SavedPrompt[];
  showArchive: boolean;
  activePromptId: string | null;
  activeTemplateId: string | null;
  draftTitle: string;
  isTemplate: boolean;
  saveStatus: "saved" | "saving" | "unsaved";
  allTemplates: PromptTemplate[];
  currentDisplayTitle: string;

  // Setters
  setPromptContent: React.Dispatch<React.SetStateAction<string>>;
  setShowArchive: React.Dispatch<React.SetStateAction<boolean>>;

  // Handlers
  handleSelectTemplate: (template: PromptTemplate) => void;
  handleSelectSavedPrompt: (prompt: SavedPrompt) => void;
  handleNewPrompt: () => void;
  handleTitleChange: (newTitle: string) => void;
  handleDeleteSavedPrompt: (id: string) => void;
  handleDeleteTemplate: (id: string) => void;
  handleRestoreTemplate: (template: PromptTemplate) => void;
  handleRestorePrompt: (prompt: SavedPrompt) => void;
  handleDuplicatePrompt: (prompt: SavedPrompt) => void;
  handleDuplicateTemplate: (template: PromptTemplate) => void;
  handleRenameTemplate: (templateId: string, name: string) => void;
  handleRenameSavedPrompt: (promptId: string, title: string) => void;
  handleToggleTemplate: () => void;
}

export function usePromptsManager(): UsePromptsManagerResult {
  // State
  const [promptContent, setPromptContent] = useState<string>("");
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
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState<string>("");
  const [isTemplate, setIsTemplate] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    "saved"
  );

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Computed: merged default templates
  const mergedDefaultTemplates = DEFAULT_TEMPLATES.filter(
    (t) => !deletedDefaultTemplateIds.has(t.id)
  ).map((t) => {
    const override = modifiedDefaultTemplates.find((m) => m.id === t.id);
    return override ? { ...t, ...override } : t;
  });

  const allTemplates = [...mergedDefaultTemplates, ...customTemplates];

  // Initial Load
  useEffect(() => {
    // Load Saved Prompts
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

    // Load Current Draft
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
        setActiveTemplateId(activeId ? null : storedTemplateId || null);
        setDraftTitle(title || "");
        setIsTemplate(
          activeId ? false : Boolean(storedTemplateId || storedIsTemplate)
        );
      } catch (e) {
        console.error("Failed to parse draft", e);
      }
    }
  }, []);

  // Persist Saved Prompts
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

  // Autosave Draft & Continuous Save
  useEffect(() => {
    const draftState = {
      content: promptContent,
      activeId: activePromptId,
      activeTemplateId,
      title: draftTitle,
      isTemplate,
    };
    localStorage.setItem("promptArchitect_draft", JSON.stringify(draftState));

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

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
      }, 1000);
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

  // Handlers
  const handleSelectTemplate = useCallback((template: PromptTemplate) => {
    setPromptContent(template.content);
    setDraftTitle(template.name);
    setActivePromptId(null);
    setActiveTemplateId(template.id);
    setSaveStatus("saved");
    setIsTemplate(true);
  }, []);

  const handleSelectSavedPrompt = useCallback((prompt: SavedPrompt) => {
    setPromptContent(prompt.content);
    setActivePromptId(prompt.id);
    setActiveTemplateId(null);
    setIsTemplate(false);
  }, []);

  const handleNewPrompt = useCallback(() => {
    setPromptContent("");
    createNewPrompt("", "Untitled Prompt");
  }, [createNewPrompt]);

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      if (activePromptId) {
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

            const updated = {
              ...baseTemplate,
              name: newTitle || baseTemplate.name,
            };
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
    },
    [activePromptId, activeTemplateId]
  );

  const handleDeleteSavedPrompt = useCallback(
    (id: string) => {
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
    },
    [savedPrompts, activePromptId]
  );

  const handleDeleteTemplate = useCallback(
    (id: string) => {
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
    },
    [allTemplates, activeTemplateId]
  );

  const handleRestoreTemplate = useCallback((template: PromptTemplate) => {
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
  }, []);

  const handleRestorePrompt = useCallback((prompt: SavedPrompt) => {
    setSavedPrompts((prev) => [prompt, ...prev]);
    setArchivedPrompts((prev) => prev.filter((p) => p.id !== prompt.id));
  }, []);

  const handleDuplicatePrompt = useCallback((prompt: SavedPrompt) => {
    const newId = crypto.randomUUID();
    const duplicatedPrompt: SavedPrompt = {
      id: newId,
      title: `${prompt.title} (Copy)`,
      content: prompt.content,
      updatedAt: Date.now(),
    };
    setSavedPrompts((prev) => [duplicatedPrompt, ...prev]);
    setPromptContent(duplicatedPrompt.content);
    setActivePromptId(newId);
    setActiveTemplateId(null);
    setIsTemplate(false);
    setDraftTitle(duplicatedPrompt.title);
  }, []);

  const handleDuplicateTemplate = useCallback((template: PromptTemplate) => {
    const newId = crypto.randomUUID();
    const duplicatedTemplate: PromptTemplate = {
      id: newId,
      name: `${template.name} (Copy)`,
      content: template.content,
      category: "custom",
    };
    setCustomTemplates((prev) => [duplicatedTemplate, ...prev]);
    setPromptContent(duplicatedTemplate.content);
    setActiveTemplateId(newId);
    setActivePromptId(null);
    setIsTemplate(true);
    setDraftTitle(duplicatedTemplate.name);
  }, []);

  const handleRenameTemplate = useCallback(
    (templateId: string, name: string) => {
      setCustomTemplates((prev) => {
        const template = prev.find((t) => t.id === templateId);
        if (template) {
          return prev.map((t) => (t.id === templateId ? { ...t, name } : t));
        }
        return prev;
      });

      setModifiedDefaultTemplates((prev) => {
        const baseTemplate =
          prev.find((t) => t.id === templateId) ||
          DEFAULT_TEMPLATES.find((t) => t.id === templateId);

        if (!baseTemplate) return prev;

        const updatedTemplate = { ...baseTemplate, name };
        const idx = prev.findIndex((t) => t.id === templateId);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = updatedTemplate;
          return next;
        }
        return [...prev, updatedTemplate];
      });

      if (activeTemplateId === templateId) {
        setDraftTitle(name);
      }
    },
    [activeTemplateId]
  );

  const handleRenameSavedPrompt = useCallback(
    (promptId: string, title: string) => {
      setSavedPrompts((prev) =>
        prev.map((p) =>
          p.id === promptId ? { ...p, title, updatedAt: Date.now() } : p
        )
      );
    },
    []
  );

  const handleToggleTemplate = useCallback(() => {
    if (isTemplate) {
      // Converting from template to prompt - MOVE not copy
      const newId = crypto.randomUUID();
      const activeTemplate = allTemplates.find(
        (t) => t.id === activeTemplateId
      );
      const newTitle =
        draftTitle ||
        (activeTemplate ? activeTemplate.name : "") ||
        "Untitled Prompt";
      const newPrompt: SavedPrompt = {
        id: newId,
        title: newTitle,
        content: promptContent,
        updatedAt: Date.now(),
      };

      setSavedPrompts((prev) => [newPrompt, ...prev]);

      if (activeTemplateId) {
        const templateToRemove = allTemplates.find(
          (t) => t.id === activeTemplateId
        );
        if (templateToRemove) {
          if (templateToRemove.category === "custom") {
            setCustomTemplates((prev) =>
              prev.filter((t) => t.id !== activeTemplateId)
            );
          } else {
            setDeletedDefaultTemplateIds(
              (prev) => new Set([...prev, activeTemplateId])
            );
            setModifiedDefaultTemplates((prev) =>
              prev.filter((t) => t.id !== activeTemplateId)
            );
          }
        }
      }

      setActivePromptId(newId);
      setActiveTemplateId(null);
      setIsTemplate(false);
      setDraftTitle(newTitle);
      setSaveStatus("saved");
    } else {
      // Converting from prompt to template - MOVE not copy
      const newId = crypto.randomUUID();
      const activePrompt = savedPrompts.find((p) => p.id === activePromptId);
      const newName =
        draftTitle ||
        (activePrompt ? activePrompt.title : "") ||
        "Untitled Template";
      const newTemplate: PromptTemplate = {
        id: newId,
        name: newName,
        content: promptContent,
        category: "custom",
      };

      setCustomTemplates((prev) => [newTemplate, ...prev]);

      if (activePromptId) {
        setSavedPrompts((prev) => prev.filter((p) => p.id !== activePromptId));
      }

      setActiveTemplateId(newId);
      setActivePromptId(null);
      setIsTemplate(true);
      setDraftTitle(newName);
      setSaveStatus("saved");
    }
  }, [
    isTemplate,
    draftTitle,
    promptContent,
    allTemplates,
    activeTemplateId,
    savedPrompts,
    activePromptId,
  ]);

  // Computed: active prompt/template and display title
  const activePrompt = savedPrompts.find((p) => p.id === activePromptId);
  const activeTemplate = allTemplates.find((t) => t.id === activeTemplateId);
  const currentDisplayTitle = activePrompt
    ? activePrompt.title
    : activeTemplate
      ? activeTemplate.name
      : draftTitle;

  return {
    promptContent,
    savedPrompts,
    customTemplates,
    archivedTemplates,
    archivedPrompts,
    showArchive,
    activePromptId,
    activeTemplateId,
    draftTitle,
    isTemplate,
    saveStatus,
    allTemplates,
    currentDisplayTitle,
    setPromptContent,
    setShowArchive,
    handleSelectTemplate,
    handleSelectSavedPrompt,
    handleNewPrompt,
    handleTitleChange,
    handleDeleteSavedPrompt,
    handleDeleteTemplate,
    handleRestoreTemplate,
    handleRestorePrompt,
    handleDuplicatePrompt,
    handleDuplicateTemplate,
    handleRenameTemplate,
    handleRenameSavedPrompt,
    handleToggleTemplate,
  };
}
