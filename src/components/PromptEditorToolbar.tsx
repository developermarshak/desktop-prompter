import React, { useRef, useEffect, RefObject } from 'react';
import {
  CopyCheck,
  Sparkles,
  LayoutTemplate,
  RefreshCw,
  Save,
  FileText,
  Play,
  ChevronDown,
  FileCode,
  Columns,
  Eye,
  EyeOff,
  Terminal,
} from 'lucide-react';

interface PromptEditorToolbarProps {
  activeTitle?: string;
  saveStatus?: 'saved' | 'saving' | 'unsaved';
  value: string;
  selection: string;
  viewMode: 'edit' | 'split' | 'preview';
  isTemplate: boolean;
  isCompact: boolean;
  resolvedCopied: boolean;
  showRunDropdown: boolean;
  toolbarRef: RefObject<HTMLDivElement | null>;
  onTitleChange: (newTitle: string) => void;
  onToggleTemplate: () => void;
  onSavePrompt: () => void;
  onCopyResolved: () => void;
  onImproveSelection: (selection: string) => void;
  onSetViewMode: (mode: 'edit' | 'split' | 'preview') => void;
  onToggleRunDropdown: () => void;
  onRunWithTool: (tool: 'aider' | 'cloud-code' | 'cursor' | 'codex' | 'terminal') => void;
  isTerminalOpen: boolean;
  onToggleTerminal: () => void;
}

