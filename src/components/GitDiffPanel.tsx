import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { DiffEditor } from "@monaco-editor/react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FolderTree,
  GitCompare,
  List,
  RefreshCw,
  X,
} from "lucide-react";
import {
  Group,
  Panel as ResizablePanel,
  Separator,
} from "react-resizable-panels";
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

type FileTreeNode = {
  name: string;
  path: string;
  type: "dir" | "file";
  children?: FileTreeNode[];
  file?: GitDiffFile;
};

const buildFileTree = (files: GitDiffFile[]) => {
  const root: FileTreeNode = {
    name: "",
    path: "",
    type: "dir",
    children: [],
  };
  const dirMap = new Map<string, FileTreeNode>();
  dirMap.set("", root);

  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const file of sortedFiles) {
    const parts = file.path.split("/").filter(Boolean);
    let currentPath = "";
    let currentNode = root;
    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (isFile) {
        currentNode.children?.push({
          name: part,
          path: currentPath,
          type: "file",
          file,
        });
        return;
      }
      let nextNode = dirMap.get(currentPath);
      if (!nextNode) {
        nextNode = {
          name: part,
          path: currentPath,
          type: "dir",
          children: [],
        };
        dirMap.set(currentPath, nextNode);
        currentNode.children?.push(nextNode);
      }
      currentNode = nextNode;
    });
  }

  const sortNodes = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "dir" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => {
      if (node.children) {
        sortNodes(node.children);
      }
    });
  };

  sortNodes(root.children ?? []);
  return root.children ?? [];
};

const collectDirectoryPaths = (nodes: FileTreeNode[]) => {
  const paths: string[] = [];
  const walk = (items: FileTreeNode[]) => {
    items.forEach((node) => {
      if (node.type === "dir") {
        paths.push(node.path);
        if (node.children) {
          walk(node.children);
        }
      }
    });
  };
  walk(nodes);
  return paths;
};

export const GitDiffPanel = ({ sessionPath, onClose }: GitDiffPanelProps) => {
  const [files, setFiles] = useState<GitDiffFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [repoRoot, setRepoRoot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChangedOnly, setShowChangedOnly] = useState(true);
  const [fileViewMode, setFileViewMode] = useState<"list" | "tree">("list");
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

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

  const fileTree = useMemo(() => buildFileTree(files), [files]);

  useEffect(() => {
    if (fileTree.length === 0) {
      setExpandedDirs(new Set());
      return;
    }
    setExpandedDirs(new Set(collectDirectoryPaths(fileTree)));
  }, [fileTree]);

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const renderFileRow = (
    file: GitDiffFile,
    options?: { depth?: number; useBaseName?: boolean },
  ) => {
    const meta = statusMeta[file.status] ?? {
      label: file.status,
      badge: "?",
      className: "text-zinc-400",
    };
    const isActive = file.path === selectedPath;
    const label = options?.useBaseName
      ? file.path.split("/").pop() ?? file.path
      : file.path;
    const paddingLeft = options?.depth ? options.depth * 12 + 12 : undefined;

    return (
      <button
        key={file.path}
        onClick={() => setSelectedPath(file.path)}
        className={`w-full px-3 py-2 text-left text-xs transition-colors border-b border-zinc-900/60 ${
          isActive
            ? "bg-zinc-800 text-zinc-100"
            : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
        }`}
        style={paddingLeft ? { paddingLeft } : undefined}
        title={`${meta.label} ${file.path}`}
      >
        <div className="flex items-center gap-2">
          <span className={`font-mono ${meta.className}`}>{meta.badge}</span>
          <span className="truncate">{label}</span>
        </div>
      </button>
    );
  };

  const renderTreeNodes = (nodes: FileTreeNode[], depth: number) =>
    nodes.map((node) => {
      if (node.type === "dir") {
        const isExpanded = expandedDirs.has(node.path);
        const paddingLeft = depth * 12 + 8;
        return (
          <div key={node.path}>
            <button
              onClick={() => toggleDir(node.path)}
              className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800/60 transition-colors"
              style={{ paddingLeft }}
              title={node.path}
            >
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 text-zinc-500" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-zinc-500" />
                )}
                <span className="truncate">{node.name}</span>
              </div>
            </button>
            {isExpanded && node.children
              ? renderTreeNodes(node.children, depth + 1)
              : null}
          </div>
        );
      }
      if (!node.file) {
        return null;
      }
      return renderFileRow(node.file, { depth, useBaseName: true });
    });

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
      <Group
        orientation="horizontal"
        id="git-diff-layout"
        className="flex-1 min-h-0"
      >
        <ResizablePanel
          id="git-diff-files"
          defaultSize="25%"
          minSize="15%"
          maxSize="45%"
        >
          <div className="h-full border-r border-zinc-800 bg-zinc-950/40 flex flex-col">
            <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800 flex items-center justify-between">
              <span>Changed files</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setFileViewMode("list")}
                  className={`p-1 rounded-md transition-colors ${
                    fileViewMode === "list"
                      ? "bg-zinc-800 text-zinc-200"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                  title="List view"
                >
                  <List className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setFileViewMode("tree")}
                  className={`p-1 rounded-md transition-colors ${
                    fileViewMode === "tree"
                      ? "bg-zinc-800 text-zinc-200"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                  title="Tree view"
                >
                  <FolderTree className="h-3 w-3" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {fileViewMode === "tree"
                ? renderTreeNodes(fileTree, 0)
                : files.map((file) => renderFileRow(file))}
            </div>
          </div>
        </ResizablePanel>
        <Separator className="w-1 bg-zinc-800 hover:bg-indigo-500 transition-colors cursor-col-resize" />
        <ResizablePanel id="git-diff-viewer" minSize="45%">
          <div className="flex-1 min-w-0 h-full">
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
                originalModelPath={`${selectedFile?.path ?? "diff"}#original`}
                modifiedModelPath={`${selectedFile?.path ?? "diff"}#modified`}
                keepCurrentModel={true}
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
                  hideUnchangedRegions: showChangedOnly
                    ? {
                        enabled: true,
                        contextLineCount: 3,
                        minimumLineCount: 3,
                      }
                    : { enabled: false },
                }}
              />
            )}
          </div>
        </ResizablePanel>
      </Group>
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
          <label className="flex items-center gap-2 text-[10px] text-zinc-400">
            <input
              type="checkbox"
              checked={showChangedOnly}
              onChange={(event) => setShowChangedOnly(event.target.checked)}
              className="w-3 h-3 rounded border-zinc-600 bg-zinc-950 text-indigo-500 focus:ring-indigo-500/50 focus:ring-offset-0"
            />
            Only changed lines
          </label>
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
