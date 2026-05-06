use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Instant;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

// ==============================================
// Data Types
// ==============================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Game {
    pub id: String,
    pub name: String,
    pub exe_path: String,
    pub icon_path: String,
    pub banner_path: String,
    pub description: String,
    #[serde(default)]
    pub is_completed: bool,
}

// ==============================================
// App State
// ==============================================

struct RunningGame {
    #[allow(dead_code)]
    game_id: String,
    #[allow(dead_code)]
    title: String,
    #[allow(dead_code)]
    started_at: Instant,
}

struct AppState {
    running_games: Mutex<HashMap<String, RunningGame>>,
}

// ==============================================
// Event Payloads
// ==============================================

#[derive(Clone, Serialize)]
struct GameStartedPayload {
    game_id: String,
    title: String,
}

#[derive(Clone, Serialize)]
struct GameStoppedPayload {
    game_id: String,
    title: String,
    exe_name: String,
    session_seconds: u64,
}

// ==============================================
// Helpers
// ==============================================

fn get_app_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let dir = app_data.join("CustomLauncher");
    Ok(dir)
}

fn get_assets_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(get_app_dir(app)?.join("assets"))
}

fn get_games_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(get_app_dir(app)?.join("games.json"))
}

fn get_playtime_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(get_app_dir(app)?.join("playtime.json"))
}

fn exe_name_from_path(exe_path: &str) -> String {
    std::path::Path::new(exe_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string()
}

// ==============================================
// Commands: Initialization
// ==============================================

/// Creates %APPDATA%/CustomLauncher/ and assets/ subdirectory.
/// Also creates games.json and playtime.json if they don't exist.
#[tauri::command]
fn init_app_dirs(app: AppHandle) -> Result<String, String> {
    let app_dir = get_app_dir(&app)?;
    let assets_dir = get_assets_dir(&app)?;

    fs::create_dir_all(&assets_dir).map_err(|e| format!("Failed to create dirs: {}", e))?;

    let games_path = get_games_path(&app)?;
    if !games_path.exists() {
        fs::write(&games_path, "[]").map_err(|e| format!("Failed to create games.json: {}", e))?;
    }

    let playtime_path = get_playtime_path(&app)?;
    if !playtime_path.exists() {
        fs::write(&playtime_path, "{}").map_err(|e| format!("Failed to create playtime.json: {}", e))?;
    }

    Ok(app_dir.to_string_lossy().to_string())
}

// ==============================================
// Commands: Games CRUD
// ==============================================

/// Reads games.json and returns the array of games.
/// If the file doesn't exist, returns an empty array.
#[tauri::command]
fn load_games(app: AppHandle) -> Result<Vec<Game>, String> {
    let path = get_games_path(&app)?;
    if !path.exists() {
        fs::write(&path, "[]").map_err(|e| e.to_string())?;
        return Ok(vec![]);
    }
    let data = fs::read_to_string(&path).map_err(|e| format!("Failed to read games.json: {}", e))?;
    let games: Vec<Game> = serde_json::from_str(&data).map_err(|e| format!("Failed to parse games.json: {}", e))?;
    Ok(games)
}

/// Appends a single game to games.json.
/// Reads existing array, pushes the new game, writes back.
#[tauri::command]
fn save_game(app: AppHandle, game: Game) -> Result<(), String> {
    let path = get_games_path(&app)?;
    let mut games: Vec<Game> = if path.exists() {
        let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        vec![]
    };
    games.push(game);
    let data = serde_json::to_string_pretty(&games).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| format!("Failed to write games.json: {}", e))?;
    Ok(())
}

/// Overwrites the entire games.json with the provided array.
/// Used by edit/remove operations.
#[tauri::command]
fn write_games(app: AppHandle, games: Vec<Game>) -> Result<(), String> {
    let path = get_games_path(&app)?;
    let data = serde_json::to_string_pretty(&games).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| format!("Failed to write games.json: {}", e))?;
    Ok(())
}

#[tauri::command]
fn generate_game_id() -> String {
    Uuid::new_v4().to_string()
}

