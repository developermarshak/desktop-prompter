use git2::{Delta, DiffOptions, ErrorCode, Oid, Repository};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use std::{
    collections::HashMap,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
};
use tauri::{Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

#[derive(Clone, Serialize)]
struct TerminalOutput {
    id: String,
    data: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitDiffFile {
    path: String,
    status: String,
    old_content: String,
    new_content: String,
    is_binary: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitDiffResponse {
    root: String,
    files: Vec<GitDiffFile>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitDiffStatsResponse {
    added: usize,
    removed: usize,
    files_changed: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileSectionResponse {
    content: String,
    path: String,
    start_line: usize,
    end_line: usize,
}

struct PtySession {
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send>,
}

#[derive(Default)]
struct PtyState {
    sessions: Mutex<HashMap<String, PtySession>>,
}

#[derive(Default)]
struct McpTaskServerState {
    child: Mutex<Option<Child>>,
}

struct McpServerTarget {
    path: PathBuf,
    use_node: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct McpServerCommandResponse {
    command: String,
    args: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TaskGroupStoreResponse {
    task_groups: Vec<serde_json::Value>,
    exists: bool,
}

impl Drop for McpTaskServerState {
    fn drop(&mut self) {
        if let Ok(mut child_guard) = self.child.lock() {
            if let Some(mut child) = child_guard.take() {
                let _ = child.kill();
            }
        }
    }
}

fn shell_command() -> CommandBuilder {
    if cfg!(target_os = "windows") {
        CommandBuilder::new("cmd")
    } else {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        CommandBuilder::new(shell)
    }
}

fn delta_status_label(status: Delta) -> &'static str {
    match status {
        Delta::Added => "added",
        Delta::Modified => "modified",
        Delta::Deleted => "deleted",
        Delta::Renamed => "renamed",
        Delta::Copied => "copied",
        Delta::Typechange => "typechange",
        Delta::Untracked => "untracked",
        Delta::Conflicted => "conflicted",
        Delta::Ignored => "ignored",
        Delta::Unreadable => "unreadable",
        _ => "unknown",
    }
}

fn read_blob_content(repo: &Repository, oid: Oid) -> Option<Vec<u8>> {
    if oid.is_zero() {
        return None;
    }
    repo.find_blob(oid).ok().map(|blob| blob.content().to_vec())
}

fn read_workdir_content(root: &Path, rel_path: &str) -> Option<Vec<u8>> {
    let path = root.join(rel_path);
    std::fs::read(path).ok()
}

fn is_binary_content(bytes: &[u8]) -> bool {
    bytes.iter().any(|byte| *byte == 0)
}

fn count_lines(bytes: &[u8]) -> usize {
    if bytes.is_empty() {
        return 0;
    }
    let mut count = bytes.iter().filter(|byte| **byte == b'\n').count();
    if bytes.last() != Some(&b'\n') {
        count += 1;
    }
    count
}

fn collect_files(path: &Path, files: &mut Vec<PathBuf>) {
    if path.is_file() {
        files.push(path.to_path_buf());
        return;
    }
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            collect_files(&entry.path(), files);
        }
    }
}

fn get_untracked_files(repo_path: &str, workdir: &Path) -> Result<Vec<PathBuf>, String> {
    let output = run_git_command_output(
        repo_path,
        &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    )?;
    let mut files = Vec::new();
    for entry in output.split('\0') {
        if entry.starts_with("?? ") {
            let rel_path = entry.trim_start_matches("?? ").trim();
            if rel_path.is_empty() {
                continue;
            }
            let full_path = workdir.join(rel_path);
            collect_files(&full_path, &mut files);
        }
    }
    Ok(files)
}

fn resolve_base_commit<'repo>(
    repo: &'repo Repository,
    base_branch: &str,
) -> Result<git2::Commit<'repo>, String> {
    let candidates = [
        base_branch.to_string(),
        format!("refs/heads/{}", base_branch),
        format!("refs/remotes/origin/{}", base_branch),
    ];

    for candidate in candidates {
        if let Ok(obj) = repo.revparse_single(&candidate) {
            if let Ok(commit) = obj.peel_to_commit() {
                return Ok(commit);
            }
        }
    }

    Err(format!("base branch '{}' not found", base_branch))
}

fn resolve_section_path(root_path: Option<String>, file_path: String) -> Result<PathBuf, String> {
    let path = PathBuf::from(&file_path);
    if path.is_absolute() {
        return Ok(path);
    }
    let cleaned_root = root_path.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    });
    if let Some(root) = cleaned_root {
        return Ok(Path::new(&root).join(&file_path));
    }
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    Ok(cwd.join(&file_path))
}

