//! Tauri-facing runtime for the Codex ambient reducer.
//!
//! The pure reducer remains in `ambient`; this module only owns process-local
//! synchronization, window visibility, snapshot fan-out, and the delayed DONE
//! settlement.

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
    AmbientEvent, AmbientReducer, AmbientSnapshot, AmbientStatus, DONE_IDLE_DELAY_SECONDS,
    DoneSettlement,
};

pub const AMBIENT_SNAPSHOT_EVENT: &str = "codex-ambient-snapshot";
pub const AMBIENT_WINDOW_LABEL: &str = "ambient";

#[derive(Default)]
pub struct AmbientRuntime {
    enabled: AtomicBool,
    reducer: Mutex<AmbientReducer>,
}

impl AmbientRuntime {
    pub fn set_enabled<R: Runtime>(&self, app: &AppHandle<R>, enabled: bool) {
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
        if !self.enabled.load(Ordering::SeqCst) {
            return;
        }

        let applied = self.reducer().ingest(true, event);
        if !applied.accepted {
            return;
        }

        self.publish(app, &applied.snapshot);

        if let Some(settlement) = applied.done_settlement {
            self.schedule_done_settlement(app, settlement);
        }
    }

    fn settle_done_if_current<R: Runtime>(&self, app: &AppHandle<R>, settlement: DoneSettlement) {
        if !self.enabled.load(Ordering::SeqCst) {
            return;
        }

        if let Some(snapshot) = self.reducer().settle_done_if_current(settlement) {
            self.publish(app, &snapshot);
        }
    }

    fn reducer(&self) -> MutexGuard<'_, AmbientReducer> {
        self.reducer
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn schedule_done_settlement<R: Runtime>(&self, app: &AppHandle<R>, settlement: DoneSettlement) {
        let app = app.clone();

        thread::spawn(move || {
            thread::sleep(Duration::from_secs(DONE_IDLE_DELAY_SECONDS));
            app.state::<AmbientRuntime>()
                .settle_done_if_current(&app, settlement);
        });
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
    let x = work_area.position.x.saturating_add(
        work_area
            .size
            .width
            .saturating_sub(size.width)
            .saturating_div(2) as i32,
    );
    let y = work_area
        .position
        .y
        .saturating_add(work_area.size.height.saturating_sub(size.height) as i32);

    let _ = window.set_position(PhysicalPosition::new(x, y));
}
