//! Tauri-facing runtime for the multi-session ambient reducer.
//!
//! The pure reducer remains in `ambient`; this module only owns process-local
//! synchronization, window visibility, snapshot fan-out, and the TTL sweeper.

use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex, MutexGuard,
    },
    thread,
    time::Duration,
};

use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, Runtime, WebviewWindow};
use tauri_plugin_custom_window::MAIN_WINDOW_LABEL;

use super::ambient::{
    AmbientAlertKind, AmbientEvent, AmbientReducer, AmbientSnapshot, AmbientStatus,
    SWEEPER_INTERVAL_SECONDS, TTL_SECONDS,
};

pub const AMBIENT_SNAPSHOT_EVENT: &str = "codex-ambient-snapshot";
pub const AMBIENT_WINDOW_LABEL: &str = "ambient";
pub const AMBIENT_ALERT_EVENT: &str = "agent-ambient-alert";
pub const AMBIENT_ALERT_WINDOW_LABEL: &str = "ambient-alert";
const AMBIENT_WINDOW_OFFSET_X: i32 = -420;
const AMBIENT_WINDOW_OFFSET_Y: i32 = 10;
const WAITING_ALERT_DURATION_MS: u64 = 2_800;
const DONE_ALERT_DURATION_MS: u64 = 1_800;
const ALERT_FALLBACK_GRACE_MS: u64 = 500;

#[derive(Clone, Copy, Debug, Eq, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AmbientAlertPayload {
    pub kind: AmbientAlertKind,
    pub generation: u64,
    pub duration_ms: u64,
}

#[derive(Debug, Default)]
struct AmbientAlertCoordinator {
    generation: u64,
    active: Option<AmbientAlertPayload>,
}

impl AmbientAlertCoordinator {
    fn request(&mut self, kind: AmbientAlertKind) -> Option<AmbientAlertPayload> {
        if let Some(active) = self.active {
            if active.kind == AmbientAlertKind::Waiting || active.kind == kind {
                return None;
            }
        }

        self.generation = self.generation.wrapping_add(1);
        if self.generation == 0 {
            self.generation = 1;
        }

        let payload = AmbientAlertPayload {
            kind,
            generation: self.generation,
            duration_ms: match kind {
                AmbientAlertKind::Waiting => WAITING_ALERT_DURATION_MS,
                AmbientAlertKind::Done => DONE_ALERT_DURATION_MS,
            },
        };
        self.active = Some(payload);
        Some(payload)
    }

    fn complete(&mut self, generation: u64) -> bool {
        if self.active.map(|active| active.generation) != Some(generation) {
            return false;
        }

        self.active = None;
        true
    }

    fn clear(&mut self) {
        self.generation = self.generation.wrapping_add(1);
        self.active = None;
    }

