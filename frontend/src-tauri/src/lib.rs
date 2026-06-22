// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri_plugin_deep_link::DeepLinkExt;
use mdns_sd::{ServiceDaemon, ServiceEvent};
use std::time::Duration;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn discover_server() -> Result<String, String> {
    let mdns = ServiceDaemon::new().map_err(|e| e.to_string())?;
    let service_type = "_zesschess._tcp.local.";
    let receiver = mdns.browse(service_type).map_err(|e| e.to_string())?;

    let timeout = Duration::from_secs(5);
    let start = std::time::Instant::now();

    while start.elapsed() < timeout {
        if let Ok(event) = receiver.recv_timeout(Duration::from_millis(500)) {
            if let ServiceEvent::ServiceResolved(info) = event {
                let addresses: Vec<_> = info.get_addresses().iter().collect();

                // Ưu tiên địa chỉ RadminVPN (dải 26.x.x.x)
                if let Some(addr) = addresses.iter().find(|a| a.to_string().starts_with("26.")) {
                    return Ok(format!("{}:{}", addr, info.get_port()));
                }

                // Fallback: lấy địa chỉ đầu tiên nếu không tìm thấy dải 26.x
                if let Some(addr) = addresses.first() {
                    return Ok(format!("{}:{}", addr, info.get_port()));
                }
            }
        }
    }

    Err("No server found".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(
            tauri_plugin_single_instance::Builder::new()
                .callback(|app, args, cwd| {
                    println!("single-instance: {args:?} @ {cwd}");
                    let _ = app.deep_link().handle_cli_arguments(args.iter());
                })
                .build(),
        );
    }

    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
            #[cfg(target_os = "linux")]
            app.deep_link().register_all()?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, discover_server])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}