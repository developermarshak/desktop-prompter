import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Terminal } from 'xterm'
import type { IDisposable } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { invoke } from '@tauri-apps/api/tauri'
import { listen } from '@tauri-apps/api/event'
import { Play, Plus, TerminalSquare, X } from 'lucide-react'
import 'xterm/css/xterm.css'

const DEFAULT_COMMAND = 'ls -la'

type TerminalTab = {
  id: string
  title: string
  createdAt: number
}

type CommandResult = {
  stdout: string
  stderr: string
  code: number
}

type TerminalEntry = {
  term: Terminal
  fit: FitAddon
  inputDisposable?: IDisposable
}

type TerminalOutputEvent = {
  id: string
  data: string
}

const createTab = (index: number): TerminalTab => ({
  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `tab-${Date.now()}-${index}`,
  title: `Terminal ${index}`,
  createdAt: Date.now()
})

const normalizeOutput = (value: string) => value.replace(/\r?\n/g, '\r\n')

const isTauri = () => typeof window !== 'undefined' && '__TAURI__' in window

const theme = {
  background: '#1a1710',
  foreground: '#f7f7f4',
  cursor: '#ff9b1a',
  selectionBackground: 'rgba(255, 179, 77, 0.35)'
}

const tabsInitial = [createTab(1)]

const runDemoCommand = async (command: string): Promise<CommandResult> => {
  const simulated = `Demo mode: ran \"${command}\" on the desktop shell.\nOutput streaming appears here.`
  return {
    stdout: simulated,
    stderr: '',
    code: 0
  }
}

const useTerminalMap = () => {
  const mapRef = useRef(new Map<string, TerminalEntry>())

  const register = useCallback((id: string, entry: TerminalEntry) => {
    mapRef.current.set(id, entry)
  }, [])

  const unregister = useCallback((id: string) => {
    const entry = mapRef.current.get(id)
    mapRef.current.delete(id)
    return entry
  }, [])

  const get = useCallback((id: string) => mapRef.current.get(id), [])

  return useMemo(() => ({ register, unregister, get, map: mapRef.current }), [register, unregister, get])
}

type TerminalCanvasProps = {
  id: string
  active: boolean
  interactive: boolean
  onReady: (id: string, entry: TerminalEntry) => void
  onDispose: (id: string) => void
  onResize: (id: string, cols: number, rows: number) => void
}

