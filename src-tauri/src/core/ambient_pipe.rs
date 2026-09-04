//! Windows local IPC for ambient events (multi-session concurrent).
//!
//! BongoCat may run elevated for input capture while the one-shot PowerShell
//! client remains at medium integrity. The pipe DACL is restricted to the
//! current Windows user and its mandatory label permits medium-integrity
//! clients from that account to write to the elevated server.
//!
//! The main thread always keeps one pipe instance waiting for connections.
//! When a client connects, a short-lived handler thread reads the event and
//! feeds it to the reducer, while the main thread immediately creates the
//! next instance — eliminating the pipe-less window that caused silent event
//! drops under concurrency.

use std::{ffi::c_void, mem::size_of, thread, time::Duration};

use tauri::{AppHandle, Manager};
use windows::{
    Win32::{
        Foundation::{
            CloseHandle, ERROR_PIPE_CONNECTED, HANDLE, HLOCAL, INVALID_HANDLE_VALUE, LocalFree,
        },
        Security::{
            Authorization::{
                ConvertSidToStringSidW, ConvertStringSecurityDescriptorToSecurityDescriptorW,
                SDDL_REVISION_1,
            },
            GetTokenInformation, PSECURITY_DESCRIPTOR, SECURITY_ATTRIBUTES, TOKEN_QUERY,
            TOKEN_USER, TokenUser,
        },
        Storage::FileSystem::{FILE_FLAG_FIRST_PIPE_INSTANCE, PIPE_ACCESS_INBOUND, ReadFile},
        System::{
            Pipes::{
                ConnectNamedPipe, CreateNamedPipeW, PIPE_READMODE_MESSAGE,
                PIPE_REJECT_REMOTE_CLIENTS, PIPE_TYPE_MESSAGE, PIPE_WAIT,
            },
            Threading::{GetCurrentProcess, OpenProcessToken},
        },
    },
    core::{Error, HSTRING, PWSTR, Result},
};

use super::{
    ambient::{AMBIENT_PIPE_NAME, MAX_AMBIENT_PAYLOAD_BYTES, decode_ambient_payload},
    ambient_runtime::AmbientRuntime,
};

const PIPE_RETRY_DELAY: Duration = Duration::from_secs(1);
const PIPE_MAX_INSTANCES: u32 = 16;

pub fn start(app: AppHandle) {
    let result = thread::Builder::new()
        .name("codex-ambient-pipe".into())
        .spawn(move || serve(app));

    if let Err(error) = result {
        tauri_plugin_log::log::error!("failed to start Codex ambient pipe thread: {error}");
    }
}

fn serve(app: AppHandle) {
    let security = match PipeSecurity::for_current_user() {
        Ok(security) => security,
        Err(error) => {
            tauri_plugin_log::log::error!(
                "failed to create Codex ambient pipe security descriptor: {error}"
            );
            return;
        }
    };

    let mut is_first = true;

    loop {
        let pipe = match create_pipe(&security.attributes, &security.user_sid, is_first) {
            Ok(pipe) => pipe,
            Err(error) => {
                tauri_plugin_log::log::warn!("failed to create Codex ambient pipe: {error}");
                thread::sleep(PIPE_RETRY_DELAY);
                continue;
            }
        };
        is_first = false;

        if !wait_for_client(pipe.0) {
            continue;
        }

        let app = app.clone();
        thread::spawn(move || {
            if let Some(event) = read_event(&pipe) {
                app.state::<AmbientRuntime>().ingest(&app, event);
            }
        });
    }
}

fn create_pipe(
    attributes: &SECURITY_ATTRIBUTES,
    user_sid: &str,
    first_instance: bool,
) -> Result<OwnedHandle> {
    let path = HSTRING::from(format!(r"\\.\pipe\{AMBIENT_PIPE_NAME}.{user_sid}"));
    let mut flags = PIPE_ACCESS_INBOUND;
    if first_instance {
        flags |= FILE_FLAG_FIRST_PIPE_INSTANCE;
    }
    let handle = unsafe {
        CreateNamedPipeW(
            &path,
            flags,
            PIPE_TYPE_MESSAGE | PIPE_READMODE_MESSAGE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
            PIPE_MAX_INSTANCES,
            0,
            (MAX_AMBIENT_PAYLOAD_BYTES + 1) as u32,
            500,
            Some(attributes),
        )
    };

    if handle == INVALID_HANDLE_VALUE {
        Err(Error::from_win32())
    } else {
        Ok(OwnedHandle(handle))
    }
}

