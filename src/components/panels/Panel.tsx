import React from 'react';
import { PanelId } from '../../types/panels';
import { PanelTitleBar } from './PanelTitleBar';

interface PanelProps {
  id: PanelId;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
  canMinimize?: boolean;
  canDetach?: boolean;
  canClose?: boolean;
  showTitleBar?: boolean;
}

export function Panel({
  id,
  title,
  icon,
  children,
  className = '',
  headerActions,
  canMinimize = false,
  canDetach = true,
  canClose = true,
  showTitleBar = true,
}: PanelProps) {
  return (
    <div className={`flex flex-col h-full bg-zinc-900 ${className}`}>
      {showTitleBar && (
        <PanelTitleBar
          title={title}
          panelId={id}
          icon={icon}
          canMinimize={canMinimize}
          canDetach={canDetach}
          canClose={canClose}
          headerActions={headerActions}
        />
      )}
      <div className="flex-1 overflow-auto min-h-0">{children}</div>
    </div>
  );
}
