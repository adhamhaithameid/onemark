//! OneMark desktop shell — M2 spike (P10).
//!
//! Minimal on purpose: one window loading the apps/web build, one trivial IPC
//! command proving the bridge. Real M2 lands here: a native `comrak` command
//! behind the same MarkdownEngine interface (with the NFR-6 determinism test
//! vs the WASM output), dialog/fs plugins for FolderStorage, security-scoped
//! bookmarks, native menus and `.md` file associations.

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {} — from the OneMark shell", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running OneMark shell");
}
