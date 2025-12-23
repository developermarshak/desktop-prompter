import React from 'react';
import { CodexSettings } from '../types';
import { listToText, textToList } from '../codexSettings';

interface CodexSettingsProps {
  settings: CodexSettings;
  onChange: (next: CodexSettings) => void;
  onClose: () => void;
  onReset: () => void;
}

export const CodexSettingsPanel: React.FC<CodexSettingsProps> = ({
  settings,
  onChange,
  onClose,
  onReset,
}) => {
  const update = (patch: Partial<CodexSettings>) => {
    onChange({ ...settings, ...patch });
  };

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6 py-4">
        <div>
          <div className="text-lg font-semibold text-white">Codex Settings</div>
          <div className="text-xs text-zinc-500">
            Used when running a prompt in the terminal.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
          >
            Reset
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors"
          >
            Back to Editor
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-200">Run Mode</h3>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="radio"
                name="codex-run-mode"
                checked={settings.runMode === 'exec'}
                onChange={() => update({ runMode: 'exec' })}
              />
              Exec (non-interactive)
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="radio"
                name="codex-run-mode"
                checked={settings.runMode === 'tui'}
                onChange={() => update({ runMode: 'tui' })}
              />
              TUI (interactive)
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-200">Core Flags</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              Model
              <input
                type="text"
                value={settings.model}
                onChange={(e) => update({ model: e.target.value })}
                placeholder="gpt-5-codex"
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              Profile
              <input
                type="text"
                value={settings.profile}
                onChange={(e) => update({ profile: e.target.value })}
                placeholder="default"
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              Sandbox
              <select
                value={settings.sandbox}
                onChange={(e) =>
                  update({ sandbox: e.target.value as CodexSettings['sandbox'] })
                }
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">Default</option>
                <option value="read-only">read-only</option>
                <option value="workspace-write">workspace-write</option>
                <option value="danger-full-access">danger-full-access</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              Ask for approval
              <select
                value={settings.askForApproval}
                onChange={(e) =>
                  update({
                    askForApproval: e.target.value as CodexSettings['askForApproval'],
                  })
                }
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">Default</option>
                <option value="untrusted">untrusted</option>
                <option value="on-failure">on-failure</option>
                <option value="on-request">on-request</option>
                <option value="never">never</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-zinc-300">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.fullAuto}
                onChange={(e) => update({ fullAuto: e.target.checked })}
              />
              --full-auto
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.yolo}
                onChange={(e) => update({ yolo: e.target.checked })}
              />
              --yolo
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.oss}
                onChange={(e) => update({ oss: e.target.checked })}
              />
              --oss
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.search}
                onChange={(e) => update({ search: e.target.checked })}
              />
              --search
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-200">Exec Output</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              Color
              <select
                value={settings.color}
                onChange={(e) =>
                  update({ color: e.target.value as CodexSettings['color'] })
                }
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="auto">auto</option>
                <option value="always">always</option>
                <option value="never">never</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              Output schema
              <input
                type="text"
                value={settings.outputSchema}
                onChange={(e) => update({ outputSchema: e.target.value })}
                placeholder="/path/to/schema.json"
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              Output last message
              <input
                type="text"
                value={settings.outputLastMessage}
                onChange={(e) => update({ outputLastMessage: e.target.value })}
                placeholder="/path/to/output.txt"
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </label>
            <div className="flex flex-col gap-2 text-sm text-zinc-300">
              <span>Flags</span>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.skipGitRepoCheck}
                  onChange={(e) => update({ skipGitRepoCheck: e.target.checked })}
                />
                --skip-git-repo-check
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.json}
                  onChange={(e) => update({ json: e.target.checked })}
                />
                --json
              </label>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-200">Paths & Overrides</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              Add dirs (--add-dir)
              <textarea
                value={listToText(settings.addDirs)}
                onChange={(e) => update({ addDirs: textToList(e.target.value) })}
                placeholder="/path/one&#10;/path/two"
                className="min-h-[120px] bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              Images (--image)
              <textarea
                value={listToText(settings.imagePaths)}
                onChange={(e) => update({ imagePaths: textToList(e.target.value) })}
                placeholder="/path/to/image.png"
                className="min-h-[120px] bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              Enable features (--enable)
              <textarea
                value={listToText(settings.enableFeatures)}
                onChange={(e) => update({ enableFeatures: textToList(e.target.value) })}
                placeholder="rmcp_client"
                className="min-h-[120px] bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              Disable features (--disable)
              <textarea
                value={listToText(settings.disableFeatures)}
                onChange={(e) => update({ disableFeatures: textToList(e.target.value) })}
                placeholder="search"
                className="min-h-[120px] bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-zinc-300 md:col-span-2">
              Config overrides (-c key=value)
              <textarea
                value={listToText(settings.configOverrides)}
                onChange={(e) =>
                  update({ configOverrides: textToList(e.target.value) })
                }
                placeholder="features.rmcp_client=true"
                className="min-h-[120px] bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </label>
          </div>
        </section>
      </div>
    </div>
  );
};