fn resolve_prompter_store_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let home_dir = app
        .path()
        .home_dir()
        .map_err(|error| error.to_string())?;
    Ok(home_dir.join(".prompter").join("task-groups.json"))
}

fn run_git_command(repo_path: &str, args: &[&str]) -> Result<(), String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(args)
        .output()
        .map_err(|error| error.to_string())?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let message = if !stderr.is_empty() { stderr } else { stdout };
    Err(if message.is_empty() {
        "git command failed".to_string()
    } else {
        message
    })
}

fn run_git_command_output(repo_path: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(args)
        .output()
        .map_err(|error| error.to_string())?;
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let message = if !stderr.is_empty() { stderr } else { stdout };
    Err(if message.is_empty() {
        "git command failed".to_string()
    } else {
        message
    })
}

fn mcp_binary_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "mcp-task-server.exe"
    } else {
        "mcp-task-server"
    }
}

fn resolve_mcp_server_target(app: &tauri::AppHandle) -> Option<McpServerTarget> {
    if let Ok(explicit) = std::env::var("DESKTOP_PROMPTER_MCP_BINARY") {
        let candidate = PathBuf::from(explicit);
        if candidate.exists() {
            return Some(McpServerTarget {
                path: candidate,
                use_node: false,
            });
        }
    }

    if let Ok(explicit) = std::env::var("DESKTOP_PROMPTER_MCP_SCRIPT") {
        let candidate = PathBuf::from(explicit);
        if candidate.exists() {
            return Some(McpServerTarget {
                path: candidate,
                use_node: true,
            });
        }
    }

    if cfg!(debug_assertions) {
        if let Ok(cwd) = std::env::current_dir() {
            for base in cwd.ancestors().take(4) {
                let candidate = base.join("scripts").join("mcp-task-server.cjs");
                if candidate.exists() {
                    return Some(McpServerTarget {
                        path: candidate,
                        use_node: true,
                    });
                }
            }
        }
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidate = resource_dir.join(mcp_binary_name());
        if candidate.exists() {
            return Some(McpServerTarget {
                path: candidate,
                use_node: false,
            });
        }
    }

    if let Ok(cwd) = std::env::current_dir() {
        for base in cwd.ancestors().take(4) {
            let candidate = base.join("scripts").join("mcp-task-server.cjs");
            if candidate.exists() {
                return Some(McpServerTarget {
                    path: candidate,
                    use_node: true,
                });
            }
        }
    }

    None
}

fn start_mcp_task_server(
    app: &tauri::AppHandle,
    state: &State<McpTaskServerState>,
) -> Result<(), String> {
    let mut child_guard = state
        .child
        .lock()
        .map_err(|_| "mcp task server state poisoned".to_string())?;
    if child_guard.is_some() {
        return Ok(());
    }

    let target = resolve_mcp_server_target(app)
        .ok_or_else(|| "unable to locate mcp task server executable".to_string())?;
    let node_binary =
        std::env::var("DESKTOP_PROMPTER_MCP_NODE").unwrap_or_else(|_| "node".to_string());

    let mut cmd = if target.use_node {
        let mut cmd = Command::new(node_binary);
        cmd.arg(&target.path);
        cmd
    } else {
        Command::new(&target.path)
    };

    cmd
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    if let Some(parent) = target.path.parent() {
        cmd.current_dir(parent);
    }

    if let Ok(tasks_path) = resolve_prompter_store_path(app) {
        cmd.env("DESKTOP_PROMPTER_TASKS_PATH", tasks_path);
    }

    let child = cmd.spawn().map_err(|error| error.to_string())?;
    *child_guard = Some(child);
    Ok(())
}

#[tauri::command]
fn get_mcp_task_server_command(app: tauri::AppHandle) -> Result<McpServerCommandResponse, String> {
    let target = resolve_mcp_server_target(&app)
        .ok_or_else(|| "unable to locate mcp task server executable".to_string())?;
    let node_binary =
        std::env::var("DESKTOP_PROMPTER_MCP_NODE").unwrap_or_else(|_| "node".to_string());

    if target.use_node {
        return Ok(McpServerCommandResponse {
            command: node_binary,
            args: vec![target.path.to_string_lossy().to_string()],
        });
    }

    Ok(McpServerCommandResponse {
        command: target.path.to_string_lossy().to_string(),
        args: Vec::new(),
    })
}

