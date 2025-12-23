import React from 'react';
import { LayoutTemplate, Clock } from 'lucide-react';

interface SuggestionItem {
  id: string;
  label: string;
  content: string;
  type: 'template' | 'saved';
}

interface PromptEditorAutocompleteProps {
  showSuggestions: boolean;
  suggestions: SuggestionItem[];
  selectedIndex: number;
  onAcceptSuggestion: (item: SuggestionItem) => void;
}

export const PromptEditorAutocomplete: React.FC<PromptEditorAutocompleteProps> = ({
  showSuggestions,
  suggestions,
  selectedIndex,
  onAcceptSuggestion,
}) => {
  if (!showSuggestions) {
    return null;
  }

  return (
    <div className="absolute left-6 bottom-16 w-80 max-h-64 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 flex flex-col">
      <div className="px-3 py-2 text-xs font-semibold text-zinc-500 border-b border-zinc-800 bg-zinc-900 sticky top-0 flex justify-between">
        <span>Insert Reference</span>
        <span className="text-zinc-600 font-normal">Enter to select</span>
      </div>
      {suggestions.length === 0 ? (
        <div className="px-3 py-4 text-sm text-zinc-500 text-center italic">No matching prompts</div>
      ) : (
        suggestions.map((item, index) => (
          <button
            key={`${item.type}-${item.id}`}
            onClick={() => onAcceptSuggestion(item)}
            className={`w-full text-left px-3 py-3 text-sm flex items-start gap-3 transition-colors border-b border-zinc-800/50 last:border-0 ${
              index === selectedIndex
                ? 'bg-indigo-900/40 text-white'
                : 'text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <div className={`mt-0.5 p-1 rounded ${item.type === 'template' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
              {item.type === 'template' ? (
                <LayoutTemplate className="w-3.5 h-3.5" />
              ) : (
                <Clock className="w-3.5 h-3.5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate text-xs mb-0.5">{item.label}</div>
              <div className="text-xs text-zinc-500 line-clamp-2 font-mono opacity-70 leading-normal">
                {item.content}
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  );
};
