use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub provider: String,
    pub model: String,
    pub api_base: String,
    pub temperature: f64,
    pub max_tokens: u32,
    pub system_prompt: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderInfo {
    pub id: String,
    pub name: String,
    pub models: Vec<String>,
    pub default_api_base: String,
    pub requires_api_key: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiRequest {
    pub action: String,
    pub content: String,
    pub context: Option<String>,
}

pub async fn send_to_provider(
    provider: &str,
    model: &str,
    api_base: &str,
    api_key: Option<&str>,
    messages: Vec<Message>,
    temperature: f64,
    max_tokens: u32,
) -> Result<String, String> {
    match provider {
        "openai" => openai::send(messages, model, api_base, api_key, temperature, max_tokens).await,
        "anthropic" => {
            anthropic::send(messages, model, api_base, api_key, temperature, max_tokens).await
        }
        "ollama" => ollama::send(messages, model, api_base, temperature, max_tokens).await,
        "openai_compat" => {
            openai_compat::send(messages, model, api_base, api_key, temperature, max_tokens).await
        }
        _ => Err(format!("Unsupported provider: {provider}")),
    }
}

pub fn get_providers() -> Vec<ProviderInfo> {
    vec![
        ProviderInfo {
            id: "openai".into(),
            name: "OpenAI".into(),
            models: vec![
                "gpt-4o".into(),
                "gpt-4o-mini".into(),
                "gpt-4-turbo".into(),
                "gpt-4".into(),
                "gpt-3.5-turbo".into(),
                "o3-mini".into(),
            ],
            default_api_base: "https://api.openai.com/v1".into(),
            requires_api_key: true,
        },
        ProviderInfo {
            id: "anthropic".into(),
            name: "Anthropic".into(),
            models: vec![
                "claude-opus-4-7".into(),
                "claude-sonnet-4-6".into(),
                "claude-haiku-4-5-20251001".into(),
                "claude-3-5-sonnet-20241022".into(),
            ],
            default_api_base: "https://api.anthropic.com/v1".into(),
            requires_api_key: true,
        },
        ProviderInfo {
            id: "ollama".into(),
            name: "Ollama".into(),
            models: vec![],
            default_api_base: "http://localhost:11434/v1".into(),
            requires_api_key: false,
        },
        ProviderInfo {
            id: "openai_compat".into(),
            name: "OpenAI Compatible".into(),
            models: vec![],
            default_api_base: "http://localhost:8000/v1".into(),
            requires_api_key: true,
        },
    ]
}

use super::anthropic;
use super::ollama;
use super::openai;
use super::openai_compat;
