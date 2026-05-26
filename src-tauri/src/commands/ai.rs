use crate::llm::provider::{self, AiRequest, Message, ModelConfig, ProviderInfo};
use crate::AppState;
use super::helpers::get_api_key_internal;
use tauri::State;

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

#[tauri::command]
pub fn get_supported_providers() -> Vec<ProviderInfo> {
    provider::get_providers()
}

fn get_default_system_prompt(action: &str) -> String {
    match action {
        "review" => "你是一位资深的网文编辑，擅长审阅和点评小说。请对以下文本进行审阅，从文法、节奏、人物塑造、情节逻辑等方面给出具体建议。直接给出审阅意见，不要客套话。".into(),
        "idea" => "你是一位创意无限的网文构思助手。根据用户提供的情节节点或故事设定，给出3-5个有创意的情节发展方向或写作思路。每个思路简洁有力，100字以内。".into(),
        "continue" => "你是一位文笔流畅的网文写手。请根据上文语境和风格，自然地续写下文。保持人称、时态、文风与上文一致，不要突然转换视角。续写长度适中，在原文基础上推进情节。\n\n严格禁止：\n- 不要输出任何标题、章节号、前缀标记\n- 不要写「续写」「接上文」等引导语\n- 不要写作者注、旁白、元评论\n- 直接从正文第一句开始，仿佛原文就是你自己写的".into(),
        "gen_setting" => "你是一位世界观架构师。根据用户提供的故事方向或已有设定，生成完整的世界观设定。包括但不限于：世界背景、力量体系、种族设定、历史事件、地理环境等。请用连贯的段落直接呈现设定内容，不要写任何前言或引言，也不要使用列表格式。".into(),
        "gen_character" => "你是一位角色设计师。根据用户提供的故事设定和角色需求，生成一个完整的角色档案。请严格按以下格式输出，不要输出任何其他内容：\n\n【姓名】角色名\n【定位】主角/配角/反派/路人\n【描述】性格、外貌、背景故事、动机目标的详细描述（200字以内）".into(),
        "gen_chapter" => "你是一位专业的网文作者。根据用户提供的小说设定和前文内容，直接生成一个完整的章节。要求：情节连贯，文笔流畅，篇幅适中（800-1500字），契合世界观和人物设定。\n\n输出格式要求（严格遵守）：\n第一行必须是章节标题，以 # 开头。例如：# 陨落的天才\n接下来空一行，然后直接开始正文。不要写任何前言、后记、说明、作者的话。".into(),
        "gen_plot_summary" => "你是一位小说编辑，擅长为章节撰写简洁的剧情总结。请根据提供的章节内容和之前的剧情总结，用1-2句话概括本章发生的关键事件和情节推进。只输出总结本身，不要任何前缀、标记或格式。".into(),
        "consistency" => "你是一位严谨的小说逻辑检查员。你的任务是核对用户选中的小说段落与书中已设定的角色信息是否一致。\n\n你将收到：\n1. 角色档案（姓名、定位、描述）\n2. 待检查的小说段落\n\n请检查以下类型的不一致：\n- 角色外貌描述与档案冲突（如眼睛颜色、身高、发型等）\n- 角色性格行为与档案描述矛盾\n- 角色背景故事与档案不符\n- 角色姓名拼写错误或混淆\n- 角色定位与行为不匹配（如配角却做了主角才该做的事）\n\n对于发现的不一致，请严格按以下格式输出，每项一行：\n【不一致】角色名 | 类型（外观/性格/背景/姓名/定位） | 问题描述 | 严重程度（高/中/低）\n\n如果没有发现任何不一致，请只输出「未发现不一致」。不要输出任何其他内容。".into(),
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
                "请根据以下小说片段的上文语境，自然地续写下文。保持文风和节奏一致，直接从正文继续，不要加任何标题或标记：\n\n---\n{}\n---",
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
        "gen_chapter" => {
            let ctx = request.context.as_deref().unwrap_or("");
            let content = if ctx.is_empty() {
                format!("请根据以下提示，直接生成一个完整的小说章节：\n\n{}", request.content)
            } else {
                format!(
                    "小说设定和上下文：\n\n{}\n\n请根据以上设定，直接生成一个完整的小说章节。不需要写章节标题。\n\n补充提示：{}",
                    ctx, request.content
                )
            };
            messages.push(Message { role: "user".into(), content });
        }
        "gen_plot_summary" => {
            let ctx = request.context.as_deref().unwrap_or("");
            let content = if ctx.is_empty() {
                format!(
                    "请为以下章节内容生成1-2句话的剧情总结：\n\n{}",
                    request.content
                )
            } else {
                format!(
                    "前文章节剧情总结：\n{}\n\n请根据上述前文总结，为以下新章节生成1-2句话的剧情总结，注意承上启下：\n\n{}",
                    ctx, request.content
                )
            };
            messages.push(Message { role: "user".into(), content });
        }
        "consistency" => {
            let ctx = request.context.as_deref().unwrap_or("");
            let content = format!(
                "角色档案：\n{}\n\n待检查的小说段落：\n---\n{}\n---\n\n请检查上述段落与角色档案的一致性。",
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