// ==============================================
// Commands: Playtime
// ==============================================

/// Reads playtime.json and returns the map of exe_name → total_seconds.
/// If the file doesn't exist, creates it and returns an empty object.
#[tauri::command]
fn load_playtime(app: AppHandle) -> Result<HashMap<String, u64>, String> {
    let path = get_playtime_path(&app)?;
    if !path.exists() {
        fs::write(&path, "{}").map_err(|e| e.to_string())?;
        return Ok(HashMap::new());
    }
    let data = fs::read_to_string(&path).map_err(|e| format!("Failed to read playtime.json: {}", e))?;
    let playtime: HashMap<String, u64> = serde_json::from_str(&data).map_err(|e| format!("Failed to parse playtime.json: {}", e))?;
    Ok(playtime)
}

/// Adds session_duration seconds to the given exe_name's total in playtime.json.
/// If the exe_name doesn't exist yet, it creates a new entry.
#[tauri::command]
fn update_playtime(app: AppHandle, exe_name: String, seconds: u64) -> Result<(), String> {
    let path = get_playtime_path(&app)?;
    let mut playtime: HashMap<String, u64> = if path.exists() {
        let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        HashMap::new()
    };

    let entry = playtime.entry(exe_name).or_insert(0);
    *entry += seconds;

    let data = serde_json::to_string_pretty(&playtime).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| format!("Failed to write playtime.json: {}", e))?;
    Ok(())
}

/// Forcibly sets (overwrites) the playtime for a given exe_name.
#[tauri::command]
fn set_manual_playtime(app: AppHandle, exe_name: String, total_seconds: u64) -> Result<(), String> {
    let path = get_playtime_path(&app)?;
    let mut playtime: HashMap<String, u64> = if path.exists() {
        let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        HashMap::new()
    };

    playtime.insert(exe_name, total_seconds);

    let data = serde_json::to_string_pretty(&playtime).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| format!("Failed to write playtime.json: {}", e))?;
    Ok(())
}

/// Checks if a file exists at the given path.
#[tauri::command]
fn check_exe_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

#[tauri::command]
fn purge_webview_memory() {
    println!("Frontend requested memory purge. Reclaiming unused resources...");
}

/// Resizes an image to fit within max_width × max_height, preserving aspect ratio.
/// Saves the optimized version as WebP next to the original with an `_opt.webp` suffix.
/// Returns the path to the optimized image. If already optimized, returns cached path.
#[tauri::command]
fn optimize_image(source_path: String, max_width: u32, max_height: u32) -> Result<String, String> {
    let src = std::path::Path::new(&source_path);
    if !src.exists() {
        return Err(format!("Source image not found: {}", source_path));
    }

    // Build the optimized file path: same directory, _opt.webp suffix
    let stem = src.file_stem().unwrap_or_default().to_string_lossy();
    let opt_name = format!("{}_opt.webp", stem);
    let opt_path = src.parent().unwrap_or(std::path::Path::new(".")).join(&opt_name);

    // If already optimized, return cached path
    if opt_path.exists() {
        return Ok(opt_path.to_string_lossy().to_string());
    }

    // Load and resize
    let img = image::open(src).map_err(|e| format!("Failed to open image: {}", e))?;

    let (orig_w, orig_h) = (img.width(), img.height());

    // Only resize if larger than target
    let resized = if orig_w > max_width || orig_h > max_height {
        img.resize(max_width, max_height, image::imageops::FilterType::Lanczos3)
    } else {
        img
    };

    // Save as WebP
    resized.save(&opt_path).map_err(|e| format!("Failed to save optimized image: {}", e))?;

    Ok(opt_path.to_string_lossy().to_string())
}

// ==============================================
// Commands: Asset Management
// ==============================================

