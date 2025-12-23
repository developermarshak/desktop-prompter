import { useCallback, useEffect, useMemo, useRef } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal, type IDisposable } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { TerminalTab } from "../types";
import { drainTerminalWrites, subscribeTerminalQueue } from "../terminalQueue";

type TerminalPanelProps = {
  className?: string;
  tabs: TerminalTab[];
  activeTabId: string | null;
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

const fontFamily =
  "'JetBrains Mono', 'SFMono-Regular', ui-monospace, monospace";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const TerminalPanel = ({
  className,
  tabs,
  activeTabId,
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

  const createSession = useCallback(
    async (id: string, container: HTMLDivElement) => {
      if (!runningInTauri || sessionsRef.current.has(id)) {
        return;
      }

      const term = new Terminal({
        cursorBlink: true,
        convertEol: true,
        fontFamily,
        fontSize: 13,
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
    [flushPendingOutput, flushQueuedWrites, runningInTauri],
  );

  useEffect(() => {
    if (!runningInTauri) {
      return;
    }
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    listen<TerminalOutputPayload>("terminal-output", (event) => {
      writeOutput(event.payload.id, event.payload.data);
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
  }, [runningInTauri, writeOutput]);

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

  return (
    <div className={containerClassName}>
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-2">
        <div className="text-sm font-semibold text-zinc-200">Terminal</div>
        <div className="text-xs text-zinc-500">Desktop PTY</div>
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
