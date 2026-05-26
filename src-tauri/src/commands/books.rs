use tauri::Manager;

#[tauri::command]
pub fn save_all_books(app_handle: tauri::AppHandle, data: String) -> Result<(), String> {
    let base = app_handle.path().app_data_dir().map_err(|e| format!("App data dir: {e}"))?;
    let books_dir = base.join("books");
    let tmp = base.join("books_tmp");

    // Clean old single-file storage
    let old = base.join("books.json");
    if old.exists() {
        std::fs::remove_file(&old).ok();
    }

    // Write to temp dir then atomic rename
    if tmp.exists() {
        std::fs::remove_dir_all(&tmp).map_err(|e| format!("Clean temp dir: {e}"))?;
    }

    let books: Vec<serde_json::Value> =
        serde_json::from_str(&data).map_err(|e| format!("Parse: {e}"))?;

    for book in &books {
        let id = book["id"].as_str().unwrap_or("unknown");
        let chapters = book["chapters"].as_array().cloned().unwrap_or_default();

        // Write meta.json (book without chapters content, but with chapter index)
        let mut meta = book.clone();
        let chapter_index: Vec<serde_json::Value> = chapters
            .iter()
            .map(|ch| {
                serde_json::json!({
                    "id": ch["id"],
                    "title": ch["title"],
                    "createdAt": ch["createdAt"],
                    "updatedAt": ch["updatedAt"]
                })
            })
            .collect();
        meta["chapters"] = serde_json::Value::Array(chapter_index);

        let book_dir = tmp.join(id);
        std::fs::create_dir_all(&book_dir).map_err(|e| format!("Create dir: {e}"))?;
        let meta_str = serde_json::to_string_pretty(&meta).map_err(|e| format!("Serialize meta: {e}"))?;
        std::fs::write(book_dir.join("meta.json"), &meta_str).map_err(|e| format!("Write meta: {e}"))?;

        // Write each chapter as separate file
        let ch_dir = book_dir.join("chapters");
        std::fs::create_dir_all(&ch_dir).map_err(|e| format!("Create chapters dir: {e}"))?;
        for ch in &chapters {
            let cid = ch["id"].as_str().unwrap_or("unknown");
            let ch_str = serde_json::to_string_pretty(ch).map_err(|e| format!("Serialize chapter: {e}"))?;
            std::fs::write(ch_dir.join(format!("{cid}.json")), &ch_str)
                .map_err(|e| format!("Write chapter: {e}"))?;
        }
    }

    // Atomic swap
    if books_dir.exists() {
        std::fs::remove_dir_all(&books_dir).map_err(|e| format!("Clean old dir: {e}"))?;
    }
    std::fs::rename(&tmp, &books_dir).map_err(|e| format!("Atomic swap: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn load_all_books(app_handle: tauri::AppHandle) -> Result<String, String> {
    let base = app_handle.path().app_data_dir().map_err(|e| format!("App data dir: {e}"))?;
    let books_dir = base.join("books");

    // Migrate from old single file
    let old = base.join("books.json");
    if old.exists() && !books_dir.exists() {
        let data = std::fs::read_to_string(&old).map_err(|e| format!("Read old data: {e}"))?;
        let books: Vec<serde_json::Value> =
            serde_json::from_str(&data).map_err(|e| format!("Parse old data: {e}"))?;
        // Trigger save in new format
        let new_data = serde_json::to_string(&books).map_err(|e| format!("Serialize: {e}"))?;
        drop(data);
        save_all_books(app_handle.clone(), new_data)?;
        std::fs::remove_file(&old).ok();
    }

    if !books_dir.exists() {
        return Ok("[]".into());
    }

    let mut books: Vec<serde_json::Value> = Vec::new();

    for entry in std::fs::read_dir(&books_dir).map_err(|e| format!("Read dir: {e}"))? {
        let entry = entry.map_err(|e| format!("Read entry: {e}"))?;
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }

        let book_dir = entry.path();
        let meta_path = book_dir.join("meta.json");
        if !meta_path.exists() {
            continue;
        }

        let meta_str =
            std::fs::read_to_string(&meta_path).map_err(|e| format!("Read meta: {e}"))?;
        let mut book: serde_json::Value =
            serde_json::from_str(&meta_str).map_err(|e| format!("Parse meta: {e}"))?;

        // Load chapters
        let ch_dir = book_dir.join("chapters");
        let mut chapters: Vec<serde_json::Value> = Vec::new();
        if ch_dir.exists() {
            for ch_entry in
                std::fs::read_dir(&ch_dir).map_err(|e| format!("Read chapters dir: {e}"))?
            {
                let ch_entry = ch_entry.map_err(|e| format!("Read entry: {e}"))?;
                let ch_str =
                    std::fs::read_to_string(ch_entry.path()).map_err(|e| format!("Read chapter: {e}"))?;
                let ch: serde_json::Value =
                    serde_json::from_str(&ch_str).map_err(|e| format!("Parse chapter: {e}"))?;
                chapters.push(ch);
            }
        }
        chapters.sort_by_key(|c| {
            c["createdAt"].as_str().unwrap_or("").to_string()
        });
        book["chapters"] = serde_json::Value::Array(chapters);
        books.push(book);
    }

    books.sort_by_key(|b| {
        b["updatedAt"].as_str().unwrap_or("").to_string()
    });

    serde_json::to_string(&books).map_err(|e| format!("Serialize: {e}"))
}

#[tauri::command]
pub fn delete_book_dir(app_handle: tauri::AppHandle, book_id: String) -> Result<(), String> {
    let base = app_handle.path().app_data_dir().map_err(|e| format!("App data dir: {e}"))?;
    let book_dir = base.join("books").join(&book_id);
    if book_dir.exists() {
        std::fs::remove_dir_all(&book_dir).map_err(|e| format!("Delete dir: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn export_book_markdown(
    app_handle: tauri::AppHandle,
    book_title: String,
    chapters_json: String,
) -> Result<String, String> {
    use serde_json::Value;
    let chapters: Vec<Value> =
        serde_json::from_str(&chapters_json).map_err(|e| format!("Parse JSON: {e}"))?;

    let mut md = format!("# {}\n\n", book_title);

    for ch in chapters {
        let title = ch["title"].as_str().unwrap_or("Untitled");
        let content = ch["content"].as_str().unwrap_or("");

        // Strip HTML tags for plain text export
        let plain = content
            .replace("<p>", "\n")
            .replace("</p>", "\n")
            .replace("<br>", "\n")
            .replace("<br/>", "\n")
            .replace("<br />", "\n");

        // Remove remaining HTML tags
        let clean = strip_html(&plain);

        md.push_str(&format!("## {}\n\n", title));
        md.push_str(&clean);
        md.push_str("\n\n---\n\n");
    }

    let doc_dir = app_handle
        .path()
        .document_dir()
        .map_err(|e| format!("Documents dir: {e}"))?;

    let novelcraft_dir = doc_dir.join("QuillForge");
    std::fs::create_dir_all(&novelcraft_dir).map_err(|e| format!("Create dir失败: {e}"))?;

    let safe_title = book_title
        .chars()
        .map(|c| if r#"<>:"/\|?*"#.contains(c) { '_' } else { c })
        .collect::<String>();
    let path = novelcraft_dir.join(format!("{}.md", safe_title));
    std::fs::write(&path, &md).map_err(|e| format!("Export failed: {e}"))?;

    Ok(path.to_string_lossy().to_string())
}

fn strip_html(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut in_tag = false;
    for ch in input.chars() {
        if ch == '<' {
            in_tag = true;
        } else if ch == '>' {
            in_tag = false;
        } else if !in_tag {
            out.push(ch);
        }
    }
    out
}
