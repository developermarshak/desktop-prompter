import React from 'react';
import { PromptTemplate, SavedPrompt, TerminalTab } from '../types';
import { LayoutTemplate, Plus, Trash2, Clock, FileBadge, Archive, RotateCcw, Copy, Settings, Terminal, X } from 'lucide-react';

interface SidebarProps {
  templates: PromptTemplate[];
  savedPrompts: SavedPrompt[];
  archivedTemplates: PromptTemplate[];
  archivedPrompts: SavedPrompt[];
  terminalTabs: TerminalTab[];
  activeTerminalTabId: string | null;
  activePromptId: string | null;
  activeTemplateId: string | null;
  showArchive: boolean;
  onSelectTerminalTab: (tab: TerminalTab) => void;
  onNewTerminalTab: () => void;
  onCloseTerminalTab: (id: string) => void;
  onSelectTemplate: (template: PromptTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onDuplicateTemplate: (template: PromptTemplate) => void;
  onSelectSavedPrompt: (prompt: SavedPrompt) => void;
  onDeleteSavedPrompt: (id: string) => void;
  onDuplicatePrompt: (prompt: SavedPrompt) => void;
  onRestoreTemplate: (template: PromptTemplate) => void;
  onRestorePrompt: (prompt: SavedPrompt) => void;
  onToggleArchive: () => void;
  onNewPrompt: () => void;
  onSavePrompt: () => void;
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
  activeTerminalTabId,
  activePromptId,
  activeTemplateId,
  showArchive,
  onSelectTerminalTab,
  onNewTerminalTab,
  onCloseTerminalTab,
  onSelectTemplate,
  onDeleteTemplate,
  onDuplicateTemplate,
  onSelectSavedPrompt,
  onDeleteSavedPrompt,
  onDuplicatePrompt,
  onRestoreTemplate,
  onRestorePrompt,
  onToggleArchive,
  onNewPrompt,
  onSavePrompt,
  isOpen,
  activeView,
  onOpenSettings,
}) => {
  if (!isOpen) return null;

  // Unified list: Custom templates first, then System templates
  const unifiedTemplates = [...templates].sort((a, b) => {
    // Priority: Custom > System
    if (a.category === 'custom' && b.category !== 'custom') return -1;
    if (a.category !== 'custom' && b.category === 'custom') return 1;
    // Then alphabetical
    return a.name.localeCompare(b.name);
  });

  return (
    <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full shrink-0 transition-all duration-300">
      <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0">
        <h1 className="font-bold text-lg text-white tracking-tight flex items-center gap-2">
           <LayoutTemplate className="w-5 h-5 text-indigo-500" />
           PromptArch
        </h1>
        <button 
          onClick={onNewPrompt}
          className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
          title="New Prompt"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Templates Section */}
        <div className="p-4 pb-2">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <LayoutTemplate className="w-3 h-3" /> Templates
          </h2>
          <div className="space-y-1">
            {unifiedTemplates.map((t) => (
               <div 
                    key={t.id}
                    className={`group flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
                      activeTemplateId === t.id 
                        ? 'bg-zinc-800 text-white' 
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    }`}
                    onClick={() => onSelectTemplate(t)}
                >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        {t.category === 'custom' && <FileBadge className="w-3 h-3 text-indigo-400 shrink-0" />}
                        <span className="truncate">{t.name}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDuplicateTemplate(t);
                            }}
                            className="p-1 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 rounded transition-all"
                            title="Duplicate Template"
                        >
                            <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteTemplate(t.id);
                            }}
                            className="p-1 hover:bg-red-900/30 text-zinc-500 hover:text-red-400 rounded transition-all"
                            title="Delete Template"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            ))}
          </div>
        </div>

        <div className="h-px bg-zinc-800 mx-4 my-2" />

        {/* Saved Prompts Section */}
        <div className="p-4 pt-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-3 h-3" /> Saved Prompts
            </h2>
            <button 
              onClick={onSavePrompt}
              className="p-1 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
              title="Save Prompt"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            {savedPrompts.length === 0 ? (
              <p className="text-zinc-600 text-xs italic px-3">No saved prompts yet.</p>
            ) : (
              savedPrompts.map((p) => {
                const isActive = p.id === activePromptId;
                return (
                  <div
                    key={p.id}
                    onClick={() => onSelectSavedPrompt(p)}
                    className={`group flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
                        isActive 
                        ? 'bg-zinc-800 text-white' 
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    <span className="flex-1 truncate mr-2">
                      {p.title || 'Untitled Prompt'}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicatePrompt(p);
                          }}
                          className="p-1 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 rounded transition-all"
                          title="Duplicate Prompt"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSavedPrompt(p.id);
                          }}
                          className="p-1 hover:bg-red-900/30 text-zinc-500 hover:text-red-400 rounded transition-all"
                          title="Delete Prompt"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="h-px bg-zinc-800 mx-4 my-2" />

        {/* Terminal Tabs Section */}
        <div className="p-4 pt-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-3 h-3" /> Terminal Tabs
            </h2>
            <button
              onClick={onNewTerminalTab}
              className="p-1 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
              title="New Terminal Tab"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            {terminalTabs.length === 0 ? (
              <p className="text-zinc-600 text-xs italic px-3">
                No terminal tabs yet.
              </p>
            ) : (
              terminalTabs.map((tab) => {
                const isActive = tab.id === activeTerminalTabId;
                return (
                  <div
                    key={tab.id}
                    onClick={() => onSelectTerminalTab(tab)}
                    className={`group flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    <span className="flex-1 truncate mr-2">{tab.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTerminalTab(tab.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-900/30 text-zinc-500 hover:text-red-400 rounded transition-all"
                      title="Close Tab"
                    >
                      <X className="w-3.5 h-3.5" />
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
            <div className="h-px bg-zinc-800 mx-4 my-2" />
            <div className="p-4 pt-2">
              <button
                onClick={onToggleArchive}
                className="w-full flex items-center justify-between mb-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Archive className="w-3 h-3" /> Archive
                </div>
                <span className="text-zinc-600">
                  ({archivedTemplates.length + archivedPrompts.length})
                </span>
              </button>
              
              {showArchive && (
                <div className="space-y-4">
                  {/* Archived Templates */}
                  {archivedTemplates.length > 0 && (
                    <div>
                      <h3 className="text-xs font-medium text-zinc-600 mb-2">Templates</h3>
                      <div className="space-y-1">
                        {archivedTemplates.map((t) => (
                          <div
                            key={t.id}
                            className="group flex items-center justify-between px-3 py-2 rounded-md text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {t.category === 'custom' && <FileBadge className="w-3 h-3 text-indigo-400 shrink-0" />}
                              <span className="truncate">{t.name}</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRestoreTemplate(t);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-green-900/30 text-zinc-500 hover:text-green-400 rounded transition-all shrink-0"
                              title="Restore Template"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Archived Prompts */}
                  {archivedPrompts.length > 0 && (
                    <div>
                      <h3 className="text-xs font-medium text-zinc-600 mb-2">Prompts</h3>
                      <div className="space-y-1">
                        {archivedPrompts.map((p) => (
                          <div
                            key={p.id}
                            className="group flex items-center justify-between px-3 py-2 rounded-md text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                          >
                            <span className="flex-1 truncate mr-2">
                              {p.title || 'Untitled Prompt'}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRestorePrompt(p);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-green-900/30 text-zinc-500 hover:text-green-400 rounded transition-all"
                              title="Restore Prompt"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
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

      <div className="border-t border-zinc-800 p-3">
        <button
          onClick={onOpenSettings}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
            activeView === 'settings'
              ? 'bg-zinc-800 text-white'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>
    </aside>
  );
};
