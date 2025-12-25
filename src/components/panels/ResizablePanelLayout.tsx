import React from 'react';
import {
  Group,
  Panel as ResizablePanel,
  Separator,
  PanelImperativeHandle,
} from 'react-resizable-panels';

interface ResizablePanelLayoutProps {
  sidebarContent: React.ReactNode;
  mainContent: React.ReactNode;
  terminalContent: React.ReactNode;
  sidebarOpen: boolean;
  terminalOpen: boolean;
  sidebarRef?: React.RefObject<PanelImperativeHandle | null>;
  terminalRef?: React.RefObject<PanelImperativeHandle | null>;
}

export function ResizablePanelLayout({
  sidebarContent,
  mainContent,
  terminalContent,
  sidebarOpen,
  terminalOpen,
}: ResizablePanelLayoutProps) {
  return (
    <Group
      orientation="horizontal"
      id="desktop-prompter-main-layout"
      className="h-screen"
    >
      {/* Sidebar Panel */}
      {sidebarOpen && (
        <>
          <ResizablePanel
            id="sidebar"
            defaultSize="20%"
            minSize="15%"
            maxSize="40%"
            collapsible={true}
          >
            <div className="h-full bg-zinc-900 border-r border-zinc-800">
              {sidebarContent}
            </div>
          </ResizablePanel>
          <Separator className="w-1 bg-zinc-800 hover:bg-indigo-500 transition-colors cursor-col-resize" />
        </>
      )}

      {/* Main Content Panel */}
      <ResizablePanel id="main-content" minSize="30%">
        <Group orientation="vertical" id="desktop-prompter-vertical-layout">
          {/* Editor Panel */}
          <ResizablePanel id="editor" minSize="20%">
            <div className="h-full bg-zinc-950">{mainContent}</div>
          </ResizablePanel>

          {terminalOpen && (
            <>
              <Separator className="h-1 bg-zinc-800 hover:bg-indigo-500 transition-colors cursor-row-resize" />

              {/* Terminal Panel */}
              <ResizablePanel
                id="terminal"
                defaultSize="30%"
                minSize="10%"
                maxSize="70%"
                collapsible={true}
              >
                <div className="h-full bg-zinc-950 border-t border-zinc-800">
                  {terminalContent}
                </div>
              </ResizablePanel>
            </>
          )}
        </Group>
      </ResizablePanel>
    </Group>
  );
}

export function ResizeHandle({
  direction = 'horizontal',
}: {
  direction?: 'horizontal' | 'vertical';
}) {
  const isHorizontal = direction === 'horizontal';
  return (
    <Separator
      className={`
        ${isHorizontal ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}
        bg-zinc-800 hover:bg-indigo-500 active:bg-indigo-400
        transition-colors duration-150
      `}
    />
  );
}
