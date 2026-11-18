# Changelog

All notable changes to **JivanOS** (`https://github.com/Jaizm6/JivanOS`) are documented in this file.

---

## [3.0.0] — 2026-11-18

### Android APK & Release Pipeline
- **In-Place APK Upgrades (`com.jivanos.lifesystem`)**: Pinned deterministic Android APK signing (`signingConfigs.debug` and `signingConfigs.release` in `.github/workflows/build-android-apk.yml`) using the repository's base64 keystore so every release from `v3.0.0` onward installs cleanly over the previous version without signature conflict errors.
- **Versioned Release Automation**: Automated `versionCode` (`30000 + GITHUB_RUN_NUMBER`) and `versionName` (`3.0.<run>`) generation with `apksigner` certificate verification during GitHub Actions builds.
- **One-Time Migration Note**: Users upgrading from legacy `v2.1.x` builds should export a local JSON backup (or sync to a drive), uninstall `v2.1.x` once, and install `v3.0.0`. All future updates from `v3.0.0+` upgrade seamlessly in place.

### Joplin-Style Multi-Drive Sync & Local-First Storage
- **Zero-Login `JivanOS Private Vault`**: Added device-to-device synchronization powered by a generated Pairing Key + optional Vault PIN — works across Android APK, iOS PWA, Windows, macOS, and Linux without requiring Google login or personal account credentials.
- **Multi-Drive Synchronization Targets**: Support for Microsoft OneDrive, Google Drive (App Data Folder), Dropbox, Nextcloud (WebDAV), generic WebDAV / Koofr / Home NAS, S3-compatible object storage (AWS S3, Cloudflare R2, MinIO, Backblaze B2), Local / Syncthing Folder, and optional JivanOS Cloud (Firebase).
- **Live Configuration Diagnostics**: Added real **Check Configuration** endpoint and credential verification before syncing, eliminating silent failures and misleading status feedback (`BackupModal.tsx` truthy-object fix).
- **Automatic Sync & Multi-Drive Auto-Backup Mirrors**: Debounced auto-sync on edits, launch pull checks, configurable background intervals (`5`, `15`, `30`, `60` min), client-side AES-256 E2EE passphrase encryption, and mirrored backups across enabled secondary drives.
- **Bidirectional Personal Profile Sync**: Optional toggle to sync avatar photo (auto-compressed WebP), full name, nickname, DOB, gender, height/weight metrics, preferred currency, and bio across connected devices.

### Settings, Auth UX & Brand Overhaul
- **Redesigned Settings & Profile Hub**: Rebuilt the Synchronization & Storage section and Account Profile section (`SettingsManager.tsx`) with live drive testing, primary sync target selection, health metrics, currency picker, inline Google Auth error reporting, and full Capacitor WebView guidance.
- **New JivanOS Identity**: Replaced all legacy hexagonal marks and outdated third-party inspiration tags with the geometric JivanOS `"J"` emblem across web favicons, PWA icons (`192x192`, `512x512`, `maskable`), sidebar, and settings.
- **Clock & Calendar Layout Polish**: Fixed AM/PM pill alignment on the clock divider line, adjusted month label formatting (preventing `"Novem..."` truncation), and improved responsive spacing across mobile and desktop viewports.

---

## [2.1.7] — Legacy Signed Build Lineage
- Prior Android release build (`com.jivanos.lifesystem`) built before deterministic CI signing keystore pinning.
- Introduced Material 3 Expressive themes, Sound Synthesizer channels, Eisenhower Matrix, Medication dose logs, Hydration adaptive reminders, and Universal Export Hub.

## [2.0.0] — Cross-Platform Life OS Foundation
- Local-first productivity, habits, schedule timeline, Pomodoro focus timer, multi-currency bills, goals, and encrypted client-side vault lock.
