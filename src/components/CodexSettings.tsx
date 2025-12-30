import React from 'react';
import { ClaudeSettings, CodexSettings } from '../types';
import { listToText, textToList } from '../codexSettings';
import { listToText as claudeListToText, textToList as claudeTextToList } from '../claudeSettings';

interface CodexSettingsProps {
  settings: CodexSettings;
  claudeSettings: ClaudeSettings;
  onChange: (next: CodexSettings) => void;
  onClaudeChange: (next: ClaudeSettings) => void;
  onClose: () => void;
  onReset: () => void;
}

export const CodexSettingsPanel: React.FC<CodexSettingsProps> = ({
  settings,
  claudeSettings,
  onChange,
  onClaudeChange,
  onClose,
  onReset,
}) => {
  const [activeTab, setActiveTab] = React.useState<'codex' | 'claude'>('codex');

  const update = (patch: Partial<CodexSettings>) => {
    onChange({ ...settings, ...patch });
  };

  const updateClaude = (patch: Partial<ClaudeSettings>) => {
    onClaudeChange({ ...claudeSettings, ...patch });
  };

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <div className="border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <div className="text-lg font-semibold text-white">Tool Settings</div>
            <div className="text-xs text-zinc-500">
              Used when running prompts in the terminal.
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

        <div className="flex gap-1 px-6">
          <button
            onClick={() => setActiveTab('codex')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'codex'
                ? 'text-white border-indigo-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-200'
            }`}
          >
            Codex
          </button>
          <button
            onClick={() => setActiveTab('claude')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'claude'
                ? 'text-white border-indigo-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-200'
            }`}
          >
            Claude
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        {activeTab === 'codex' ? (
          <>
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
          </>
        ) : (
          <>
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-200">CLI Configuration</h3>
          <div className="grid gap-4">
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              Claude CLI Path
              <input
                type="text"
                value={claudeSettings.cliPath}
                onChange={(e) => updateClaude({ cliPath: e.target.value })}
                placeholder="claude or /path/to/claude"
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-xs text-zinc-500">
                Full path to the Claude CLI executable (e.g., /Users/you/.n/bin/claude)
              </span>
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-200">Core Settings</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              Model
              <input
                type="text"
                value={claudeSettings.model}
                onChange={(e) => updateClaude({ model: e.target.value })}
                placeholder="claude-3-5-sonnet"
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              Output format
              <select
                value={claudeSettings.outputFormat}
                onChange={(e) =>
                  updateClaude({ outputFormat: e.target.value as ClaudeSettings['outputFormat'] })
                }
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">Default (text)</option>
                <option value="json">JSON</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-zinc-300">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={claudeSettings.alwaysThinkingEnabled}
                onChange={(e) => updateClaude({ alwaysThinkingEnabled: e.target.checked })}
              />
              Always thinking enabled
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={claudeSettings.dangerouslySkipPermissions}
                onChange={(e) => updateClaude({ dangerouslySkipPermissions: e.target.checked })}
              />
              --dangerously-skip-permissions
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-200">System Prompts</h3>
          <div className="grid gap-4">
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              System prompt (--system-prompt)
              <textarea
                value={claudeSettings.systemPrompt}
                onChange={(e) => updateClaude({ systemPrompt: e.target.value })}
                placeholder="Custom system prompt..."
                className="min-h-[80px] bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              System prompt file (--system-prompt-file)
              <input
                type="text"
                value={claudeSettings.systemPromptFile}
                onChange={(e) => updateClaude({ systemPromptFile: e.target.value })}
                placeholder="/path/to/prompt.txt"
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              Append system prompt (--append-system-prompt)
              <textarea
                value={claudeSettings.appendSystemPrompt}
                onChange={(e) => updateClaude({ appendSystemPrompt: e.target.value })}
                placeholder="Additional instructions..."
                className="min-h-[80px] bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-200">Paths & Exclusions</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              Additional directories (--add-dir)
              <textarea
                value={claudeListToText(claudeSettings.addDirs)}
                onChange={(e) => updateClaude({ addDirs: claudeTextToList(e.target.value) })}
                placeholder="/path/one&#10;/path/two"
                className="min-h-[120px] bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              Exclude sensitive files
              <textarea
                value={claudeListToText(claudeSettings.excludeSensitiveFiles)}
                onChange={(e) => updateClaude({ excludeSensitiveFiles: claudeTextToList(e.target.value) })}
                placeholder=".env&#10;credentials.json&#10;*.key"
                className="min-h-[120px] bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-200">Extra Arguments</h3>
          <label className="flex flex-col gap-2 text-sm text-zinc-300">
            Additional CLI arguments
            <input
              type="text"
              value={claudeSettings.args}
              onChange={(e) => updateClaude({ args: e.target.value })}
              placeholder="--max-tokens 2048 --custom-flag"
              className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </label>
        </section>
          </>
        )}
      </div>
    </div>
  );
};
