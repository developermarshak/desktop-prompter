import { useCallback, useEffect, useMemo, useRef } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal, type IDisposable } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { TerminalTab, CLIStatus } from "../types";
import { drainTerminalWrites, subscribeTerminalQueue } from "../terminalQueue";
import { ExternalLink } from "lucide-react";

type TerminalPanelProps = {
  className?: string;
  tabs: TerminalTab[];
  activeTabId: string | null;
  onPopOut?: () => void;
  onToggleLogs?: () => void;
  logsOpen?: boolean;
  isDetached?: boolean;
  onTerminalOutput?: (tabId: string, data: string) => void;
  cliStatus?: CLIStatus;
};

type TerminalOutputPayload = {
  id: string;
  data: string;
};

type TerminalSession = {
  term: Terminal;
  fit: FitAddon;
  inputDisposable?: IDisposable;
  resizeObserver?: ResizeObserver;
  ptyReady: boolean;
  dispose: (closePty: boolean) => void;
};

const theme = {
  background: "#0d1117",
  foreground: "#e6edf3",
  cursor: "#58a6ff",
};

const DEFAULT_FONT_SIZE = 13;
const MIN_FONT_SIZE = 9;
const MAX_FONT_SIZE = 22;

const fontFamily =
  "'JetBrains Mono', 'SFMono-Regular', ui-monospace, monospace";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const TerminalPanel = ({
  className,
  tabs,
  activeTabId,
  onPopOut,
  onToggleLogs,
  logsOpen = false,
  isDetached = false,
  onTerminalOutput,
  cliStatus = 'question',
}: TerminalPanelProps) => {
  const effectiveActiveTabId = activeTabId ?? tabs[0]?.id ?? null;
  const containersRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const sessionsRef = useRef<Map<string, TerminalSession>>(new Map());
  const pendingOutputRef = useRef<Map<string, string[]>>(new Map());
  const runningInTauri = isTauri();

  const writeOutput = useCallback((id: string, data: string) => {
    const session = sessionsRef.current.get(id);
    if (session) {
      session.term.write(data);
      return;
    }
    const pending = pendingOutputRef.current.get(id) ?? [];
    pending.push(data);
    pendingOutputRef.current.set(id, pending);
  }, []);

  const flushPendingOutput = useCallback((id: string, session: TerminalSession) => {
    const pending = pendingOutputRef.current.get(id);
    if (!pending || pending.length === 0) {
      return;
    }
    pending.forEach((chunk) => session.term.write(chunk));
    pendingOutputRef.current.delete(id);
  }, []);

  const flushQueuedWrites = useCallback(async (id: string) => {
    const session = sessionsRef.current.get(id);
    if (!session?.ptyReady) {
      return;
    }
    const pending = drainTerminalWrites(id);
    for (const entry of pending) {
      if (entry.delayMs) {
        await pause(entry.delayMs);
      }
      try {
        await invoke("write_pty", { id, data: entry.data });
      } catch (error) {
        session.term.writeln(`\r\n[write failed] ${String(error)}`);
      }
    }
  }, []);

  const adjustFontSize = useCallback((id: string, delta: number) => {
    const session = sessionsRef.current.get(id);
    if (!session) {
      return;
    }
    const current = session.term.options.fontSize ?? DEFAULT_FONT_SIZE;
    const next = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, current + delta));
    if (next === current) {
      return;
    }
    session.term.options.fontSize = next;
    session.fit.fit();
    if (session.ptyReady) {
      invoke("resize_pty", { id, cols: session.term.cols, rows: session.term.rows }).catch(
        () => undefined,
      );
    }
  }, []);

  const createSession = useCallback(
    async (id: string, container: HTMLDivElement) => {
      if (!runningInTauri || sessionsRef.current.has(id)) {
        return;
      }

      const term = new Terminal({
        cursorBlink: true,
        convertEol: true,
        fontFamily,
        fontSize: DEFAULT_FONT_SIZE,
        theme,
        scrollback: 2000,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(container);
      fit.fit();
      term.writeln("Type directly in the terminal.");
      term.focus();

      const session: TerminalSession = {
        term,
        fit,
        ptyReady: false,
        dispose: () => undefined,
      };
      sessionsRef.current.set(id, session);

      term.attachCustomKeyEventHandler((event) => {
        if (event.type !== "keydown") {
          return true;
        }
        if (event.metaKey && !event.ctrlKey && !event.altKey) {
          if (event.key === "+" || event.key === "=") {
            adjustFontSize(id, 1);
            return false;
          }
          if (event.key === "-" || event.key === "_") {
            adjustFontSize(id, -1);
            return false;
          }
        }
        return true;
      });

      const resizeToFit = () => {
        fit.fit();
        if (!session.ptyReady) {
          return;
        }
        invoke("resize_pty", { id, cols: term.cols, rows: term.rows }).catch(
          () => undefined,
        );
      };

      session.resizeObserver = new ResizeObserver(() => {
        resizeToFit();
      });
      session.resizeObserver.observe(container);

      session.inputDisposable = term.onData((data) => {
        invoke("write_pty", { id, data }).catch((error) => {
          term.writeln(`\r\n[write failed] ${String(error)}`);
        });
      });

      session.dispose = (closePty: boolean) => {
        session.inputDisposable?.dispose();
        session.resizeObserver?.disconnect();
        term.dispose();
        if (closePty) {
          invoke("close_pty", { id }).catch(() => undefined);
        }
      };

      flushPendingOutput(id, session);

      try {
        await invoke("spawn_pty", { id, cols: term.cols, rows: term.rows });
        session.ptyReady = true;
        resizeToFit();
        await flushQueuedWrites(id);
      } catch (error) {
        term.writeln(`\r\n[failed to start shell] ${String(error)}`);
      }
    },
    [adjustFontSize, flushPendingOutput, flushQueuedWrites, runningInTauri],
  );

  useEffect(() => {
    if (!runningInTauri) {
      return;
    }
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    listen<TerminalOutputPayload>("terminal-output", (event) => {
      writeOutput(event.payload.id, event.payload.data);
      if (event.payload.data) {
        try {
          onTerminalOutput?.(event.payload.id, event.payload.data);
        } catch (error) {
          console.error("Error in terminal output callback:", error);
        }
      }
    })
      .then((stop) => {
        if (cancelled) {
          stop();
          return;
        }
        unlisten = stop;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (unlisten) {
        unlisten();
      }
    };
  }, [onTerminalOutput, runningInTauri, writeOutput]);

  useEffect(() => {
    if (!runningInTauri) {
      return;
    }
    const unsubscribe = subscribeTerminalQueue(() => {
      sessionsRef.current.forEach((_, id) => {
        void flushQueuedWrites(id);
      });
    });
    return () => {
      unsubscribe();
    };
  }, [flushQueuedWrites, runningInTauri]);

  useEffect(() => {
    if (!runningInTauri) {
      return;
    }
    const existingIds = new Set(tabs.map((tab) => tab.id));

    sessionsRef.current.forEach((session, id) => {
      if (!existingIds.has(id)) {
        session.dispose(true);
        sessionsRef.current.delete(id);
      }
    });

    tabs.forEach((tab) => {
      const container = containersRef.current.get(tab.id);
      if (!container) {
        return;
      }
      void createSession(tab.id, container);
    });
  }, [tabs, createSession, runningInTauri]);

  useEffect(() => {
    if (!runningInTauri || !effectiveActiveTabId) {
      return;
    }
    const session = sessionsRef.current.get(effectiveActiveTabId);
    if (!session) {
      return;
    }
    session.term.focus();
    session.fit.fit();
    if (session.ptyReady) {
      invoke("resize_pty", {
        id: effectiveActiveTabId,
        cols: session.term.cols,
        rows: session.term.rows,
      }).catch(() => undefined);
    }
    void flushQueuedWrites(effectiveActiveTabId);
  }, [effectiveActiveTabId, flushQueuedWrites, runningInTauri]);

  useEffect(() => {
    return () => {
      sessionsRef.current.forEach((session) => session.dispose(false));
      sessionsRef.current.clear();
      pendingOutputRef.current.clear();
    };
  }, []);

  const hasTabs = tabs.length > 0;
  const containerClassName = useMemo(
    () => `flex h-full flex-col ${className || ""}`.trim(),
    [className],
  );

  const statusColors: Record<CLIStatus, string> = {
    idle: 'bg-yellow-500',
    working: 'bg-blue-500 animate-pulse',
    question: 'bg-yellow-500 animate-pulse',
    done: 'bg-green-500',
  };

  const statusTitles: Record<CLIStatus, string> = {
    idle: 'CLI waiting for input',
    working: 'CLI working...',
    question: 'CLI waiting for input',
    done: 'CLI task completed',
  };

  return (
    <div className={containerClassName}>
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <div className="text-xs font-semibold text-zinc-200">Terminal</div>
          <div
            className={`w-2 h-2 ${statusColors[cliStatus]}`}
            title={statusTitles[cliStatus]}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="text-[10px] text-zinc-500">Desktop PTY</div>
          {onToggleLogs && (
            <button
              onClick={onToggleLogs}
              className="px-2 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              title={logsOpen ? 'Hide indication logs' : 'Show indication logs'}
            >
              Logs
            </button>
          )}
          {runningInTauri && !isDetached && onPopOut && (
            <button
              onClick={onPopOut}
              className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              title="Open in new window"
            >
              <ExternalLink size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="relative flex-1 bg-black">
        {!runningInTauri ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-zinc-500">
            <div>Terminal is available only in the Tauri desktop app.</div>
            <div className="text-xs text-zinc-600">
              Run `npm run tauri dev` to enable it.
            </div>
          </div>
        ) : !hasTabs ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-600">
            No terminal tabs.
          </div>
        ) : (
          tabs.map((tab) => (
            <div
              key={tab.id}
              ref={(el) => {
                if (el) {
                  containersRef.current.set(tab.id, el);
                } else {
                  containersRef.current.delete(tab.id);
                }
              }}
              onMouseDown={() => {
                sessionsRef.current.get(tab.id)?.term.focus();
              }}
              tabIndex={0}
              className={`absolute inset-0 transition-opacity ${
                tab.id === effectiveActiveTabId
                  ? "opacity-100"
                  : "opacity-0 pointer-events-none"
              }`}
              aria-hidden={tab.id !== effectiveActiveTabId}
            />
          ))
        )}
      </div>
    </div>
  );
};
