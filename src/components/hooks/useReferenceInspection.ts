import { useState } from 'react';
import { PromptTemplate, SavedPrompt } from '../../types';

interface ActiveReference {
  name: string;
  content: string;
  isValid: boolean;
}

interface UseReferenceInspectionProps {
  templates: PromptTemplate[];
  savedPrompts: SavedPrompt[];
}

export const useReferenceInspection = ({
  templates,
  savedPrompts,
}: UseReferenceInspectionProps) => {
  const [activeRef, setActiveRef] = useState<ActiveReference | null>(null);
  const [hoveredRef, setHoveredRef] = useState<string | null>(null);

  const getRefContent = (name: string) => {
    const t = templates.find(t => t.name === name);
    if (t) return t.content;
    const s = savedPrompts.find(p => p.title === name);
    if (s) return s.content;
    return null;
  };

  const checkActiveReference = (text: string, caretPos: number) => {
    const before = text.slice(0, caretPos);
    const after = text.slice(caretPos);
    
    const lastOpen = before.lastIndexOf('{{');
    const lastCloseBefore = before.lastIndexOf('}}');
    
    const isOpen = lastOpen !== -1 && (lastCloseBefore === -1 || lastOpen > lastCloseBefore);

    if (isOpen) {
      const nextClose = after.indexOf('}}');
      const nextOpen = after.indexOf('{{');
      
      const isClosed = nextClose !== -1 && (nextOpen === -1 || nextClose < nextOpen);

      if (isClosed) {
        const tagName = (before.slice(lastOpen + 2) + after.slice(0, nextClose)).trim();
        const content = getRefContent(tagName);

        if (content !== null) {
          setActiveRef({ name: tagName, content, isValid: true });
        } else {
          setActiveRef({ name: tagName, content: 'Reference not found', isValid: false });
        }
        return;
      }
    }
    setActiveRef(null);
  };

  return {
    activeRef,
    hoveredRef,
    setHoveredRef,
    checkActiveReference,
  };
};



