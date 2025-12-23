import { PromptTemplate, SavedPrompt } from './types';

export const resolvePromptRefs = (
  content: string,
  templates: PromptTemplate[],
  savedPrompts: SavedPrompt[]
): string => {
  const MAX_DEPTH = 3; // Prevent infinite recursion
  
  const resolve = (text: string, depth: number): string => {
      if (depth > MAX_DEPTH) return text + " [Error: Max inclusion depth exceeded]";
      
      // Match {{Name}} pattern
      return text.replace(/\{\{([^}]+)\}\}/g, (match, inner) => {
          const key = inner.trim();
          
          // Find in Templates
          const template = templates.find(t => t.name === key);
          if (template) return resolve(template.content, depth + 1);
          
          // Find in Saved Prompts
          const saved = savedPrompts.find(p => p.title === key);
          if (saved) return resolve(saved.content, depth + 1);
          
          // Return original if not found
          return match;
      });
  };

  return resolve(content, 0);
};

export const extractUniqueRefs = (text: string): string[] => {
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = new Set<string>();
    let match;
    while ((match = regex.exec(text)) !== null) {
        matches.add(match[1].trim());
    }
    return Array.from(matches);
};

export const generateTitleFromContent = (content: string): string => {
    if (!content || !content.trim()) return "Untitled Prompt";
    
    // Remove special characters for the title
    const cleanText = content.replace(/[*#_`]/g, '').trim();
    
    // Get first 6 words
    const words = cleanText.split(/\s+/).slice(0, 6);
    let title = words.join(' ');
    
    if (cleanText.length > title.length) {
        title += '...';
    }
    
    return title;
};