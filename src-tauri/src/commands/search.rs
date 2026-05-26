use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub book_id: String,
    pub book_title: String,
    pub chapter_id: String,
    pub chapter_title: String,
    pub snippet: String,
    pub score: f64,
}

#[derive(Default)]
struct SearchIndex {
    // book_id -> chapter_id -> content
    docs: HashMap<String, HashMap<String, IndexedChapter>>,
}

#[derive(Clone)]
struct IndexedChapter {
    title: String,
    content: String,
    book_title: String,
}

impl SearchIndex {
    fn index_chapter(&mut self, book_id: &str, book_title: &str, chapter_id: &str, title: &str, content: &str) {
        self.docs
            .entry(book_id.to_string())
            .or_default()
            .insert(chapter_id.to_string(), IndexedChapter {
                title: title.to_string(),
                content: content.to_string(),
                book_title: book_title.to_string(),
            });
    }

    fn remove_chapter(&mut self, book_id: &str, chapter_id: &str) {
        if let Some(book) = self.docs.get_mut(book_id) {
            book.remove(chapter_id);
        }
    }

    fn search(&self, query: &str, scope: Option<&str>) -> Vec<SearchResult> {
        let query_lower = query.to_lowercase();
        let query_words: Vec<&str> = query_lower.split_whitespace().collect();
        if query_words.is_empty() {
            return Vec::new();
        }

        let mut results = Vec::new();

        for (book_id, chapters) in &self.docs {
            // Apply scope filter
            if let Some(scope_book_id) = scope {
                if book_id != scope_book_id {
                    continue;
                }
            }

            for (chapter_id, chapter) in chapters {
                let title_lower = chapter.title.to_lowercase();
                let content_plain = strip_html(&chapter.content);
                let content_lower = content_plain.to_lowercase();

                let mut score = 0.0;
                let mut best_snippet_start = None;

                for word in &query_words {
                    // Title matches are highly weighted
                    let title_count = count_occurrences(&title_lower, word);
                    score += title_count as f64 * 10.0;

                    // Content matches
                    let content_count = count_occurrences(&content_lower, word);
                    score += content_count as f64;

                    // Find the best snippet position
                    if let Some(pos) = content_lower.find(word) {
                        match best_snippet_start {
                            None => best_snippet_start = Some(pos),
                            Some(existing) => {
                                if pos < existing {
                                    best_snippet_start = Some(pos);
                                }
                            }
                        }
                    }
                }

                if score > 0.0 {
                    let snippet = generate_snippet(&content_plain, best_snippet_start);
                    results.push(SearchResult {
                        book_id: book_id.clone(),
                        book_title: chapter.book_title.clone(),
                        chapter_id: chapter_id.clone(),
                        chapter_title: chapter.title.clone(),
                        snippet,
                        score,
                    });
                }
            }
        }

        // Sort by score descending
        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        results.truncate(50); // Limit results
        results
    }
}

fn count_occurrences(text: &str, word: &str) -> usize {
    text.match_indices(word).count()
}

fn generate_snippet(text: &str, around: Option<usize>) -> String {
    const SNIPPET_LEN: usize = 150;
    let around = around.unwrap_or(0);

    let start = if around > SNIPPET_LEN / 2 {
        around - SNIPPET_LEN / 2
    } else {
        0
    };

    let chars: Vec<char> = text.chars().collect();
    let end = (start + SNIPPET_LEN).min(chars.len());

    let snippet: String = chars[start..end].iter().collect();
    let prefix = if start > 0 { "…" } else { "" };
    let suffix = if end < chars.len() { "…" } else { "" };

    format!("{}{}{}", prefix, snippet, suffix)
}

fn strip_html(input: &str) -> String {
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

// Global search index
static INDEX: std::sync::LazyLock<Mutex<SearchIndex>> = std::sync::LazyLock::new(|| {
    Mutex::new(SearchIndex::default())
});

#[tauri::command]
pub fn index_chapter(
    book_id: String,
    book_title: String,
    chapter_id: String,
    title: String,
    content: String,
) -> Result<(), String> {
    let mut index = INDEX.lock().map_err(|e| format!("Lock failed: {e}"))?;
    index.index_chapter(&book_id, &book_title, &chapter_id, &title, &content);
    Ok(())
}

#[tauri::command]
pub fn remove_chapter_index(
    book_id: String,
    chapter_id: String,
) -> Result<(), String> {
    let mut index = INDEX.lock().map_err(|e| format!("Lock failed: {e}"))?;
    index.remove_chapter(&book_id, &chapter_id);
    Ok(())
}

#[tauri::command]
pub fn search_chapters(
    query: String,
    scope_book_id: Option<String>,
) -> Result<Vec<SearchResult>, String> {
    let index = INDEX.lock().map_err(|e| format!("Lock failed: {e}"))?;
    Ok(index.search(&query, scope_book_id.as_deref()))
}