const TerminalCanvas = ({ id, active, interactive, onReady, onDispose, onResize }: TerminalCanvasProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const termRef = useRef<Terminal | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const term = new Terminal({
      cursorBlink: true,
      disableStdin: !interactive,
      fontSize: 13,
      theme,
      scrollback: 2000
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)
    fit.fit()
    term.writeln(
      interactive
        ? 'Type directly in the terminal.'
        : '\x1b[1;33mTerminal ready.\x1b[0m Type a command and hit Run.'
    )
    term.focus()
    fitRef.current = fit
    termRef.current = term
    onReady(id, { term, fit })

    return () => {
      termRef.current = null
      term.dispose()
      onDispose(id)
    }
  }, [id, interactive, onReady, onDispose])

  useEffect(() => {
    if (!active || !containerRef.current || !fitRef.current) return
    const observer = new ResizeObserver(() => {
      fitRef.current?.fit()
      const term = termRef.current
      if (term) {
        onResize(id, term.cols, term.rows)
      }
    })
    observer.observe(containerRef.current)
    fitRef.current.fit()
    const term = termRef.current
    if (term) {
      onResize(id, term.cols, term.rows)
    }
    return () => observer.disconnect()
  }, [active, id, onResize])

  return (
    <div
      className={`absolute inset-0 transition-opacity duration-300 ${
        active ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      aria-hidden={!active}
    >
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}

const App = () => {
  const [tabs, setTabs] = useState<TerminalTab[]>(tabsInitial)
  const [activeTabId, setActiveTabId] = useState(tabsInitial[0].id)
  const [command, setCommand] = useState(DEFAULT_COMMAND)
  const [isRunning, setIsRunning] = useState(false)
  const terminals = useTerminalMap()

  const handleNewTab = () => {
    setTabs(prev => {
      const next = createTab(prev.length + 1)
      setActiveTabId(next.id)
      return [...prev, next]
    })
  }

  const handleCloseTab = (id: string) => {
    setTabs(prev => {
      if (prev.length === 1) return prev
      const nextTabs = prev.filter(tab => tab.id !== id)
      if (activeTabId === id) {
        setActiveTabId(nextTabs[0].id)
      }
      return nextTabs
    })
  }

  const writeToTerminal = useCallback(
    (id: string, value: string) => {
      const entry = terminals.get(id)
      if (!entry) return
      entry.term.write(normalizeOutput(value))
    },
    [terminals]
  )

  useEffect(() => {
    if (!isTauri()) return
    let unlisten: (() => void) | undefined
    let cancelled = false

    listen<TerminalOutputEvent>('terminal-output', event => {
      const payload = event.payload
      writeToTerminal(payload.id, payload.data)
    })
      .then(stop => {
        if (cancelled) {
          stop()
          return
        }
        unlisten = stop
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (unlisten) unlisten()
    }
  }, [writeToTerminal])

  const handleTerminalReady = useCallback(
    async (id: string, entry: TerminalEntry) => {
      terminals.register(id, entry)
      if (!isTauri()) return

      try {
        await invoke('spawn_pty', { id, cols: entry.term.cols, rows: entry.term.rows })
        if (!entry.inputDisposable) {
          entry.inputDisposable = entry.term.onData(data => {
            invoke('write_pty', { id, data }).catch(() => {})
          })
        }
      } catch (error) {
        entry.term.writeln(`\r\n\x1b[31mFailed to start shell: ${String(error)}\x1b[0m`)
      }
    },
    [terminals]
  )

  const handleTerminalDispose = useCallback(
    (id: string) => {
      const entry = terminals.unregister(id)
      entry?.inputDisposable?.dispose()
      if (isTauri()) {
        invoke('close_pty', { id }).catch(() => {})
      }
    },
    [terminals]
  )

  const handleTerminalResize = useCallback((id: string, cols: number, rows: number) => {
    if (!isTauri()) return
    invoke('resize_pty', { id, cols, rows }).catch(() => {})
  }, [])

  const runCommand = async () => {
    const trimmed = command.trim()
    if (!trimmed || isRunning) return
    const activeId = activeTabId
    const entry = terminals.get(activeId)
    if (!entry) return

    if (isTauri()) {
      entry.term.focus()
      invoke('write_pty', { id: activeId, data: `${trimmed}\n` }).catch(error => {
        entry.term.writeln(`\r\n\x1b[31mFailed to send command: ${String(error)}\x1b[0m`)
      })
      return
    }

    entry.term.writeln(`\x1b[1;32m$ ${trimmed}\x1b[0m`)
    setIsRunning(true)

    try {
      const result = isTauri()
        ? await invoke<CommandResult>('run_command', { command: trimmed })
        : await runDemoCommand(trimmed)

      if (result.stdout) {
        writeToTerminal(activeId, result.stdout)
      }
      if (result.stderr) {
        entry.term.write(`\r\n\x1b[31m${normalizeOutput(result.stderr)}\x1b[0m`)
      }
      entry.term.writeln(`\r\n\x1b[90m[exit ${result.code}]\x1b[0m`)
    } catch (error) {
      entry.term.writeln('\r\n\x1b[31mCommand failed to execute.\x1b[0m')
      entry.term.writeln(`\x1b[31m${String(error)}\x1b[0m`)
    } finally {
      setIsRunning(false)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      runCommand()
    }
  }

  return (
    <div className="min-h-screen bg-ink-50 text-ink-900">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-6">
        <section className="flex flex-1 flex-col gap-4 rounded-3xl border border-ink-200 bg-white/90 p-5 shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-900 text-amber-200">
                <TerminalSquare className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-ink-500">Terminal Studio</p>
                <h1 className="text-2xl font-semibold">Multi-tab desktop shell demo</h1>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-ink-200 bg-white px-4 py-2 text-sm text-ink-600">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                {isTauri() ? 'Tauri runtime' : 'Web demo'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-ink-600">
              <span className="text-ink-900">Terminals</span>
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs">{tabs.length}</span>
            </div>
            <button
              onClick={handleNewTab}
              className="flex items-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-ink-800"
              type="button"
            >
              <Plus className="h-4 w-4" />
              New tab
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`group flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                  tab.id === activeTabId
                    ? 'border-ink-900 bg-ink-900 text-amber-100'
                    : 'border-ink-200 bg-white text-ink-700 hover:border-ink-400'
                }`}
                type="button"
              >
                {tab.title}
                {tabs.length > 1 && (
                  <span
                    onClick={event => {
                      event.stopPropagation()
                      handleCloseTab(tab.id)
                    }}
                    className={`rounded-full p-1 transition ${
                      tab.id === activeTabId ? 'text-amber-100 hover:bg-ink-700' : 'text-ink-500 hover:bg-ink-100'
                    }`}
                    role="button"
                    aria-label={`Close ${tab.title}`}
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="grid gap-3 rounded-2xl border border-ink-200 bg-ink-50/80 p-4">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">Command input</label>
            <div className="flex flex-wrap gap-3">
              <input
                value={command}
                onChange={event => setCommand(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a shell command"
                className="min-w-[220px] flex-1 rounded-2xl border border-ink-200 bg-white px-4 py-3 font-mono text-sm text-ink-800 shadow-sm focus:border-amber-400 focus:outline-none"
              />
              <button
                onClick={runCommand}
                disabled={!isTauri() && isRunning}
                className="flex items-center gap-2 rounded-2xl bg-amber-400 px-4 py-3 text-sm font-semibold text-ink-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
              >
                <Play className="h-4 w-4" />
                {!isTauri() && isRunning ? 'Running' : 'Run'}
              </button>
            </div>
            <p className="text-xs text-ink-500">
              {isTauri()
                ? 'Send a command to the active tab or type directly in the terminal for interactive apps.'
                : 'Commands execute in the Rust backend when running inside Tauri.'}
            </p>
          </div>

          <div className="terminal-shell relative h-[420px] overflow-hidden rounded-3xl border border-ink-200 shadow-inner">
            {tabs.map(tab => (
              <TerminalCanvas
                key={tab.id}
                id={tab.id}
                active={tab.id === activeTabId}
                interactive={isTauri()}
                onReady={handleTerminalReady}
                onDispose={handleTerminalDispose}
                onResize={handleTerminalResize}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
