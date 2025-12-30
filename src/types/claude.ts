/**
 * Claude Code Stream Message Types
 */

export interface ClaudeStreamMessage {
  type: "system" | "assistant" | "user" | "result";
  subtype?: string;
  message?: {
    content?: MessageContent[];
    usage?: TokenUsage;
  };
  usage?: TokenUsage;
  // System init fields
  session_id?: string;
  model?: string;
  cwd?: string;
  tools?: string[];
  // Result fields
  result?: string;
  error?: string;
  is_error?: boolean;
  cost_usd?: number;
  total_cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
  // Meta fields
  isMeta?: boolean;
  leafUuid?: string;
  summary?: string;
  [key: string]: unknown;
}

export interface MessageContent {
  type: "text" | "tool_use" | "tool_result" | "thinking";
  text?: string;
  thinking?: string;
  signature?: string;
  // Tool use fields
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  // Tool result fields
  tool_use_id?: string;
  content?: string | unknown;
  is_error?: boolean;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface ClaudeSession {
  id: string;
  project_path: string;
  created_at: number;
  first_message?: string;
  model?: string;
}
