import React from "react";
import {
  Terminal,
  User,
  Bot,
  AlertCircle,
  CheckCircle2,
  FileText,
  FolderOpen,
  Search,
  FileEdit,
  Clock,
  Circle,
  Settings,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { ClaudeStreamMessage, MessageContent } from "@/types/claude";

interface StreamMessageProps {
  message: ClaudeStreamMessage;
  className?: string;
  streamMessages: ClaudeStreamMessage[];
}

/**
 * Component to render a single Claude Code stream message
 */
const StreamMessageComponent: React.FC<StreamMessageProps> = ({
  message,
  className,
  streamMessages,
}) => {
  // Get tool result for a specific tool call ID
  const getToolResult = (toolId: string | undefined): MessageContent | null => {
    if (!toolId) return null;
    for (const msg of streamMessages) {
      if (msg.type === "user" && msg.message?.content) {
        for (const content of msg.message.content) {
          if (content.type === "tool_result" && content.tool_use_id === toolId) {
            return content;
          }
        }
      }
    }
    return null;
  };

  // Skip rendering for meta messages
  if (message.isMeta && !message.leafUuid && !message.summary) {
    return null;
  }

  // System initialization message
  if (message.type === "system" && message.subtype === "init") {
    return (
      <Card className={cn("border-blue-500/20 bg-blue-500/5", className)}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Settings className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="flex-1 space-y-2">
              <h4 className="font-semibold text-sm">Session Initialized</h4>
              <div className="text-xs text-zinc-400 space-y-1">
                {message.session_id && (
                  <div>
                    Session: <code className="font-mono">{message.session_id.slice(0, 8)}...</code>
                  </div>
                )}
                {message.model && <div>Model: {message.model}</div>}
                {message.cwd && (
                  <div>
                    Working directory: <code className="font-mono">{message.cwd}</code>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Assistant message
  if (message.type === "assistant" && message.message) {
    const msg = message.message;
    let hasContent = false;

    return (
      <Card className={cn("border-indigo-500/20 bg-indigo-500/5", className)}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Bot className="h-5 w-5 text-indigo-400 mt-0.5" />
            <div className="flex-1 space-y-3 min-w-0">
              {msg.content?.map((content, idx) => {
                // Text content
                if (content.type === "text" && content.text) {
                  hasContent = true;
                  return (
                    <div key={idx} className="prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || "");
                            const isInline = !match;
                            return !isInline && match ? (
                              <SyntaxHighlighter
                                style={oneDark}
                                language={match[1]}
                                PreTag="div"
                              >
                                {String(children).replace(/\n$/, "")}
                              </SyntaxHighlighter>
                            ) : (
                              <code className={cn("bg-zinc-700 px-1 py-0.5 rounded", className)} {...props}>
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {content.text}
                      </ReactMarkdown>
                    </div>
                  );
                }

                // Thinking content
                if (content.type === "thinking" && content.thinking) {
                  hasContent = true;
                  return (
                    <div key={idx} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                      <div className="flex items-center gap-2 mb-2 text-xs text-zinc-400">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Thinking...</span>
                      </div>
                      <div className="text-xs text-zinc-400 font-mono whitespace-pre-wrap">
                        {content.thinking.slice(0, 500)}
                        {content.thinking.length > 500 && "..."}
                      </div>
                    </div>
                  );
                }

                // Tool use
                if (content.type === "tool_use" && content.name) {
                  hasContent = true;
                  const toolResult = getToolResult(content.id);
                  return (
                    <ToolUseWidget
                      key={idx}
                      toolName={content.name}
                      input={content.input || {}}
                      result={toolResult}
                    />
                  );
                }

                return null;
              })}

              {msg.usage && (
                <div className="text-xs text-zinc-500 mt-2">
                  Tokens: {msg.usage.input_tokens} in, {msg.usage.output_tokens} out
                </div>
              )}

              {!hasContent && (
                <div className="text-xs text-zinc-500 italic">Processing...</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // User message
  if (message.type === "user") {
    if (message.isMeta) return null;

    const msg = message.message;
    if (!msg?.content) return null;

    // Check if it's just tool results (skip rendering those separately)
    const hasVisibleContent = Array.isArray(msg.content)
      ? msg.content.some(
          (c) => c.type === "text" || (c.type === "tool_result" && !c.tool_use_id)
        )
      : typeof msg.content === "string";

    if (!hasVisibleContent) return null;

    return (
      <Card className={cn("border-zinc-600/20 bg-zinc-800/30", className)}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <User className="h-5 w-5 text-zinc-400 mt-0.5" />
            <div className="flex-1 space-y-2 min-w-0">
              {typeof msg.content === "string" ? (
                <div className="text-sm">{msg.content}</div>
              ) : (
                msg.content?.map((content, idx) => {
                  if (content.type === "text" && content.text) {
                    return (
                      <div key={idx} className="text-sm">
                        {content.text}
                      </div>
                    );
                  }
                  return null;
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Result message
  if (message.type === "result") {
    const isError = message.is_error || message.subtype?.includes("error");

    return (
      <Card
        className={cn(
          isError
            ? "border-red-500/20 bg-red-500/5"
            : "border-green-500/20 bg-green-500/5",
          className
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {isError ? (
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
            )}
            <div className="flex-1 space-y-2">
              <h4 className="font-semibold text-sm">
                {isError ? "Execution Failed" : "Execution Complete"}
              </h4>

              {message.result && (
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.result}
                  </ReactMarkdown>
                </div>
              )}

              {message.error && (
                <div className="text-sm text-red-400">{message.error}</div>
              )}

              <div className="text-xs text-zinc-500 space-y-1 mt-2">
                {(message.cost_usd || message.total_cost_usd) && (
                  <div>
                    Cost: ${(message.cost_usd || message.total_cost_usd)!.toFixed(4)} USD
                  </div>
                )}
                {message.duration_ms && (
                  <div>Duration: {(message.duration_ms / 1000).toFixed(2)}s</div>
                )}
                {message.num_turns && <div>Turns: {message.num_turns}</div>}
                {message.usage && (
                  <div>
                    Total tokens: {message.usage.input_tokens + message.usage.output_tokens}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};

/**
 * Tool Use Widget - renders tool calls with their results
 */
const ToolUseWidget: React.FC<{
  toolName: string;
  input: Record<string, unknown>;
  result: MessageContent | null;
}> = ({ toolName, input, result }) => {
  const getToolIcon = () => {
    const name = toolName.toLowerCase();
    if (name === "bash") return <Terminal className="h-4 w-4 text-green-500" />;
    if (name === "read") return <FileText className="h-4 w-4 text-blue-500" />;
    if (name === "write") return <FileEdit className="h-4 w-4 text-yellow-500" />;
    if (name === "edit") return <FileEdit className="h-4 w-4 text-orange-500" />;
    if (name === "ls") return <FolderOpen className="h-4 w-4 text-blue-400" />;
    if (name === "glob" || name === "grep") return <Search className="h-4 w-4 text-purple-500" />;
    if (name === "todowrite") return <CheckCircle2 className="h-4 w-4 text-indigo-500" />;
    if (name === "task") return <Bot className="h-4 w-4 text-cyan-500" />;
    return <Terminal className="h-4 w-4 text-zinc-400" />;
  };

  const getToolLabel = (): string => {
    const name = toolName.toLowerCase();
    if (name === "bash") return String(input.description || "Running command");
    if (name === "read") return `Reading ${(input.file_path as string)?.split("/").pop() || "file"}`;
    if (name === "write") return `Writing ${(input.file_path as string)?.split("/").pop() || "file"}`;
    if (name === "edit") return `Editing ${(input.file_path as string)?.split("/").pop() || "file"}`;
    if (name === "ls") return `Listing ${String(input.path || "directory")}`;
    if (name === "glob") return `Searching: ${String(input.pattern || "")}`;
    if (name === "grep") return `Grep: ${String(input.pattern || "")}`;
    if (name === "todowrite") return "Updating todo list";
    if (name === "task") return String(input.description || "Running task");
    return toolName;
  };

  const isLoading = !result;
  const isError = result?.is_error;

  // Extract result content
  let resultContent = "";
  if (result?.content) {
    if (typeof result.content === "string") {
      resultContent = result.content;
    } else if (typeof result.content === "object") {
      resultContent = JSON.stringify(result.content, null, 2);
    }
  }

  // TodoWrite special handling
  if (toolName.toLowerCase() === "todowrite" && input.todos) {
    const todos = input.todos as Array<{ content: string; status: string }>;
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 overflow-hidden">
        <div className="px-3 py-2 bg-zinc-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-indigo-500" />
          <span className="text-xs font-medium">Todo List</span>
        </div>
        <div className="p-3 space-y-2">
          {todos.map((todo, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              {todo.status === "completed" ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : todo.status === "in_progress" ? (
                <Clock className="h-4 w-4 text-blue-500 animate-pulse" />
              ) : (
                <Circle className="h-4 w-4 text-zinc-500" />
              )}
              <span className={todo.status === "completed" ? "line-through text-zinc-500" : ""}>
                {todo.content}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 overflow-hidden">
      <div className="px-3 py-2 bg-zinc-800 flex items-center gap-2">
        {getToolIcon()}
        <span className="text-xs font-medium flex-1">{getToolLabel()}</span>
        {isLoading && (
          <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            Running
          </Badge>
        )}
        {!isLoading && !isError && (
          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Done
          </Badge>
        )}
        {isError && (
          <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/20">
            <AlertCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        )}
      </div>

      {/* Show command for bash */}
      {toolName.toLowerCase() === "bash" && typeof input.command === "string" && (
        <div className="px-3 py-2 border-t border-zinc-700">
          <code className="text-xs font-mono text-green-400">$ {input.command}</code>
        </div>
      )}

      {/* Show result if available and not empty */}
      {resultContent && resultContent.trim() && (
        <div className="px-3 py-2 border-t border-zinc-700 max-h-48 overflow-auto">
          <pre className="text-xs font-mono text-zinc-400 whitespace-pre-wrap">
            {resultContent.slice(0, 2000)}
            {resultContent.length > 2000 && "..."}
          </pre>
        </div>
      )}
    </div>
  );
};

export const StreamMessage = React.memo(StreamMessageComponent);
