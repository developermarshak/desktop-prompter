import React, { useState, useRef, useEffect, useCallback } from "react";
import { Command } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Send,
  Loader2,
  AlertCircle,
  Terminal,
  Bot,
  Square,
  RotateCcw,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { StreamMessage } from "./StreamMessage";
import type { ClaudeStreamMessage } from "@/types/claude";

interface ClaudeSessionPanelProps {
  className?: string;
  projectPath?: string;
  cliPath?: string;
  onOpenSettings?: () => void;
}

type SessionStatus = "idle" | "running" | "error" | "complete";

export const ClaudeSessionPanel: React.FC<ClaudeSessionPanelProps> = ({
  className,
  projectPath,
  cliPath = "claude",
  onOpenSettings,
}) => {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ClaudeStreamMessage[]>([]);
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [claudeAvailable, setClaudeAvailable] = useState<boolean | null>(null);
  const [checkKey, setCheckKey] = useState(0);

  const ptyIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const jsonBufferRef = useRef<string>("");

  // Check if claude is available
  useEffect(() => {
    const checkClaude = async () => {
      try {
        const testCmd = `${cliPath} --version`;
        const command = Command.create("sh", ["-c", testCmd]);
        const output = await command.execute();

        const isAvailable = output.code === 0;
        setClaudeAvailable(isAvailable);

        if (!isAvailable) {
          setError(`CLI check failed with exit code ${output.code}. ${output.stderr}`);
        }
      } catch (err) {
        setClaudeAvailable(false);
        setError(`Exception during CLI check: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    checkClaude();
  }, [cliPath, checkKey]);

  // Retry checking CLI availability
  const retryCheck = useCallback(() => {
    setClaudeAvailable(null); // Show loading state
    setError(null); // Clear previous error
    setCheckKey((k) => k + 1);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Parse JSONL output and extract messages
  const parseJsonLine = useCallback((line: string) => {
    if (!line.trim()) return;

    try {
      const parsed = JSON.parse(line) as ClaudeStreamMessage;
      setMessages((prev) => [...prev, parsed]);
    } catch (e) {
      console.error("[Claude Run] Failed to parse JSON line:", e);
    }
  }, []);

  // Handle PTY output data
  const handlePtyData = useCallback((data: string) => {
    jsonBufferRef.current += data;

    // Process complete lines
    const lines = jsonBufferRef.current.split("\n");

    // Keep the last incomplete line in the buffer
    jsonBufferRef.current = lines.pop() || "";

    // Parse complete lines
    for (const line of lines) {
      parseJsonLine(line);
    }
  }, [parseJsonLine]);


  // Run Claude Code with streaming via PTY
  const runClaude = async () => {
    if (!prompt.trim() || status === "running") return;

    setStatus("running");
    setError(null);
    jsonBufferRef.current = "";

    try {
      // Generate unique PTY ID
      const ptyId = crypto.randomUUID();
      ptyIdRef.current = ptyId;

      // Build full command with arguments
      const args = ["-p", "--verbose", "--output-format", "stream-json"];
      if (projectPath) {
        args.push("--cwd", projectPath);
      }
      args.push(prompt.trim());

      const fullCommand = `${cliPath} ${args.map(a => a.includes(' ') ? `'${a}'` : a).join(' ')}`;

      console.log("[Claude Run] Spawning PTY:", fullCommand);

      // Listen for output BEFORE spawning (using correct event names)
      const unlistenOutput = await listen<{ id: string; data: string }>("terminal-output", (event) => {
        // Only handle output from our PTY
        if (event.payload.id === ptyId) {
          console.log("[Claude Run] Received output chunk, length:", event.payload.data.length);
          handlePtyData(event.payload.data);
        }
      });

      const unlistenExit = await listen<{ id: string; code: number }>("terminal-exit", (event) => {
        // Only handle exit from our PTY
        if (event.payload.id !== ptyId) return;

        console.log("[Claude Run] PTY exited with code:", event.payload.code);

        // Parse any remaining buffer
        if (jsonBufferRef.current.trim()) {
          parseJsonLine(jsonBufferRef.current);
        }

        if (event.payload.code === 0) {
          setStatus("complete");
        } else {
          setStatus("error");
          setError(`Claude exited with code ${event.payload.code}`);
        }

        // Cleanup
        ptyIdRef.current = null;
        unlistenOutput();
        unlistenExit();
      });

      // Spawn PTY (starts a shell)
      await invoke("spawn_pty", {
        id: ptyId,
        cols: 120,
        rows: 30,
      });

      console.log("[Claude Run] PTY spawned, writing command...");

      // Write the command to the PTY
      await invoke("write_pty", {
        id: ptyId,
        data: fullCommand + "\n",
      });

      console.log("[Claude Run] Command written to PTY");

      setPrompt("");
    } catch (err) {
      console.error("[Claude Run] Exception during execution:", err);
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
      ptyIdRef.current = null;
    }
  };

  // Cancel running process
  const cancelRun = async () => {
    if (ptyIdRef.current) {
      try {
        console.log("[Claude Run] Cancelling PTY:", ptyIdRef.current);
        await invoke("close_pty", { id: ptyIdRef.current });
        ptyIdRef.current = null;
        setStatus("idle");
      } catch (e) {
        console.error("Failed to cancel PTY:", e);
      }
    }
  };

  // Clear session
  const clearSession = () => {
    setMessages([]);
    setStatus("idle");
    setError(null);
  };

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      runClaude();
    }
  };

  // Status badge
  const renderStatusBadge = () => {
    switch (status) {
      case "running":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            Running
          </Badge>
        );
      case "error":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20">
            <AlertCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      case "complete":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
            Complete
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
            Ready
          </Badge>
        );
    }
  };

  // Not available state
  if (claudeAvailable === false) {
    return (
      <div className={cn("flex flex-col h-full bg-zinc-900", className)}>
        <Card className="m-4 border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-sm mb-1">Claude CLI Not Found</h4>
                <p className="text-xs text-zinc-400 mb-2">
                  The Claude CLI is not installed or not in your PATH.
                  Install it from{" "}
                  <a
                    href="https://claude.ai/download"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    claude.ai/download
                  </a>
                </p>
                <p className="text-xs text-zinc-500 mb-3">
                  Tested path: <code className="bg-zinc-800 px-1 rounded">{cliPath}</code>
                </p>
                {error && (
                  <Card className="mb-3 border-zinc-700 bg-zinc-800/50">
                    <CardContent className="p-2">
                      <p className="text-xs text-zinc-400 font-mono">{error}</p>
                    </CardContent>
                  </Card>
                )}
                <div className="flex gap-2">
                  {onOpenSettings && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onOpenSettings}
                      className="h-7 text-xs"
                    >
                      <Settings className="h-3 w-3 mr-1" />
                      Configure CLI Path
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={retryCheck}
                    className="h-7 text-xs"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (claudeAvailable === null) {
    return (
      <div className={cn("flex flex-col h-full bg-zinc-900 items-center justify-center", className)}>
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        <p className="text-sm text-zinc-500 mt-2">Checking Claude CLI...</p>
        <p className="text-xs text-zinc-600 mt-1">Path: {cliPath}</p>
        {error && (
          <Card className="mt-4 max-w-2xl border-yellow-500/20 bg-yellow-500/5">
            <CardContent className="p-3">
              <p className="text-xs text-zinc-400">{error}</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full bg-zinc-900", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-700 bg-zinc-800/50">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-indigo-400" />
          <span className="text-sm font-medium">Claude Session</span>
        </div>
        <div className="flex items-center gap-2">
          {renderStatusBadge()}
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSession}
              className="h-7 text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Terminal className="h-12 w-12 text-zinc-600 mb-4" />
              <h3 className="text-lg font-medium text-zinc-400">Start a Claude Session</h3>
              <p className="text-sm text-zinc-500 mt-1 max-w-md">
                Enter a prompt below to start an interactive session with Claude Code.
                Claude will help you with coding tasks, file operations, and more.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <StreamMessage
                key={idx}
                message={msg}
                streamMessages={messages}
              />
            ))
          )}

          {error && (
            <Card className="border-red-500/20 bg-red-500/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Error</h4>
                    <p className="text-xs text-zinc-400">{error}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-zinc-700 p-4 bg-zinc-800/30">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your prompt... (Cmd/Ctrl+Enter to send)"
              className="min-h-[80px] bg-zinc-800 border-zinc-700 resize-none pr-20"
              disabled={status === "running"}
            />
            <div className="absolute bottom-2 right-2 text-xs text-zinc-500">
              {prompt.length > 0 && `${prompt.length} chars`}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {status === "running" ? (
              <Button
                onClick={cancelRun}
                variant="destructive"
                size="icon"
                className="h-10 w-10"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={runClaude}
                disabled={!prompt.trim()}
                size="icon"
                className="h-10 w-10"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
