use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::LazyLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpellError {
    pub start: usize,
    pub end: usize,
    pub word: String,
    pub suggestions: Vec<String>,
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

fn tokenize(text: &str) -> Vec<(usize, usize, String)> {
    let plain = strip_html(text);
    let chars: Vec<char> = plain.chars().collect();
    let mut tokens = Vec::new();
    let mut start = None;

    for (i, &ch) in chars.iter().enumerate() {
        if ch.is_ascii_alphabetic() || ch == '\'' {
            if start.is_none() { start = Some(i); }
        } else {
            if let Some(s) = start.take() {
                let word: String = chars[s..i].iter().collect();
                if word.len() >= 2 {
                    tokens.push((s, i, word));
                }
            }
        }
    }
    if let Some(s) = start {
        let word: String = chars[s..].iter().collect();
        if word.len() >= 2 {
            tokens.push((s, chars.len(), word));
        }
    }
    tokens
}

// ---- Word dictionary ----

static EN_DICT: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
    include_str!("../../dicts/en-basic.txt")
        .lines()
        .map(|l| l.trim())
        .filter(|w| !w.is_empty() && !w.starts_with('#'))
        .collect()
});

fn is_known(word: &str) -> bool {
    EN_DICT.contains(word.to_lowercase().as_str())
}

// ---- Levenshtein suggestions ----

fn suggestions(word: &str, max_dist: u32, max_results: usize) -> Vec<String> {
    let word_lower = word.to_lowercase();
    let mut scored: Vec<(String, u32)> = EN_DICT
        .iter()
        .filter(|w| {
            let len_diff = (w.len() as i32 - word_lower.len() as i32).unsigned_abs();
            len_diff <= max_dist
        })
        .map(|w| (w.to_string(), levenshtein(&word_lower, w)))
        .filter(|(_, d)| *d <= max_dist && *d > 0)
        .collect();

    scored.sort_by_key(|(_, d)| *d);
    scored.truncate(max_results);
    scored.into_iter().map(|(w, _)| w.to_string()).collect()
}

fn levenshtein(a: &str, b: &str) -> u32 {
    let a_len = a.len();
    let b_len = b.len();
    if a_len == 0 { return b_len as u32; }
    if b_len == 0 { return a_len as u32; }

    let mut prev: Vec<u32> = (0..=b_len as u32).collect();
    let mut curr = vec![0u32; b_len + 1];

    for (i, a_ch) in a.chars().enumerate() {
        curr[0] = i as u32 + 1;
        for (j, b_ch) in b.chars().enumerate() {
            let cost = if a_ch == b_ch { 0 } else { 1 };
            curr[j + 1] = (curr[j] + 1)
                .min(prev[j + 1] + 1)
                .min(prev[j] + cost);
        }
        std::mem::swap(&mut prev, &mut curr);
    }
    prev[b_len]
}

// ---- Tauri command ----

#[tauri::command]
pub fn spell_check_text(text: String) -> Result<Vec<SpellError>, String> {
    let tokens = tokenize(&text);
    let mut errors = Vec::new();

    for (start, end, word) in tokens {
        if !is_known(&word) {
            let sugg = suggestions(&word, 2, 5);
            errors.push(SpellError { start, end, word, suggestions: sugg });
        }
    }

    Ok(errors)
}
