use std::fs;
use std::io;
use std::io::ErrorKind::NotFound;
use std::path::{Path, PathBuf};

#[cfg(test)]
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{Manager as _, Runtime};

const PINIA_STORE_DIRECTORY: &str = "tauri-plugin-pinia";

/// Initializes recovery before the Pinia plugin reads the statistics store.
pub fn init<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("statistics-recovery")
        .setup(|app, _api| {
            if let Ok(app_data_dir) = app.path().app_data_dir() {
                let path = app_data_dir
                    .join(PINIA_STORE_DIRECTORY)
                    .join(statistics_file_name());

                let _ = recover_statistics_file(&path);
            }

            Ok(())
        })
        .build()
}

fn statistics_file_name() -> &'static str {
    if cfg!(debug_assertions) {
        "statistics.dev.json"
    } else {
        "statistics.json"
    }
}

/// Moves syntactically invalid statistics JSON aside so Pinia can load an
/// empty store. The backup stays local for manual inspection or recovery.
fn recover_statistics_file(path: &Path) -> io::Result<Option<PathBuf>> {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == NotFound => return Ok(None),
        Err(error) => return Err(error),
    };

    if serde_json::from_slice::<serde_json::Value>(&bytes).is_ok() {
        return Ok(None);
    }

    let backup_path = next_backup_path(path);
    fs::rename(path, &backup_path)?;

    Ok(Some(backup_path))
}

fn next_backup_path(path: &Path) -> PathBuf {
    let parent = path.parent().unwrap_or_else(|| Path::new(""));
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("statistics.json");

    let initial = parent.join(format!("{file_name}.corrupt"));

    if !initial.exists() {
        return initial;
    }

    let index = (1..)
        .find(|index| !parent.join(format!("{file_name}.corrupt.{index}")).exists())
        .expect("a free statistics backup filename should always exist");

    parent.join(format!("{file_name}.corrupt.{index}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_statistics_json_is_left_in_place() {
        let directory = test_directory("valid");
        let path = directory.join("statistics.dev.json");
        let source = br#"{"schemaVersion":1,"daily":{}}"#;

        fs::write(&path, source).unwrap();

        assert_eq!(recover_statistics_file(&path).unwrap(), None);
        assert_eq!(fs::read(&path).unwrap(), source);

        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn malformed_statistics_json_is_moved_to_a_backup() {
        let directory = test_directory("malformed");
        let path = directory.join("statistics.dev.json");
        let source = br#"{"daily":"#;

        fs::write(&path, source).unwrap();

        let backup = recover_statistics_file(&path).unwrap().unwrap();

        assert!(!path.exists());
        assert_eq!(fs::read(backup).unwrap(), source);

        fs::remove_dir_all(directory).unwrap();
    }

    fn test_directory(name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let directory = std::env::temp_dir().join(format!(
            "bongocat-statistics-{name}-{}-{nonce}",
            std::process::id()
        ));

        fs::create_dir_all(&directory).unwrap();

        directory
    }
}
