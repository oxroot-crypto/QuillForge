use crate::llm::provider::Message;
use reqwest::Client;
use serde_json::Value;

pub async fn send(
    messages: Vec<Message>,
    model: &str,
    api_base: &str,
    api_key: Option<&str>,
    temperature: f64,
    max_tokens: u32,
) -> Result<String, String> {
    let client = Client::new();
    let api_key = api_key.ok_or("Anthropic requires an API Key")?;

    let api_messages: Vec<Value> = messages
        .iter()
        .map(|m| {
            serde_json::json!({
                "role": m.role,
                "content": m.content
            })
        })
        .collect();

    let url = format!("{}/messages", api_base.trim_end_matches('/'));
    let resp = client
        .post(&url)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": model,
            "messages": api_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }))
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    let status = resp.status();
    let body: Value = resp.json().await.map_err(|e| format!("Parse response: {e}"))?;

    if !status.is_success() {
        let err_msg = body["error"]["message"].as_str().unwrap_or("Unknown error");
        return Err(format!("Anthropic API error ({status}): {err_msg}"));
    }

    body["content"][0]["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or("Anthropic unexpected response format".into())
}
