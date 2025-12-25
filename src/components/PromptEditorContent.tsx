import React, { RefObject } from 'react';
import { PromptTemplate, SavedPrompt } from '../types';
import { resolvePromptRefs } from '../utils';

interface PromptEditorContentProps {
  value: string;
  viewMode: 'edit' | 'split' | 'preview';
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSelect: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  templates: PromptTemplate[];
  savedPrompts: SavedPrompt[];
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

export const PromptEditorContent: React.FC<PromptEditorContentProps> = ({
  value,
  viewMode,
  onChange,
  onSelect,
  onKeyDown,
  templates,
  savedPrompts,
  textareaRef,
}) => {

  const renderPreview = () => (
    <div className="w-full h-full p-6 bg-zinc-950/50 overflow-y-auto custom-scrollbar border-l border-zinc-800">
      <div className="max-w-4xl mx-auto whitespace-pre-wrap font-mono text-sm text-zinc-300 leading-relaxed">
        {resolvePromptRefs(value, templates, savedPrompts)}
      </div>
    </div>
  );

  return (
    <div className="h-full min-h-0 overflow-hidden relative group">
      {viewMode === 'preview' ? (
        renderPreview()
      ) : (
        <div className={`h-full ${viewMode === 'split' ? 'grid grid-cols-2' : ''}`}>
          {/* Textarea */}
          <div className="relative h-full flex flex-col">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={onChange}
              onSelect={onSelect}
              onKeyDown={onKeyDown}
              onClick={onSelect}
          placeholder="Start typing your prompt here... Type '{{' to include snippet."
              className="flex-1 w-full p-6 bg-transparent text-zinc-100 font-mono text-sm resize-none focus:outline-none focus:ring-0 leading-relaxed custom-scrollbar placeholder:text-zinc-700"
              spellCheck={false}
            />
            
            {/* Character Count */}
            <div className="absolute bottom-2 right-6 text-xs text-zinc-600 font-mono pointer-events-none bg-zinc-950/80 px-2 py-1 rounded">
              {value.length} chars
            </div>
          </div>

          {/* Split Preview Panel */}
          {viewMode === 'split' && renderPreview()}
        </div>
      )}
    </div>
  );
};
