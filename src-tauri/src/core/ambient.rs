//! Strict parsing and multi-session state reduction for ambient events.
//!
//! The WSL launcher owns delivery only. This module owns the sequence number,
//! per-session slot management, stale-event filtering, and the snapshot that
//! drives window visibility.

use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

pub const AMBIENT_EVENT_ARGUMENT: &str = "--codex-ambient-event";
pub const AMBIENT_PIPE_NAME: &str = "com.white795.bongocat.stats.codex-ambient";
pub const MAX_AMBIENT_PAYLOAD_BYTES: usize = 4096;
pub const TTL_SECONDS: u64 = 900;
pub const SWEEPER_INTERVAL_SECONDS: u64 = 60;

/// Which agent produced an event. Encodes identity only; the indicator's state
/// is carried separately by `AmbientStatus`.
#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum AmbientSource {
    /// Also the fallback for payloads from bridges that predate this field.
    #[default]
    Codex,
    Claude,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
enum AmbientEventKind {
    UserPromptSubmit,
    PreToolUse,
    PermissionRequest,
    PostToolUse,
    #[serde(rename = "agent-turn-complete")]
    AgentTurnComplete,
    #[serde(rename = "session-end")]
    SessionEnd,
}

impl AmbientEventKind {
    fn event_name(&self) -> &'static str {
        match self {
            Self::UserPromptSubmit => "UserPromptSubmit",
            Self::PreToolUse => "PreToolUse",
            Self::PermissionRequest => "PermissionRequest",
            Self::PostToolUse => "PostToolUse",
            Self::AgentTurnComplete => "agent-turn-complete",
            Self::SessionEnd => "session-end",
        }
    }

    fn target_state(&self) -> Option<AmbientStatus> {
        match self {
            Self::UserPromptSubmit | Self::PreToolUse | Self::PostToolUse => {
                Some(AmbientStatus::Working)
            }
            Self::PermissionRequest => Some(AmbientStatus::Waiting),
            Self::AgentTurnComplete => Some(AmbientStatus::Done),
            Self::SessionEnd => None,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AmbientEvent {
    event: AmbientEventKind,
    session_id: String,
    turn_id: String,
    source: AmbientSource,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DispatchRequest {
    NotAmbient,
    Ambient(AmbientEvent),
    InvalidAmbient,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum AmbientStatus {
    Idle,
    Working,
    Waiting,
    Done,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub session_id: String,
    pub source: AmbientSource,
    pub state: AmbientStatus,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AmbientSnapshot {
    pub version: u8,
    pub state: AmbientStatus,
    pub sequence: u64,
    pub session_id: Option<String>,
    pub turn_id: Option<String>,
    pub event: String,
    /// `None` while idle, so the frontend never paints an identity colour for a
    /// hidden indicator.
    pub source: Option<AmbientSource>,
    pub sessions: Vec<SessionInfo>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ApplyResult {
    pub accepted: bool,
    pub snapshot: AmbientSnapshot,
}

const MAX_AMBIENT_SLOTS: usize = 16;

#[derive(Clone, Debug)]
struct SessionSlot {
    session_id: String,
    turn_id: String,
    source: AmbientSource,
    state: AmbientStatus,
    event: String,
    state_sequence: u64,
    last_active: Instant,
}

#[derive(Debug)]
pub struct AmbientReducer {
    slots: Vec<SessionSlot>,
    global_sequence: u64,
    idle_event: String,
}

impl Default for AmbientReducer {
    fn default() -> Self {
        Self::new()
    }
}

impl AmbientReducer {
    pub fn new() -> Self {
        Self {
            slots: Vec::new(),
            global_sequence: 0,
            idle_event: "startup".into(),
        }
    }

    pub fn snapshot(&self) -> AmbientSnapshot {
        self.build_snapshot()
    }

    pub fn reset_to_idle(&mut self) -> AmbientSnapshot {
        if !self.slots.is_empty() {
            self.global_sequence += 1;
        }
        self.slots.clear();
        self.idle_event = "disabled".into();
        self.build_snapshot()
    }

    pub fn ingest(&mut self, enabled: bool, event: AmbientEvent) -> ApplyResult {
        if !enabled {
            return ApplyResult {
                accepted: false,
                snapshot: self.build_snapshot(),
            };
        }

        if matches!(&event.event, AmbientEventKind::SessionEnd) {
            return self.handle_session_end(&event.session_id);
        }

        let target_state = event
            .event
            .target_state()
            .expect("SessionEnd handled above");

        let slot_index = self.find_slot(&event.session_id);

        match slot_index {
            Some(index) => {
                if matches!(&event.event, AmbientEventKind::UserPromptSubmit) {
                    self.slots[index].turn_id = event.turn_id.clone();
                    self.slots[index].source = event.source;
                } else if self.slots[index].turn_id != event.turn_id {
                    return ApplyResult {
                        accepted: false,
                        snapshot: self.build_snapshot(),
                    };
                }
                self.global_sequence += 1;
                self.slots[index].state = target_state;
                self.slots[index].event = event.event.event_name().into();
                self.slots[index].state_sequence = self.global_sequence;
                self.slots[index].last_active = Instant::now();
            }
            None => {
                if self.slots.len() >= MAX_AMBIENT_SLOTS {
                    self.slots.remove(0);
                }
                self.global_sequence += 1;
                self.slots.push(SessionSlot {
                    session_id: event.session_id.clone(),
                    turn_id: event.turn_id.clone(),
                    source: event.source,
                    state: target_state,
                    event: event.event.event_name().into(),
                    state_sequence: self.global_sequence,
                    last_active: Instant::now(),
                });
            }
        }

        ApplyResult {
            accepted: true,
            snapshot: self.build_snapshot(),
        }
    }

    fn handle_session_end(&mut self, session_id: &str) -> ApplyResult {
        let Some(index) = self.find_slot(session_id) else {
            return ApplyResult {
                accepted: false,
                snapshot: self.build_snapshot(),
            };
        };

        self.slots.remove(index);
        self.global_sequence += 1;

        if self.slots.is_empty() {
            self.idle_event = "session-end".into();
        }

        ApplyResult {
            accepted: true,
            snapshot: self.build_snapshot(),
        }
    }

    pub fn evict_stale(&mut self, ttl: Duration) -> Option<AmbientSnapshot> {
        let cutoff = Instant::now() - ttl;
        let before = self.slots.len();
        self.slots.retain(|s| s.last_active > cutoff);

        if self.slots.len() < before {
            self.global_sequence += 1;
            if self.slots.is_empty() {
                self.idle_event = "ttl-evicted".into();
            }
            Some(self.build_snapshot())
        } else {
            None
        }
    }

    fn find_slot(&self, session_id: &str) -> Option<usize> {
        self.slots.iter().position(|s| s.session_id == session_id)
    }

    fn build_snapshot(&self) -> AmbientSnapshot {
        let sessions: Vec<SessionInfo> = self
            .slots
            .iter()
            .map(|s| SessionInfo {
                session_id: s.session_id.clone(),
                source: s.source,
                state: s.state,
            })
            .collect();

        let latest = self.slots.iter().max_by_key(|s| s.state_sequence);

        match latest {
            Some(slot) => AmbientSnapshot {
                version: 2,
                state: slot.state,
                sequence: self.global_sequence,
                session_id: Some(slot.session_id.clone()),
                turn_id: Some(slot.turn_id.clone()),
                event: slot.event.clone(),
                source: Some(slot.source),
                sessions,
            },
            None => AmbientSnapshot {
                version: 2,
                state: AmbientStatus::Idle,
                sequence: self.global_sequence,
                session_id: None,
                turn_id: None,
                event: self.idle_event.clone(),
                source: None,
                sessions,
            },
        }
    }
}

pub fn parse_dispatch_request(args: &[String]) -> DispatchRequest {
    let mut payload = None;

    for (index, argument) in args.iter().enumerate() {
        if argument != AMBIENT_EVENT_ARGUMENT {
            continue;
        }

        if payload.is_some() {
            return DispatchRequest::InvalidAmbient;
        }

        payload = args.get(index + 1);
        if payload.is_none() {
            return DispatchRequest::InvalidAmbient;
        }
    }

    let Some(payload) = payload else {
        return DispatchRequest::NotAmbient;
    };

    decode_ambient_payload(payload.as_bytes())
        .map(DispatchRequest::Ambient)
        .unwrap_or(DispatchRequest::InvalidAmbient)
}

pub fn decode_ambient_payload(payload: &[u8]) -> Option<AmbientEvent> {
    if payload.is_empty() || payload.len() > MAX_AMBIENT_PAYLOAD_BYTES {
        return None;
    }

    decode_ambient_event(std::str::from_utf8(payload).ok()?)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SerializedAmbientEvent {
    event: AmbientEventKind,
    session_id: String,
    turn_id: String,
    #[serde(default)]
    source: AmbientSource,
}

fn decode_ambient_event(payload: &str) -> Option<AmbientEvent> {
    let decoded = decode_base64url(payload)?;
    let event: SerializedAmbientEvent = serde_json::from_slice(&decoded).ok()?;

    if event.session_id.trim().is_empty() || event.turn_id.trim().is_empty() {
        return None;
    }

    Some(AmbientEvent {
        event: event.event,
        session_id: event.session_id,
        turn_id: event.turn_id,
        source: event.source,
    })
}

fn decode_base64url(input: &str) -> Option<Vec<u8>> {
    if input.is_empty() || input.len() % 4 == 1 {
        return None;
    }

    let mut output = Vec::with_capacity(input.len() * 3 / 4);
    let mut buffer = 0_u32;
    let mut bits = 0_u8;

    for byte in input.bytes() {
        let value = match byte {
            b'A'..=b'Z' => byte - b'A',
            b'a'..=b'z' => byte - b'a' + 26,
            b'0'..=b'9' => byte - b'0' + 52,
            b'-' => 62,
            b'_' => 63,
            _ => return None,
        };

        buffer = (buffer << 6) | u32::from(value);
        bits += 6;

        if bits >= 8 {
            bits -= 8;
            output.push((buffer >> bits) as u8);
            buffer &= (1 << bits) - 1;
        }
    }

    (bits == 0 || buffer == 0).then_some(output)
}

impl AmbientReducer {
    #[cfg(test)]
    fn age_slot(&mut self, session_id: &str, age: Duration) {
        if let Some(slot) = self.slots.iter_mut().find(|s| s.session_id == session_id) {
            slot.last_active = Instant::now() - age;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const VALID_EVENT: &str = "eyJldmVudCI6IlVzZXJQcm9tcHRTdWJtaXQiLCJzZXNzaW9uSWQiOiJzZXNzaW9uLWEiLCJ0dXJuSWQiOiJ0dXJuLWEifQ";
    const UNKNOWN_EVENT: &str =
        "eyJldmVudCI6IlVuZXhwZWN0ZWQiLCJzZXNzaW9uSWQiOiJzZXNzaW9uLWEiLCJ0dXJuSWQiOiJ0dXJuLWEifQ";
    const BLANK_SESSION: &str =
        "eyJldmVudCI6IlVzZXJQcm9tcHRTdWJtaXQiLCJzZXNzaW9uSWQiOiIgIiwidHVybklkIjoidHVybi1hIn0";
    const EXTERNAL_SEQUENCE: &str = "eyJldmVudCI6IlVzZXJQcm9tcHRTdWJtaXQiLCJzZXNzaW9uSWQiOiJzZXNzaW9uLWEiLCJ0dXJuSWQiOiJ0dXJuLWEiLCJzZXF1ZW5jZSI6OTk5fQ";

    fn args(payload: &str) -> Vec<String> {
        vec![
            "BongoCat.exe".into(),
            AMBIENT_EVENT_ARGUMENT.into(),
            payload.into(),
        ]
    }

    fn event(kind: AmbientEventKind, turn_id: &str) -> AmbientEvent {
        AmbientEvent {
            event: kind,
            session_id: "session-a".into(),
            turn_id: turn_id.into(),
            source: AmbientSource::Codex,
        }
    }

    fn event_for(
        kind: AmbientEventKind,
        session_id: &str,
        turn_id: &str,
        source: AmbientSource,
    ) -> AmbientEvent {
        AmbientEvent {
            event: kind,
            session_id: session_id.into(),
            turn_id: turn_id.into(),
            source,
        }
    }

    fn encode_base64url(input: &[u8]) -> String {
        const ALPHABET: &[u8; 64] =
            b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        let mut output = String::with_capacity(input.len().div_ceil(3) * 4);

        for chunk in input.chunks(3) {
            let value = (u32::from(chunk[0]) << 16)
                | (u32::from(*chunk.get(1).unwrap_or(&0)) << 8)
                | u32::from(*chunk.get(2).unwrap_or(&0));
            output.push(ALPHABET[((value >> 18) & 0x3f) as usize] as char);
            output.push(ALPHABET[((value >> 12) & 0x3f) as usize] as char);
            if chunk.len() > 1 {
                output.push(ALPHABET[((value >> 6) & 0x3f) as usize] as char);
            }
            if chunk.len() > 2 {
                output.push(ALPHABET[(value & 0x3f) as usize] as char);
            }
        }

        output
    }

    // ── parsing (unchanged) ──────────────────────────────────────────────

    #[test]
    fn valid_base64url_argument_decodes_to_the_normalized_event_contract() {
        assert_eq!(
            parse_dispatch_request(&args(VALID_EVENT)),
            DispatchRequest::Ambient(event(AmbientEventKind::UserPromptSubmit, "turn-a"))
        );
    }

    #[test]
    fn absent_ambient_argument_keeps_normal_secondary_launch_behavior() {
        assert_eq!(
            parse_dispatch_request(&["BongoCat.exe".into(), "--show-preference".into()]),
            DispatchRequest::NotAmbient
        );
    }

    #[test]
    fn malformed_or_untrusted_ambient_argument_is_rejected() {
        for arguments in [
            args("not-base64url"),
            args(UNKNOWN_EVENT),
            args(BLANK_SESSION),
            args(EXTERNAL_SEQUENCE),
            vec!["BongoCat.exe".into(), AMBIENT_EVENT_ARGUMENT.into()],
            vec![
                "BongoCat.exe".into(),
                AMBIENT_EVENT_ARGUMENT.into(),
                VALID_EVENT.into(),
                AMBIENT_EVENT_ARGUMENT.into(),
                VALID_EVENT.into(),
            ],
        ] {
            assert_eq!(
                parse_dispatch_request(&arguments),
                DispatchRequest::InvalidAmbient
            );
        }
    }

    #[test]
    fn pipe_payload_over_the_limit_is_rejected_before_json_reduction() {
        let oversized_json = serde_json::json!({
            "event": "UserPromptSubmit",
            "sessionId": "s".repeat(MAX_AMBIENT_PAYLOAD_BYTES),
            "turnId": "turn-a",
        });
        let payload = encode_base64url(oversized_json.to_string().as_bytes());

        assert!(payload.len() > MAX_AMBIENT_PAYLOAD_BYTES);
        assert_eq!(decode_ambient_payload(payload.as_bytes()), None);
    }

    #[test]
    fn payload_without_source_still_decodes_as_a_codex_event() {
        let decoded = decode_ambient_payload(VALID_EVENT.as_bytes()).expect("legacy payload");
        assert_eq!(decoded.source, AmbientSource::Codex);
    }

    #[test]
    fn payload_source_is_parsed_and_unknown_sources_are_rejected() {
        let claude = encode_base64url(
            br#"{"event":"UserPromptSubmit","sessionId":"session-a","turnId":"turn-a","source":"claude"}"#,
        );
        let decoded = decode_ambient_payload(claude.as_bytes()).expect("claude payload");
        assert_eq!(decoded.source, AmbientSource::Claude);

        let unknown = encode_base64url(
            br#"{"event":"UserPromptSubmit","sessionId":"session-a","turnId":"turn-a","source":"gemini"}"#,
        );
        assert_eq!(decode_ambient_payload(unknown.as_bytes()), None);
    }

    #[test]
    fn session_end_event_is_decoded() {
        let payload = encode_base64url(
            br#"{"event":"session-end","sessionId":"session-a","turnId":"turn-a","source":"claude"}"#,
        );
        let decoded = decode_ambient_payload(payload.as_bytes()).expect("session-end payload");
        assert_eq!(decoded.event, AmbientEventKind::SessionEnd);
        assert_eq!(decoded.source, AmbientSource::Claude);
    }

    #[test]
    fn source_serializes_in_lowercase_for_the_frontend() {
        assert_eq!(
            serde_json::to_string(&AmbientSource::Claude).unwrap(),
            r#""claude""#
        );
        assert_eq!(
            serde_json::to_string(&AmbientSource::Codex).unwrap(),
            r#""codex""#
        );
    }

    // ── single-session reducer ────────────────────────────────────────────

    #[test]
    fn a_prompt_starts_working_and_the_reducer_owns_the_sequence() {
        let mut reducer = AmbientReducer::new();

        let applied = reducer.ingest(true, event(AmbientEventKind::UserPromptSubmit, "turn-a"));

        assert!(applied.accepted);
        assert_eq!(applied.snapshot.state, AmbientStatus::Working);
        assert_eq!(applied.snapshot.sequence, 1);
        assert_eq!(applied.snapshot.session_id.as_deref(), Some("session-a"));
        assert_eq!(applied.snapshot.turn_id.as_deref(), Some("turn-a"));
        assert_eq!(applied.snapshot.event, "UserPromptSubmit");
    }

    #[test]
    fn lifecycle_events_bootstrap_a_turn_and_map_to_waiting_or_working() {
        let mut reducer = AmbientReducer::new();

        let waiting = reducer.ingest(true, event(AmbientEventKind::PermissionRequest, "turn-a"));
        assert!(waiting.accepted);
        assert_eq!(waiting.snapshot.state, AmbientStatus::Waiting);
        assert_eq!(waiting.snapshot.sequence, 1);

        let working = reducer.ingest(true, event(AmbientEventKind::PreToolUse, "turn-a"));
        assert!(working.accepted);
        assert_eq!(working.snapshot.state, AmbientStatus::Working);
        assert_eq!(working.snapshot.sequence, 2);

        let post_tool = reducer.ingest(true, event(AmbientEventKind::PostToolUse, "turn-a"));
        assert!(post_tool.accepted);
        assert_eq!(post_tool.snapshot.state, AmbientStatus::Working);
        assert_eq!(post_tool.snapshot.sequence, 3);
    }

    #[test]
    fn a_new_prompt_discards_a_late_done_for_the_old_turn() {
        let mut reducer = AmbientReducer::new();
        reducer.ingest(true, event(AmbientEventKind::UserPromptSubmit, "turn-a"));
        reducer.ingest(true, event(AmbientEventKind::UserPromptSubmit, "turn-b"));

        let rejected = reducer.ingest(true, event(AmbientEventKind::AgentTurnComplete, "turn-a"));

        assert!(!rejected.accepted);
        assert_eq!(rejected.snapshot.state, AmbientStatus::Working);
        assert_eq!(rejected.snapshot.sequence, 2);
        assert_eq!(rejected.snapshot.turn_id.as_deref(), Some("turn-b"));
    }

    #[test]
    fn done_persists_until_new_turn() {
        let mut reducer = AmbientReducer::new();
        reducer.ingest(true, event(AmbientEventKind::UserPromptSubmit, "turn-a"));

        let done = reducer.ingest(true, event(AmbientEventKind::AgentTurnComplete, "turn-a"));
        assert_eq!(done.snapshot.state, AmbientStatus::Done);
        assert_eq!(done.snapshot.session_id.as_deref(), Some("session-a"));

        // Done persists — no automatic settlement.
        assert_eq!(reducer.snapshot().state, AmbientStatus::Done);

        // New turn overrides Done to Working.
        let restarted = reducer.ingest(true, event(AmbientEventKind::UserPromptSubmit, "turn-b"));
        assert!(restarted.accepted);
        assert_eq!(restarted.snapshot.state, AmbientStatus::Working);
        assert_eq!(restarted.snapshot.turn_id.as_deref(), Some("turn-b"));
    }

    #[test]
    fn done_persists_until_session_end() {
        let mut reducer = AmbientReducer::new();

        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::UserPromptSubmit,
                "session-a",
                "turn-a",
                AmbientSource::Claude,
            ),
        );
        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::AgentTurnComplete,
                "session-a",
                "turn-a",
                AmbientSource::Claude,
            ),
        );
        assert_eq!(reducer.snapshot().state, AmbientStatus::Done);

        // SessionEnd removes the done slot.
        let ended = reducer.ingest(
            true,
            event_for(
                AmbientEventKind::SessionEnd,
                "session-a",
                "turn-a",
                AmbientSource::Claude,
            ),
        );
        assert!(ended.accepted);
        assert_eq!(ended.snapshot.state, AmbientStatus::Idle);
    }

    #[test]
    fn disabled_feature_ignores_events_without_advancing_state() {
        let mut reducer = AmbientReducer::new();

        let ignored = reducer.ingest(false, event(AmbientEventKind::UserPromptSubmit, "turn-a"));

        assert!(!ignored.accepted);
        assert_eq!(ignored.snapshot.state, AmbientStatus::Idle);
        assert_eq!(ignored.snapshot.sequence, 0);
        assert_eq!(reducer.snapshot(), ignored.snapshot);
    }

    #[test]
    fn snapshot_source_clears_when_session_ends() {
        let mut reducer = AmbientReducer::new();
        assert_eq!(reducer.snapshot().source, None);

        let claude_submit = event_for(
            AmbientEventKind::UserPromptSubmit,
            "session-a",
            "turn-a",
            AmbientSource::Claude,
        );
        let working = reducer.ingest(true, claude_submit);
        assert_eq!(working.snapshot.source, Some(AmbientSource::Claude));

        let done = reducer.ingest(
            true,
            event_for(
                AmbientEventKind::AgentTurnComplete,
                "session-a",
                "turn-a",
                AmbientSource::Claude,
            ),
        );
        assert_eq!(done.snapshot.source, Some(AmbientSource::Claude));

        // SessionEnd removes the slot — source clears.
        let ended = reducer.ingest(
            true,
            event_for(
                AmbientEventKind::SessionEnd,
                "session-a",
                "turn-a",
                AmbientSource::Claude,
            ),
        );
        assert_eq!(ended.snapshot.source, None);
    }

    // ── multi-session reducer ────────────────────────────────────────────

    #[test]
    fn two_sessions_tracked_independently() {
        let mut reducer = AmbientReducer::new();

        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::UserPromptSubmit,
                "session-a",
                "turn-a1",
                AmbientSource::Codex,
            ),
        );
        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::UserPromptSubmit,
                "session-b",
                "turn-b1",
                AmbientSource::Claude,
            ),
        );

        // Session A goes to waiting, session B stays working.
        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::PermissionRequest,
                "session-a",
                "turn-a1",
                AmbientSource::Codex,
            ),
        );

        // Snapshot shows the most recently updated session (A, which is waiting).
        let snap = reducer.snapshot();
        assert_eq!(snap.state, AmbientStatus::Waiting);
        assert_eq!(snap.session_id.as_deref(), Some("session-a"));

        // Session B can still advance independently.
        let b_tool = reducer.ingest(
            true,
            event_for(
                AmbientEventKind::PreToolUse,
                "session-b",
                "turn-b1",
                AmbientSource::Claude,
            ),
        );
        assert!(b_tool.accepted);
        assert_eq!(b_tool.snapshot.state, AmbientStatus::Working);
        assert_eq!(b_tool.snapshot.session_id.as_deref(), Some("session-b"));
    }

    #[test]
    fn done_in_one_session_does_not_affect_other() {
        let mut reducer = AmbientReducer::new();

        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::UserPromptSubmit,
                "session-a",
                "turn-a",
                AmbientSource::Codex,
            ),
        );
        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::UserPromptSubmit,
                "session-b",
                "turn-b",
                AmbientSource::Claude,
            ),
        );

        // Session A completes — Done persists.
        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::AgentTurnComplete,
                "session-a",
                "turn-a",
                AmbientSource::Codex,
            ),
        );

        // Session B continues working, unaffected.
        let b_tool = reducer.ingest(
            true,
            event_for(
                AmbientEventKind::PreToolUse,
                "session-b",
                "turn-b",
                AmbientSource::Claude,
            ),
        );
        assert!(b_tool.accepted);
        assert_eq!(b_tool.snapshot.state, AmbientStatus::Working);
        assert_eq!(b_tool.snapshot.session_id.as_deref(), Some("session-b"));

        // Session A is still in Done (slot preserved).
        assert_eq!(reducer.slots[0].session_id, "session-a");
        assert_eq!(reducer.slots[0].state, AmbientStatus::Done);
    }

    #[test]
    fn session_end_removes_slot_immediately() {
        let mut reducer = AmbientReducer::new();

        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::UserPromptSubmit,
                "session-a",
                "turn-a",
                AmbientSource::Claude,
            ),
        );
        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::UserPromptSubmit,
                "session-b",
                "turn-b",
                AmbientSource::Codex,
            ),
        );

        let removed = reducer.ingest(
            true,
            event_for(
                AmbientEventKind::SessionEnd,
                "session-a",
                "turn-a",
                AmbientSource::Claude,
            ),
        );
        assert!(removed.accepted);

        // Only session B remains.
        let snap = reducer.snapshot();
        assert_eq!(snap.state, AmbientStatus::Working);
        assert_eq!(snap.session_id.as_deref(), Some("session-b"));
    }

    #[test]
    fn session_end_for_unknown_session_is_rejected() {
        let mut reducer = AmbientReducer::new();

        let result = reducer.ingest(
            true,
            event_for(
                AmbientEventKind::SessionEnd,
                "never-seen",
                "turn-x",
                AmbientSource::Claude,
            ),
        );
        assert!(!result.accepted);
    }

    #[test]
    fn session_end_on_last_session_returns_idle() {
        let mut reducer = AmbientReducer::new();

        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::UserPromptSubmit,
                "session-a",
                "turn-a",
                AmbientSource::Claude,
            ),
        );
        let removed = reducer.ingest(
            true,
            event_for(
                AmbientEventKind::SessionEnd,
                "session-a",
                "turn-a",
                AmbientSource::Claude,
            ),
        );

        assert_eq!(removed.snapshot.state, AmbientStatus::Idle);
        assert_eq!(removed.snapshot.session_id, None);
        assert_eq!(removed.snapshot.event, "session-end");
    }

    #[test]
    fn done_slot_overridden_by_new_turn_preserving_position() {
        let mut reducer = AmbientReducer::new();

        // Create two sessions: A then B.
        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::UserPromptSubmit,
                "session-a",
                "turn-a1",
                AmbientSource::Codex,
            ),
        );
        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::UserPromptSubmit,
                "session-b",
                "turn-b1",
                AmbientSource::Claude,
            ),
        );

        // Session A completes (Done persists).
        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::AgentTurnComplete,
                "session-a",
                "turn-a1",
                AmbientSource::Codex,
            ),
        );

        // Session A starts a new turn — slot overridden, position preserved.
        let reactivated = reducer.ingest(
            true,
            event_for(
                AmbientEventKind::UserPromptSubmit,
                "session-a",
                "turn-a2",
                AmbientSource::Codex,
            ),
        );
        assert!(reactivated.accepted);

        // Verify A's slot is still at index 0 (before B).
        assert_eq!(reducer.slots[0].session_id, "session-a");
        assert_eq!(reducer.slots[0].turn_id, "turn-a2");
        assert_eq!(reducer.slots[0].state, AmbientStatus::Working);
        assert_eq!(reducer.slots[1].session_id, "session-b");
    }

    #[test]
    fn stale_turn_event_rejected_per_slot() {
        let mut reducer = AmbientReducer::new();

        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::UserPromptSubmit,
                "session-a",
                "turn-a1",
                AmbientSource::Codex,
            ),
        );
        // Start a new turn on the same session.
        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::UserPromptSubmit,
                "session-a",
                "turn-a2",
                AmbientSource::Codex,
            ),
        );

        // Late event from old turn is rejected.
        let stale = reducer.ingest(
            true,
            event_for(
                AmbientEventKind::PreToolUse,
                "session-a",
                "turn-a1",
                AmbientSource::Codex,
            ),
        );
        assert!(!stale.accepted);
        assert_eq!(reducer.snapshot().turn_id.as_deref(), Some("turn-a2"));
    }

    #[test]
    fn reset_to_idle_clears_all_slots() {
        let mut reducer = AmbientReducer::new();

        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::UserPromptSubmit,
                "session-a",
                "turn-a",
                AmbientSource::Codex,
            ),
        );
        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::UserPromptSubmit,
                "session-b",
                "turn-b",
                AmbientSource::Claude,
            ),
        );

        let idle = reducer.reset_to_idle();
        assert_eq!(idle.state, AmbientStatus::Idle);
        assert_eq!(idle.event, "disabled");
        assert!(reducer.slots.is_empty());
    }

    #[test]
    fn snapshot_sessions_array_reflects_all_active_slots() {
        let mut reducer = AmbientReducer::new();

        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::UserPromptSubmit,
                "session-a",
                "turn-a",
                AmbientSource::Codex,
            ),
        );
        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::UserPromptSubmit,
                "session-b",
                "turn-b",
                AmbientSource::Claude,
            ),
        );
        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::AgentTurnComplete,
                "session-a",
                "turn-a",
                AmbientSource::Codex,
            ),
        );

        let snap = reducer.snapshot();
        assert_eq!(snap.version, 2);
        assert_eq!(snap.sessions.len(), 2);

        assert_eq!(snap.sessions[0].session_id, "session-a");
        assert_eq!(snap.sessions[0].source, AmbientSource::Codex);
        assert_eq!(snap.sessions[0].state, AmbientStatus::Done);

        assert_eq!(snap.sessions[1].session_id, "session-b");
        assert_eq!(snap.sessions[1].source, AmbientSource::Claude);
        assert_eq!(snap.sessions[1].state, AmbientStatus::Working);
    }

    #[test]
    fn idle_snapshot_has_empty_sessions() {
        let reducer = AmbientReducer::new();
        let snap = reducer.snapshot();
        assert_eq!(snap.version, 2);
        assert_eq!(snap.state, AmbientStatus::Idle);
        assert!(snap.sessions.is_empty());
    }

    // ── TTL eviction ─────────────────────────────────────────────────────

    #[test]
    fn stale_session_is_evicted_by_ttl() {
        let mut reducer = AmbientReducer::new();

        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::UserPromptSubmit,
                "session-a",
                "turn-a",
                AmbientSource::Codex,
            ),
        );
        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::UserPromptSubmit,
                "session-b",
                "turn-b",
                AmbientSource::Claude,
            ),
        );

        // Age session-a past TTL.
        reducer.age_slot("session-a", Duration::from_secs(TTL_SECONDS + 1));

        let evicted = reducer.evict_stale(Duration::from_secs(TTL_SECONDS));
        assert!(evicted.is_some());

        // Only session-b remains.
        assert_eq!(reducer.slots.len(), 1);
        assert_eq!(reducer.slots[0].session_id, "session-b");
    }

    #[test]
    fn ttl_eviction_of_last_slot_returns_idle_with_ttl_event() {
        let mut reducer = AmbientReducer::new();

        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::UserPromptSubmit,
                "session-a",
                "turn-a",
                AmbientSource::Claude,
            ),
        );

        reducer.age_slot("session-a", Duration::from_secs(TTL_SECONDS + 1));

        let snap = reducer
            .evict_stale(Duration::from_secs(TTL_SECONDS))
            .expect("stale session evicted");
        assert_eq!(snap.state, AmbientStatus::Idle);
        assert_eq!(snap.event, "ttl-evicted");
        assert_eq!(snap.session_id, None);
    }

    #[test]
    fn fresh_sessions_survive_ttl_sweep() {
        let mut reducer = AmbientReducer::new();

        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::UserPromptSubmit,
                "session-a",
                "turn-a",
                AmbientSource::Codex,
            ),
        );

        let evicted = reducer.evict_stale(Duration::from_secs(TTL_SECONDS));
        assert!(evicted.is_none());
        assert_eq!(reducer.slots.len(), 1);
    }

    #[test]
    fn activity_resets_ttl_clock() {
        let mut reducer = AmbientReducer::new();

        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::UserPromptSubmit,
                "session-a",
                "turn-a",
                AmbientSource::Codex,
            ),
        );

        // Age past TTL.
        reducer.age_slot("session-a", Duration::from_secs(TTL_SECONDS + 1));

        // New activity resets the clock.
        reducer.ingest(
            true,
            event_for(
                AmbientEventKind::PreToolUse,
                "session-a",
                "turn-a",
                AmbientSource::Codex,
            ),
        );

        let evicted = reducer.evict_stale(Duration::from_secs(TTL_SECONDS));
        assert!(evicted.is_none());
        assert_eq!(reducer.slots.len(), 1);
    }
}
