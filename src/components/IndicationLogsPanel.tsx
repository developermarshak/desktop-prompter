import React, { useMemo } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { CLIStatusLogEntry } from '../types';

interface IndicationLogsPanelProps {
  logs: CLIStatusLogEntry[];
  onClear?: () => void;
  onClose?: () => void;
  onPopOut?: () => void;
  isDetached?: boolean;
  showHeader?: boolean;
}

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const IndicationLogsPanel: React.FC<IndicationLogsPanelProps> = ({
  logs,
  onClear,
  onClose,
  onPopOut,
  isDetached = false,
  showHeader = true,
}) => {
  const visibleLogs = useMemo(() => logs, [logs]);

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {showHeader ? (
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3 py-1.5">
          <div className="flex items-center gap-2">
            <div className="text-xs font-semibold text-zinc-200">Indication Logs</div>
            <div className="text-[10px] text-zinc-500">{visibleLogs.length} entries</div>
          </div>
          <div className="flex items-center gap-1.5">
            {onClear && (
              <button
                onClick={onClear}
                className="px-2 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                title="Clear logs"
              >
                Clear
              </button>
            )}
            {onPopOut && !isDetached && (
              <button
                onClick={onPopOut}
                className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                title="Open in new window"
              >
                <ExternalLink size={12} />
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                title="Close"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between border-b border-zinc-900 bg-zinc-950 px-3 py-1.5">
          <div className="text-[10px] uppercase tracking-wide text-zinc-600">Indication Logs</div>
          {onClear && (
            <button
              onClick={onClear}
              className="px-2 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
              title="Clear logs"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {visibleLogs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-zinc-600">
            No indication logs yet.
          </div>
        ) : (
          <div className="divide-y divide-zinc-900">
            {visibleLogs.map((entry) => (
              <div key={entry.id} className="px-3 py-2 font-mono text-[11px] text-zinc-300">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-zinc-500">
                  <span>{formatTime(entry.timestamp)}</span>
                  <span>tab:{entry.tabId.slice(0, 8)}</span>
                  <span>prev:{entry.previousStatus}</span>
                  <span>next:{entry.status}</span>
                  <span>reason:{entry.reason}</span>
                  <span>buffer:{entry.bufferSize}</span>
                  {entry.statusChanged && <span className="text-emerald-400">status-change</span>}
                </div>
                {entry.match && (
                  <div className="mt-1 text-amber-300">
                    match:{entry.match.group}/{entry.match.source} {entry.match.pattern}
                  </div>
                )}
                {entry.lastLine && (
                  <div className="mt-1 text-zinc-200">last: {entry.lastLine}</div>
                )}
                {entry.recentOutput && (
                  <pre className="mt-1 whitespace-pre-wrap text-zinc-500">
                    {entry.recentOutput}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
