use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Mutex,
};
use std::time::{Duration, Instant};
use url::Url;

static SESSION_COUNTER: AtomicU64 = AtomicU64::new(1);

pub struct OAuthLoopbackState {
    listeners: Mutex<HashMap<String, (TcpListener, u16)>>,
}

impl Default for OAuthLoopbackState {
    fn default() -> Self {
        Self {
            listeners: Mutex::new(HashMap::new()),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoopbackStartResult {
    pub session_id: String,
    pub port: u16,
    pub redirect_uri: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoopbackCallbackResult {
    pub code: String,
    pub state: String,
    pub redirect_uri: String,
}

fn build_callback_html(title: &str, message: &str, is_error: bool) -> String {
    let accent = if is_error { "#DC2626" } else { "#4F46E5" };
    format!(
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"/>\
        <title>{title}</title>\
        <style>body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;\
        background:#f8fafc;color:#0f172a;display:flex;align-items:center;justify-content:center;\
        min-height:100vh;margin:0;padding:24px;}}main{{background:#fff;border:1px solid #e2e8f0;\
        border-radius:20px;padding:28px 32px;max-width:400px;text-align:center;\
        box-shadow:0 12px 32px rgba(15,23,42,.08);}}h1{{font-size:18px;margin:0 0 8px;color:{accent};}}\
        p{{font-size:14px;line-height:1.5;color:#475569;margin:0;}}</style></head>\
        <body><main><h1>{title}</h1><p>{message}</p></main></body></html>"
    )
}

fn write_http_response(stream: &mut std::net::TcpStream, status: &str, body: &str) {
    let response = format!(
        "HTTP/1.1 {status}\r\n\
        Content-Type: text/html; charset=utf-8\r\n\
        Content-Length: {}\r\n\
        Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'\r\n\
        Cache-Control: no-store\r\n\
        Connection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

#[tauri::command]
pub fn oauth_start_loopback(
    state: tauri::State<'_, OAuthLoopbackState>,
) -> Result<LoopbackStartResult, String> {
    // Strictly bind to loopback 127.0.0.1 on an OS-assigned ephemeral port
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind local OAuth callback listener: {e}"))?;
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("Failed to configure OAuth listener: {e}"))?;

    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to read local OAuth port: {e}"))?
        .port();

    let id = SESSION_COUNTER.fetch_add(1, Ordering::SeqCst);
    let session_id = format!("oauth_{port}_{id}");
    let redirect_uri = format!("http://localhost:{port}/callback");

    let mut guard = state
        .listeners
        .lock()
        .map_err(|_| "OAuth loopback state lock poisoned.".to_string())?;
    guard.insert(session_id.clone(), (listener, port));

    Ok(LoopbackStartResult {
        session_id,
        port,
        redirect_uri,
    })
}

#[tauri::command]
pub fn oauth_cancel_loopback(
    state: tauri::State<'_, OAuthLoopbackState>,
    session_id: String,
) -> Result<(), String> {
    let mut guard = state
        .listeners
        .lock()
        .map_err(|_| "OAuth loopback state lock poisoned.".to_string())?;
    // Dropping the TcpListener immediately shuts down the local port
    guard.remove(&session_id);
    Ok(())
}

#[tauri::command]
pub async fn oauth_wait_callback(
    state: tauri::State<'_, OAuthLoopbackState>,
    session_id: String,
    expected_state: String,
    timeout_secs: Option<u64>,
) -> Result<LoopbackCallbackResult, String> {
    let (listener, port) = {
        let mut guard = state
            .listeners
            .lock()
            .map_err(|_| "OAuth loopback state lock poisoned.".to_string())?;
        guard
            .remove(&session_id)
            .ok_or_else(|| "OAuth loopback session not found or already closed.".to_string())?
    };

    let redirect_uri = format!("http://localhost:{port}/callback");
    let timeout = Duration::from_secs(timeout_secs.unwrap_or(180).clamp(15, 300));

    tauri::async_runtime::spawn_blocking(move || {
        let deadline = Instant::now() + timeout;

        loop {
            if Instant::now() >= deadline {
                return Err("Sign-in timed out before the browser redirected back to JivanOS.".to_string());
            }

            match listener.accept() {
                Ok((mut stream, _addr)) => {
                    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
                    let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));

                    let mut buffer = [0u8; 8192];
                    let bytes_read = match stream.read(&mut buffer) {
                        Ok(n) if n > 0 => n,
                        _ => continue,
                    };

                    let request_str = String::from_utf8_lossy(&buffer[..bytes_read]);
                    let first_line = request_str.lines().next().unwrap_or("");
                    let mut parts = first_line.split_whitespace();
                    let method = parts.next().unwrap_or("");
                    let raw_target = parts.next().unwrap_or("/");

                    if method != "GET" {
                        let html = build_callback_html(
                            "Unsupported request",
                            "Please return to JivanOS and try connecting again.",
                            true,
                        );
                        write_http_response(&mut stream, "405 Method Not Allowed", &html);
                        continue;
                    }

                    let parsed_url = match Url::parse(&format!("http://localhost:{port}{raw_target}")) {
                        Ok(u) => u,
                        Err(_) => continue,
                    };

                    // Ignore browser /favicon.ico requests and keep listening for /callback
                    if parsed_url.path() != "/callback" && parsed_url.path() != "/" {
                        let html = build_callback_html("Not found", "Waiting for OAuth callback.", true);
                        write_http_response(&mut stream, "404 Not Found", &html);
                        continue;
                    }

                    let params: HashMap<String, String> = parsed_url
                        .query_pairs()
                        .map(|(k, v)| (k.into_owned(), v.into_owned()))
                        .collect();

                    if let Some(oauth_err) = params.get("error") {
                        let html = build_callback_html(
                            "Sign-in cancelled",
                            "Authorization was not granted. You can close this window and return to JivanOS.",
                            true,
                        );
                        write_http_response(&mut stream, "200 OK", &html);
                        return Err(format!("Authorization failed: {oauth_err}"));
                    }

                    let returned_state = params.get("state").cloned().unwrap_or_default();
                    if returned_state.is_empty() || returned_state != expected_state {
                        let html = build_callback_html(
                            "Security verification failed",
                            "The sign-in state token did not match. Please restart sign-in in JivanOS.",
                            true,
                        );
                        write_http_response(&mut stream, "400 Bad Request", &html);
                        return Err("OAuth state mismatch. Please retry sign-in.".to_string());
                    }

                    let code = params.get("code").cloned().unwrap_or_default();
                    if code.is_empty() {
                        let html = build_callback_html(
                            "Missing authorization code",
                            "No authorization code was returned. Please retry from JivanOS.",
                            true,
                        );
                        write_http_response(&mut stream, "400 Bad Request", &html);
                        return Err("Provider did not return an authorization code.".to_string());
                    }

                    let html = build_callback_html(
                        "Connected to JivanOS",
                        "Sign-in complete. You can safely close this browser tab and return to JivanOS.",
                        false,
                    );
                    write_http_response(&mut stream, "200 OK", &html);

                    // Listener drops immediately upon returning, shutting down the local port
                    return Ok(LoopbackCallbackResult {
                        code,
                        state: returned_state,
                        redirect_uri,
                    });
                }
                Err(ref err) if err.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(60));
                }
                Err(err) => {
                    return Err(format!("Local OAuth callback listener error: {err}"));
                }
            }
        }
    })
    .await
    .map_err(|_| "OAuth callback task terminated unexpectedly.".to_string())?
}