#[tauri::command]
fn load_task_groups(app: tauri::AppHandle) -> Result<TaskGroupStoreResponse, String> {
    let store_path = resolve_prompter_store_path(&app)?;
    let exists = store_path.exists();
    if !exists {
        return Ok(TaskGroupStoreResponse {
            task_groups: Vec::new(),
            exists: false,
        });
    }
    let content = std::fs::read_to_string(&store_path).map_err(|error| error.to_string())?;
    let parsed: serde_json::Value =
        serde_json::from_str(&content).map_err(|error| error.to_string())?;
    let task_groups = parsed
        .get("taskGroups")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();
    Ok(TaskGroupStoreResponse {
        task_groups,
        exists: true,
    })
}

#[tauri::command]
fn save_task_groups(
    app: tauri::AppHandle,
    task_groups: Vec<serde_json::Value>,
) -> Result<(), String> {
    let store_path = resolve_prompter_store_path(&app)?;
    if let Some(parent) = store_path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let payload = serde_json::json!({
        "taskGroups": task_groups,
        "updatedAt": chrono::Utc::now().timestamp_millis(),
    });
    let tmp_path = store_path.with_extension("json.tmp");
    std::fs::write(&tmp_path, serde_json::to_vec_pretty(&payload).map_err(|e| e.to_string())?)
        .map_err(|error| error.to_string())?;
    std::fs::rename(&tmp_path, &store_path).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_git_diff(path: String) -> Result<GitDiffResponse, String> {
    let repo = Repository::discover(&path).map_err(|error| error.to_string())?;
    let root = repo
        .workdir()
        .ok_or_else(|| "repository has no working directory".to_string())?;

    let mut diff_opts = DiffOptions::new();
    diff_opts
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_typechange(true);

    let diff = match repo.head().ok().and_then(|head| head.peel_to_tree().ok()) {
        Some(tree) => repo
            .diff_tree_to_workdir_with_index(Some(&tree), Some(&mut diff_opts))
            .map_err(|error| error.to_string())?,
        None => repo
            .diff_index_to_workdir(None, Some(&mut diff_opts))
            .map_err(|error| error.to_string())?,
    };

    let mut files = Vec::new();
    for delta in diff.deltas() {
        let path = delta
            .new_file()
            .path()
            .or_else(|| delta.old_file().path());
        let Some(path) = path else {
            continue;
        };
        let path = path.to_string_lossy().to_string();

        let old_bytes = read_blob_content(&repo, delta.old_file().id());
        let new_bytes = read_workdir_content(root, &path);

        let old_is_binary = old_bytes
            .as_ref()
            .map(|bytes| is_binary_content(bytes))
            .unwrap_or(false);
        let new_is_binary = new_bytes
            .as_ref()
            .map(|bytes| is_binary_content(bytes))
            .unwrap_or(false);
        let is_binary = old_is_binary || new_is_binary;

        let old_content = if is_binary {
            String::new()
        } else {
            old_bytes
                .as_ref()
                .map(|bytes| String::from_utf8_lossy(bytes).to_string())
                .unwrap_or_default()
        };
        let new_content = if is_binary {
            String::new()
        } else {
            new_bytes
                .as_ref()
                .map(|bytes| String::from_utf8_lossy(bytes).to_string())
                .unwrap_or_default()
        };

        files.push(GitDiffFile {
            path,
            status: delta_status_label(delta.status()).to_string(),
            old_content,
            new_content,
            is_binary,
        });
    }

    Ok(GitDiffResponse {
        root: root.to_string_lossy().to_string(),
        files,
    })
}

#[tauri::command]
fn get_git_diff_stats(path: String, base_branch: String) -> Result<GitDiffStatsResponse, String> {
    let output = run_git_command_output(
        &path,
        &["diff", "--numstat", &base_branch],
    )?;

    let mut added = 0usize;
    let mut removed = 0usize;
    let mut files_changed = 0usize;

    for line in output.lines() {
        let mut parts = line.split('\t');
        let added_part = parts.next().unwrap_or("");
        let removed_part = parts.next().unwrap_or("");
        let file_part = parts.next().unwrap_or("");
        if file_part.is_empty() {
            continue;
        }
        files_changed += 1;
        if added_part == "-" || removed_part == "-" {
            continue;
        }
        if let Ok(value) = added_part.parse::<usize>() {
            added += value;
        }
        if let Ok(value) = removed_part.parse::<usize>() {
            removed += value;
        }
    }

    if let Ok(repo) = Repository::discover(&path) {
        if let Some(workdir) = repo.workdir() {
            if let Ok(untracked_files) = get_untracked_files(&path, workdir) {
                for file_path in untracked_files {
                    if let Ok(bytes) = std::fs::read(&file_path) {
                        if is_binary_content(&bytes) {
                            files_changed += 1;
                            continue;
                        }
                        let line_count = count_lines(&bytes);
                        if line_count > 0 {
                            added += line_count;
                        }
                        files_changed += 1;
                    }
                }
            }
        }
    }

    Ok(GitDiffStatsResponse {
        added,
        removed,
        files_changed,
    })
}

#[tauri::command]
fn get_git_branch(path: String) -> Result<String, String> {
    let repo = Repository::discover(&path).map_err(|error| error.to_string())?;
    if let Ok(head) = repo.head() {
        if let Some(name) = head.shorthand() {
            return Ok(name.to_string());
        }
    }
    Ok(String::new())
}

#[tauri::command]
fn get_git_diff_base(path: String, base_branch: String) -> Result<GitDiffResponse, String> {
    let repo = Repository::discover(&path).map_err(|error| error.to_string())?;
    let root = repo
        .workdir()
        .ok_or_else(|| "repository has no working directory".to_string())?;
    let base_commit = resolve_base_commit(&repo, &base_branch)?;
    let base_tree = base_commit.tree().map_err(|error| error.to_string())?;

    let mut diff_opts = DiffOptions::new();
    diff_opts
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_typechange(true);

    let diff = repo
        .diff_tree_to_workdir_with_index(Some(&base_tree), Some(&mut diff_opts))
        .map_err(|error| error.to_string())?;

    let mut files = Vec::new();
    for delta in diff.deltas() {
        let path = delta
            .new_file()
            .path()
            .or_else(|| delta.old_file().path());
        let Some(path) = path else {
            continue;
        };
        let path = path.to_string_lossy().to_string();

        let old_bytes = read_blob_content(&repo, delta.old_file().id());
        let new_bytes = read_workdir_content(root, &path);

        let old_is_binary = old_bytes
            .as_ref()
            .map(|bytes| is_binary_content(bytes))
            .unwrap_or(false);
        let new_is_binary = new_bytes
            .as_ref()
            .map(|bytes| is_binary_content(bytes))
            .unwrap_or(false);
        let is_binary = old_is_binary || new_is_binary;

        let old_content = if is_binary {
            String::new()
        } else {
            old_bytes
                .as_ref()
                .map(|bytes| String::from_utf8_lossy(bytes).to_string())
                .unwrap_or_default()
        };
        let new_content = if is_binary {
            String::new()
        } else {
            new_bytes
                .as_ref()
                .map(|bytes| String::from_utf8_lossy(bytes).to_string())
                .unwrap_or_default()
        };

        files.push(GitDiffFile {
            path,
            status: delta_status_label(delta.status()).to_string(),
            old_content,
            new_content,
            is_binary,
        });
    }

    Ok(GitDiffResponse {
        root: root.to_string_lossy().to_string(),
        files,
    })
}

#[tauri::command]
fn get_file_section(
    root_path: Option<String>,
    file_path: String,
    line_start: usize,
    line_end: usize,
) -> Result<FileSectionResponse, String> {
    let path = resolve_section_path(root_path, file_path)?;
    let content = std::fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let lines: Vec<&str> = content.lines().collect();

    if lines.is_empty() {
        return Ok(FileSectionResponse {
            content: String::new(),
            path: path.to_string_lossy().to_string(),
            start_line: line_start.max(1),
            end_line: line_start.max(1),
        });
    }

    let start = line_start.max(1);
    let end = line_end.max(start);
    let start_index = start - 1;
    let end_index = end.min(lines.len());

    let snippet = if start_index >= lines.len() {
        String::new()
    } else {
        lines[start_index..end_index].join("\n")
    };

    Ok(FileSectionResponse {
        content: snippet,
        path: path.to_string_lossy().to_string(),
        start_line: start,
        end_line: end_index,
    })
}

#[tauri::command]
fn reset_task_git(
    repo_path: String,
    worktree_path: Option<String>,
    branch_name: Option<String>,
) -> Result<(), String> {
    let repo = Repository::discover(&repo_path).map_err(|error| error.to_string())?;

    if let Some(worktree_path) = worktree_path {
        let trimmed = worktree_path.trim();
        if !trimmed.is_empty() && Path::new(trimmed).exists() {
            run_git_command(&repo_path, &["worktree", "remove", "--force", trimmed])?;
        }
    }

    if let Some(branch_name) = branch_name {
        let trimmed = branch_name.trim();
        if !trimmed.is_empty() {
            let reference_name = if trimmed.starts_with("refs/") {
                trimmed.to_string()
            } else {
                format!("refs/heads/{}", trimmed)
            };
            match repo.find_reference(&reference_name) {
                Ok(mut reference) => {
                    reference.delete().map_err(|error| error.to_string())?;
                }
                Err(error) => {
                    if error.code() != ErrorCode::NotFound {
                        return Err(error.to_string());
                    }
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
fn spawn_pty(
    id: String,
    cols: u16,
    rows: u16,
    state: State<PtyState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    {
        let mut sessions = state
            .sessions
            .lock()
            .map_err(|_| "terminal state poisoned".to_string())?;
        if let Some(mut session) = sessions.remove(&id) {
            let _ = session.child.kill();
        }
    }

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: rows.max(1),
            cols: cols.max(2),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| error.to_string())?;

    let mut cmd = shell_command();
    cmd.env("TERM", "xterm-256color");
    let home_key = if cfg!(target_os = "windows") {
        "USERPROFILE"
    } else {
        "HOME"
    };
    if let Ok(home) = std::env::var(home_key) {
        cmd.cwd(home);
    }

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|error| error.to_string())?;

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| error.to_string())?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|error| error.to_string())?;

    let id_clone = id.clone();
    let app_handle = app.clone();
    std::thread::spawn(move || {
        let mut buffer = [0u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(bytes) => {
                    let data = String::from_utf8_lossy(&buffer[..bytes]).to_string();
                    let _ = app_handle.emit(
                        "terminal-output",
                        TerminalOutput {
                            id: id_clone.clone(),
                            data,
                        },
                    );
                }
                Err(_) => break,
            }
        }
    });

    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| "terminal state poisoned".to_string())?;
    sessions.insert(
        id,
        PtySession {
            master: pair.master,
            writer,
            child,
        },
    );
    Ok(())
}

