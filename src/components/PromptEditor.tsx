import React from 'react';
import { ClaudeSettings, CodexSettings, PromptTemplate, SavedPrompt } from '../types';
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
  onRequestTerminal: (title?: string) => string | null;
  promptTitle?: string;
  activeTerminalTabId?: string | null;
  codexSettings: CodexSettings;
  claudeSettings: ClaudeSettings;
  isTemplate: boolean;
  onToggleTemplate: () => void;
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
  promptTitle,
  activeTerminalTabId,
  codexSettings,
  claudeSettings,
  isTemplate,
  onToggleTemplate
}) => {
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
  } = usePromptEditor({
    value,
    templates,
    savedPrompts,
    onChange,
    isChatOpen,
    onRequestTerminal,
    promptTitle,
    activeTerminalTabId,
    codexSettings,
    claudeSettings,
  });

  return (
    <div className="flex flex-col h-full bg-zinc-950 relative">
      {/* Header Toolbar */}
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
        onTitleChange={onTitleChange}
        onToggleTemplate={onToggleTemplate}
        onCopyResolved={handleCopyResolved}
        onSetViewMode={setViewMode}
        onToggleRunDropdown={() => setShowRunDropdown(!showRunDropdown)}
        onRunWithTool={handleRunWithTool}
        onOpenInWeb={handleOpenInWeb}
      />
      
      {/* Reference Bar */}
      <PromptEditorReferenceBar
        uniqueRefs={uniqueRefs}
        templates={templates}
        savedPrompts={savedPrompts}
        hoveredRef={hoveredRef}
        onSetHoveredRef={setHoveredRef}
        viewMode={viewMode}
      />

      {/* Editor Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden relative group">
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
        
        {/* Autocomplete Popup */}
        <PromptEditorAutocomplete
          showSuggestions={showSuggestions}
          suggestions={suggestions}
          selectedIndex={selectedIndex}
          onAcceptSuggestion={acceptSuggestion}
        />

        {/* Active Reference Inspector */}
        <PromptEditorReferenceInspector
          activeRef={activeRef}
          showSuggestions={showSuggestions}
          hoveredRef={hoveredRef}
        />
      </div>

      {/* Directory Selection Modal */}
      <RunPromptModal
        show={showDirectoryModal}
        selectedTool={selectedTool}
        selectedDirectory={selectedDirectory}
        onClose={() => {
          setShowDirectoryModal(false);
          setSelectedTool(null);
        }}
        onDirectoryChange={setSelectedDirectory}
        onBrowseDirectory={handleBrowseDirectory}
        onConfirm={handleConfirmRun}
      />
    </div>
  );
};
