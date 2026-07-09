# SquashDB Documentation

SquashDB is a Capacitor-based watchlist/media-progress tracker that runs as an Android app (and can be opened as a plain web page). There is no server and no traditional database — the app is a static multi-page site (`www/*.html` + `app.js` + `metadata.js` + `applock.js`) backed by browser `localStorage`, with an optional file-based mirror on Android via a custom native plugin.

## Contents

- [db-schema.md](db-schema.md) — the `localStorage`-backed "database": `state.items`, `state.preferences`, and every individual key.
- [file-schema.md](file-schema.md) — the app's source directory layout, plus the on-device `squash-db/` folder tree and backup `.tar`/`.json` formats.
- [metadata.md](metadata.md) — how online metadata lookup works: built-in sources (TVmaze/Wikidata/Open Library) and the custom-source JSON-path mapping system.
- [storage.md](storage.md) — where data actually lives (localStorage vs. SAF folder vs. WebView HTTP cache vs. sessionStorage), persistence/eviction behavior, the backup/export/import/sync pipeline, and fresh-install auto-restore.
- [app-lock.md](app-lock.md) — the App Password feature: PIN/pattern/alphanumeric methods, PBKDF2 hashing, rate limiting, and the security-question recovery flow (with an explicit threat-model caveat).
- [app-walkthrough.md](app-walkthrough.md) — every page, every button/toggle/picker, and what it does.

## Quick orientation

- **No backend.** Everything runs client-side in the Android WebView (or a desktop browser for quick testing).
- **No SQL database.** "The database" is `state.items` and `state.preferences`, JSON-serialized into `localStorage`.
- **Native additions are two small custom Capacitor plugins**, not a full native rewrite:
  - `AppIconPlugin` — switches the Android launcher icon/name by enabling one pre-baked `activity-alias` out of a fixed grid (12 icon variants × 16 names).
  - `BackupFolderPlugin` — Storage Access Framework (SAF) folder picking, plain/nested/binary file I/O, and a from-scratch POSIX tar writer/reader for backups.
- **Multi-page, not a single-page app.** Every screen is its own `.html` file; `applock.js`, then `metadata.js`, then `app.js` are loaded on each page and re-derive UI state from `localStorage` on every load.
- **App lock is a UI gate, not encryption.** If a PIN/pattern/password is set (Settings → Security), it blocks the UI on every page load until unlocked, but the underlying data in `localStorage` is not encrypted — see [app-lock.md](app-lock.md) for the exact threat model.
