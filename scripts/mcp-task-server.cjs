const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { createRequire } = require("node:module");
const process = require("node:process");

const requireFromRoot = createRequire(path.join(__dirname, "..", "package.json"));
const sdkPackagePath = requireFromRoot.resolve(
  "@modelcontextprotocol/sdk/package.json",
);
const sdkPackageDir = path.dirname(sdkPackagePath);
const sdkRoot =
  path.basename(sdkPackageDir) === "cjs" &&
  path.basename(path.dirname(sdkPackageDir)) === "dist"
    ? path.resolve(sdkPackageDir, "..", "..")
    : sdkPackageDir;
const { Server } = require(path.join(sdkRoot, "dist", "cjs", "server", "index.js"));
const {
  StdioServerTransport,
} = require(path.join(sdkRoot, "dist", "cjs", "server", "stdio.js"));
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require(path.join(sdkRoot, "dist", "cjs", "types.js"));

const DEFAULT_STORE_PATH = path.join(
  os.homedir(),
  ".prompter",
  "task-groups.json",
);
const STORE_PATH =
  process.env.DESKTOP_PROMPTER_TASKS_PATH ?? DEFAULT_STORE_PATH;

const TOOL_DEFS = [
  {
    name: "task_group_create",
    description: "Create a new task group.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        prompt: { type: "string" },
        runner: { type: "string", enum: ["codex", "claude", "claude-ui"] },
        runInWorktree: { type: "boolean" },
        projectPath: { type: "string" },
        baseBranch: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "task_group_list",
    description: "List all task groups.",
    inputSchema: {
      type: "object",
      properties: {
        includeTasks: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "task_group_add_tasks",
    description: "Add a batch of tasks to a task group.",
    inputSchema: {
      type: "object",
      properties: {
        groupId: { type: "string" },
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              section: {
                type: "object",
                properties: {
                  filePath: { type: "string" },
                  lineStart: { type: "number" },
                  lineEnd: { type: "number" },
                },
                required: ["filePath", "lineStart", "lineEnd"],
                additionalProperties: false,
              },
              gitBranch: { type: "string" },
              worktreePath: { type: "string" },
              status: {
                type: "string",
                enum: ["ready", "queued", "working", "done", "archived"],
              },
            },
            required: ["name"],
            additionalProperties: false,
          },
        },
      },
      required: ["groupId", "tasks"],
      additionalProperties: false,
    },
  },
  {
    name: "task_group_list_tasks",
    description: "List tasks for a task group.",
    inputSchema: {
      type: "object",
      properties: {
        groupId: { type: "string" },
        includeArchived: { type: "boolean" },
      },
      required: ["groupId"],
      additionalProperties: false,
    },
  },
  {
    name: "task_group_archive_tasks",
    description: "Archive a batch of tasks in a task group.",
    inputSchema: {
      type: "object",
      properties: {
        groupId: { type: "string" },
        taskIds: { type: "array", items: { type: "string" } },
      },
      required: ["groupId", "taskIds"],
      additionalProperties: false,
    },
  },
];

const defaultSection = () => ({
  filePath: "",
  lineStart: 1,
  lineEnd: 1,
});

const defaultTask = (input) => ({
  id: randomUUID(),
  name: input.name,
  section: input.section ?? defaultSection(),
  gitBranch: input.gitBranch ?? "",
  worktreePath: input.worktreePath ?? "",
  diffStats: null,
  status: input.status ?? "ready",
  selected: false,
  sessionTabId: null,
});

const defaultTaskGroup = (input) => ({
  id: randomUUID(),
  name: input.name,
  prompt: input.prompt ?? "",
  runner: input.runner ?? "codex",
  runInWorktree: input.runInWorktree ?? false,
  projectPath: input.projectPath ?? "",
  baseBranch: input.baseBranch ?? "main",
  tasks: [],
});

const readStore = async () => {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.taskGroups)) {
      return { taskGroups: [] };
    }
    return { taskGroups: parsed.taskGroups };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { taskGroups: [] };
    }
    throw error;
  }
};

const writeStore = async (store) => {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  const payload = {
    taskGroups: store.taskGroups,
    updatedAt: Date.now(),
  };
  const tmpPath = `${STORE_PATH}.tmp-${process.pid}`;
  await fs.writeFile(tmpPath, JSON.stringify(payload, null, 2), "utf8");
  await fs.rename(tmpPath, STORE_PATH);
};

const getGroupOrThrow = (store, groupId) => {
  const group = store.taskGroups.find((item) => item.id === groupId);
  if (!group) {
    throw new Error(`Task group not found: ${groupId}`);
  }
  return group;
};

const handleCreateGroup = async (args) => {
  const store = await readStore();
  const group = defaultTaskGroup(args);
  store.taskGroups.push(group);
  await writeStore(store);
  return group;
};

const handleListGroups = async (args) => {
  const store = await readStore();
  if (args?.includeTasks) {
    return store.taskGroups;
  }
  return store.taskGroups.map((group) => ({
    id: group.id,
    name: group.name,
    prompt: group.prompt,
    runner: group.runner,
    runInWorktree: group.runInWorktree,
    projectPath: group.projectPath,
    baseBranch: group.baseBranch,
    taskCount: Array.isArray(group.tasks) ? group.tasks.length : 0,
  }));
};

const handleAddTasks = async (args) => {
  const store = await readStore();
  const group = getGroupOrThrow(store, args.groupId);
  if (!Array.isArray(group.tasks)) {
    group.tasks = [];
  }
  const created = args.tasks.map((task) => defaultTask(task));
  group.tasks.push(...created);
  await writeStore(store);
  return {
    groupId: group.id,
    added: created,
  };
};

const handleListTasks = async (args) => {
  const store = await readStore();
  const group = getGroupOrThrow(store, args.groupId);
  const tasks = Array.isArray(group.tasks) ? group.tasks : [];
  if (args.includeArchived) {
    return tasks;
  }
  return tasks.filter((task) => task.status !== "archived");
};

const handleArchiveTasks = async (args) => {
  const store = await readStore();
  const group = getGroupOrThrow(store, args.groupId);
  const taskIdSet = new Set(args.taskIds);
  let updated = 0;
  if (!Array.isArray(group.tasks)) {
    group.tasks = [];
  }
  group.tasks = group.tasks.map((task) => {
    if (!taskIdSet.has(task.id)) {
      return task;
    }
    updated += 1;
    return {
      ...task,
      status: "archived",
      selected: false,
    };
  });
  await writeStore(store);
  return {
    groupId: group.id,
    archived: updated,
  };
};

const run = async () => {
  process.stdin.resume();
  const server = new Server(
    {
      name: "desktop-prompter-task-groups",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    let result;
    switch (name) {
      case "task_group_create":
        result = await handleCreateGroup(args);
        break;
      case "task_group_list":
        result = await handleListGroups(args ?? {});
        break;
      case "task_group_add_tasks":
        result = await handleAddTasks(args);
        break;
      case "task_group_list_tasks":
        result = await handleListTasks(args);
        break;
      case "task_group_archive_tasks":
        result = await handleArchiveTasks(args);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
};

run().catch((error) => {
  console.error("Failed to start MCP task server:", error);
  process.exitCode = 1;
});
