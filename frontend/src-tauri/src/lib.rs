// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri_plugin_deep_link::DeepLinkExt;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
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
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