#[tauri::command]
fn write_pty(id: String, data: String, state: State<PtyState>) -> Result<(), String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| "terminal state poisoned".to_string())?;
    let session = sessions
        .get_mut(&id)
        .ok_or_else(|| "missing terminal session".to_string())?;
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|error| error.to_string())?;
    session
        .writer
        .flush()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn resize_pty(id: String, cols: u16, rows: u16, state: State<PtyState>) -> Result<(), String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| "terminal state poisoned".to_string())?;
    let session = sessions
        .get_mut(&id)
        .ok_or_else(|| "missing terminal session".to_string())?;
    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn close_pty(id: String, state: State<PtyState>) -> Result<(), String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| "terminal state poisoned".to_string())?;
    if let Some(mut session) = sessions.remove(&id) {
        let _ = session.child.kill();
    }
    Ok(())
}

#[tauri::command]
async fn create_panel_window(
    app: tauri::AppHandle,
    panel_id: String,
    title: String,
    width: f64,
    height: f64,
    x: Option<f64>,
    y: Option<f64>,
) -> Result<(), String> {
    let label = format!("panel-{}", panel_id);
    let url = format!("index.html?panel={}", panel_id);

    let mut builder = WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App(url.into()),
    )
    .title(&title)
    .inner_size(width, height)
    .decorations(true)
    .resizable(true);

    if let (Some(x), Some(y)) = (x, y) {
        builder = builder.position(x, y);
    }

    builder.build().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn close_panel_window(app: tauri::AppHandle, panel_id: String) -> Result<(), String> {
    let label = format!("panel-{}", panel_id);
    if let Some(window) = app.get_webview_window(&label) {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PtyState::default())
        .manage(McpTaskServerState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            let handle = app.handle();
            let state = app.state::<McpTaskServerState>();
            if let Err(error) = start_mcp_task_server(&handle, &state) {
                eprintln!("Failed to start MCP task server: {error}");
            }
            Ok(())
        })
        // Updater temporarily disabled - TODO: fix signature generation
        // .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            spawn_pty,
            write_pty,
            resize_pty,
            close_pty,
            get_mcp_task_server_command,
            load_task_groups,
            save_task_groups,
            get_git_diff,
            get_git_diff_stats,
            get_git_branch,
            get_git_diff_base,
            get_file_section,
            reset_task_git,
            create_panel_window,
            close_panel_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
