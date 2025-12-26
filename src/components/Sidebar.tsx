import React, { useState } from 'react';
import { PromptTemplate, SavedPrompt, TerminalTab, CLIStatus } from '../types';
import { LayoutTemplate, Plus, Trash2, Clock, FileBadge, Archive, RotateCcw, Copy, Settings, Terminal, X } from 'lucide-react';

interface SidebarProps {
  templates: PromptTemplate[];
  savedPrompts: SavedPrompt[];
  archivedTemplates: PromptTemplate[];
  archivedPrompts: SavedPrompt[];
  terminalTabs: TerminalTab[];
  waitingTerminalTabIds?: Set<string>;
  terminalCLIStatus?: Map<string, CLIStatus>;
  activeTerminalTabId: string | null;
  activePromptId: string | null;
  activeTemplateId: string | null;
  showArchive: boolean;
  onSelectTerminalTab: (tab: TerminalTab) => void;
  onNewTerminalTab: () => void;
  onCloseTerminalTab: (id: string) => void;
  onRenameTerminalTab: (id: string, title: string) => void;
  onSelectTemplate: (template: PromptTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onDuplicateTemplate: (template: PromptTemplate) => void;
  onRenameTemplate: (id: string, name: string) => void;
  onSelectSavedPrompt: (prompt: SavedPrompt) => void;
  onDeleteSavedPrompt: (id: string) => void;
  onDuplicatePrompt: (prompt: SavedPrompt) => void;
  onRenameSavedPrompt: (id: string, title: string) => void;
  onRestoreTemplate: (template: PromptTemplate) => void;
  onRestorePrompt: (prompt: SavedPrompt) => void;
  onToggleArchive: () => void;
  onNewPrompt: () => void;
  isOpen: boolean;
  activeView: 'editor' | 'settings';
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  templates,
  savedPrompts,
  archivedTemplates,
  archivedPrompts,
  terminalTabs,
  waitingTerminalTabIds,
  terminalCLIStatus,
  activeTerminalTabId,
  activePromptId,
  activeTemplateId,
  showArchive,
  onSelectTerminalTab,
  onNewTerminalTab,
  onCloseTerminalTab,
  onRenameTerminalTab,
  onSelectTemplate,
  onDeleteTemplate,
  onDuplicateTemplate,
  onRenameTemplate,
  onSelectSavedPrompt,
  onDeleteSavedPrompt,
  onDuplicatePrompt,
  onRenameSavedPrompt,
  onRestoreTemplate,
  onRestorePrompt,
  onToggleArchive,
  onNewPrompt,
  isOpen,
  activeView,
  onOpenSettings,
}) => {
  if (!isOpen) return null;

  const [editingTerminalTabId, setEditingTerminalTabId] = useState<string | null>(null);
  const [terminalTitleDraft, setTerminalTitleDraft] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [promptTitleDraft, setPromptTitleDraft] = useState('');

  const beginTerminalRename = (tab: TerminalTab) => {
    setEditingTerminalTabId(tab.id);
    setTerminalTitleDraft(tab.title);
  };

  const commitTerminalRename = () => {
    if (!editingTerminalTabId) {
      return;
    }
    const nextTitle = terminalTitleDraft.trim();
    if (nextTitle.length > 0) {
      onRenameTerminalTab(editingTerminalTabId, nextTitle);
    }
    setEditingTerminalTabId(null);
    setTerminalTitleDraft('');
  };

  const cancelTerminalRename = () => {
    setEditingTerminalTabId(null);
    setTerminalTitleDraft('');
  };

  const beginTemplateRename = (template: PromptTemplate) => {
    setEditingTemplateId(template.id);
    setTemplateNameDraft(template.name);
  };

  const commitTemplateRename = () => {
    if (!editingTemplateId) {
      return;
    }
    const nextName = templateNameDraft.trim();
    if (nextName.length > 0) {
      onRenameTemplate(editingTemplateId, nextName);
    }
    setEditingTemplateId(null);
    setTemplateNameDraft('');
  };

  const cancelTemplateRename = () => {
    setEditingTemplateId(null);
    setTemplateNameDraft('');
  };

  const beginPromptRename = (prompt: SavedPrompt) => {
    setEditingPromptId(prompt.id);
    setPromptTitleDraft(prompt.title);
  };

  const commitPromptRename = () => {
    if (!editingPromptId) {
      return;
    }
    const nextTitle = promptTitleDraft.trim();
    if (nextTitle.length > 0) {
      onRenameSavedPrompt(editingPromptId, nextTitle);
    }
    setEditingPromptId(null);
    setPromptTitleDraft('');
  };

  const cancelPromptRename = () => {
    setEditingPromptId(null);
    setPromptTitleDraft('');
  };

  // Unified list: Custom templates first, then System templates
  const unifiedTemplates = [...templates].sort((a, b) => {
    // Priority: Custom > System
    if (a.category === 'custom' && b.category !== 'custom') return -1;
    if (a.category !== 'custom' && b.category === 'custom') return 1;
    // Then alphabetical
    return a.name.localeCompare(b.name);
  });

  return (
    <aside className="w-full bg-zinc-900 border-r border-zinc-800 flex flex-col h-full shrink-0 transition-all duration-300">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Snippets Section */}
        <div className="p-2 pb-1.5">
          <h2 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1 px-1">
            <LayoutTemplate className="w-2.5 h-2.5" /> Snippets
          </h2>
          <div className="space-y-0">
            {unifiedTemplates.map((t) => {
              const isEditing = editingTemplateId === t.id;
              return (
               <div
                    key={t.id}
                    className={`group flex items-center justify-between px-2 py-1.5 text-xs transition-colors cursor-pointer ${
                      activeTemplateId === t.id
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    }`}
                    onClick={() => onSelectTemplate(t)}
                    onDoubleClick={() => beginTemplateRename(t)}
                >
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {t.category === 'custom' && <FileBadge className="w-2.5 h-2.5 text-indigo-400 shrink-0" />}
                        {isEditing ? (
                          <input
                            type="text"
                            value={templateNameDraft}
                            onChange={(event) => setTemplateNameDraft(event.target.value)}
                            onBlur={commitTemplateRename}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                commitTemplateRename();
                              }
                              if (event.key === 'Escape') {
                                cancelTemplateRename();
                              }
                            }}
                            onClick={(event) => event.stopPropagation()}
                            onDoubleClick={(event) => event.stopPropagation()}
                            className="w-full bg-zinc-900/70 border border-zinc-700 rounded px-1 py-0.5 text-xs text-zinc-200 focus:outline-none focus:ring-0"
                            autoFocus
                          />
                        ) : (
                          <span className="truncate">{t.name}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDuplicateTemplate(t);
                            }}
                            className="p-0.5 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-all"
                            title="Duplicate Template"
                        >
                            <Copy className="w-3 h-3" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteTemplate(t.id);
                            }}
                            className="p-0.5 hover:bg-red-900/30 text-zinc-500 hover:text-red-400 transition-all"
                            title="Delete Template"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-zinc-800 mx-1.5 my-1" />

        {/* Saved Prompts Section */}
        <div className="p-2 pt-1.5">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <h2 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" /> Saved Prompts
            </h2>
            <button
              onClick={onNewPrompt}
              className="p-0.5 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title="New Prompt"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-0">
            {savedPrompts.length === 0 ? (
              <p className="text-zinc-600 text-[10px] italic px-2">No saved prompts yet.</p>
            ) : (
              savedPrompts.map((p) => {
                const isActive = p.id === activePromptId;
                const isEditing = editingPromptId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => onSelectSavedPrompt(p)}
                    onDoubleClick={() => beginPromptRename(p)}
                    className={`group flex items-center justify-between px-2 py-1.5 text-xs transition-colors cursor-pointer ${
                        isActive
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        value={promptTitleDraft}
                        onChange={(event) => setPromptTitleDraft(event.target.value)}
                        onBlur={commitPromptRename}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            commitPromptRename();
                          }
                          if (event.key === 'Escape') {
                            cancelPromptRename();
                          }
                        }}
                        onClick={(event) => event.stopPropagation()}
                        onDoubleClick={(event) => event.stopPropagation()}
                        className="flex-1 bg-zinc-900/70 border border-zinc-700 rounded px-1 py-0.5 text-xs text-zinc-200 focus:outline-none focus:ring-0 mr-1"
                        autoFocus
                      />
                    ) : (
                      <span className="flex-1 truncate mr-1">
                        {p.title || 'Untitled Prompt'}
                      </span>
                    )}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicatePrompt(p);
                          }}
                          className="p-0.5 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-all"
                          title="Duplicate Prompt"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSavedPrompt(p.id);
                          }}
                          className="p-0.5 hover:bg-red-900/30 text-zinc-500 hover:text-red-400 transition-all"
                          title="Delete Prompt"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="h-px bg-zinc-800 mx-1.5 my-1" />

        {/* Terminal Tabs Section */}
        <div className="p-2 pt-1.5">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <h2 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <Terminal className="w-2.5 h-2.5" /> Terminal Tabs
            </h2>
            <button
              onClick={onNewTerminalTab}
              className="p-0.5 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title="New Terminal Tab"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-0">
            {terminalTabs.length === 0 ? (
              <p className="text-zinc-600 text-[10px] italic px-2">
                No terminal tabs yet.
              </p>
            ) : (
              terminalTabs.map((tab) => {
                const isActive = tab.id === activeTerminalTabId;
                const isWaiting = waitingTerminalTabIds?.has(tab.id) ?? false;
                const cliStatus = terminalCLIStatus?.get(tab.id) || 'question';
                const isEditing = editingTerminalTabId === tab.id;

                const statusColors: Record<CLIStatus, string> = {
                  idle: 'bg-yellow-500',
                  working: 'bg-blue-500',
                  question: 'bg-yellow-500',
                  done: 'bg-green-500',
                };

                const statusTitles: Record<CLIStatus, string> = {
                  idle: 'CLI waiting for input',
                  working: 'CLI working...',
                  question: 'CLI waiting for input',
                  done: 'CLI task completed',
                };

                return (
                  <div
                    key={tab.id}
                    onClick={() => onSelectTerminalTab(tab)}
                    onDoubleClick={() => beginTerminalRename(tab)}
                    className={`group flex items-center justify-between px-2 py-1.5 text-xs transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-1.5 mr-1">
                      {isEditing ? (
                        <input
                          type="text"
                          value={terminalTitleDraft}
                          onChange={(event) => setTerminalTitleDraft(event.target.value)}
                          onBlur={commitTerminalRename}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              commitTerminalRename();
                            }
                            if (event.key === 'Escape') {
                              cancelTerminalRename();
                            }
                          }}
                          onClick={(event) => event.stopPropagation()}
                          onDoubleClick={(event) => event.stopPropagation()}
                          className="w-full bg-zinc-900/70 border border-zinc-700 rounded px-1 py-0.5 text-xs text-zinc-200 focus:outline-none focus:ring-0"
                          autoFocus
                        />
                      ) : (
                        <span className="truncate">{tab.title}</span>
                      )}
                      <div
                        className={`h-2 w-2 rounded-full ${statusColors[cliStatus]} ${cliStatus === 'question' || cliStatus === 'working' ? 'animate-pulse' : ''}`}
                        title={statusTitles[cliStatus]}
                      />
                      {isWaiting && (
                        <span
                          className="flex items-center gap-0.5 text-[9px] uppercase tracking-wide text-amber-300"
                          title="Waiting for output"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                          wait
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTerminalTab(tab.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-900/30 text-zinc-500 hover:text-red-400 transition-all"
                      title="Close Tab"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Archive Section */}
        {(archivedTemplates.length > 0 || archivedPrompts.length > 0) && (
          <>
            <div className="h-px bg-zinc-800 mx-1.5 my-1" />
            <div className="p-2 pt-1.5">
              <button
                onClick={onToggleArchive}
                className="w-full flex items-center justify-between mb-1.5 px-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <Archive className="w-2.5 h-2.5" /> Archive
                </div>
                <span className="text-zinc-600">
                  ({archivedTemplates.length + archivedPrompts.length})
                </span>
              </button>

              {showArchive && (
                <div className="space-y-2">
                  {/* Archived Snippets */}
                  {archivedTemplates.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-medium text-zinc-600 mb-1 px-1">Snippets</h3>
                      <div className="space-y-0">
                        {archivedTemplates.map((t) => (
                          <div
                            key={t.id}
                            className="group flex items-center justify-between px-2 py-1.5 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                          >
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              {t.category === 'custom' && <FileBadge className="w-2.5 h-2.5 text-indigo-400 shrink-0" />}
                              <span className="truncate">{t.name}</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRestoreTemplate(t);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-green-900/30 text-zinc-500 hover:text-green-400 transition-all shrink-0"
                              title="Restore Template"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Archived Prompts */}
                  {archivedPrompts.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-medium text-zinc-600 mb-1 px-1">Prompts</h3>
                      <div className="space-y-0">
                        {archivedPrompts.map((p) => (
                          <div
                            key={p.id}
                            className="group flex items-center justify-between px-2 py-1.5 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                          >
                            <span className="flex-1 truncate mr-1">
                              {p.title || 'Untitled Prompt'}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRestorePrompt(p);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-green-900/30 text-zinc-500 hover:text-green-400 transition-all"
                              title="Restore Prompt"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="border-t border-zinc-800 p-1.5">
        <button
          onClick={onOpenSettings}
          className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-xs transition-colors ${
            activeView === 'settings'
              ? 'bg-zinc-800 text-white'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          Settings
        </button>
      </div>
    </aside>
  );
};
