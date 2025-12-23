import React, { useRef, useEffect } from 'react';
import { X, FolderOpen, Play } from 'lucide-react';

interface RunPromptModalProps {
  show: boolean;
  selectedTool: 'aider' | 'cloud-code' | 'cursor' | 'codex' | 'terminal' | null;
  selectedDirectory: string;
  onClose: () => void;
  onDirectoryChange: (dir: string) => void;
  onBrowseDirectory: () => void;
  onConfirm: () => void;
}

export const RunPromptModal: React.FC<RunPromptModalProps> = ({
  show,
  selectedTool,
  selectedDirectory,
  onClose,
  onDirectoryChange,
  onBrowseDirectory,
  onConfirm,
}) => {
  const directoryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (show && directoryInputRef.current) {
      directoryInputRef.current.focus();
    }
  }, [show]);

  if (!show || !selectedTool) {
    return null;
  }

  const toolNames: Record<string, string> = {
    'aider': 'Aider',
    'cloud-code': 'Cloud Code',
    'cursor': 'Cursor',
    'codex': 'Codex',
    'terminal': 'Terminal'
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white">
            Run with {toolNames[selectedTool]}
          </h3>
          <button 
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <label className="block text-sm font-medium text-zinc-400 mb-2">
            Working Directory (optional)
          </label>
          <div className="flex gap-2">
            <input
              ref={directoryInputRef}
              type="text"
              value={selectedDirectory}
              onChange={(e) => onDirectoryChange(e.target.value)}
              placeholder="e.g., /path/to/project or ./src"
              className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 placeholder:text-zinc-600 font-mono text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onConfirm();
                }
                if (e.key === 'Escape') {
                  onClose();
                }
              }}
            />
            <button
              onClick={onBrowseDirectory}
              className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors flex items-center gap-2"
              title="Browse for directory"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            The directory path will be included with the prompt when copied.
          </p>
        </div>
        <div className="px-6 py-4 bg-zinc-950/50 border-t border-zinc-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            {selectedTool === 'terminal' ? 'Run in Terminal' : 'Copy Prompt'}
          </button>
        </div>
      </div>
    </div>
  );
};
