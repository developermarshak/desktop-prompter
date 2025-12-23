import React from 'react';
import { Info } from 'lucide-react';

interface ActiveReference {
  name: string;
  content: string;
  isValid: boolean;
}

interface PromptEditorReferenceInspectorProps {
  activeRef: ActiveReference | null;
  showSuggestions: boolean;
  hoveredRef: string | null;
}

export const PromptEditorReferenceInspector: React.FC<PromptEditorReferenceInspectorProps> = ({
  activeRef,
  showSuggestions,
  hoveredRef,
}) => {
  if (!activeRef || showSuggestions || hoveredRef) {
    return null;
  }

  return (
    <div className="absolute bottom-6 left-6 right-6 mx-auto max-w-2xl bg-zinc-900/90 backdrop-blur-md border border-zinc-700 rounded-lg shadow-xl p-3 flex gap-4 items-start animate-in slide-in-from-bottom-2 z-40 pointer-events-none">
      <div className="mt-1 p-1.5 bg-indigo-500/20 rounded-md">
        <Info className="w-4 h-4 text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-indigo-300">
            Cursor Inside: {activeRef.name}
          </span>
        </div>
        <div className="text-xs text-zinc-400 font-mono line-clamp-3 leading-relaxed">
          {activeRef.content}
        </div>
      </div>
    </div>
  );
};
