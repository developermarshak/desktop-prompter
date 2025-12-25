import { CLIStatus, CLIStatusDetection, CLIStatusDetectionMatch } from '../types';

// Patterns to detect CLI asking questions
const QUESTION_PATTERNS = [
  /\?\s*$/m,                           // Lines ending with ?
  /\(y\/n\)/i,                         // (y/n) prompts
  /\(yes\/no\)/i,                      // (yes/no) prompts
  /continue\?/i,                       // Continue?
  /proceed\?/i,                        // Proceed?
  /approve\?/i,                        // Approve?
  /confirm\?/i,                        // Confirm?
  /Enter\s+(?:to\s+)?(?:continue|confirm|approve)/i,  // Press Enter to continue
  /waiting for (?:input|response|approval)/i,
  /Do you want to/i,
];

// Patterns to detect CLI is done/completed
const DONE_PATTERNS = [
  /Task completed/i,
  /Successfully completed/i,
  /Finished successfully/i,
  /Done!/i,
  /✓.*(?:complete|done|finished)/i,
  /All tasks completed/i,
  /Execution completed/i,
  /Process finished/i,
];

// Patterns to detect CLI is working
const WORKING_PATTERNS = [
  /Running/i,
  /Processing/i,
  /Executing/i,
  /Working on/i,
  /Analyzing/i,
  /Building/i,
  /Compiling/i,
  /Installing/i,
];

// Patterns specific to Codex/Claude Code
const CODEX_PATTERNS = {
  question: [
    /Would you like me to/i,
    /Should I proceed/i,
    /Do you want me to/i,
    /May I/i,
  ],
  done: [
    /I've completed/i,
    /I'm done/i,
    /Task is complete/i,
    /All set!/i,
  ],
  working: [
    /I'm working on/i,
    /Let me/i,
    /I'll/i,
    /Starting to/i,
  ],
};

/**
 * Analyzes terminal output to detect CLI status
 * @param output - The terminal output text
 * @param previousStatus - The previous CLI status to help with state transitions
 * @returns The detected CLI status
 */
function findMatch(patterns: RegExp[], text: string): RegExp | null {
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      return pattern;
    }
  }
  return null;
}

function buildMatch(
  group: CLIStatusDetectionMatch['group'],
  source: CLIStatusDetectionMatch['source'],
  pattern: RegExp,
): CLIStatusDetectionMatch {
  return {
    group,
    source,
    pattern: pattern.toString(),
  };
}

export function detectCLIStatusDetailed(
  output: string,
  previousStatus: CLIStatus = 'question',
): CLIStatusDetection {
  // Get the last few lines for analysis (most recent output is most relevant)
  const lines = output.split('\n').filter(line => line.trim().length > 0);
  const recentOutput = lines.slice(-10).join('\n'); // Last 10 lines
  const lastLine = lines[lines.length - 1] || '';

  // Check for question patterns first (highest priority)
  const questionLineMatch = findMatch(QUESTION_PATTERNS, lastLine);
  const questionCodexMatch = findMatch(CODEX_PATTERNS.question, recentOutput);
  if (questionLineMatch || questionCodexMatch) {
    return {
      status: 'question',
      previousStatus,
      reason: 'question',
      match: questionLineMatch
        ? buildMatch('question', 'lastLine', questionLineMatch)
        : buildMatch('question', 'recentOutput', questionCodexMatch as RegExp),
      lastLine,
      recentOutput,
      bufferSize: output.length,
    };
  }

  // Check for done patterns
  const doneMatch = findMatch(DONE_PATTERNS, recentOutput);
  const doneCodexMatch = findMatch(CODEX_PATTERNS.done, recentOutput);
  if (doneMatch || doneCodexMatch) {
    return {
      status: 'done',
      previousStatus,
      reason: 'done',
      match: doneMatch
        ? buildMatch('done', 'recentOutput', doneMatch)
        : buildMatch('done', 'recentOutput', doneCodexMatch as RegExp),
      lastLine,
      recentOutput,
      bufferSize: output.length,
    };
  }

  // Check for working patterns
  const workingMatch = findMatch(WORKING_PATTERNS, recentOutput);
  const workingCodexMatch = findMatch(CODEX_PATTERNS.working, recentOutput);
  if (workingMatch || workingCodexMatch) {
    return {
      status: 'working',
      previousStatus,
      reason: 'working',
      match: workingMatch
        ? buildMatch('working', 'recentOutput', workingMatch)
        : buildMatch('working', 'recentOutput', workingCodexMatch as RegExp),
      lastLine,
      recentOutput,
      bufferSize: output.length,
    };
  }

  // If we were previously in a 'working' state and didn't detect done/question,
  // keep the working state
  if (previousStatus === 'working') {
    return {
      status: 'working',
      previousStatus,
      reason: 'carryover',
      lastLine,
      recentOutput,
      bufferSize: output.length,
    };
  }

  // Default to question (idle removed)
  return {
    status: 'question',
    previousStatus,
    reason: 'idle',
    lastLine,
    recentOutput,
    bufferSize: output.length,
  };
}

export function detectCLIStatus(output: string, previousStatus: CLIStatus = 'question'): CLIStatus {
  return detectCLIStatusDetailed(output, previousStatus).status;
}

/**
 * Debounced status tracker to avoid rapid status changes
 */
export class CLIStatusTracker {
  private currentStatus: CLIStatus = 'question';
  private outputBuffer: string = '';
  private idleTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private onStatusChange: (status: CLIStatus) => void,
    private onDetection?: (detection: CLIStatusDetection) => void,
  ) {}

  addOutput(data: string): void {
    try {
      // Append to buffer, keep last 5000 characters
      this.outputBuffer = (this.outputBuffer + data).slice(-5000);

      // Detect status from accumulated output
      const detection = detectCLIStatusDetailed(this.outputBuffer, this.currentStatus);
      const newStatus = detection.status;
      this.onDetection?.(detection);

      if (newStatus !== this.currentStatus) {
        this.currentStatus = newStatus;
        this.onStatusChange(newStatus);
      }

      this.scheduleIdleFallback();
    } catch (error) {
      console.error("Error in CLIStatusTracker.addOutput:", error);
    }
  }

  reset(): void {
    this.outputBuffer = '';
    this.currentStatus = 'question';
    this.clearIdleTimeout();
    this.onStatusChange('question');
  }

  destroy(): void {
    this.clearIdleTimeout();
  }

  private clearIdleTimeout(): void {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }
  }

  private scheduleIdleFallback(): void {
    this.clearIdleTimeout();
    this.idleTimeout = setTimeout(() => {
      if (this.currentStatus === 'question') {
        return;
      }
      const snapshot = this.getBufferSnapshot();
      this.onDetection?.({
        status: 'question',
        previousStatus: this.currentStatus,
        reason: 'idle',
        lastLine: snapshot.lastLine,
        recentOutput: snapshot.recentOutput,
        bufferSize: this.outputBuffer.length,
      });
      this.currentStatus = 'question';
      this.onStatusChange('question');
    }, 5000);
  }

  private getBufferSnapshot(): { lastLine: string; recentOutput: string } {
    const lines = this.outputBuffer.split('\n').filter(line => line.trim().length > 0);
    const recentOutput = lines.slice(-10).join('\n');
    const lastLine = lines[lines.length - 1] || '';
    return { lastLine, recentOutput };
  }
}
