//! Tauri-facing runtime for the multi-session ambient reducer.
//!
//! The pure reducer remains in `ambient`; this module only owns process-local
//! synchronization, window visibility, snapshot fan-out, and the TTL sweeper.

use std::{
    sync::{
        Mutex, MutexGuard,
        atomic::{AtomicBool, Ordering},
    },
    thread,
    time::Duration,
};

use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, Runtime, WebviewWindow};

use super::ambient::{
    AmbientEvent, AmbientReducer, AmbientSnapshot, AmbientStatus, SWEEPER_INTERVAL_SECONDS,
    TTL_SECONDS,
};

pub const AMBIENT_SNAPSHOT_EVENT: &str = "codex-ambient-snapshot";
pub const AMBIENT_WINDOW_LABEL: &str = "ambient";
const AMBIENT_WINDOW_OFFSET_X: i32 = -420;
const AMBIENT_WINDOW_OFFSET_Y: i32 = 10;

#[derive(Default)]
pub struct AmbientRuntime {
    enabled: AtomicBool,
    reducer: Mutex<AmbientReducer>,
    /// Serializes state changes with snapshot publication. Pipe clients are
    /// handled concurrently, so reducer locking alone is insufficient: an
    /// older snapshot could otherwise publish after a newer one and apply a
    /// stale window show/hide operation.
    update_lock: Mutex<()>,
    sweeper_started: AtomicBool,
}

impl AmbientRuntime {
    pub fn set_enabled<R: Runtime>(&self, app: &AppHandle<R>, enabled: bool) {
        let _update = self.update_guard();
        self.enabled.store(enabled, Ordering::SeqCst);

        let snapshot = if enabled {
            self.reducer().snapshot()
        } else {
            self.reducer().reset_to_idle()
        };

        self.publish(app, &snapshot);
    }

    pub fn snapshot(&self) -> AmbientSnapshot {
        self.reducer().snapshot()
    }

    pub fn ingest<R: Runtime>(&self, app: &AppHandle<R>, event: AmbientEvent) {
        let _update = self.update_guard();

        if !self.enabled.load(Ordering::SeqCst) {
            return;
        }

        let applied = self.reducer().ingest(true, event);
        if !applied.accepted {
            return;
        }

        self.publish(app, &applied.snapshot);
        self.ensure_sweeper(app);
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
                if !runtime.enabled.load(Ordering::SeqCst) {
                    continue;
                }

                if let Some(snapshot) = runtime.reducer().evict_stale(ttl) {
                    runtime.publish(&app, &snapshot);
                }
            }
        });
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

    fn publish<R: Runtime>(&self, app: &AppHandle<R>, snapshot: &AmbientSnapshot) {
        let _ = app.emit_to(AMBIENT_WINDOW_LABEL, AMBIENT_SNAPSHOT_EVENT, snapshot);
        self.sync_window_visibility(app, snapshot);
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
