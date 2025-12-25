import { isTauri } from '@tauri-apps/api/core';
import type { Layout } from 'react-resizable-panels';

export type LayoutSnapshot = {
  main: Layout;
  vertical: Layout;
};

export type WindowSize = {
  width: number;
  height: number;
};

const DB_URL = 'sqlite:app_config.db';
const SETTINGS_TABLE = 'app_settings';
const STORAGE_KEYS = {
  layout: 'desktop-prompter_layouts',
  window: 'desktop-prompter_window',
  terminalFontSize: 'desktop-prompter_terminal_font_size',
};

type DbRow = { value: string };

let dbPromise: Promise<any> | null = null;

async function getDatabase() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const module = await import('@tauri-apps/plugin-sql');
      const db = await module.default.load(DB_URL);
      await db.execute(
        `CREATE TABLE IF NOT EXISTS ${SETTINGS_TABLE} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`
      );
      return db;
    })();
  }
  return dbPromise;
}

async function loadSetting<T>(key: string): Promise<T | null> {
  if (!isTauri()) {
    const stored = localStorage.getItem(key);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as T;
  }

  try {
    const db = await getDatabase();
    const rows = (await db.select(
      `SELECT value FROM ${SETTINGS_TABLE} WHERE key = ? LIMIT 1`,
      [key]
    )) as DbRow[];
    if (!rows.length) {
      return null;
    }
    return JSON.parse(rows[0].value) as T;
  } catch (error) {
    console.warn('Failed to read app setting from SQLite, falling back to localStorage', error);
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : null;
  }
}

async function saveSetting<T>(key: string, value: T): Promise<void> {
  const payload = JSON.stringify(value);

  if (!isTauri()) {
    localStorage.setItem(key, payload);
    return;
  }

  try {
    const db = await getDatabase();
    await db.execute(
      `INSERT INTO ${SETTINGS_TABLE} (key, value) VALUES (?1, ?2)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, payload]
    );
  } catch (error) {
    console.warn('Failed to write app setting to SQLite, falling back to localStorage', error);
    localStorage.setItem(key, payload);
  }
}

export async function loadLayoutSnapshot(): Promise<LayoutSnapshot | null> {
  return loadSetting<LayoutSnapshot>(STORAGE_KEYS.layout);
}

export async function saveLayoutSnapshot(snapshot: LayoutSnapshot): Promise<void> {
  return saveSetting(STORAGE_KEYS.layout, snapshot);
}

export async function loadWindowSize(): Promise<WindowSize | null> {
  return loadSetting<WindowSize>(STORAGE_KEYS.window);
}

export async function saveWindowSize(size: WindowSize): Promise<void> {
  return saveSetting(STORAGE_KEYS.window, size);
}

export async function loadTerminalFontSize(): Promise<number | null> {
  return loadSetting<number>(STORAGE_KEYS.terminalFontSize);
}

export async function saveTerminalFontSize(size: number): Promise<void> {
  return saveSetting(STORAGE_KEYS.terminalFontSize, size);
}
