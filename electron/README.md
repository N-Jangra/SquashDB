# SquashDB Desktop (Electron + SQLite)

The same web app in `www/` runs as a desktop app on Linux and Windows, storing
its data in a local SQLite database instead of the browser's `localStorage`.

## Architecture

- `electron/main.js` — main process. Creates the window, opens the SQLite
  database (`better-sqlite3`) at `<userData>/squashdb.db`, and registers IPC
  handlers for load / saveItems / saveWatchLog / savePreferences / wipe.
- `electron/preload.js` — exposes a small `window.desktopDB` API to the page via
  `contextBridge`. The renderer stays sandboxed (no Node, no direct FS).
- `www/core/desktop-db.js` — renderer-side helper. On desktop it calls
  `window.desktopDB`; on Android/browser every function is a safe no-op.
- `www/app.js` — `loadData()` reads SQLite first on desktop (refreshing the
  localStorage mirror for fast paints); `flushPendingSave()` writes changed
  domains to SQLite (per-item item writes, so no whole-DB rewrites).

The localStorage mirror is still used everywhere (Electron's Chromium persists
it), so the app works even before SQLite; SQLite is the durable store on top.

## Data model (JSON-per-row)

```sql
items(id TEXT PRIMARY KEY, data TEXT, updated INTEGER)  -- one row per tracked item
watch_log(id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT)
prefs(key TEXT PRIMARY KEY, value TEXT)                 -- 'preferences' row
```

Each row's `data`/`value` is the JSON of the existing in-memory object, so it is
a near drop-in. Normalize into typed columns later if you want richer SQL.

## Run in development

```bash
npm install
npm run electron:rebuild   # compile better-sqlite3 against Electron's ABI (once, and after Electron upgrades)
npm run electron
```

> `electron:rebuild` is required because `better-sqlite3` is a native module and
> Electron ships its own Node ABI. Skipping it causes a NODE_MODULE_VERSION error.

## Build installers

```bash
npm run dist:linux   # AppImage + .deb  -> dist-desktop/
npm run dist:win     # .exe (NSIS)      -> dist-desktop/   (build on Windows or CI)
npm run dist         # current platform
```

Windows binaries must be built on Windows (or CI with a Windows runner), because
the native `better-sqlite3` module is compiled per platform.

## Notes

- Android is unaffected: Capacitor uses `capacitor.config.json`, not the
  package.json `main` field. The Android encrypted store and desktop SQLite are
  separate; move data between them with the app's JSON export/import.
- Android-only plugins (backup folder, biometric) are simply absent on desktop;
  the code already guards for missing plugins.