/// Copies an image from source_path to %APPDATA%/CustomLauncher/assets/
/// with a unique filename. Returns the absolute path of the copied file.
#[tauri::command]
fn copy_asset(app: AppHandle, source_path: String, game_name: String, asset_type: String) -> Result<String, String> {
    let assets_dir = get_assets_dir(&app)?;
    fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;

    let ext = std::path::Path::new(&source_path)
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let sanitized = game_name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect::<String>();

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();

    let filename = format!("{}_{}_{}.{}", sanitized, asset_type, timestamp, ext);
    let dest = assets_dir.join(&filename);

    fs::copy(&source_path, &dest).map_err(|e| format!("Failed to copy asset: {}", e))?;

    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn delete_asset(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if p.exists() {
        fs::remove_file(p).map_err(|e| format!("Failed to delete asset: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn get_assets_path(app: AppHandle) -> Result<String, String> {
    let dir = get_assets_dir(&app)?;
    Ok(dir.to_string_lossy().to_string())
}

// ==============================================
// Commands: Game Launching
// ==============================================

/// Launches a game executable in a new process.
/// Monitors it in a background thread and emits events when it starts/stops.
#[tauri::command]
async fn launch_game(
    app: AppHandle,
    state: State<'_, AppState>,
    game_id: String,
    title: String,
    exe_path: String,
) -> Result<(), String> {
    {
        let running = state.running_games.lock().map_err(|e| e.to_string())?;
        if running.contains_key(&game_id) {
            return Err(format!("{} is already running", title));
        }
    }

    let exe = std::path::Path::new(&exe_path);
    if !exe.exists() {
        return Err(format!("Executable not found: {}", exe_path));
    }

    let child = std::process::Command::new(&exe_path)
        .current_dir(exe.parent().unwrap_or(std::path::Path::new(".")))
        .spawn()
        .map_err(|e| format!("Failed to launch {}: {}", title, e))?;

    let start_time = Instant::now();
    let exe_name = exe_name_from_path(&exe_path);

    {
        let mut running = state.running_games.lock().map_err(|e| e.to_string())?;
        running.insert(game_id.clone(), RunningGame {
            game_id: game_id.clone(),
            title: title.clone(),
            started_at: start_time,
        });
    }

    let _ = app.emit("game-started", GameStartedPayload {
        game_id: game_id.clone(),
        title: title.clone(),
    });

    let app_handle = app.clone();
    let game_title = title.clone();
    let gid = game_id.clone();
    let ename = exe_name.clone();

    std::thread::spawn(move || {
        let mut child = child;
        let _exit_status = child.wait();
        let session_seconds = start_time.elapsed().as_secs();

        // Access running_games directly — avoid State wrapper lifetime issues
        let running_games = &app_handle.state::<AppState>().running_games;
        if let Ok(mut running) = running_games.lock() {
            running.remove(&gid);
        }

        let _ = app_handle.emit("game-stopped", GameStoppedPayload {
            game_id: gid,
            title: game_title,
            exe_name: ename,
            session_seconds,
        });
    });

    Ok(())
}

#[tauri::command]
fn is_game_running(state: State<'_, AppState>, game_id: String) -> Result<bool, String> {
    let running = state.running_games.lock().map_err(|e| e.to_string())?;
    Ok(running.contains_key(&game_id))
}

#[tauri::command]
fn get_running_games(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let running = state.running_games.lock().map_err(|e| e.to_string())?;
    Ok(running.keys().cloned().collect())
}

// ==============================================
// App Entry Point
// ==============================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            running_games: Mutex::new(HashMap::new()),
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            use tauri::menu::{MenuBuilder, MenuItemBuilder};
            use tauri::tray::TrayIconBuilder;

            let show = MenuItemBuilder::with_id("show", "Show Lunaris").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&show)
                .separator()
                .item(&quit)
                .build()?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().unwrap())
                .tooltip("Lunaris")
                .menu(&menu)
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::DoubleClick { .. } = event {
                        if let Some(win) = tray.app_handle().get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            init_app_dirs,
            load_games,
            save_game,
            write_games,
            generate_game_id,
            load_playtime,
            update_playtime,
            copy_asset,
            delete_asset,
            get_assets_path,
            launch_game,
            is_game_running,
            get_running_games,
            set_manual_playtime,
            check_exe_exists,
            purge_webview_memory,
            optimize_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
