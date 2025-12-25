import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { emit, listen, UnlistenFn } from '@tauri-apps/api/event';
import { isTauri } from '@tauri-apps/api/core';
import {
  PanelId,
  PanelLayoutState,
  PanelConfig,
  DetachedWindowConfig,
  PanelMessage,
  DEFAULT_LAYOUT_STATE,
} from '../types/panels';
import { savePanelLayout, loadPanelLayout, resetPanelLayout } from '../utils/panelStorage';

interface PanelContextValue {
  layout: PanelLayoutState;
  togglePanel: (id: PanelId) => void;
  showPanel: (id: PanelId) => void;
  hidePanel: (id: PanelId) => void;
  minimizePanel: (id: PanelId) => void;
  detachPanel: (id: PanelId) => Promise<void>;
  dockPanel: (id: PanelId) => Promise<void>;
  setPanelSize: (id: PanelId, size: number) => void;
  saveLayout: () => void;
  resetLayout: () => void;
  isDetached: (id: PanelId) => boolean;
  isPanelVisible: (id: PanelId) => boolean;
  getDetachedWindow: (id: PanelId) => DetachedWindowConfig | undefined;
  isDetachedWindow: boolean;
  currentPanelId: PanelId | null;
}

const PanelContext = createContext<PanelContextValue | null>(null);

interface PanelProviderProps {
  children: React.ReactNode;
  isDetached?: boolean;
  panelId?: PanelId | null;
}

export function PanelProvider({ children, isDetached = false, panelId = null }: PanelProviderProps) {
  const [layout, setLayout] = useState<PanelLayoutState>(() => loadPanelLayout());
  const detachedWindowsRef = useRef<Map<PanelId, WebviewWindow>>(new Map());

  useEffect(() => {
    let unlistenFn: UnlistenFn | null = null;

    const setupListener = async () => {
      unlistenFn = await listen<PanelMessage>('panel-to-main', (event) => {
        const { panelId: msgPanelId, type } = event.payload;

        switch (type) {
          case 'dock-request':
            dockPanel(msgPanelId);
            break;
          case 'close-request':
            hidePanel(msgPanelId);
            break;
        }
      });
    };

    if (!isDetached) {
      setupListener();
    }

    return () => {
      unlistenFn?.();
    };
  }, [isDetached]);

  useEffect(() => {
    savePanelLayout(layout);
  }, [layout]);

  const updatePanelConfig = useCallback((id: PanelId, updates: Partial<PanelConfig>) => {
    setLayout((prev) => ({
      ...prev,
      panels: {
        ...prev.panels,
        [id]: {
          ...prev.panels[id],
          ...updates,
        },
      },
    }));
  }, []);

  const togglePanel = useCallback((id: PanelId) => {
    setLayout((prev) => {
      const panel = prev.panels[id];
      const newState = panel.state === 'hidden' ? 'docked' : 'hidden';
      return {
        ...prev,
        panels: {
          ...prev.panels,
          [id]: { ...panel, state: newState },
        },
      };
    });
  }, []);

  const showPanel = useCallback((id: PanelId) => {
    updatePanelConfig(id, { state: 'docked' });
  }, [updatePanelConfig]);

  const hidePanel = useCallback((id: PanelId) => {
    updatePanelConfig(id, { state: 'hidden' });
  }, [updatePanelConfig]);

  const minimizePanel = useCallback((id: PanelId) => {
    updatePanelConfig(id, { state: 'minimized' });
  }, [updatePanelConfig]);

  const detachPanel = useCallback(async (id: PanelId) => {
    if (!isTauri()) {
      console.warn('Panel detachment is only available in Tauri desktop app');
      return;
    }

    try {
      const mainWindow = WebviewWindow.getCurrent();
      const position = await mainWindow.outerPosition();

      const windowLabel = `panel-${id}`;
      const detached = new WebviewWindow(windowLabel, {
        url: `index.html?panel=${id}`,
        title: layout.panels[id].title,
        width: 600,
        height: 400,
        x: position.x + 50,
        y: position.y + 50,
        decorations: true,
        resizable: true,
      });

      detachedWindowsRef.current.set(id, detached);

      detached.once('tauri://created', () => {
        updatePanelConfig(id, { state: 'detached' });
        setLayout((prev) => ({
          ...prev,
          detachedWindows: [
            ...prev.detachedWindows.filter((w) => w.panelId !== id),
            {
              panelId: id,
              windowLabel,
              width: 600,
              height: 400,
              x: position.x + 50,
              y: position.y + 50,
            },
          ],
        }));
      });

      detached.once('tauri://close-requested', async () => {
        await dockPanel(id);
      });
    } catch (error) {
      console.error('Failed to detach panel:', error);
    }
  }, [layout.panels, updatePanelConfig]);

  const dockPanel = useCallback(async (id: PanelId) => {
    try {
      const window = detachedWindowsRef.current.get(id);
      if (window) {
        await window.close();
        detachedWindowsRef.current.delete(id);
      }

      updatePanelConfig(id, { state: 'docked' });
      setLayout((prev) => ({
        ...prev,
        detachedWindows: prev.detachedWindows.filter((w) => w.panelId !== id),
      }));
    } catch (error) {
      console.error('Failed to dock panel:', error);
    }
  }, [updatePanelConfig]);

  const setPanelSize = useCallback((id: PanelId, size: number) => {
    updatePanelConfig(id, { defaultSize: size });
  }, [updatePanelConfig]);

  const saveLayoutManual = useCallback(() => {
    savePanelLayout(layout);
  }, [layout]);

  const resetLayoutState = useCallback(() => {
    resetPanelLayout();
    setLayout(DEFAULT_LAYOUT_STATE);
  }, []);

  const isDetachedCheck = useCallback((id: PanelId) => {
    return layout.panels[id].state === 'detached';
  }, [layout.panels]);

  const isPanelVisible = useCallback((id: PanelId) => {
    const state = layout.panels[id].state;
    return state === 'docked';
  }, [layout.panels]);

  const getDetachedWindow = useCallback((id: PanelId) => {
    return layout.detachedWindows.find((w) => w.panelId === id);
  }, [layout.detachedWindows]);

  const value: PanelContextValue = {
    layout,
    togglePanel,
    showPanel,
    hidePanel,
    minimizePanel,
    detachPanel,
    dockPanel,
    setPanelSize,
    saveLayout: saveLayoutManual,
    resetLayout: resetLayoutState,
    isDetached: isDetachedCheck,
    isPanelVisible,
    getDetachedWindow,
    isDetachedWindow: isDetached,
    currentPanelId: panelId,
  };

  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>;
}

export function usePanelContext() {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error('usePanelContext must be used within a PanelProvider');
  }
  return context;
}

export function usePanelCommunication() {
  const { currentPanelId, isDetachedWindow } = usePanelContext();

  const sendToMain = useCallback(async (message: Omit<PanelMessage, 'panelId'>) => {
    if (isDetachedWindow && currentPanelId) {
      await emit('panel-to-main', { ...message, panelId: currentPanelId });
    }
  }, [currentPanelId, isDetachedWindow]);

  const requestDock = useCallback(async () => {
    await sendToMain({ type: 'dock-request' });
  }, [sendToMain]);

  const requestClose = useCallback(async () => {
    await sendToMain({ type: 'close-request' });
  }, [sendToMain]);

  return { sendToMain, requestDock, requestClose };
}
