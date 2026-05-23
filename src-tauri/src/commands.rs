use crate::crypto;
use crate::llm::provider::{self, AiRequest, Message, ModelConfig, ProviderInfo};
use crate::AppState;
use tauri::Manager;
use tauri::State;
use tauri_plugin_store::StoreExt;

#[tauri::command]
pub async fn send_ai_message(
    state: State<'_, AppState>,
    config: ModelConfig,
    request: AiRequest,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let api_key = get_api_key_internal(&state, &config.provider, &app_handle)?;

    let system_prompt = if config.system_prompt.is_empty() {
        get_default_system_prompt(&request.action)
    } else {
        config.system_prompt.clone()
    };

    let messages = build_messages(&request, &system_prompt);

    provider::send_to_provider(
        &config.provider,
        &config.model,
        &config.api_base,
        api_key.as_deref(),
        messages,
        config.temperature,
        config.max_tokens,
    )
    .await
}

#[tauri::command]
pub fn save_api_key(
    state: State<'_, AppState>,
    provider: String,
    api_key: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let encryption_key = state
        .encryption_key
        .lock()
        .map_err(|e| format!("Lock failed: {e}"))?;

    let key = encryption_key.ok_or("Encryption key not initialized")?;
    let encrypted = crypto::encrypt(&api_key, &key)?;

    let store = app_handle
        .store("quillforge-secrets.json")
        .map_err(|e| format!("Store open failed: {e}"))?;
    store.set(format!("apikey_{provider}"), serde_json::Value::String(encrypted));
    store.save().map_err(|e| format!("Persist failed: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn get_api_key_masked(
    state: State<'_, AppState>,
    provider: String,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let api_key = get_api_key_internal(&state, &provider, &app_handle)?;
    match api_key {
        Some(key) => Ok(mask_key(&key)),
        None => Ok("N/A".into()),
    }
}

#[tauri::command]
pub fn has_api_key(
    state: State<'_, AppState>,
    provider: String,
    app_handle: tauri::AppHandle,
) -> Result<bool, String> {
    let api_key = get_api_key_internal(&state, &provider, &app_handle)?;
    Ok(api_key.is_some())
}

#[tauri::command]
pub fn delete_api_key(
    _state: State<'_, AppState>,
    provider: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let store = app_handle
        .store("quillforge-secrets.json")
        .map_err(|e| format!("Store open failed: {e}"))?;
    store.delete(format!("apikey_{provider}"));
    store.save().map_err(|e| format!("Persist failed: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn get_supported_providers() -> Vec<ProviderInfo> {
    provider::get_providers()
}

// ── Project persistence ──

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

#[tauri::command]
pub async fn check_provider_connection(
    state: State<'_, AppState>,
    config: ModelConfig,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let api_key = get_api_key_internal(&state, &config.provider, &app_handle)?;

    let test_messages = vec![Message {
        role: "user".into(),
        content: "Reply with just the word 'OK'.".into(),
    }];

    let result = provider::send_to_provider(
        &config.provider,
        &config.model,
        &config.api_base,
        api_key.as_deref(),
        test_messages,
        0.3,
        50,
    )
    .await?;

    Ok(format!("OK — {model}: {result}", model = config.model))
}

fn get_api_key_internal(
    state: &State<'_, AppState>,
    provider: &str,
    app_handle: &tauri::AppHandle,
) -> Result<Option<String>, String> {
    let store = app_handle
        .store("quillforge-secrets.json")
        .map_err(|e| format!("Store open failed: {e}"))?;

    let encrypted = store.get(format!("apikey_{provider}"));

    match encrypted {
        Some(val) => {
            let encrypted_str = val.as_str().unwrap_or("");
            if encrypted_str.is_empty() {
                return Ok(None);
            }
            let encryption_key = state
                .encryption_key
                .lock()
                .map_err(|e| format!("Lock failed: {e}"))?;
            let key = encryption_key.ok_or("Encryption key not initialized")?;
            let decrypted = crypto::decrypt(encrypted_str, &key)?;
            Ok(Some(decrypted))
        }
        None => Ok(None),
    }
}

fn mask_key(key: &str) -> String {
    if key.len() <= 8 {
        return "***".into();
    }
    let prefix: String = key.chars().take(4).collect();
    let suffix: String = key.chars().rev().take(4).collect::<String>().chars().rev().collect();
    format!("{prefix}****{suffix}")
}

fn get_default_system_prompt(action: &str) -> String {
    match action {
        "review" => "你是一位资深的网文编辑，擅长审阅和点评小说。请对以下文本进行审阅，从文法、节奏、人物塑造、情节逻辑等方面给出具体建议。直接给出审阅意见，不要客套话。".into(),
        "idea" => "你是一位创意无限的网文构思助手。根据用户提供的情节节点或故事设定，给出3-5个有创意的情节发展方向或写作思路。每个思路简洁有力，100字以内。".into(),
        "continue" => "你是一位文笔流畅的网文写手。请根据上文语境和风格，自然地续写下文。保持人称、时态、文风与上文一致，不要突然转换视角。续写长度适中，在原文基础上推进情节。".into(),
        "gen_setting" => "你是一位世界观架构师。根据用户提供的故事方向或已有设定，生成完整的世界观设定。包括但不限于：世界背景、力量体系、种族设定、历史事件、地理环境等。请用连贯的段落直接呈现设定内容，不要写任何前言或引言，也不要使用列表格式。".into(),
        "gen_character" => "你是一位角色设计师。根据用户提供的故事设定和角色需求，生成一个完整的角色档案。请严格按以下格式输出，不要输出任何其他内容：\n\n【姓名】角色名\n【定位】主角/配角/反派/路人\n【描述】性格、外貌、背景故事、动机目标的详细描述（200字以内）".into(),
        _ => "你是一位专业的网文创作助手。".into(),
    }
}

fn build_messages(request: &AiRequest, system_prompt: &str) -> Vec<Message> {
    let mut messages = vec![Message {
        role: "system".into(),
        content: system_prompt.into(),
    }];

    match request.action.as_str() {
        "review" => {
            let content = format!(
                "请审阅以下小说片段：\n\n---\n{}\n---\n\n请给出具体的审阅意见。",
                request.content
            );
            messages.push(Message {
                role: "user".into(),
                content,
            });
        }
        "idea" => {
            let ctx = request.context.as_deref().unwrap_or("");
            let content = format!(
                "我当前的小说情节节点是：\n\n{}\n\n补充上下文：\n\n{}\n\n请给我几个有创意的情节发展思路。",
                request.content, ctx
            );
            messages.push(Message {
                role: "user".into(),
                content,
            });
        }
        "continue" => {
            let content = format!(
                "请根据以下小说片段的上文语境，自然地续写下文。保持文风和节奏一致：\n\n---\n{}\n---\n\n续写：",
                request.content
            );
            messages.push(Message {
                role: "user".into(),
                content,
            });
        }
        "gen_setting" => {
            let ctx = request.context.as_deref().unwrap_or("");
            let content = if ctx.is_empty() {
                format!("请根据以下故事构思生成世界观设定：\n\n{}", request.content)
            } else {
                format!("现有的故事设定：\n\n{}\n\n请根据以上设定，补充或完善世界观设定，重点关注：\n\n{}", ctx, request.content)
            };
            messages.push(Message { role: "user".into(), content });
        }
        "gen_character" => {
            let ctx = request.context.as_deref().unwrap_or("");
            let content = format!(
                "故事背景设定：\n\n{}\n\n请根据以上设定，生成一个角色。角色需求：\n\n{}",
                ctx, request.content
            );
            messages.push(Message { role: "user".into(), content });
        }
        _ => {
            messages.push(Message {
                role: "user".into(),
                content: request.content.clone(),
            });
        }
    }

    messages
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
