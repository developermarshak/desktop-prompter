import React, { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { PromptEditor } from "./components/PromptEditor";
import { ChatAssistant } from "./components/ChatAssistant";
import { GitDiffPanel } from "./components/GitDiffPanel";
import { Menu } from "lucide-react";
import { TerminalPanel } from "./components/TerminalPanel";
import { ClaudeSessionPanel } from "./components/claude";
import { CodexSettingsPanel } from "./components/CodexSettings";
import {
  Group,
  Panel as ResizablePanel,
  Separator,
} from "react-resizable-panels";
import { usePanelContext } from "./contexts/PanelContext";
import { IndicationLogsPanel } from "./components/IndicationLogsPanel";
import { saveCliStatusLogs } from "./utils/cliStatusLogs";
import {
  useTerminalManager,
  useLayoutManager,
  usePromptsManager,
  useChatManager,
  useSettingsManager,
  useTaskGroupsManager,
} from "./hooks";
import { TaskGroupPanel } from "./components/TaskGroupPanel";
import { TaskSectionPreview } from "./types";

const App: React.FC = () => {
  // Panel visibility state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [claudeSessionOpen] = useState(false);
  const [indicationLogsOpen, setIndicationLogsOpen] = useState(false);
  const [activeView, setActiveView] = useState<"editor" | "settings">("editor");
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffSessionPath, setDiffSessionPath] = useState<string | null>(null);
  const [diffSource, setDiffSource] = useState<"session" | "task" | null>(null);

  // Custom hooks
  const terminalManager = useTerminalManager();
  const layoutManager = useLayoutManager();
  const promptsManager = usePromptsManager();
  const chatManager = useChatManager();
  const settingsManager = useSettingsManager();
  const taskGroupsManager = useTaskGroupsManager();
  const [migrationToast, setMigrationToast] = useState<string | null>(null);
  const [taskSectionPreview, setTaskSectionPreview] =
    useState<TaskSectionPreview | null>(null);

  const { detachPanel, isDetached } = usePanelContext();

  const activeTerminalTab = terminalManager.terminalTabs.find(
    (tab) => tab.id === terminalManager.activeTerminalTabId
  );
  const activeTerminalSessionPath = terminalManager.activeTerminalTabId
    ? terminalManager.terminalSessionPaths.get(terminalManager.activeTerminalTabId) ?? null
    : null;
  const diffAvailable =
    Boolean(activeTerminalSessionPath) && activeTerminalTab?.type !== "claude";

  const handleDetachTerminal = async () => {
    await detachPanel("terminal");
    terminalManager.setTerminalOpen(false);
  };

  const handleDetachIndicationLogs = async () => {
    await detachPanel("indication-logs");
    setIndicationLogsOpen(false);
  };

  const sidebarContent = (
    <Sidebar
      isOpen={true}
      templates={promptsManager.allTemplates}
      savedPrompts={promptsManager.savedPrompts}
      archivedTemplates={promptsManager.archivedTemplates}
      archivedPrompts={promptsManager.archivedPrompts}
      taskGroups={taskGroupsManager.taskGroups}
      activeTaskGroupId={taskGroupsManager.activeTaskGroupId}
      terminalTabs={terminalManager.terminalTabs}
      waitingTerminalTabIds={terminalManager.terminalWaitingTabs}
      terminalCLIStatus={terminalManager.terminalCLIStatus}
      activeTerminalTabId={terminalManager.activeTerminalTabId}
      activePromptId={promptsManager.activePromptId}
      activeTemplateId={promptsManager.activeTemplateId}
      showArchive={promptsManager.showArchive}
      onSelectTerminalTab={terminalManager.handleSelectTerminalTab}
      onNewTerminalTab={terminalManager.handleNewTerminalTab}
      onCloseTerminalTab={terminalManager.handleCloseTerminalTab}
      onRenameTerminalTab={terminalManager.handleRenameTerminalTab}
      onSelectTemplate={(template) => {
        taskGroupsManager.setActiveTaskGroupId(null);
        promptsManager.handleSelectTemplate(template);
      }}
      onDeleteTemplate={promptsManager.handleDeleteTemplate}
      onDuplicateTemplate={promptsManager.handleDuplicateTemplate}
      onRenameTemplate={promptsManager.handleRenameTemplate}
      onSelectSavedPrompt={(prompt) => {
        taskGroupsManager.setActiveTaskGroupId(null);
        promptsManager.handleSelectSavedPrompt(prompt);
      }}
      onDeleteSavedPrompt={promptsManager.handleDeleteSavedPrompt}
      onDuplicatePrompt={promptsManager.handleDuplicatePrompt}
      onRenameSavedPrompt={promptsManager.handleRenameSavedPrompt}
      onRestoreTemplate={promptsManager.handleRestoreTemplate}
      onRestorePrompt={promptsManager.handleRestorePrompt}
      onToggleArchive={() =>
        promptsManager.setShowArchive(!promptsManager.showArchive)
      }
      onNewPrompt={() => {
        taskGroupsManager.setActiveTaskGroupId(null);
        promptsManager.handleNewPrompt();
      }}
      onSelectTaskGroup={(group) => {
        taskGroupsManager.setActiveTaskGroupId(group.id);
      }}
      onNewTaskGroup={taskGroupsManager.createTaskGroup}
      onDeleteTaskGroup={taskGroupsManager.deleteTaskGroup}
      onRenameTaskGroup={taskGroupsManager.renameTaskGroup}
      activeView={activeView}
      onOpenSettings={() =>
        setActiveView((prev) => (prev === "settings" ? "editor" : "settings"))
      }
    />
  );

  const activeTaskGroup = taskGroupsManager.activeTaskGroup;

  useEffect(() => {
    setTaskSectionPreview(null);
  }, [taskGroupsManager.activeTaskGroupId]);

  useEffect(() => {
    if (!taskGroupsManager.migrationNotice) {
      return;
    }
    setMigrationToast(taskGroupsManager.migrationNotice);
    taskGroupsManager.clearMigrationNotice();
    const timer = window.setTimeout(() => {
      setMigrationToast(null);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [taskGroupsManager]);

  const openTaskSession = (tabId: string) => {
    const tab = terminalManager.terminalTabs.find((entry) => entry.id === tabId);
    if (tab) {
      terminalManager.handleSelectTerminalTab(tab);
    }
  };

  const handleToggleDiffPanel = () => {
    if (!diffAvailable) {
      return;
    }
    if (diffOpen && diffSource === "session") {
      setDiffOpen(false);
      setDiffSource(null);
      return;
    }
    setDiffSessionPath(activeTerminalSessionPath ?? null);
    setDiffSource("session");
    setDiffOpen(true);
  };

  const handleOpenTaskDiffPanel = (path: string) => {
    const trimmed = path.trim();
    if (!trimmed) {
      return;
    }
    setDiffSessionPath(trimmed);
    setDiffSource("task");
    setDiffOpen(true);
  };

  useEffect(() => {
    if (diffSource !== "session" || !diffOpen) {
      return;
    }
    setDiffSessionPath(activeTerminalSessionPath ?? null);
  }, [activeTerminalSessionPath, diffOpen, diffSource]);

  const promptEditorContent = (
    <PromptEditor
      value={activeTaskGroup ? activeTaskGroup.prompt : promptsManager.promptContent}
      activeTitle={
        activeTaskGroup ? activeTaskGroup.name : promptsManager.currentDisplayTitle
      }
      saveStatus={activeTaskGroup ? "saved" : promptsManager.saveStatus}
      onChange={(value) => {
        if (activeTaskGroup) {
          taskGroupsManager.updateTaskGroup(activeTaskGroup.id, { prompt: value });
        } else {
          promptsManager.setPromptContent(value);
        }
      }}
      onTitleChange={(title) => {
        if (activeTaskGroup) {
          taskGroupsManager.renameTaskGroup(activeTaskGroup.id, title);
        } else {
          promptsManager.handleTitleChange(title);
        }
      }}
      templates={promptsManager.allTemplates}
      savedPrompts={promptsManager.savedPrompts}
      isChatOpen={chatManager.chatOpen}
      onRequestTerminal={terminalManager.createTerminalTab}
      promptTitle={
        activeTaskGroup ? activeTaskGroup.name : promptsManager.currentDisplayTitle
      }
      activeTerminalTabId={terminalManager.activeTerminalTabId}
      onSaveTerminalSessionPath={terminalManager.setTerminalSessionPath}
      codexSettings={settingsManager.codexSettings}
      claudeSettings={settingsManager.claudeSettings}
      worktreeSettings={settingsManager.worktreeSettings}
      isTemplate={activeTaskGroup ? false : promptsManager.isTemplate}
      onToggleTemplate={activeTaskGroup ? () => {} : promptsManager.handleToggleTemplate}
      showTemplateToggle={!activeTaskGroup}
      showPromptActions={!activeTaskGroup}
      sectionPreview={taskSectionPreview}
      onCloseSectionPreview={() => setTaskSectionPreview(null)}
    />
  );

  const mainContent =
    activeView === "settings" ? (
      <CodexSettingsPanel
        settings={settingsManager.codexSettings}
        claudeSettings={settingsManager.claudeSettings}
        worktreeSettings={settingsManager.worktreeSettings}
        onChange={settingsManager.setCodexSettings}
        onClaudeChange={settingsManager.setClaudeSettings}
        onWorktreeChange={settingsManager.setWorktreeSettings}
        onClose={() => setActiveView("editor")}
        onReset={settingsManager.resetAllSettings}
      />
    ) : activeTaskGroup ? (
      <TaskGroupPanel
        group={activeTaskGroup}
        templates={promptsManager.allTemplates}
        savedPrompts={promptsManager.savedPrompts}
        codexSettings={settingsManager.codexSettings}
        claudeSettings={settingsManager.claudeSettings}
        onSetSectionPreview={setTaskSectionPreview}
        onUpdateGroup={taskGroupsManager.updateTaskGroup}
        onCreateTask={taskGroupsManager.createTask}
        onUpdateTask={taskGroupsManager.updateTask}
        onDeleteTasks={taskGroupsManager.deleteTasks}
        onResetTasks={taskGroupsManager.resetTasks}
        onSetTasksStatus={taskGroupsManager.setTasksStatus}
        onSetTasksSelected={taskGroupsManager.setTasksSelected}
        onClearSelection={taskGroupsManager.clearTaskSelection}
        onRequestTerminal={terminalManager.createTerminalTab}
        onSaveTerminalSessionPath={terminalManager.setTerminalSessionPath}
        onOpenSession={openTaskSession}
        onOpenDiffPanel={handleOpenTaskDiffPanel}
      />
    ) : (
      promptEditorContent
    );

  const terminalContent = (
      <TerminalPanel
        tabs={terminalManager.terminalTabs}
        activeTabId={terminalManager.activeTerminalTabId}
        onTerminalOutput={terminalManager.handleTerminalOutput}
        onPopOut={handleDetachTerminal}
        onToggleLogs={() => setIndicationLogsOpen((prev) => !prev)}
        onToggleDiff={handleToggleDiffPanel}
        logsOpen={indicationLogsOpen}
        diffOpen={diffOpen}
        diffAvailable={diffAvailable}
        isDetached={isDetached("terminal")}
        cliStatus={
          terminalManager.activeTerminalTabId
            ? terminalManager.terminalCLIStatus.get(
              terminalManager.activeTerminalTabId
            ) || "question"
          : "question"
      }
      onRenameTab={terminalManager.handleRenameTerminalTab}
      onClaudeStatusChange={terminalManager.handleClaudeStatusChange}
    />
  );

  return (
    <div className="h-screen bg-black overflow-hidden">
      {migrationToast && (
        <div className="fixed right-4 top-4 z-50 rounded-lg border border-emerald-500/40 bg-emerald-900/80 px-4 py-3 text-xs text-emerald-100 shadow-xl">
          {migrationToast}
        </div>
      )}
      <Group
        orientation="horizontal"
        id="desktop-prompter-main-layout"
        className="h-full"
        groupRef={layoutManager.mainGroupRef}
        onLayoutChange={layoutManager.handleMainLayoutChange}
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
          <div className="h-full flex flex-col relative">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="absolute top-4 left-4 z-20 p-2 bg-zinc-800 rounded-md text-zinc-400 hover:text-white"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <Group
              orientation="vertical"
              id="desktop-prompter-vertical-layout"
              className="h-full"
              groupRef={layoutManager.verticalGroupRef}
              onLayoutChange={layoutManager.handleVerticalLayoutChange}
            >
              {/* Editor Panel */}
              <ResizablePanel id="editor" minSize="20%">
                <div className="h-full bg-zinc-950">{mainContent}</div>
              </ResizablePanel>

              {terminalManager.terminalOpen && (
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

              {claudeSessionOpen && (
                <>
                  <Separator className="h-1 bg-zinc-800 hover:bg-indigo-500 transition-colors cursor-row-resize" />
                  {/* Claude Session Panel */}
                  <ResizablePanel
                    id="claude-session"
                    defaultSize="40%"
                    minSize="20%"
                    maxSize="80%"
                    collapsible={true}
                  >
                    <div className="h-full bg-zinc-950 border-t border-zinc-800">
                      <ClaudeSessionPanel
                        cliPath={settingsManager.claudeSettings.cliPath}
                        onOpenSettings={() => setActiveView("settings")}
                      />
                    </div>
                  </ResizablePanel>
                </>
              )}

              {indicationLogsOpen && (
                <>
                  <Separator className="h-1 bg-zinc-800 hover:bg-indigo-500 transition-colors cursor-row-resize" />
                  <ResizablePanel
                    id="indication-logs"
                    defaultSize="25%"
                    minSize="10%"
                    maxSize="60%"
                    collapsible={true}
                  >
                    <div className="h-full bg-zinc-950 border-t border-zinc-800">
                      <IndicationLogsPanel
                        logs={terminalManager.cliStatusLogs}
                        onClear={() => {
                          terminalManager.clearCliStatusLogs();
                          saveCliStatusLogs([]);
                        }}
                        onClose={() => setIndicationLogsOpen(false)}
                        onPopOut={handleDetachIndicationLogs}
                        isDetached={isDetached("indication-logs")}
                      />
                    </div>
                  </ResizablePanel>
                </>
              )}
            </Group>
          </div>
        </ResizablePanel>

        {/* Chat Assistant Panel (Right Column) */}
        {(diffOpen || chatManager.chatOpen || activeTaskGroup) && (
          <>
            <Separator className="w-1 bg-zinc-800 hover:bg-indigo-500 transition-colors cursor-col-resize" />
            <ResizablePanel
              id="right-panel"
              defaultSize="25%"
              minSize="15%"
              maxSize="50%"
              collapsible={true}
            >
              <div className="h-full bg-zinc-900 border-l border-zinc-800">
                {diffOpen ? (
                  <GitDiffPanel
                    sessionPath={diffSessionPath}
                    onClose={() => {
                      setDiffOpen(false);
                      setDiffSource(null);
                    }}
                  />
                ) : chatManager.chatOpen ? (
                  <ChatAssistant
                    messages={chatManager.messages}
                    isLoading={chatManager.chatLoading}
                    onSendMessage={chatManager.handleSendMessage}
                    onClose={() => chatManager.setChatOpen(false)}
                  />
                ) : activeTaskGroup && activeView !== "settings" ? (
                  <div className="h-full bg-zinc-950">{promptEditorContent}</div>
                ) : null}
              </div>
            </ResizablePanel>
          </>
        )}
      </Group>
    </div>
  );
};

export default App;
