import { PanelLayoutState, DEFAULT_LAYOUT_STATE } from '../types/panels';

const LAYOUT_STORAGE_KEY = 'promptArchitect_panelLayout';

export function savePanelLayout(layout: PanelLayoutState): void {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch (error) {
    console.error('Failed to save panel layout:', error);
  }
}

export function loadPanelLayout(): PanelLayoutState {
  try {
    const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as PanelLayoutState;
      return mergeWithDefaults(parsed);
    }
  } catch (error) {
    console.error('Failed to load panel layout:', error);
  }
  return DEFAULT_LAYOUT_STATE;
}

export function resetPanelLayout(): void {
  try {
    localStorage.removeItem(LAYOUT_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to reset panel layout:', error);
  }
}

function mergeWithDefaults(stored: Partial<PanelLayoutState>): PanelLayoutState {
  return {
    panels: {
      ...DEFAULT_LAYOUT_STATE.panels,
      ...stored.panels,
    },
    detachedWindows: stored.detachedWindows ?? [],
  };
}
