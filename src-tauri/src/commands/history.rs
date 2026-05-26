use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::Manager;

const MAX_SNAPSHOTS_PER_CHAPTER: usize = 100;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotInfo {
    pub timestamp: String,
    pub label: String,
    pub word_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct SnapshotMeta {
    timestamp: String,
    label: String,
    word_count: usize,
}

fn history_dir(app_handle: &tauri::AppHandle, book_id: &str, chapter_id: &str) -> std::path::PathBuf {
    let base = app_handle
        .path()
        .app_data_dir()
        .expect("App data dir should be accessible");
    base.join("books")
        .join(book_id)
        .join("history")
        .join(chapter_id)
}

fn count_words(html: &str) -> usize {
    // Strip HTML tags and count characters
    let text = html
        .replace("<p>", " ")
        .replace("</p>", " ")
        .replace("<br>", " ")
        .replace("<br/>", " ")
        .replace("<br />", " ");
    let text = strip_html_tags(&text);
    text.chars().filter(|c| !c.is_whitespace()).count()
}

fn strip_html_tags(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut in_tag = false;
    for ch in input.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(ch),
            _ => {}
        }
    }
    out
}

#[tauri::command]
pub fn save_snapshot(
    app_handle: tauri::AppHandle,
    book_id: String,
    chapter_id: String,
    content: String,
    label: Option<String>,
) -> Result<String, String> {
    let dir = history_dir(&app_handle, &book_id, &chapter_id);
    std::fs::create_dir_all(&dir).map_err(|e| format!("Create history dir: {e}"))?;

    let timestamp = Utc::now().to_rfc3339();
    let word_count = count_words(&content);

    let meta = SnapshotMeta {
        timestamp: timestamp.clone(),
        label: label.unwrap_or_default(),
        word_count,
    };

    let safe_name = timestamp.replace(':', "_").replace('.', "_");
    let snapshot_path = dir.join(format!("{safe_name}.json"));

    let snapshot = serde_json::json!({
        "meta": meta,
        "content": content,
    });

    let data = serde_json::to_string_pretty(&snapshot)
        .map_err(|e| format!("Serialize snapshot: {e}"))?;
    std::fs::write(&snapshot_path, &data).map_err(|e| format!("Write snapshot: {e}"))?;

    // Prune old snapshots if exceeding limit
    prune_snapshots(&dir);

    Ok(timestamp)
}

#[tauri::command]
pub fn list_snapshots(
    app_handle: tauri::AppHandle,
    book_id: String,
    chapter_id: String,
) -> Result<Vec<SnapshotInfo>, String> {
    let dir = history_dir(&app_handle, &book_id, &chapter_id);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut snapshots: Vec<SnapshotInfo> = Vec::new();

    for entry in std::fs::read_dir(&dir).map_err(|e| format!("Read history dir: {e}"))? {
        let entry = entry.map_err(|e| format!("Read entry: {e}"))?;
        if entry.path().extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }

        let data = std::fs::read_to_string(entry.path())
            .map_err(|e| format!("Read snapshot: {e}"))?;
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&data) {
            if let Some(meta) = val.get("meta") {
                snapshots.push(SnapshotInfo {
                    timestamp: meta["timestamp"].as_str().unwrap_or("").to_string(),
                    label: meta["label"].as_str().unwrap_or("").to_string(),
                    word_count: meta["word_count"].as_u64().unwrap_or(0) as usize,
                });
            }
        }
    }

    // Sort newest first
    snapshots.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    Ok(snapshots)
}

#[tauri::command]
pub fn get_snapshot_content(
    app_handle: tauri::AppHandle,
    book_id: String,
    chapter_id: String,
    timestamp: String,
) -> Result<String, String> {
    let dir = history_dir(&app_handle, &book_id, &chapter_id);
    let safe_name = timestamp.replace(':', "_").replace('.', "_");
    let path = dir.join(format!("{safe_name}.json"));

    if !path.exists() {
        return Err("Snapshot not found".into());
    }

    let data = std::fs::read_to_string(&path).map_err(|e| format!("Read snapshot: {e}"))?;
    let val: serde_json::Value =
        serde_json::from_str(&data).map_err(|e| format!("Parse snapshot: {e}"))?;

    let content = val["content"]
        .as_str()
        .unwrap_or("")
        .to_string();
    Ok(content)
}

#[tauri::command]
pub fn restore_snapshot(
    app_handle: tauri::AppHandle,
    book_id: String,
    chapter_id: String,
    timestamp: String,
) -> Result<String, String> {
    // get_snapshot_content already returns the content
    get_snapshot_content(app_handle, book_id, chapter_id, timestamp)
}

fn prune_snapshots(dir: &std::path::Path) {
    let mut entries: Vec<(std::path::PathBuf, std::time::SystemTime)> = Vec::new();
    if let Ok(read_dir) = std::fs::read_dir(dir) {
        for entry in read_dir.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if let Ok(modified) = metadata.modified() {
                    entries.push((entry.path(), modified));
                }
            }
        }
    }

    if entries.len() <= MAX_SNAPSHOTS_PER_CHAPTER {
        return;
    }

    // Sort oldest first, remove oldest
    entries.sort_by(|a, b| b.1.cmp(&a.1)); // newest first
    for (path, _) in entries.iter().skip(MAX_SNAPSHOTS_PER_CHAPTER) {
        std::fs::remove_file(path).ok();
    }
}
