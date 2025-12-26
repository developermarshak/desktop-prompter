import {
  useState,
  useEffect,
  useRef,
  type SyntheticEvent,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { ClaudeSettings, CodexSettings, PromptTemplate, SavedPrompt } from '../../types';
import { resolvePromptRefs, extractUniqueRefs } from '../../utils';
import { useAutocomplete } from './useAutocomplete';
import { useReferenceInspection } from './useReferenceInspection';
import { useToolIntegration } from './useToolIntegration';

interface UsePromptEditorProps {
  value: string;
  templates: PromptTemplate[];
  savedPrompts: SavedPrompt[];
  onChange: (value: string) => void;
  isChatOpen: boolean;
  onRequestTerminal?: (title?: string) => string | null;
  promptTitle?: string;
  activeTerminalTabId?: string | null;
  codexSettings: CodexSettings;
  claudeSettings: ClaudeSettings;
}

export const usePromptEditor = ({
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
}: UsePromptEditorProps) => {
  const [resolvedCopied, setResolvedCopied] = useState(false);
  const [selection, setSelection] = useState('');
  const [isCompact, setIsCompact] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'split' | 'preview'>('edit');

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  // Derived State
  const uniqueRefs = extractUniqueRefs(value);

  // Tool Integration Hook
  const toolIntegration = useToolIntegration({
    value,
    templates,
    savedPrompts,
    onRunInTerminal: onRequestTerminal,
    promptTitle,
    terminalTabId: activeTerminalTabId,
    codexSettings,
    claudeSettings,
  });

  // Autocomplete Hook
  const autocomplete = useAutocomplete({
    value,
    templates,
    savedPrompts,
    onChange,
    textareaRef,
  });

  // Reference Inspection Hook
  const referenceInspection = useReferenceInspection({
    templates,
    savedPrompts,
  });

  // Check available space for buttons
  useEffect(() => {
    const checkSpace = () => {
      if (toolbarRef.current) {
        const toolbarWidth = toolbarRef.current.offsetWidth;
        setIsCompact(toolbarWidth < 800);
      } else {
        setIsCompact(window.innerWidth < 1024);
      }
    };

    checkSpace();
    window.addEventListener('resize', checkSpace);
    return () => window.removeEventListener('resize', checkSpace);
  }, [isChatOpen, viewMode]);

  const handleCopyResolved = () => {
    const textToCopy = resolvePromptRefs(value, templates, savedPrompts);
    navigator.clipboard.writeText(textToCopy);
    setResolvedCopied(true);
    setTimeout(() => setResolvedCopied(false), 2000);
  };

  const handleSelect = (e: SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const selectedText = target.value.substring(target.selectionStart, target.selectionEnd);
    setSelection(selectedText);
    referenceInspection.checkActiveReference(target.value, target.selectionStart);
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const caret = e.target.selectionStart;
    onChange(newValue);
    referenceInspection.checkActiveReference(newValue, caret);
    autocomplete.handleAutocompleteChange(newValue, caret);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    autocomplete.handleKeyDown(e);
  };

  return {
    // State
    resolvedCopied,
    selection,
    isCompact,
    viewMode,
    uniqueRefs,
    // Autocomplete
    showSuggestions: autocomplete.showSuggestions,
    suggestions: autocomplete.suggestions,
    selectedIndex: autocomplete.selectedIndex,
    acceptSuggestion: autocomplete.acceptSuggestion,
    // Reference Inspection
    activeRef: referenceInspection.activeRef,
    hoveredRef: referenceInspection.hoveredRef,
    setHoveredRef: referenceInspection.setHoveredRef,
    // Tool Integration
    showRunDropdown: toolIntegration.showRunDropdown,
    showDirectoryModal: toolIntegration.showDirectoryModal,
    selectedTool: toolIntegration.selectedTool,
    selectedDirectory: toolIntegration.selectedDirectory,
    runDropdownRef: toolIntegration.runDropdownRef,
    directoryInputRef: toolIntegration.directoryInputRef,
    setShowRunDropdown: toolIntegration.setShowRunDropdown,
    setShowDirectoryModal: toolIntegration.setShowDirectoryModal,
    setSelectedTool: toolIntegration.setSelectedTool,
    setSelectedDirectory: toolIntegration.setSelectedDirectory,
    handleRunWithTool: toolIntegration.handleRunWithTool,
    handleBrowseDirectory: toolIntegration.handleBrowseDirectory,
    handleConfirmRun: toolIntegration.handleConfirmRun,
    // Refs
    textareaRef,
    toolbarRef,
    // Handlers
    handleCopyResolved,
    handleSelect,
    handleChange,
    handleKeyDown,
    setViewMode,
  };
};
