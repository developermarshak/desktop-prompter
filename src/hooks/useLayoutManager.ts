import { useState, useEffect, useCallback, useRef } from "react";
import {
  type GroupImperativeHandle,
  type Layout,
} from "react-resizable-panels";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { isTauri } from "@tauri-apps/api/core";
import {
  loadLayoutSnapshot,
  loadWindowSize,
  saveLayoutSnapshot,
  saveWindowSize,
  type LayoutSnapshot,
} from "../utils/appSettings";

export interface UseLayoutManagerResult {
  mainGroupRef: React.RefObject<GroupImperativeHandle | null>;
  verticalGroupRef: React.RefObject<GroupImperativeHandle | null>;
  handleMainLayoutChange: (layout: Layout) => void;
  handleVerticalLayoutChange: (layout: Layout) => void;
  layoutLoaded: boolean;
}

export function useLayoutManager(): UseLayoutManagerResult {
  const mainGroupRef = useRef<GroupImperativeHandle | null>(null);
  const verticalGroupRef = useRef<GroupImperativeHandle | null>(null);
  const layoutSnapshotRef = useRef<LayoutSnapshot>({ main: {}, vertical: {} });
  const layoutSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const windowSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [layoutLoaded, setLayoutLoaded] = useState(false);

  const scheduleLayoutSave = useCallback(() => {
    if (layoutSaveTimerRef.current) {
      clearTimeout(layoutSaveTimerRef.current);
    }
    layoutSaveTimerRef.current = setTimeout(() => {
      void saveLayoutSnapshot(layoutSnapshotRef.current);
    }, 400);
  }, []);

  const handleMainLayoutChange = useCallback(
    (layout: Layout) => {
      layoutSnapshotRef.current = {
        ...layoutSnapshotRef.current,
        main: layout,
      };
      if (layoutLoaded) {
        scheduleLayoutSave();
      }
    },
    [layoutLoaded, scheduleLayoutSave]
  );

  const handleVerticalLayoutChange = useCallback(
    (layout: Layout) => {
      layoutSnapshotRef.current = {
        ...layoutSnapshotRef.current,
        vertical: layout,
      };
      if (layoutLoaded) {
        scheduleLayoutSave();
      }
    },
    [layoutLoaded, scheduleLayoutSave]
  );

  // Load layout and window size on mount
  useEffect(() => {
    let cancelled = false;

    const restoreLayoutAndWindow = async () => {
      const [storedLayout, storedWindow] = await Promise.all([
        loadLayoutSnapshot(),
        loadWindowSize(),
      ]);

      if (cancelled) {
        return;
      }

      if (storedLayout) {
        layoutSnapshotRef.current = storedLayout;
      }

      if (storedWindow && isTauri()) {
        const appWindow = getCurrentWindow();
        await appWindow.setSize(
          new LogicalSize(storedWindow.width, storedWindow.height)
        );
      }

      setLayoutLoaded(true);
    };

    void restoreLayoutAndWindow();

    return () => {
      cancelled = true;
      if (layoutSaveTimerRef.current) {
        clearTimeout(layoutSaveTimerRef.current);
      }
    };
  }, []);

  // Apply stored layout to panels
  useEffect(() => {
    if (!layoutLoaded) {
      return;
    }

    const applyStoredLayout = (
      groupRef: React.RefObject<GroupImperativeHandle | null>,
      storedLayout: Layout,
      key: keyof LayoutSnapshot
    ) => {
      const group = groupRef.current;
      if (!group) {
        return;
      }

      const current = group.getLayout();
      if (Object.keys(storedLayout).length === 0) {
        layoutSnapshotRef.current = {
          ...layoutSnapshotRef.current,
          [key]: current,
        };
        scheduleLayoutSave();
        return;
      }

      const filtered = Object.fromEntries(
        Object.entries(storedLayout).filter(([panelId]) => panelId in current)
      );

      const merged = { ...current, ...filtered };
      group.setLayout(merged);
      layoutSnapshotRef.current = {
        ...layoutSnapshotRef.current,
        [key]: merged,
      };
    };

    applyStoredLayout(mainGroupRef, layoutSnapshotRef.current.main, "main");
    applyStoredLayout(
      verticalGroupRef,
      layoutSnapshotRef.current.vertical,
      "vertical"
    );
  }, [layoutLoaded, scheduleLayoutSave]);

  // Handle window resize
  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let unlisten: (() => void) | null = null;

    const handleResize = async () => {
      const appWindow = getCurrentWindow();
      unlisten = await appWindow.onResized(({ payload }) => {
        if (windowSaveTimerRef.current) {
          clearTimeout(windowSaveTimerRef.current);
        }
        windowSaveTimerRef.current = setTimeout(() => {
          void saveWindowSize({
            width: payload.width,
            height: payload.height,
          });
        }, 250);
      });
    };

    void handleResize();

    return () => {
      unlisten?.();
      if (windowSaveTimerRef.current) {
        clearTimeout(windowSaveTimerRef.current);
      }
    };
  }, []);

  return {
    mainGroupRef,
    verticalGroupRef,
    handleMainLayoutChange,
    handleVerticalLayoutChange,
    layoutLoaded,
  };
}
