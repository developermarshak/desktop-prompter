import React from 'react';
import { CodexSettings, PromptTemplate, SavedPrompt } from '../types';
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
  onImproveSelection: (selection: string) => void;
  templates: PromptTemplate[];
  savedPrompts: SavedPrompt[];
  isChatOpen: boolean;
  isTerminalOpen: boolean;
  onToggleTerminal: () => void;
  onRequestTerminal: () => void;
  activeTerminalTabId?: string | null;
  codexSettings: CodexSettings;
  isTemplate: boolean;
  onToggleTemplate: () => void;
  onSavePrompt: () => void;
}

export const PromptEditor: React.FC<PromptEditorProps> = ({
  value,
  activeTitle,
  saveStatus = 'saved',
  onChange,
  onTitleChange,
  onImproveSelection,
  templates,
  savedPrompts,
  isChatOpen,
  isTerminalOpen,
  onToggleTerminal,
  onRequestTerminal,
  activeTerminalTabId,
  codexSettings,
  isTemplate,
  onToggleTemplate,
  onSavePrompt
}) => {
  const {
    resolvedCopied,
    selection,
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
    activeTerminalTabId,
    codexSettings,
  });

  return (
    <div className="flex flex-col h-full bg-zinc-950 relative">
      {/* Header Toolbar */}
      <PromptEditorToolbar
        activeTitle={activeTitle}
        saveStatus={saveStatus}
        value={value}
        selection={selection}
        viewMode={viewMode}
        isTemplate={isTemplate}
        isCompact={isCompact}
        resolvedCopied={resolvedCopied}
        showRunDropdown={showRunDropdown}
        toolbarRef={toolbarRef}
        onTitleChange={onTitleChange}
        onToggleTemplate={onToggleTemplate}
        onSavePrompt={onSavePrompt}
        onCopyResolved={handleCopyResolved}
        onImproveSelection={onImproveSelection}
        onSetViewMode={setViewMode}
        onToggleRunDropdown={() => setShowRunDropdown(!showRunDropdown)}
        onRunWithTool={handleRunWithTool}
        isTerminalOpen={isTerminalOpen}
        onToggleTerminal={onToggleTerminal}
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
      <div className="flex-1 overflow-hidden relative group">
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
