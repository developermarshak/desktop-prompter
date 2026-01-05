import React from 'react';
import { Editor } from "@monaco-editor/react";
import {
  ClaudeSettings,
  CodexSettings,
  PromptTemplate,
  SavedPrompt,
  TaskSectionPreview,
  WorktreeSettings,
} from '../types';
import { PromptEditorToolbar } from './PromptEditorToolbar';
import { PromptEditorReferenceBar } from './PromptEditorReferenceBar';
import { PromptEditorContent } from './PromptEditorContent';
import { PromptEditorAutocomplete } from './PromptEditorAutocomplete';
import { PromptEditorReferenceInspector } from './PromptEditorReferenceInspector';
import { RunPromptModal } from './RunPromptModal';
import { usePromptEditor } from './hooks/usePromptEditor';

interface PromptEditorProps {
  value: string;
  activeTitle?: string;
  saveStatus?: 'saved' | 'saving' | 'unsaved';
  onChange: (value: string) => void;
  onTitleChange: (newTitle: string) => void;
  templates: PromptTemplate[];
  savedPrompts: SavedPrompt[];
  isChatOpen: boolean;
  onRequestTerminal: (title?: string, type?: 'terminal' | 'claude') => string | null;
  onSaveTerminalSessionPath?: (tabId: string, path: string) => void;
  promptTitle?: string;
  activeTerminalTabId?: string | null;
  codexSettings: CodexSettings;
  claudeSettings: ClaudeSettings;
  worktreeSettings: WorktreeSettings;
  isTemplate: boolean;
  onToggleTemplate: () => void;
  showTemplateToggle?: boolean;
  showPromptActions?: boolean;
  sectionPreview?: TaskSectionPreview | null;
  onCloseSectionPreview?: () => void;
}

export const PromptEditor: React.FC<PromptEditorProps> = ({
  value,
  activeTitle,
  saveStatus = 'saved',
  onChange,
  onTitleChange,
  templates,
  savedPrompts,
  isChatOpen,
  onRequestTerminal,
  onSaveTerminalSessionPath,
  promptTitle,
  activeTerminalTabId,
  codexSettings,
  claudeSettings,
  worktreeSettings,
  isTemplate,
  onToggleTemplate,
  showTemplateToggle = true,
  showPromptActions = true,
  sectionPreview = null,
  onCloseSectionPreview,
}) => {
  const getLanguageFromPath = (path: string) => {
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    switch (ext) {
      case "ts":
      case "tsx":
        return "typescript";
      case "js":
      case "jsx":
        return "javascript";
      case "json":
        return "json";
      case "md":
      case "markdown":
        return "markdown";
      case "rs":
        return "rust";
      case "py":
        return "python";
      case "go":
        return "go";
      case "css":
        return "css";
      case "html":
        return "html";
      case "toml":
        return "toml";
      case "yaml":
      case "yml":
        return "yaml";
      case "sh":
      case "zsh":
        return "shell";
      default:
        return "plaintext";
    }
  };

  const {
    resolvedCopied,
    isCompact,
    viewMode,
    showSuggestions,
    suggestions,
    selectedIndex,
    activeRef,
    hoveredRef,
    showRunDropdown,
    showDirectoryModal,
    selectedTool,
    selectedDirectory,
    createWorktree,
    uniqueRefs,
    textareaRef,
    toolbarRef,
    handleCopyResolved,
    handleRunWithTool,
    handleOpenInWeb,
    handleBrowseDirectory,
    handleConfirmRun,
    handleSelect,
    handleChange,
    handleKeyDown,
    acceptSuggestion,
    setViewMode,
    setHoveredRef,
    setShowRunDropdown,
    setShowDirectoryModal,
    setSelectedTool,
    setSelectedDirectory,
    setCreateWorktree,
  } = usePromptEditor({
    value,
    templates,
    savedPrompts,
    onChange,
    isChatOpen,
    onRequestTerminal,
    onSaveTerminalSessionPath,
    promptTitle,
    activeTerminalTabId,
    codexSettings,
    claudeSettings,
    worktreeSettings,
  });

  return (
    <div className="flex flex-col h-full bg-zinc-950 relative">
      {!sectionPreview && (
        <PromptEditorToolbar
          activeTitle={activeTitle}
          saveStatus={saveStatus}
          value={value}
          viewMode={viewMode}
          isTemplate={isTemplate}
          isCompact={isCompact}
          resolvedCopied={resolvedCopied}
          showRunDropdown={showRunDropdown}
          toolbarRef={toolbarRef}
          showTemplateToggle={showTemplateToggle}
          showPromptActions={showPromptActions}
          onTitleChange={onTitleChange}
          onToggleTemplate={onToggleTemplate}
          onCopyResolved={handleCopyResolved}
          onSetViewMode={setViewMode}
          onToggleRunDropdown={() => setShowRunDropdown(!showRunDropdown)}
          onRunWithTool={handleRunWithTool}
          onOpenInWeb={handleOpenInWeb}
        />
      )}
      
      {!sectionPreview && (
        <PromptEditorReferenceBar
          uniqueRefs={uniqueRefs}
          templates={templates}
          savedPrompts={savedPrompts}
          hoveredRef={hoveredRef}
          onSetHoveredRef={setHoveredRef}
          viewMode={viewMode}
        />
      )}

      {/* Editor Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden relative group">
        {sectionPreview ? (
          <div className="h-full flex flex-col">
            <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
              <div className="text-zinc-200">
                Section ({sectionPreview.label})
              </div>
              {onCloseSectionPreview && (
                <button
                  type="button"
                  onClick={onCloseSectionPreview}
                  className="text-zinc-500 hover:text-white"
                >
                  Close
                </button>
              )}
            </div>
            <div className="flex-1 min-h-0">
              {sectionPreview.loading ? (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                  Loading section...
                </div>
              ) : sectionPreview.error ? (
                <div className="flex h-full items-center justify-center text-sm text-rose-300">
                  {sectionPreview.error}
                </div>
              ) : (
                <Editor
                  theme="vs-dark"
                  language={getLanguageFromPath(sectionPreview.filePath)}
                  value={sectionPreview.content}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 12,
                    wordWrap: "on",
                    lineNumbers: (lineNumber) =>
                      String(lineNumber + sectionPreview.lineStart - 1),
                    lineNumbersMinChars: String(sectionPreview.lineStart).length,
                  }}
                />
              )}
            </div>
          </div>
        ) : (
          <>
            <PromptEditorContent
              value={value}
              viewMode={viewMode}
              onChange={handleChange}
              onSelect={handleSelect}
              onKeyDown={handleKeyDown}
              templates={templates}
              savedPrompts={savedPrompts}
              textareaRef={textareaRef}
            />

            <PromptEditorAutocomplete
              showSuggestions={showSuggestions}
              suggestions={suggestions}
              selectedIndex={selectedIndex}
              onAcceptSuggestion={acceptSuggestion}
            />

            <PromptEditorReferenceInspector
              activeRef={activeRef}
              showSuggestions={showSuggestions}
              hoveredRef={hoveredRef}
            />
          </>
        )}
      </div>

      {/* Directory Selection Modal */}
      <RunPromptModal
        show={showDirectoryModal}
        selectedTool={selectedTool}
        selectedDirectory={selectedDirectory}
        createWorktree={createWorktree}
        onClose={() => {
          setShowDirectoryModal(false);
          setSelectedTool(null);
        }}
        onDirectoryChange={setSelectedDirectory}
        onCreateWorktreeChange={setCreateWorktree}
        onBrowseDirectory={handleBrowseDirectory}
        onConfirm={handleConfirmRun}
      />
    </div>
  );
};