fn wait_for_client(pipe: HANDLE) -> bool {
    match unsafe { ConnectNamedPipe(pipe, None) } {
        Ok(()) => true,
        Err(_) => unsafe { windows::Win32::Foundation::GetLastError() == ERROR_PIPE_CONNECTED },
    }
}

fn read_event(pipe: &OwnedHandle) -> Option<super::ambient::AmbientEvent> {
    let mut buffer = [0_u8; MAX_AMBIENT_PAYLOAD_BYTES + 1];
    let mut bytes_read = 0_u32;
    let result = unsafe { ReadFile(pipe.0, Some(&mut buffer), Some(&mut bytes_read), None) };
    let length = bytes_read as usize;

    if result.is_err() || length == 0 || length > MAX_AMBIENT_PAYLOAD_BYTES {
        return None;
    }

    decode_ambient_payload(&buffer[..length])
}

struct PipeSecurity {
    attributes: SECURITY_ATTRIBUTES,
    descriptor: PSECURITY_DESCRIPTOR,
    user_sid: String,
}

impl PipeSecurity {
    fn for_current_user() -> Result<Self> {
        let user_sid = current_user_sid()?;
        let sddl = HSTRING::from(format!(
            "D:P(A;;GA;;;SY)(A;;GA;;;{user_sid})S:(ML;;NW;;;ME)"
        ));
        let mut descriptor = PSECURITY_DESCRIPTOR::default();

        unsafe {
            ConvertStringSecurityDescriptorToSecurityDescriptorW(
                &sddl,
                SDDL_REVISION_1,
                &mut descriptor,
                None,
            )?;
        }

        Ok(Self {
            attributes: SECURITY_ATTRIBUTES {
                nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
                lpSecurityDescriptor: descriptor.0,
                bInheritHandle: false.into(),
            },
            descriptor,
            user_sid,
        })
    }
}

impl Drop for PipeSecurity {
    fn drop(&mut self) {
        unsafe {
            let _ = LocalFree(Some(HLOCAL(self.descriptor.0)));
        }
    }
}

fn current_user_sid() -> Result<String> {
    let mut token = HANDLE::default();
    unsafe {
        OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token)?;
    }
    let token = OwnedHandle(token);

    let mut required_size = 0_u32;
    let _ = unsafe { GetTokenInformation(token.0, TokenUser, None, 0, &mut required_size) };
    if required_size == 0 {
        return Err(Error::from_win32());
    }

    let word_size = size_of::<usize>();
    let mut buffer = vec![0_usize; (required_size as usize).div_ceil(word_size)];
    unsafe {
        GetTokenInformation(
            token.0,
            TokenUser,
            Some(buffer.as_mut_ptr().cast::<c_void>()),
            required_size,
            &mut required_size,
        )?;
    }

    let token_user = unsafe { &*buffer.as_ptr().cast::<TOKEN_USER>() };
    let mut sid_text = PWSTR::null();
    unsafe {
        ConvertSidToStringSidW(token_user.User.Sid, &mut sid_text)?;
    }
    let sid_text = LocalWideString(sid_text);

    unsafe { Ok(sid_text.0.to_string()?) }
}

struct OwnedHandle(HANDLE);

// SAFETY: Windows handles are process-wide identifiers safe to use from any
// thread. We transfer exclusive ownership into the handler thread.
unsafe impl Send for OwnedHandle {}

impl Drop for OwnedHandle {
    fn drop(&mut self) {
        unsafe {
            let _ = CloseHandle(self.0);
        }
    }
}

struct LocalWideString(PWSTR);

impl Drop for LocalWideString {
    fn drop(&mut self) {
        unsafe {
            let _ = LocalFree(Some(HLOCAL(self.0.0.cast())));
        }
    }
}
