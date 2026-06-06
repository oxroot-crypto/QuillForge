//! LLM 提供商路由模块——根据 provider 标识将请求分发到对应的 API 实现。
//! 前端通过 Tauri invoke 调用，Rust 层负责 Key 注入和 HTTP 代理，Key 不暴露给前端。

use super::anthropic;
use super::ollama;
use super::openai;
use super::openai_compat;
use serde::{Deserialize, Serialize};

/// LLM 对话消息——与前端 `Message` 类型镜像，字段均使用 snake_case 序列化
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
}

/// 模型配置——从前端传入，包含提供商、模型名、API 地址、温度、最大 token 数等
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub provider: String,
    pub model: String,
    pub api_base: String,
    pub temperature: f64,
    pub max_tokens: u32,
    pub system_prompt: String,
}

/// 提供商元信息——用于前端设置面板展示可用模型列表和配置要求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderInfo {
    pub id: String,
    pub name: String,
    pub models: Vec<String>,
    pub default_api_base: String,
    pub requires_api_key: bool,
}

/// AI 请求体——前端发起 AI 操作时传入，action 为操作类型路由键
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiRequest {
    pub action: String,
    pub content: String,
    pub context: Option<String>,
}

/// 根据 provider 标识路由到对应的 LLM API 实现。
/// `api_key` 为 None 时表示该提供商不需要 Key（如本地 Ollama）。
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
