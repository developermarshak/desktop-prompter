import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Play, Square, Terminal, X, CheckCircle, XCircle, Clock, Copy, Check } from 'lucide-react';
import { createCLIJob, streamJobEvents, CLIJobRequest, JobEvent } from '../services/cliJobService';

interface CLIJobRunnerProps {
  token: string;
  defaultCwd?: string;
}

export const CLIJobRunner: React.FC<CLIJobRunnerProps> = ({ token, defaultCwd = '/Users' }) => {
  const [tool, setTool] = useState<'aider' | 'codex' | 'claude_code' | 'cursor'>('aider');
  const [args, setArgs] = useState<string>('');
  const [cwd, setCwd] = useState<string>(defaultCwd);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<Array<{ type: 'stdout' | 'stderr' | 'info'; text: string }>>([]);
  const [status, setStatus] = useState<'idle' | 'queued' | 'running' | 'completed' | 'failed' | 'error'>('idle');
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [showAgentCommand, setShowAgentCommand] = useState(false);
  const [copied, setCopied] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const clearOutput = () => {
    setOutput([]);
    setStatus('idle');
    setExitCode(null);
    setShowAgentCommand(false);
  };

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
  const agentCommand = `prompter-agent --token ${token} --url ${API_BASE_URL}`;

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(agentCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy command:', error);
    }
  };

  const handleRun = useCallback(async () => {
    setShowAgentCommand(true);
    if (isRunning) {
      return;
    }

    clearOutput();
    setIsRunning(true);
    setStatus('queued');

    try {
      const request: CLIJobRequest = {
        tool,
        args: args.split(' ').filter((a) => a.trim()),
        cwd: cwd.trim() || defaultCwd,
        timeout_sec: 300,
        interactive: false,
      };

      const result = await createCLIJob(request, token);
      setStatus('running');

      // Subscribe to events
      const unsubscribe = streamJobEvents(result.job_id, token, (event: JobEvent) => {
        if (event.event === 'stdout') {
          setOutput((prev) => [...prev, { type: 'stdout', text: event.chunk || '' }]);
        } else if (event.event === 'stderr') {
          setOutput((prev) => [...prev, { type: 'stderr', text: event.chunk || '' }]);
        } else if (event.event === 'start') {
          setOutput((prev) => [...prev, { type: 'info', text: `Starting: ${event.message || ''}\n` }]);
          setStatus('running');
        } else if (event.event === 'exit') {
          setExitCode(event.code ?? null);
          setStatus(event.code === 0 ? 'completed' : 'failed');
          setIsRunning(false);
          if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
          }
        } else if (event.event === 'error') {
          setOutput((prev) => [...prev, { type: 'stderr', text: `Error: ${event.message || ''}\n` }]);
          setStatus('error');
          setIsRunning(false);
          if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
          }
        }
      });

      unsubscribeRef.current = unsubscribe;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode =
        typeof (error as { errorCode?: string }).errorCode === 'string'
          ? (error as { errorCode: string }).errorCode
          : null;
      setOutput([{ type: 'stderr', text: `Failed to start job: ${errorMessage}\n` }]);
      setStatus('error');
      setIsRunning(false);
      
      // Check if it's a NO_AGENT_ONLINE error
      if (errorCode === 'NO_AGENT_ONLINE') {
        setShowAgentCommand(true);
      } else {
        setShowAgentCommand(false);
      }
    }
  }, [tool, args, cwd, token, isRunning, defaultCwd]);

  const handleStop = () => {
    // Note: Actual stop would require backend support
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    setIsRunning(false);
    setStatus('error');
  };

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-zinc-400" />
          <h3 className="text-sm font-semibold text-white">CLI Tool Runner</h3>
        </div>
        <div className="flex items-center gap-2">
          {status === 'running' && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <Clock className="w-3.5 h-3.5 animate-spin" />
              Running
            </div>
          )}
          {status === 'completed' && (
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <CheckCircle className="w-3.5 h-3.5" />
              Completed
            </div>
          )}
          {(status === 'failed' || status === 'error') && (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <XCircle className="w-3.5 h-3.5" />
              {status === 'failed' ? `Failed (${exitCode})` : 'Error'}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 space-y-3">
        <div className="flex gap-2">
          <select
            value={tool}
            onChange={(e) => setTool(e.target.value as any)}
            disabled={isRunning}
            className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
          >
            <option value="aider">Aider</option>
            <option value="codex">Codex</option>
            <option value="claude_code">Claude Code</option>
            <option value="cursor">Cursor</option>
          </select>
          <input
            type="text"
            value={args}
            onChange={(e) => setArgs(e.target.value)}
            placeholder="Arguments (space-separated)"
            disabled={isRunning}
            className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
          />
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            placeholder="Working directory"
            disabled={isRunning}
            className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
          />
          {isRunning ? (
            <button
              onClick={handleStop}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          ) : (
            <button
              onClick={handleRun}
              disabled={!cwd.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Run
            </button>
          )}
          {output.length > 0 && (
            <button
              onClick={clearOutput}
              className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Output */}
      <div className="flex-1 overflow-auto bg-black p-4 font-mono text-sm">
        {showAgentCommand ? (
          <div className="space-y-4">
            <div className="text-red-400 mb-4">
              No agent is currently online. Please start the desktop agent with the following command:
            </div>
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <code className="flex-1 text-green-400 break-all">{agentCommand}</code>
                <button
                  onClick={handleCopyCommand}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors flex items-center gap-2 shrink-0"
                  title="Copy command"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-green-400" />
                      <span className="text-green-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : output.length === 0 ? (
          <div className="text-zinc-600 text-center py-8">
            Output will appear here when you run a command
          </div>
        ) : (
          <div className="space-y-0.5">
            {output.map((line, idx) => (
              <div
                key={idx}
                className={
                  line.type === 'stderr'
                    ? 'text-red-400'
                    : line.type === 'info'
                    ? 'text-yellow-400'
                    : 'text-green-400'
                }
              >
                {line.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
