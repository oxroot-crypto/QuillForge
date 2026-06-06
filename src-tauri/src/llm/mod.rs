//! LLM 模块——各提供商 API 实现和路由分发。
//! 每个子模块实现一个提供商的 HTTP 调用逻辑，provider.rs 负责根据标识符路由。

pub mod anthropic;
pub mod ollama;
pub mod openai;
pub mod openai_compat;
pub mod provider;