    #[cfg(test)]
    fn active(&self) -> Option<AmbientAlertPayload> {
        self.active
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
struct AmbientConsumers {
    indicator_enabled: bool,
    presentation_enabled: bool,
}

impl AmbientConsumers {
    fn set_indicator_enabled(&mut self, enabled: bool) {
        self.indicator_enabled = enabled;
    }

    fn set_presentation_enabled(&mut self, enabled: bool) {
        self.presentation_enabled = enabled;
    }

    fn indicator_enabled(&self) -> bool {
        self.indicator_enabled
    }

    fn presentation_enabled(&self) -> bool {
        self.presentation_enabled
    }

    fn receiving(&self) -> bool {
        self.indicator_enabled || self.presentation_enabled
    }
}

#[derive(Default)]
pub struct AmbientRuntime {
    consumers: Mutex<AmbientConsumers>,
    reducer: Mutex<AmbientReducer>,
    /// Serializes state changes with snapshot publication. Pipe clients are
    /// handled concurrently, so reducer locking alone is insufficient: an
    /// older snapshot could otherwise publish after a newer one and apply a
    /// stale window show/hide operation.
    update_lock: Mutex<()>,
    alert_coordinator: Mutex<AmbientAlertCoordinator>,
    sweeper_started: AtomicBool,
}

impl AmbientRuntime {
    pub fn set_indicator_enabled<R: Runtime>(&self, app: &AppHandle<R>, enabled: bool) {
        let _update = self.update_guard();
        {
            let mut consumers = self.consumers();
            consumers.set_indicator_enabled(enabled);
        }
        let consumers = self.consumer_snapshot();

        let snapshot = if consumers.receiving() {
            self.reducer().snapshot()
        } else {
            self.reducer().reset_to_idle()
        };

        self.publish(app, &snapshot, consumers);
        if !enabled {
            self.hide_indicator(app);
            self.cancel_alert(app);
        }
    }

    pub fn set_presentation_enabled<R: Runtime>(&self, app: &AppHandle<R>, enabled: bool) {
        let _update = self.update_guard();
        {
            let mut consumers = self.consumers();
            consumers.set_presentation_enabled(enabled);
        }
        let consumers = self.consumer_snapshot();

        let snapshot = if consumers.receiving() {
            self.reducer().snapshot()
        } else {
            self.reducer().reset_to_idle()
        };

        self.publish(app, &snapshot, consumers);
    }

    pub fn snapshot(&self) -> AmbientSnapshot {
        self.reducer().snapshot()
    }

    pub fn ingest<R: Runtime>(&self, app: &AppHandle<R>, event: AmbientEvent) {
        let _update = self.update_guard();
        let consumers = self.consumer_snapshot();

        if !consumers.receiving() {
            return;
        }

        let applied = self.reducer().ingest(true, event);
        if !applied.accepted {
            return;
        }

        self.publish(app, &applied.snapshot, consumers);
        if consumers.indicator_enabled() {
            if let Some(alert) = applied.alert {
                self.request_alert(app, alert);
            }
        }
        self.ensure_sweeper(app);
    }

    pub fn complete_alert<R: Runtime>(&self, app: &AppHandle<R>, generation: u64) {
        let _update = self.update_guard();
        self.complete_alert_locked(app, generation);
    }

    fn ensure_sweeper<R: Runtime>(&self, app: &AppHandle<R>) {
        if self
            .sweeper_started
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return;
        }

        let app = app.clone();
        thread::spawn(move || {
            let ttl = Duration::from_secs(TTL_SECONDS);
            let interval = Duration::from_secs(SWEEPER_INTERVAL_SECONDS);

            loop {
                thread::sleep(interval);

                let runtime = app.state::<AmbientRuntime>();
                let _update = runtime.update_guard();
                let consumers = runtime.consumer_snapshot();
                if !consumers.receiving() {
                    continue;
                }

                if let Some(snapshot) = runtime.reducer().evict_stale(ttl) {
                    runtime.publish(&app, &snapshot, consumers);
                }
            }
        });
    }

    fn consumers(&self) -> MutexGuard<'_, AmbientConsumers> {
        self.consumers
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn consumer_snapshot(&self) -> AmbientConsumers {
        *self.consumers()
    }

    fn reducer(&self) -> MutexGuard<'_, AmbientReducer> {
        self.reducer
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn update_guard(&self) -> MutexGuard<'_, ()> {
        self.update_lock
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn alert_coordinator(&self) -> MutexGuard<'_, AmbientAlertCoordinator> {
        self.alert_coordinator
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn publish<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        snapshot: &AmbientSnapshot,
        consumers: AmbientConsumers,
    ) {
        if consumers.indicator_enabled() {
            let _ = app.emit_to(AMBIENT_WINDOW_LABEL, AMBIENT_SNAPSHOT_EVENT, snapshot);
            self.sync_window_visibility(app, snapshot);
        }

        if consumers.presentation_enabled() {
            let _ = app.emit_to(MAIN_WINDOW_LABEL, AMBIENT_SNAPSHOT_EVENT, snapshot);
        }
    }

    fn sync_window_visibility<R: Runtime>(&self, app: &AppHandle<R>, snapshot: &AmbientSnapshot) {
        let Some(window) = app.get_webview_window(AMBIENT_WINDOW_LABEL) else {
            return;
        };

        if snapshot.state == AmbientStatus::Idle {
            let _ = window.hide();
            return;
        }

        configure_window(app, &window);
        let _ = window.show();
    }

    fn request_alert<R: Runtime>(&self, app: &AppHandle<R>, kind: AmbientAlertKind) {
        let Some(window) = app.get_webview_window(AMBIENT_ALERT_WINDOW_LABEL) else {
            return;
        };
        let Some(payload) = self.alert_coordinator().request(kind) else {
            return;
        };

        configure_alert_window(app, &window);
        let _ = window.show();
        let _ = app.emit_to(AMBIENT_ALERT_WINDOW_LABEL, AMBIENT_ALERT_EVENT, payload);

        let app = app.clone();
        let _ = thread::Builder::new()
            .name("ambient-alert-timeout".into())
            .spawn(move || {
                thread::sleep(Duration::from_millis(
                    payload.duration_ms + ALERT_FALLBACK_GRACE_MS,
                ));
                app.state::<AmbientRuntime>()
                    .complete_alert(&app, payload.generation);
            });
    }

    fn complete_alert_locked<R: Runtime>(&self, app: &AppHandle<R>, generation: u64) {
        if !self.alert_coordinator().complete(generation) {
            return;
        }

        if let Some(window) = app.get_webview_window(AMBIENT_ALERT_WINDOW_LABEL) {
            let _ = window.hide();
        }
    }

