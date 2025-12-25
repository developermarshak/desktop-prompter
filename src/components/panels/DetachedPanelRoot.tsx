import { PanelId } from '../../types/panels';
import { PanelProvider, usePanelCommunication } from '../../contexts/PanelContext';
import { TerminalTab, CLIStatusLogEntry } from '../../types';
import { TerminalPanel } from '../TerminalPanel';
import { Maximize2 } from 'lucide-react';
import { IndicationLogsPanel } from '../IndicationLogsPanel';
import { loadCliStatusLogs, saveCliStatusLogs } from '../../utils/cliStatusLogs';
import { useEffect, useState } from 'react';

interface DetachedPanelContentProps {
  panelId: PanelId;
}

function DetachedPanelContent({ panelId }: DetachedPanelContentProps) {
  const { requestDock } = usePanelCommunication();
  const [logs, setLogs] = useState<CLIStatusLogEntry[]>(() => loadCliStatusLogs());

  useEffect(() => {
    if (panelId !== 'indication-logs') {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'promptArchitect_cliStatusLogs') {
        setLogs(loadCliStatusLogs());
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [panelId]);

  const handleDock = () => {
    requestDock();
  };

  const renderContent = () => {
    switch (panelId) {
      case 'terminal':
        // For terminal, we need to get the tabs from the main window via IPC
        // For now, show a placeholder - this will be connected in the inter-window communication phase
        const defaultTab: TerminalTab = { id: 'detached-terminal', title: 'Terminal' };
        return (
          <TerminalPanel
            tabs={[defaultTab]}
            activeTabId={defaultTab.id}
            className="h-full"
          />
        );
      case 'templates':
        return (
          <div className="p-4 text-zinc-400">
            <p>Snippets panel content will be loaded from main window.</p>
          </div>
        );
      case 'prompts':
        return (
          <div className="p-4 text-zinc-400">
            <p>Prompts panel content will be loaded from main window.</p>
          </div>
        );
      case 'indication-logs':
        return (
          <IndicationLogsPanel
            logs={logs}
            onClear={() => {
              setLogs([]);
              saveCliStatusLogs([]);
            }}
            showHeader={false}
            isDetached
          />
        );
      default:
        return (
          <div className="p-4 text-zinc-400">
            <p>Unknown panel: {panelId}</p>
          </div>
        );
    }
  };

  const getPanelTitle = () => {
    switch (panelId) {
      case 'terminal':
        return 'Terminal';
      case 'templates':
        return 'Snippets';
      case 'prompts':
        return 'Prompts';
      case 'indication-logs':
        return 'Indication Logs';
      default:
        return 'Panel';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900">
        <span className="text-sm font-medium text-zinc-300">{getPanelTitle()}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleDock}
            className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
            title="Dock back to main window"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-auto">{renderContent()}</div>
    </div>
  );
}

interface DetachedPanelRootProps {
  panelId: PanelId;
}

export function DetachedPanelRoot({ panelId }: DetachedPanelRootProps) {
  return (
    <PanelProvider isDetached panelId={panelId}>
      <DetachedPanelContent panelId={panelId} />
    </PanelProvider>
  );
}

export function getPanelIdFromUrl(): PanelId | null {
  const urlParams = new URLSearchParams(window.location.search);
  const panelParam = urlParams.get('panel');
  if (panelParam && ['templates', 'prompts', 'terminal', 'indication-logs'].includes(panelParam)) {
    return panelParam as PanelId;
  }
  return null;
}
