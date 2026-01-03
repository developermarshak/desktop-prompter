import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { DiffEditor } from "@monaco-editor/react";
import { RefreshCw, X, GitCompare, AlertTriangle } from "lucide-react";
import type { GitDiffFile, GitDiffResponse } from "../types/git";

interface GitDiffPanelProps {
  sessionPath?: string | null;
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

export const GitDiffPanel = ({ sessionPath, onClose }: GitDiffPanelProps) => {
  const [files, setFiles] = useState<GitDiffFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [repoRoot, setRepoRoot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDiff = useCallback(async () => {
    if (!sessionPath || !isTauri()) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await invoke<GitDiffResponse>("get_git_diff", {
        path: sessionPath,
      });
      setFiles(response.files ?? []);
      setRepoRoot(response.root ?? null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load git diff.",
      );
    } finally {
      setLoading(false);
    }
  }, [sessionPath]);

  useEffect(() => {
    if (!sessionPath) {
      setFiles([]);
      setSelectedPath(null);
      setRepoRoot(null);
      setError(null);
      return;
    }
    void loadDiff();
  }, [loadDiff, sessionPath]);

  useEffect(() => {
    if (files.length === 0) {
      setSelectedPath(null);
      return;
    }
    if (!selectedPath || !files.some((file) => file.path === selectedPath)) {
      setSelectedPath(files[0].path);
    }
  }, [files, selectedPath]);

  const selectedFile = useMemo(
    () => files.find((file) => file.path === selectedPath) ?? null,
    [files, selectedPath],
  );

  const language = useMemo(() => {
    if (!selectedFile) {
      return "plaintext";
    }
    return getLanguageFromPath(selectedFile.path);
  }, [selectedFile]);

  const renderContent = () => {
    if (!isTauri()) {
      return (
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
          Git diff is available only in the Tauri desktop app.
        </div>
      );
    }
    if (!sessionPath) {
      return (
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
          No session path saved yet. Run a prompt in a project directory.
        </div>
      );
    }
    if (loading) {
      return (
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
          Loading diff...
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-rose-300">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      );
    }
    if (files.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
          No changes detected.
        </div>
      );
    }

    return (
      <>
        <div className="w-52 border-r border-zinc-800 bg-zinc-950/40 flex flex-col">
          <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
            Changed files
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {files.map((file) => {
              const meta = statusMeta[file.status] ?? {
                label: file.status,
                badge: "?",
                className: "text-zinc-400",
              };
              const isActive = file.path === selectedPath;
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
            })}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          {selectedFile?.isBinary ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              Binary file diff is not available.
            </div>
          ) : (
            <DiffEditor
              original={selectedFile?.oldContent ?? ""}
              modified={selectedFile?.newContent ?? ""}
              language={language}
              theme="vs-dark"
              options={{
                renderSideBySide: false,
                readOnly: true,
                minimap: { enabled: false },
                automaticLayout: true,
                scrollBeyondLastLine: false,
                wordWrap: "on",
                fontSize: 12,
                fontFamily:
                  "'JetBrains Mono', 'SFMono-Regular', ui-monospace, monospace",
              }}
            />
          )}
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900 shrink-0">
        <div className="flex items-center gap-2 text-zinc-200 font-semibold">
          <GitCompare className="w-4 h-4 text-emerald-400" />
          <span>Git Diff</span>
        </div>
        <div className="flex items-center gap-2">
          {repoRoot && (
            <span className="text-[10px] text-zinc-500 max-w-[140px] truncate">
              {repoRoot}
            </span>
          )}
          <button
            onClick={loadDiff}
            disabled={!sessionPath || loading || !isTauri()}
            className="p-1.5 hover:bg-zinc-800 text-zinc-400 rounded-md transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            title="Refresh diff"
          >
            <RefreshCw className={loading ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-800 text-zinc-400 rounded-md transition-colors"
            title="Close Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex">{renderContent()}</div>
    </div>
  );
};