    fn hide_indicator<R: Runtime>(&self, app: &AppHandle<R>) {
        if let Some(window) = app.get_webview_window(AMBIENT_WINDOW_LABEL) {
            let _ = window.hide();
        }
    }

    fn cancel_alert<R: Runtime>(&self, app: &AppHandle<R>) {
        self.alert_coordinator().clear();
        if let Some(window) = app.get_webview_window(AMBIENT_ALERT_WINDOW_LABEL) {
            let _ = window.hide();
        }
    }
}

fn configure_window<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>) {
    let _ = window.set_skip_taskbar(true);
    let _ = window.set_focusable(false);
    let _ = window.set_ignore_cursor_events(true);
    let _ = window.set_always_on_top(true);

    let (Ok(Some(monitor)), Ok(size)) = (app.primary_monitor(), window.outer_size()) else {
        return;
    };
    let work_area = monitor.work_area();
    let x = work_area
        .position
        .x
        .saturating_add(
            work_area
                .size
                .width
                .saturating_sub(size.width)
                .saturating_div(2) as i32,
        )
        .saturating_add(AMBIENT_WINDOW_OFFSET_X);
    let y = work_area
        .position
        .y
        .saturating_add(work_area.size.height.saturating_sub(size.height) as i32)
        .saturating_add(AMBIENT_WINDOW_OFFSET_Y);

    let _ = window.set_position(PhysicalPosition::new(x, y));
}

fn configure_alert_window<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>) {
    let _ = window.set_skip_taskbar(true);
    let _ = window.set_focusable(false);
    let _ = window.set_ignore_cursor_events(true);
    let _ = window.set_always_on_top(true);

    let Ok(Some(monitor)) = app.primary_monitor() else {
        return;
    };
    let work_area = monitor.work_area();
    let _ = window.set_size(work_area.size);
    let _ = window.set_position(work_area.position);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn either_consumer_keeps_receiving_enabled() {
        let mut consumers = AmbientConsumers::default();

        assert!(!consumers.receiving());

        consumers.set_indicator_enabled(true);
        assert!(consumers.receiving());
        assert!(consumers.indicator_enabled());
        assert!(!consumers.presentation_enabled());

        consumers.set_presentation_enabled(true);
        consumers.set_indicator_enabled(false);
        assert!(consumers.receiving());
        assert!(!consumers.indicator_enabled());
        assert!(consumers.presentation_enabled());

        consumers.set_presentation_enabled(false);
        assert!(!consumers.receiving());
    }

    #[test]
    fn consumer_flags_remain_independent() {
        let mut consumers = AmbientConsumers::default();

        consumers.set_presentation_enabled(true);
        assert!(!consumers.indicator_enabled());
        assert!(consumers.presentation_enabled());

        consumers.set_indicator_enabled(true);
        assert!(consumers.indicator_enabled());
        assert!(consumers.presentation_enabled());

        consumers.set_presentation_enabled(false);
        assert!(consumers.indicator_enabled());
        assert!(!consumers.presentation_enabled());
    }

    #[test]
    fn waiting_preempts_done_while_done_never_overwrites_waiting() {
        let mut coordinator = AmbientAlertCoordinator::default();

        let done = coordinator
            .request(AmbientAlertKind::Done)
            .expect("first done should display");
        let waiting = coordinator
            .request(AmbientAlertKind::Waiting)
            .expect("waiting should preempt done");

        assert!(waiting.generation > done.generation);
        assert_eq!(waiting.kind, AmbientAlertKind::Waiting);
        assert_eq!(coordinator.request(AmbientAlertKind::Done), None);
        assert_eq!(coordinator.request(AmbientAlertKind::Waiting), None);
    }

    #[test]
    fn only_the_current_generation_can_complete_or_hide_an_alert() {
        let mut coordinator = AmbientAlertCoordinator::default();

        let done = coordinator
            .request(AmbientAlertKind::Done)
            .expect("done should display");
        let waiting = coordinator
            .request(AmbientAlertKind::Waiting)
            .expect("waiting should preempt done");

        assert!(!coordinator.complete(done.generation));
        assert!(coordinator.complete(waiting.generation));
        assert!(!coordinator.complete(waiting.generation));

        let next = coordinator
            .request(AmbientAlertKind::Done)
            .expect("completion should release the coordinator");
        assert!(next.generation > waiting.generation);
    }

    #[test]
    fn clearing_alerts_invalidates_outstanding_completion_callbacks() {
        let mut coordinator = AmbientAlertCoordinator::default();
        let active = coordinator
            .request(AmbientAlertKind::Waiting)
            .expect("waiting should display");

        coordinator.clear();

        assert!(!coordinator.complete(active.generation));
        assert!(coordinator.active().is_none());
    }
}
