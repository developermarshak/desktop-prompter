import { useMemo, useState } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { X, AlertTriangle, GitCompare } from "lucide-react";
import type { GitDiffResponse } from "../types/git";

interface TaskDiffModalProps {
  open: boolean;
  title: string;
  diff: GitDiffResponse | null;
  loading: boolean;
  error?: string | null;
  onClose: () => void;
}

const statusMeta: Record<
  string,
  { label: string; badge: string; className: string }
> = {
  added: { label: "Added", badge: "A", className: "text-emerald-400" },
  modified: { label: "Modified", badge: "M", className: "text-amber-400" },
  deleted: { label: "Deleted", badge: "D", className: "text-rose-400" },
  renamed: { label: "Renamed", badge: "R", className: "text-indigo-400" },
  copied: { label: "Copied", badge: "C", className: "text-cyan-400" },
  typechange: { label: "Typechange", badge: "T", className: "text-sky-400" },
  untracked: { label: "Untracked", badge: "U", className: "text-emerald-300" },
  conflicted: { label: "Conflicted", badge: "!", className: "text-rose-300" },
};

const getLanguageFromPath = (path: string) => {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "json":
      return "json";
    case "md":
    case "markdown":
      return "markdown";
    case "rs":
      return "rust";
    case "py":
      return "python";
    case "go":
      return "go";
    case "css":
      return "css";
    case "html":
      return "html";
    case "toml":
      return "toml";
    case "yaml":
    case "yml":
      return "yaml";
    case "sh":
    case "zsh":
      return "shell";
    default:
      return "plaintext";
  }
};

export const TaskDiffModal = ({
  open,
  title,
  diff,
  loading,
  error,
  onClose,
}: TaskDiffModalProps) => {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const files = diff?.files ?? [];
  const selectedFile = useMemo(
    () => files.find((file) => file.path === selectedPath) ?? files[0] ?? null,
    [files, selectedPath],
  );

  const language = useMemo(() => {
    if (!selectedFile) {
      return "plaintext";
    }
    return getLanguageFromPath(selectedFile.path);
  }, [selectedFile]);

  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-200">
            <GitCompare className="h-4 w-4 text-indigo-400" />
            <span>{title}</span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex">
          <div className="w-60 border-r border-zinc-800 bg-zinc-950/60 flex flex-col">
            <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
              Changed files
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {files.length === 0 ? (
                <div className="px-3 py-4 text-xs text-zinc-600 italic">
                  No changes detected.
                </div>
              ) : (
                files.map((file) => {
                  const meta = statusMeta[file.status] ?? {
                    label: file.status,
                    badge: "?",
                    className: "text-zinc-400",
                  };
                  const isActive = file.path === selectedFile?.path;
                  return (
                    <button
                      key={file.path}
                      onClick={() => setSelectedPath(file.path)}
                      className={`w-full px-3 py-2 text-left text-xs transition-colors border-b border-zinc-900/60 ${
                        isActive
                          ? "bg-zinc-800 text-zinc-100"
                          : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                      }`}
                      title={`${meta.label} ${file.path}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`font-mono ${meta.className}`}>
                          {meta.badge}
                        </span>
                        <span className="truncate">{file.path}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0 bg-zinc-950/40">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                Loading diff...
              </div>
            ) : error ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-rose-300">
                <AlertTriangle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            ) : selectedFile ? (
              selectedFile.isBinary ? (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                  Binary file diff not supported.
                </div>
              ) : (
                <DiffEditor
                  theme="vs-dark"
                  language={language}
                  original={selectedFile.oldContent}
                  modified={selectedFile.newContent}
                  options={{
                    readOnly: true,
                    renderSideBySide: true,
                    minimap: { enabled: false },
                    fontSize: 12,
                    wordWrap: "on",
                  }}
                />
              )
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                No diff selected.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
