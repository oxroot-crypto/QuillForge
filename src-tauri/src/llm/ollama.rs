use crate::llm::provider::Message;
use reqwest::Client;
use serde_json::Value;

pub async fn send(
    messages: Vec<Message>,
    model: &str,
    api_base: &str,
    temperature: f64,
    max_tokens: u32,
) -> Result<String, String> {
    let client = Client::new();

    let api_messages: Vec<Value> = messages
        .iter()
        .map(|m| {
            serde_json::json!({
                "role": m.role,
                "content": m.content
            })
        })
        .collect();

    let url = format!("{}/chat/completions", api_base.trim_end_matches('/'));
    let resp = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": model,
            "messages": api_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }))
        .send()
        .await
        .map_err(|e| format!("Request failed: {e} — is Ollama running?"))?;

    let status = resp.status();
    let body: Value = resp.json().await.map_err(|e| format!("Parse response: {e}"))?;

    if !status.is_success() {
        let err_msg = body["error"]["message"].as_str().unwrap_or("Unknown error");
        return Err(format!("Ollama API error ({status}): {err_msg}"));
    }

    body["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or("Ollama unexpected response format".into())
}
