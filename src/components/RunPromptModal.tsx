import React, { useRef, useEffect } from 'react';
import { X, FolderOpen, Play, GitBranch } from 'lucide-react';

interface RunPromptModalProps {
  show: boolean;
  selectedTool: 'codex' | 'claude' | 'claude-ui' | null;
  selectedDirectory: string;
  createWorktree: boolean;
  onClose: () => void;
  onDirectoryChange: (dir: string) => void;
  onCreateWorktreeChange: (value: boolean) => void;
  onBrowseDirectory: () => void;
  onConfirm: () => void;
}

export const RunPromptModal: React.FC<RunPromptModalProps> = ({
  show,
  selectedTool,
  selectedDirectory,
  createWorktree,
  onClose,
  onDirectoryChange,
  onCreateWorktreeChange,
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

  const toolLabel = selectedTool === 'claude-ui' ? 'Claude UI' : selectedTool === 'claude' ? 'Claude' : 'Codex';

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white">
            Run with {toolLabel}
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
            The selected directory will be used when running in the terminal.
          </p>

          {/* Git Worktree Option */}
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={createWorktree}
                onChange={(e) => onCreateWorktreeChange(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-600 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/50 focus:ring-offset-0"
              />
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300" />
                <span className="text-sm text-zinc-300 group-hover:text-white">
                  Create git worktree before running
                </span>
              </div>
            </label>
            <p className="text-xs text-zinc-500 mt-2 ml-7">
              Creates an isolated copy of the repository from the current branch.
            </p>
          </div>
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
            Run in {toolLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
