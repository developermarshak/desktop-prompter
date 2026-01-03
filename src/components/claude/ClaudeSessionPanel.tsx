import React, { useState, useRef, useEffect, useCallback } from "react";
import { Command, type Child } from "@tauri-apps/plugin-shell";
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
  tabId?: string;
  projectPath?: string;
  cliPath?: string;
  initialPrompt?: string;
  onOpenSettings?: () => void;
  onStatusChange?: (tabId: string, status: SessionStatus) => void;
}

export type SessionStatus = "idle" | "running" | "error" | "complete";

export const ClaudeSessionPanel: React.FC<ClaudeSessionPanelProps> = ({
  className,
  tabId,
  projectPath,
  cliPath = "claude",
  initialPrompt,
  onOpenSettings,
  onStatusChange,
}) => {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ClaudeStreamMessage[]>([]);
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [claudeAvailable, setClaudeAvailable] = useState<boolean | null>(null);
  const [checkKey, setCheckKey] = useState(0);

  const childProcessRef = useRef<Child | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const jsonBufferRef = useRef<string>("");
  const hasAutoRunRef = useRef(false);

  // Notify parent of status changes
  useEffect(() => {
    if (tabId) {
      onStatusChange?.(tabId, status);
    }
  }, [tabId, status, onStatusChange]);

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

  // Run Claude Code using Tauri Command API (not PTY)
  const runClaudeWithPrompt = useCallback(async (promptText: string) => {
    if (!promptText.trim() || status === "running") return;

    setStatus("running");
    setError(null);
    jsonBufferRef.current = "";

    try {
      // Build arguments
      const args = ["-p", "--verbose", "--output-format", "stream-json"];
      args.push(promptText.trim());

      console.log("[Claude Run] Spawning command:", cliPath, args, "cwd:", projectPath);

      // Create and spawn the command directly (not via PTY)
      // Pass cwd as an option if projectPath is specified
      const command = projectPath
        ? Command.create(cliPath, args, { cwd: projectPath })
        : Command.create(cliPath, args);

      // Handle stdout
      command.stdout.on("data", (data: string) => {
        console.log("[Claude Run] stdout chunk, length:", data.length);
        handlePtyData(data);
      });

      // Handle stderr (might have useful output)
      command.stderr.on("data", (data: string) => {
        console.log("[Claude Run] stderr:", data);
      });

      // Handle close event
      command.on("close", (data) => {
        console.log("[Claude Run] Command exited with code:", data.code);

        // Parse any remaining buffer
        if (jsonBufferRef.current.trim()) {
          parseJsonLine(jsonBufferRef.current);
        }

        if (data.code === 0) {
          setStatus("complete");
        } else {
          setStatus("error");
          setError(`Claude exited with code ${data.code ?? 'unknown'}`);
        }

        childProcessRef.current = null;
      });

      // Handle error event
      command.on("error", (error: string) => {
        console.error("[Claude Run] Command error:", error);
        setStatus("error");
        setError(error);
        childProcessRef.current = null;
      });

      // Spawn the process
      const child = await command.spawn();
      childProcessRef.current = child;

      console.log("[Claude Run] Command spawned with PID:", child.pid);

      setPrompt("");
    } catch (err) {
      console.error("[Claude Run] Exception during execution:", err);
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
      childProcessRef.current = null;
    }
  }, [status, projectPath, cliPath, handlePtyData, parseJsonLine]);

  // Run Claude Code from user input
  const runClaude = async () => {
    await runClaudeWithPrompt(prompt);
  };

  // Auto-run initial prompt
  useEffect(() => {
    if (initialPrompt && claudeAvailable && !hasAutoRunRef.current && status === "idle") {
      hasAutoRunRef.current = true;
      // Small delay to ensure component is fully mounted
      setTimeout(() => {
        if (initialPrompt.trim()) {
          runClaudeWithPrompt(initialPrompt);
          // Clear localStorage after using it
          localStorage.removeItem('promptArchitect_claudeSessionPrompt');
        }
      }, 500);
    }
  }, [initialPrompt, claudeAvailable, status, runClaudeWithPrompt]);

  // Cancel running process
  const cancelRun = async () => {
    if (childProcessRef.current) {
      try {
        console.log("[Claude Run] Killing process:", childProcessRef.current.pid);
        await childProcessRef.current.kill();
        childProcessRef.current = null;
        setStatus("idle");
      } catch (e) {
        console.error("Failed to cancel process:", e);
      }
    }
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
