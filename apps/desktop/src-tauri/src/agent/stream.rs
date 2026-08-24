use serde::Deserialize;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StreamEvent {
    TextStart,
    Text(String),
    Tool(String),
    Finished(Option<String>),
}

#[derive(Deserialize)]
#[serde(tag = "type")]
enum Line {
    #[serde(rename = "stream_event")]
    Stream { event: Event },
    #[serde(rename = "result")]
    Result {
        #[serde(default)]
        is_error: bool,
        #[serde(default)]
        result: Option<String>,
    },
    #[serde(other)]
    Ignored,
}

#[derive(Deserialize)]
#[serde(tag = "type")]
enum Event {
    #[serde(rename = "content_block_start")]
    BlockStart { content_block: Block },
    #[serde(rename = "content_block_delta")]
    BlockDelta { delta: Delta },
    #[serde(other)]
    Ignored,
}

#[derive(Deserialize)]
#[serde(tag = "type")]
enum Block {
    #[serde(rename = "text")]
    Text,
    #[serde(rename = "tool_use")]
    ToolUse { name: String },
    #[serde(other)]
    Ignored,
}

#[derive(Deserialize)]
#[serde(tag = "type")]
enum Delta {
    #[serde(rename = "text_delta")]
    Text { text: String },
    #[serde(other)]
    Ignored,
}

/// Reads the partial-message stream rather than whole assistant messages, so
/// the panel paints tokens as they land. Unknown line shapes are dropped: the
/// CLI adds event types between releases and none of them are load-bearing.
pub fn parse_line(line: &str) -> Option<StreamEvent> {
    match serde_json::from_str::<Line>(line).ok()? {
        Line::Stream { event } => match event {
            Event::BlockStart {
                content_block: Block::Text,
            } => Some(StreamEvent::TextStart),
            Event::BlockStart {
                content_block: Block::ToolUse { name },
            } => Some(StreamEvent::Tool(name)),
            Event::BlockDelta {
                delta: Delta::Text { text },
            } => Some(StreamEvent::Text(text)),
            _ => None,
        },
        Line::Result { is_error, result } => {
            Some(StreamEvent::Finished(is_error.then(|| {
                result.unwrap_or_else(|| "the agent run failed".to_string())
            })))
        }
        Line::Ignored => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn stream(event: &str) -> String {
        format!(r#"{{"type":"stream_event","event":{event}}}"#)
    }

    #[test]
    fn opens_a_block_then_streams_its_chunks() {
        let start = stream(
            r#"{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}"#,
        );
        let delta = stream(
            r#"{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hel"}}"#,
        );

        assert_eq!(parse_line(&start), Some(StreamEvent::TextStart));
        assert_eq!(parse_line(&delta), Some(StreamEvent::Text("hel".into())));
    }

    #[test]
    fn a_tool_block_is_named_as_soon_as_it_opens() {
        let line = stream(
            r#"{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"x","name":"Edit"}}"#,
        );

        assert_eq!(parse_line(&line), Some(StreamEvent::Tool("Edit".into())));
    }

    #[test]
    fn the_whole_assistant_message_is_ignored_so_text_is_not_counted_twice() {
        let line = r#"{"type":"assistant","message":{"content":[{"type":"text","text":"hello"}]}}"#;

        assert_eq!(parse_line(line), None);
    }

    #[test]
    fn a_successful_result_finishes_without_an_error() {
        let line = r#"{"type":"result","subtype":"success","is_error":false,"result":"ok"}"#;

        assert_eq!(parse_line(line), Some(StreamEvent::Finished(None)));
    }

    #[test]
    fn a_failed_result_carries_its_message() {
        let line = r#"{"type":"result","is_error":true,"result":"boom"}"#;

        assert_eq!(
            parse_line(line),
            Some(StreamEvent::Finished(Some("boom".into())))
        );
    }

    #[test]
    fn unknown_and_malformed_lines_are_dropped() {
        assert_eq!(parse_line(r#"{"type":"rate_limit_event"}"#), None);
        assert_eq!(parse_line("not json"), None);
    }
}
