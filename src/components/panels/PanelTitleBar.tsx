import React from 'react';
import { Minus, Maximize2, ExternalLink, X } from 'lucide-react';
import { PanelId } from '../../types/panels';
import { usePanelContext, usePanelCommunication } from '../../contexts/PanelContext';

interface PanelTitleBarProps {
  title: string;
  panelId: PanelId;
  icon?: React.ReactNode;
  canMinimize?: boolean;
  canDetach?: boolean;
  canClose?: boolean;
  headerActions?: React.ReactNode;
}

export function PanelTitleBar({
  title,
  panelId,
  icon,
  canMinimize = false,
  canDetach = true,
  canClose = true,
  headerActions,
}: PanelTitleBarProps) {
  const { hidePanel, detachPanel, isDetachedWindow } = usePanelContext();
  const { requestDock } = usePanelCommunication();

  const handleClose = () => {
    if (isDetachedWindow) {
      requestDock();
    } else {
      hidePanel(panelId);
    }
  };

  const handleDetach = async () => {
    if (!isDetachedWindow) {
      await detachPanel(panelId);
    }
  };

  const handleDock = () => {
    if (isDetachedWindow) {
      requestDock();
    }
  };

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
      <div className="flex items-center gap-2">
        {icon && <span className="text-zinc-400">{icon}</span>}
        <span className="text-sm font-medium text-zinc-300">{title}</span>
      </div>

      <div className="flex items-center gap-1">
        {headerActions}

        {canMinimize && !isDetachedWindow && (
          <button
            onClick={() => hidePanel(panelId)}
            className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
            title="Minimize"
          >
            <Minus size={14} />
          </button>
        )}

        {canDetach && !isDetachedWindow && (
          <button
            onClick={handleDetach}
            className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
            title="Open in new window"
          >
            <ExternalLink size={14} />
          </button>
        )}

        {isDetachedWindow && (
          <button
            onClick={handleDock}
            className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
            title="Dock back to main window"
          >
            <Maximize2 size={14} />
          </button>
        )}

        {canClose && (
          <button
            onClick={handleClose}
            className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
            title="Close"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
