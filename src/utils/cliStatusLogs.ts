import { CLIStatusLogEntry } from '../types';

const LOG_STORAGE_KEY = 'promptArchitect_cliStatusLogs';
const MAX_LOG_ENTRIES = 300;

export function loadCliStatusLogs(): CLIStatusLogEntry[] {
  try {
    const stored = localStorage.getItem(LOG_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored) as CLIStatusLogEntry[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch (error) {
    console.error('Failed to load indication logs:', error);
    return [];
  }
}

export function saveCliStatusLogs(logs: CLIStatusLogEntry[]): void {
  try {
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
  } catch (error) {
    console.error('Failed to save indication logs:', error);
  }
}

export function trimCliStatusLogs(logs: CLIStatusLogEntry[]): CLIStatusLogEntry[] {
  return logs.slice(0, MAX_LOG_ENTRIES);
}

export function truncateLogText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(-maxLength);
}