export const PromptEditorToolbar: React.FC<PromptEditorToolbarProps> = ({
  activeTitle,
  saveStatus = 'saved',
  value,
  selection,
  viewMode,
  isTemplate,
  isCompact,
  resolvedCopied,
  showRunDropdown,
  toolbarRef,
  onTitleChange,
  onToggleTemplate,
  onSavePrompt,
  onCopyResolved,
  onImproveSelection,
  onSetViewMode,
  onToggleRunDropdown,
  onRunWithTool,
  isTerminalOpen,
  onToggleTerminal,
}) => {
  const runDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (runDropdownRef.current && !runDropdownRef.current.contains(event.target as Node)) {
        onToggleRunDropdown();
      }
    };

    if (showRunDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showRunDropdown, onToggleRunDropdown]);

  return (
    <div ref={toolbarRef} className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur-sm sticky top-0 z-10 shrink-0">
      <div className="flex items-center gap-6 flex-1 min-w-0 mr-4 ml-8 md:ml-0">
        <div className="flex-1 max-w-md">
          <input 
            type="text"
            value={activeTitle || ''}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Untitled Prompt"
            className="w-full bg-transparent text-lg font-semibold text-zinc-200 focus:outline-none focus:ring-0 placeholder:text-zinc-700"
          />
          <div className="flex items-center gap-2 mt-0.5">
            {activeTitle && <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Editable</span>}
            {saveStatus === 'saving' && <span className="flex items-center gap-1 text-[10px] text-indigo-400 font-medium"><RefreshCw className="w-3 h-3 animate-spin"/> Saving...</span>}
            {saveStatus === 'saved' && activeTitle && <span className="flex items-center gap-1 text-[10px] text-zinc-500 font-medium">All changes saved</span>}
            {saveStatus === 'unsaved' && !activeTitle && value.length > 0 && <span className="flex items-center gap-1 text-[10px] text-amber-500/80 font-medium">Unsaved Draft</span>}
          </div>
        </div>
        
        {/* View Mode Toggles */}
        <div className="hidden md:flex bg-zinc-900 rounded-lg p-1 border border-zinc-800 shrink-0">
          <button
            onClick={() => onSetViewMode('edit')}
            title="Editor Only"
            className={`p-1.5 rounded-md transition-all ${viewMode === 'edit' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <FileCode className="w-4 h-4" />
          </button>
          <button
            onClick={() => onSetViewMode('split')}
            title="Split View"
            className={`p-1.5 rounded-md transition-all ${viewMode === 'split' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Columns className="w-4 h-4" />
          </button>
          <button
            onClick={() => onSetViewMode('preview')}
            title="Preview Only"
            className={`p-1.5 rounded-md transition-all ${viewMode === 'preview' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {viewMode === 'preview' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {selection.length > 0 && viewMode !== 'preview' && (
          <button
            onClick={() => onImproveSelection(selection)}
            className="hidden lg:flex animate-in fade-in slide-in-from-top-1 items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-md transition-colors mr-2"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Improve Selection
          </button>
        )}

        <div className="w-px h-6 bg-zinc-800 mx-1" />

        {/* Template Toggle Switch */}
        <div className="flex items-center gap-2">
          {!isCompact ? (
            <>
              <span className={`text-xs font-medium transition-colors ${
                !isTemplate ? 'text-emerald-400' : 'text-zinc-500'
              }`}>Prompt</span>
              <button
                onClick={onToggleTemplate}
                title={isTemplate ? "Save as Template (Click to save as Prompt)" : "Save as Prompt (Click to save as Template)"}
                className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
                role="switch"
                aria-checked={isTemplate}
              >
                {/* Background track */}
                <span
                  className={`absolute inset-0 rounded-full transition-colors duration-200 ease-in-out ${
                    isTemplate ? 'bg-indigo-600' : 'bg-emerald-600'
                  }`}
                />
                {/* Sliding thumb */}
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200 ease-in-out ${
                    isTemplate ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
              <span className={`text-xs font-medium transition-colors ${
                isTemplate ? 'text-indigo-400' : 'text-zinc-500'
              }`}>Template</span>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <FileText className={`w-3.5 h-3.5 transition-colors ${
                !isTemplate ? 'text-emerald-400' : 'text-zinc-500'
              }`} />
              <button
                onClick={onToggleTemplate}
                title={isTemplate ? "Save as Template (Click to save as Prompt)" : "Save as Prompt (Click to save as Template)"}
                className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
                role="switch"
                aria-checked={isTemplate}
              >
                {/* Background track */}
                <span
                  className={`absolute inset-0 rounded-full transition-colors duration-200 ease-in-out ${
                    isTemplate ? 'bg-indigo-600' : 'bg-emerald-600'
                  }`}
                />
                {/* Sliding thumb */}
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200 ease-in-out ${
                    isTemplate ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
              <LayoutTemplate className={`w-3.5 h-3.5 transition-colors ${
                isTemplate ? 'text-indigo-400' : 'text-zinc-500'
              }`} />
            </div>
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={onSavePrompt}
          title="Save prompt or template"
          className={`flex items-center gap-2 ${isCompact ? 'p-2' : 'px-3 py-1.5'} text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors shadow-sm shadow-indigo-900/30`}
        >
          <Save className="w-3.5 h-3.5 shrink-0" />
          {!isCompact && <span>Save</span>}
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              saveStatus === 'saving'
                ? 'bg-amber-400 animate-pulse'
                : saveStatus === 'unsaved'
                  ? 'bg-amber-500'
                  : 'bg-emerald-400'
            }`}
          />
        </button>

        {/* Copy Ready Button */}
        <button
          onClick={onCopyResolved}
          title="Copy Ready Prompt (Resolved)"
          className={`flex items-center ${isCompact ? 'justify-center p-2' : 'gap-2 px-3 py-1.5'} text-xs font-medium text-indigo-300 hover:text-white hover:bg-indigo-500/20 rounded-md transition-colors bg-zinc-900/50 border border-zinc-800`}
        >
          {resolvedCopied ? (
            <span className={`text-emerald-400 font-bold shrink-0 ${isCompact ? 'text-xs' : ''}`}>
              {isCompact ? '✓' : 'Copied!'}
            </span>
          ) : (
            <>
              <CopyCheck className="w-3.5 h-3.5 shrink-0" />
              {!isCompact && <span>Copy Ready</span>}
            </>
          )}
        </button>

        {/* Terminal Toggle */}
        <button
          onClick={onToggleTerminal}
          title="Toggle terminal panel"
          className={`flex items-center ${isCompact ? 'justify-center p-2' : 'gap-2 px-3 py-1.5'} text-xs font-medium ${
            isTerminalOpen ? 'text-cyan-200 bg-cyan-500/15 border-cyan-500/30' : 'text-cyan-300'
          } hover:text-white hover:bg-cyan-500/20 rounded-md transition-colors bg-zinc-900/50 border border-zinc-800`}
        >
          <Terminal className="w-3.5 h-3.5 shrink-0" />
          {!isCompact && <span>Terminal</span>}
        </button>

        {/* Run Prompt Button */}
        <div className="relative" ref={runDropdownRef}>
          <button
            onClick={onToggleRunDropdown}
            title="Run prompt with AI coding assistant"
            className={`flex items-center ${isCompact ? 'justify-center p-2' : 'gap-2 px-3 py-1.5'} text-xs font-medium text-emerald-300 hover:text-white hover:bg-emerald-500/20 rounded-md transition-colors bg-zinc-900/50 border border-zinc-800`}
          >
            <Play className="w-3.5 h-3.5 shrink-0" />
            {!isCompact && <span>Run</span>}
            <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${showRunDropdown ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {showRunDropdown && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 text-xs font-semibold text-zinc-500 border-b border-zinc-800 bg-zinc-950">
                Run with:
              </div>
              <button
                onClick={() => onRunWithTool('aider')}
                className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-3 border-b border-zinc-800/50 last:border-0"
              >
                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                <span>Aider</span>
              </button>
              <button
                onClick={() => onRunWithTool('cloud-code')}
                className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-3 border-b border-zinc-800/50 last:border-0"
              >
                <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                <span>Cloud Code</span>
              </button>
              <button
                onClick={() => onRunWithTool('cursor')}
                className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-3 border-b border-zinc-800/50 last:border-0"
              >
                <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                <span>Cursor</span>
              </button>
              <button
                onClick={() => onRunWithTool('codex')}
                className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-3"
              >
                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <span>Codex</span>
              </button>
              <button
                onClick={() => onRunWithTool('terminal')}
                className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-3 border-t border-zinc-800/50"
              >
                <div className="w-2 h-2 rounded-full bg-cyan-500 shrink-0" />
                <span>Terminal</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
