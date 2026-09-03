//! Strict parsing and single-turn state reduction for Codex ambient events.
//!
//! The WSL launcher owns delivery only. This module owns the sequence number,
//! active turn, stale-event filtering, and the compare-and-set data required
//! for the DONE-to-IDLE timer.

use serde::{Deserialize, Serialize};

pub const AMBIENT_EVENT_ARGUMENT: &str = "--codex-ambient-event";
pub const DONE_IDLE_DELAY_SECONDS: u64 = 5;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
enum AmbientEventKind {
    UserPromptSubmit,
    PreToolUse,
    PermissionRequest,
    PostToolUse,
    #[serde(rename = "agent-turn-complete")]
    AgentTurnComplete,
}

impl AmbientEventKind {
    fn event_name(&self) -> &'static str {
        match self {
            Self::UserPromptSubmit => "UserPromptSubmit",
            Self::PreToolUse => "PreToolUse",
            Self::PermissionRequest => "PermissionRequest",
            Self::PostToolUse => "PostToolUse",
            Self::AgentTurnComplete => "agent-turn-complete",
        }
    }

    fn target_state(&self) -> AmbientStatus {
        match self {
            Self::UserPromptSubmit | Self::PreToolUse | Self::PostToolUse => AmbientStatus::Working,
            Self::PermissionRequest => AmbientStatus::Waiting,
            Self::AgentTurnComplete => AmbientStatus::Done,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AmbientEvent {
    event: AmbientEventKind,
    session_id: String,
    turn_id: String,
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
pub struct AmbientSnapshot {
    pub version: u8,
    pub state: AmbientStatus,
    pub sequence: u64,
    pub session_id: Option<String>,
    pub turn_id: Option<String>,
    pub event: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DoneSettlement {
    sequence: u64,
    session_id: String,
    turn_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ApplyResult {
    pub accepted: bool,
    pub snapshot: AmbientSnapshot,
    pub done_settlement: Option<DoneSettlement>,
}

#[derive(Debug)]
pub struct AmbientReducer {
    snapshot: AmbientSnapshot,
    active_session_id: Option<String>,
    active_turn_id: Option<String>,
}

impl Default for AmbientReducer {
    fn default() -> Self {
        Self::new()
    }
}

impl AmbientReducer {
    pub fn new() -> Self {
        Self {
            snapshot: AmbientSnapshot {
                version: 1,
                state: AmbientStatus::Idle,
                sequence: 0,
                session_id: None,
                turn_id: None,
                event: "startup".into(),
            },
            active_session_id: None,
            active_turn_id: None,
        }
    }

    pub fn snapshot(&self) -> AmbientSnapshot {
        self.snapshot.clone()
    }

    pub fn reset_to_idle(&mut self) -> AmbientSnapshot {
        self.active_session_id = None;
        self.active_turn_id = None;

        if self.snapshot.state == AmbientStatus::Idle {
            return self.snapshot();
        }

        self.transition(AmbientStatus::Idle, "disabled", None, None)
    }

    pub fn ingest(&mut self, enabled: bool, event: AmbientEvent) -> ApplyResult {
        if !enabled {
            return ApplyResult {
                accepted: false,
                snapshot: self.snapshot(),
                done_settlement: None,
            };
        }

        if matches!(&event.event, AmbientEventKind::UserPromptSubmit) {
            self.active_session_id = Some(event.session_id.clone());
            self.active_turn_id = Some(event.turn_id.clone());
        } else if self.active_turn_id.is_none() {
            // BongoCat may start while Codex is already in a turn. The first
            // valid lifecycle event therefore establishes that active turn.
            self.active_session_id = Some(event.session_id.clone());
            self.active_turn_id = Some(event.turn_id.clone());
        } else if !self.matches_active_turn(&event) {
            return ApplyResult {
                accepted: false,
                snapshot: self.snapshot(),
                done_settlement: None,
            };
        }

        let state = event.event.target_state();
        let snapshot = self.transition(
            state,
            event.event.event_name(),
            Some(event.session_id.clone()),
            Some(event.turn_id.clone()),
        );
        let done_settlement = (state == AmbientStatus::Done).then(|| DoneSettlement {
            sequence: snapshot.sequence,
            session_id: event.session_id,
            turn_id: event.turn_id,
        });

        ApplyResult {
            accepted: true,
            snapshot,
            done_settlement,
        }
    }

    pub fn settle_done_if_current(
        &mut self,
        settlement: DoneSettlement,
    ) -> Option<AmbientSnapshot> {
        let current = &self.snapshot;
        if !(current.sequence == settlement.sequence
            && current.state == AmbientStatus::Done
            && current.session_id.as_deref() == Some(settlement.session_id.as_str())
            && current.turn_id.as_deref() == Some(settlement.turn_id.as_str()))
        {
            return None;
        }

        self.active_session_id = None;
        self.active_turn_id = None;
        Some(self.transition(AmbientStatus::Idle, "done-settled", None, None))
    }

    fn matches_active_turn(&self, event: &AmbientEvent) -> bool {
        self.active_session_id.as_deref() == Some(event.session_id.as_str())
            && self.active_turn_id.as_deref() == Some(event.turn_id.as_str())
    }

    fn transition(
        &mut self,
        state: AmbientStatus,
        event: &str,
        session_id: Option<String>,
        turn_id: Option<String>,
    ) -> AmbientSnapshot {
        self.snapshot.sequence = self
            .snapshot
            .sequence
            .checked_add(1)
            .expect("Codex ambient sequence overflowed");
        self.snapshot.state = state;
        self.snapshot.session_id = session_id;
        self.snapshot.turn_id = turn_id;
        self.snapshot.event = event.into();
        self.snapshot.clone()
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

    decode_ambient_event(payload)
        .map(DispatchRequest::Ambient)
        .unwrap_or(DispatchRequest::InvalidAmbient)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SerializedAmbientEvent {
    event: AmbientEventKind,
    session_id: String,
    turn_id: String,
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

    fn event(event: AmbientEventKind, turn_id: &str) -> AmbientEvent {
        AmbientEvent {
            event,
            session_id: "session-a".into(),
            turn_id: turn_id.into(),
        }
    }

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
    fn a_prompt_starts_working_and_the_reducer_owns_the_sequence() {
        let mut reducer = AmbientReducer::new();

        let applied = reducer.ingest(true, event(AmbientEventKind::UserPromptSubmit, "turn-a"));

        assert!(applied.accepted);
        assert_eq!(applied.snapshot.state, AmbientStatus::Working);
        assert_eq!(applied.snapshot.sequence, 1);
        assert_eq!(applied.snapshot.session_id.as_deref(), Some("session-a"));
        assert_eq!(applied.snapshot.turn_id.as_deref(), Some("turn-a"));
        assert_eq!(applied.snapshot.event, "UserPromptSubmit");
        assert_eq!(applied.done_settlement, None);
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
    fn done_settlement_cannot_override_a_newer_turn_but_idles_the_matching_turn() {
        assert_eq!(DONE_IDLE_DELAY_SECONDS, 5);

        let mut reducer = AmbientReducer::new();
        reducer.ingest(true, event(AmbientEventKind::UserPromptSubmit, "turn-a"));
        let done = reducer.ingest(true, event(AmbientEventKind::AgentTurnComplete, "turn-a"));
        let settlement = done.done_settlement.expect("DONE schedules a settlement");

        reducer.ingest(true, event(AmbientEventKind::UserPromptSubmit, "turn-b"));
        assert_eq!(reducer.settle_done_if_current(settlement.clone()), None);
        assert_eq!(reducer.snapshot().state, AmbientStatus::Working);
        assert_eq!(reducer.snapshot().turn_id.as_deref(), Some("turn-b"));

        let mut matching_reducer = AmbientReducer::new();
        matching_reducer.ingest(true, event(AmbientEventKind::UserPromptSubmit, "turn-a"));
        let matching_done =
            matching_reducer.ingest(true, event(AmbientEventKind::AgentTurnComplete, "turn-a"));
        let idle = matching_reducer
            .settle_done_if_current(matching_done.done_settlement.unwrap())
            .expect("matching DONE settles to idle");

        assert_eq!(idle.state, AmbientStatus::Idle);
        assert_eq!(idle.sequence, 3);
        assert_eq!(idle.session_id, None);
        assert_eq!(idle.turn_id, None);
        assert_eq!(idle.event, "done-settled");
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
}
