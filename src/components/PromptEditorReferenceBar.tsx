import React from 'react';
import { LayoutTemplate } from 'lucide-react';
import { PromptTemplate, SavedPrompt } from '../types';

interface PromptEditorReferenceBarProps {
  uniqueRefs: string[];
  templates: PromptTemplate[];
  savedPrompts: SavedPrompt[];
  hoveredRef: string | null;
  onSetHoveredRef: (ref: string | null) => void;
  viewMode: 'edit' | 'split' | 'preview';
}

export const PromptEditorReferenceBar: React.FC<PromptEditorReferenceBarProps> = ({
  uniqueRefs,
  templates,
  savedPrompts,
  hoveredRef,
  onSetHoveredRef,
  viewMode,
}) => {
  const getRefContent = (name: string) => {
    const t = templates.find(t => t.name === name);
    if (t) return t.content;
    const s = savedPrompts.find(p => p.title === name);
    if (s) return s.content;
    return null;
  };

  if (uniqueRefs.length === 0 || viewMode === 'preview') {
    return null;
  }

  return (
    <div className="px-6 py-2 bg-zinc-900 border-b border-zinc-800 flex flex-wrap items-center gap-2 shrink-0 relative z-0">
      <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mr-2 shrink-0">
        Detected References:
      </span>
      {uniqueRefs.map(refName => {
        const content = getRefContent(refName);
        const isValid = content !== null;
        return (
          <div 
            key={refName} 
            className="relative group"
            onMouseEnter={() => onSetHoveredRef(refName)}
            onMouseLeave={() => onSetHoveredRef(null)}
          >
            <div className={`px-2 py-1 rounded text-xs font-mono border flex items-center gap-1.5 cursor-help transition-colors ${
              isValid 
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20' 
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}>
              <LayoutTemplate className="w-3 h-3" />
              {refName}
            </div>
            
            {/* Hover Tooltip/Preview - Now positioned safely with z-index */}
            {hoveredRef === refName && (
              <div className="absolute top-full left-0 mt-2 w-80 p-3 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-zinc-800">
                  <span className="text-xs font-bold text-white">{refName}</span>
                  <span className="text-[10px] text-zinc-500">{isValid ? 'Preview' : 'Not Found'}</span>
                </div>
                <div className="text-xs text-zinc-400 font-mono line-clamp-6 leading-relaxed whitespace-pre-wrap">
                  {isValid ? content : "Reference name does not match any template or saved prompt."}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
