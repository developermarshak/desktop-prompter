export type PanelId = 'templates' | 'prompts' | 'terminal' | 'indication-logs';

export type PanelState = 'docked' | 'minimized' | 'detached' | 'hidden';

export type PanelPosition = 'left' | 'right' | 'bottom' | 'floating';

export interface PanelConfig {
  id: PanelId;
  title: string;
  position: PanelPosition;
  state: PanelState;
  defaultSize: number;
  minSize: number;
  maxSize: number;
  collapsible: boolean;
  detachable: boolean;
}

export interface DetachedWindowConfig {
  panelId: PanelId;
  windowLabel: string;
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export interface PanelLayoutState {
  panels: Record<PanelId, PanelConfig>;
  detachedWindows: DetachedWindowConfig[];
}

export interface PanelMessage {
  type: 'state-update' | 'close-request' | 'dock-request';
  panelId: PanelId;
  payload?: unknown;
}

export const DEFAULT_PANEL_CONFIGS: Record<PanelId, PanelConfig> = {
  templates: {
    id: 'templates',
    title: 'Snippets',
    position: 'left',
    state: 'docked',
    defaultSize: 50,
    minSize: 20,
    maxSize: 80,
    collapsible: true,
    detachable: true,
  },
  prompts: {
    id: 'prompts',
    title: 'Prompts',
    position: 'left',
    state: 'docked',
    defaultSize: 50,
    minSize: 20,
    maxSize: 80,
    collapsible: true,
    detachable: true,
  },
  terminal: {
    id: 'terminal',
    title: 'Terminal',
    position: 'bottom',
    state: 'docked',
    defaultSize: 30,
    minSize: 10,
    maxSize: 70,
    collapsible: true,
    detachable: true,
  },
  'indication-logs': {
    id: 'indication-logs',
    title: 'Indication Logs',
    position: 'bottom',
    state: 'docked',
    defaultSize: 25,
    minSize: 10,
    maxSize: 60,
    collapsible: true,
    detachable: true,
  },
};

export const DEFAULT_LAYOUT_STATE: PanelLayoutState = {
  panels: DEFAULT_PANEL_CONFIGS,
  detachedWindows: [],
};
