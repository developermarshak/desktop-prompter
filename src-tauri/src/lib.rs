use git2::{Delta, DiffOptions, Oid, Repository};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use std::{
    collections::HashMap,
    io::{Read, Write},
    path::Path,
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

struct PtySession {
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send>,
}

#[derive(Default)]
struct PtyState {
    sessions: Mutex<HashMap<String, PtySession>>,
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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        // Updater temporarily disabled - TODO: fix signature generation
        // .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            spawn_pty,
            write_pty,
            resize_pty,
            close_pty,
            get_git_diff,
            create_panel_window,
            close_panel_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
