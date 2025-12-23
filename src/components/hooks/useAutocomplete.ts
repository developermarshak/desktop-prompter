import { useState, type RefObject, type KeyboardEvent } from 'react';
import { PromptTemplate, SavedPrompt } from '../../types';

interface SuggestionItem {
  id: string;
  label: string;
  content: string;
  type: 'template' | 'saved';
}

interface UseAutocompleteProps {
  value: string;
  templates: PromptTemplate[];
  savedPrompts: SavedPrompt[];
  onChange: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

export const useAutocomplete = ({
  value,
  templates,
  savedPrompts,
  onChange,
  textareaRef,
}: UseAutocompleteProps) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [triggerIndex, setTriggerIndex] = useState(-1);

  const getSuggestions = (): SuggestionItem[] => {
    const items: SuggestionItem[] = [
      ...templates.map(t => ({ id: t.id, label: t.name, content: t.content, type: 'template' as const })),
      ...savedPrompts.map(p => ({ id: p.id, label: p.title, content: p.content, type: 'saved' as const }))
    ];
    
    if (!suggestionQuery) return items;
    return items.filter(item => 
      item.label.toLowerCase().includes(suggestionQuery.toLowerCase())
    );
  };

  const suggestions = getSuggestions();

  const acceptSuggestion = (item: SuggestionItem) => {
    if (!textareaRef.current) return;
    
    const before = value.substring(0, triggerIndex);
    const after = value.substring(textareaRef.current.selectionEnd);
    const refTag = `{{${item.label}}}`;
    const newValue = before + refTag + after;
    
    onChange(newValue);
    setShowSuggestions(false);
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = before.length + refTag.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleAutocompleteChange = (newValue: string, caret: number) => {
    // Autocomplete Logic
    const lastOpen = newValue.lastIndexOf('{{', caret);
    const lastClose = newValue.lastIndexOf('}}', caret);

    if (lastOpen !== -1 && lastOpen > lastClose && (caret - lastOpen) <= 30) {
      const query = newValue.slice(lastOpen + 2, caret);
      setSuggestionQuery(query);
      setShowSuggestions(true);
      setTriggerIndex(lastOpen);
      setSelectedIndex(0);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          acceptSuggestion(suggestions[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    }
  };

  return {
    showSuggestions,
    suggestions,
    selectedIndex,
    acceptSuggestion,
    handleAutocompleteChange,
    handleKeyDown,
  };
};
