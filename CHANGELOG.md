# Changelog

All notable changes to SquashDB are documented in this file.

## [0.0.2]

### File-based backups (Android)
- New native plugin (`BackupFolderPlugin`) for Storage Access Framework (SAF) folder picking, plain/nested/binary file I/O, and a from-scratch POSIX (ustar) tar writer/reader — no third-party library.
- **Folder-tree mirror**: enabling a backup folder mirrors every tracked item into `squash-db/<category>/<item-slug>/index.json` + `thumbnail.webp` (thumbnail fetched and re-encoded to WebP), additive-only — items removed in-app are never deleted from the mirror.
- **Full tar backups**: Export now writes a single `squashdb_backup_<date>.tar` containing the entire `squash-db/` tree plus the state JSON, as a sibling of `squash-db/` in the chosen folder. Falls back to a plain `.json` download on non-native/desktop.
- **Import** accepts both `.json` and `.tar` (previously JSON-only); always merges by item ID, never overwrites existing items.
- **Daily auto-backup**: on app launch, if 24+ hours have passed since the last auto-backup and there are tracked items, writes a new tar snapshot automatically and prunes old ones, keeping only the newest 3 backup dates.
- **Auto-restore**: on a fresh install (or whenever the app has zero items), picking a folder that already contains a dated backup file or a raw `squash-db/` tree from a previous install offers to restore from it.
- Settings → Backup & Sync now shows the resolved folder path (e.g. `/Documents/SquashBackups`) so you can confirm sync/export/import are targeting the folder you expect, plus a **Folder Sync Delay** picker (Immediately / 5s / 10s / 30s / 1 minute) controlling how long after an edit the app waits before auto-syncing.
- A silent startup check flags (without an intrusive popup) if the saved backup folder has become invalid/inaccessible.

### Custom metadata sources
- Built-in sources (TVmaze, Wikidata, Open Library) can now be individually enabled/disabled and drag-reordered from Settings → Metadata Sources.
- Add your own metadata source: a search URL template (`{query}`/`{apiKey}` placeholders), an optional API key, and field mappings captured visually — paste a sample response and click through its JSON tree to mark the results array, title, thumbnail, and subtitle fields, instead of hand-typing paths.

### App lock (App Password)
- New Settings → Security section with an app-wide lock: PIN (4+ digits), pattern (3×3 grid, 2+ dots — no stock-Android 4-dot minimum), alphanumeric password, or none.
- Secrets are hashed (PBKDF2-SHA256, salted, never stored in plain text) and gate every page behind a full-screen lock screen shown once per app session.
- Rate limiting: after 5 wrong attempts, a "Forgot password?" option appears, backed by 3 required security questions (also hashed) that let you set a new password without a hard lockout.
- This deters casual snooping only — the underlying data is not encrypted, only gated behind the lock screen.

### Performance
- Dashboard and Timeline now render items in batches of 30 via `IntersectionObserver`, loading more as you scroll, instead of building every card up front — keeps large libraries responsive.

### Appearance
- New **Animation Speed** setting (Off / Fast / Normal / Slow) scales every CSS transition and animation app-wide via a shared `--anim-speed` variable, including the boot splash.
- The boot splash now holds for a minimum ~1.5 seconds (scaled by Animation Speed) instead of redirecting immediately, so it's actually visible on fast devices.
- Settings reorganized from 4 sections into 6 focused ones: **Appearance**, **App Identity**, **Tracking**, **Metadata**, **Backup & Sync**, **Security**.

### App icon (Android)
- Added 8 new illustrated launcher icon choices: Bento Grid, Glass Impact, Play Stack, Progress Ring, Vault, Orbit Hub, Progress Vault, Timeline Pulse — each crossed with all 16 app-name presets, same as the existing icons.
- Removed the Purple icon and the "invisible" icon experiment (fully-transparent icons render as a solid black fallback tile on many Android launchers, so it never actually looked invisible).
- Fixed the Classic icon and its base app icon still being the generic placeholder art from Capacitor's project scaffolding — now uses the real SquashDB logo.
- Turquoise remains the default-enabled icon.

### Fixes
- Fixed backup export/import silently failing or producing unreadable files on native Android (previously relied on browser-only file APIs that don't work reliably inside the Capacitor WebView).
- Fixed auto-restore never finding existing data when a previous install had only auto-synced (no dated backup file at the folder root) — it now also detects and offers to restore from a raw `squash-db/` tree.

## [0.0.1]

### Tracking & categories
- Track progress across 8 built-in categories: Game, Movie, TV Series, K-Drama, C-Drama, Manga, Anime, Novel — each with its own status list.
- Create custom tracking lists (name, icon, and status set) from Settings → Tracking Choices, in addition to the built-in categories.
- Delete custom lists (blocked if the list still has tracked items, to prevent accidental data loss).
- Enable/disable individual lists, and drag-to-reorder enabled lists from Settings → Category Order (only shows currently-enabled lists).
- Default install ships with TV Series, Movies, Anime, and Novel enabled; Game, K-Drama, C-Drama, and Manga are available but off by default.

### Item details
- Per-season episode tracking for Series/K-Drama/C-Drama/Anime: total/watched episodes per season, a checkbox in front of each season name that strikes through the season and auto-fills watched = total, and a "Seasons Watched" field that auto-ticks that many seasons at once.
- Volume/chapter tracking for Manga and Novel.
- Movie/game runtime entered as separate **Hours** and **Minutes** fields (instead of a single minutes field), stored internally as total minutes.
- Ratings, notes, completion dates, and category-specific status lists.

### Metadata lookup (optional, online mode)
- Fetch metadata from TVmaze (TV/anime), Wikidata (movies/games), and Open Library (manga/novels) to auto-fill thumbnails, season/episode counts, and runtime.
- Metadata lookup logic lives in its own module (`www/metadata.js`), separate from the main app logic.

### Dashboard & timeline
- List-only dashboard view (grid mode removed) with checkbox, thumbnail, title, category tag, and a 3-dot action menu per item.
- Timeline view now shows item thumbnails (when Metadata Thumbnails is on) alongside completion history.
- Removed the colored accent strip from the left edge of dashboard item cards.

### Appearance & navigation
- Customizable bottom navigation bar icons (16 choices each for Dashboard, Timeline, Stats, and Settings tabs).
- Bottom nav no longer shows a background "pill" behind the active tab — only the icon color changes.
- Settings reorganized into **Appearance** (renamed from "App Appearance"), a new **App** section (App Icon, App Name, Bottom Menu Icons), and **General**.

### Custom app icon & name (Android)
- Switch the home screen app icon between 5 presets: Classic, Turquoise, Purple, Orange, Pink (Settings → App Icon).
- Switch the home screen app name between 16 presets, sorted alphabetically: Backlog, Binge Log, Checklist, ListKeeper, My Files, My Lists, My Watchlist, Notes, Reminders, Splash, SquashDB, Squid, ToWatch, Tracker, Vault, Watchlist (Settings → App Name).
- Icon and name can be changed independently without resetting each other; applying a change briefly restarts the app.
- Implemented via a native Capacitor plugin (`AppIconPlugin`) and pre-baked Android `activity-alias` entries (no effect outside the installed Android app).

### Backups
- Export all tracked data to a JSON file and re-import it later (Settings → Backups & Restore).
- Wipe all data option.

### Fixes
- Fixed several broken bottom-nav icon names that didn't exist in the bundled icon set.
- Fixed number inputs not filling their container width, which could cause fields (e.g. "Watched" episode count) to visually overflow outside their card on narrow screens.
- Fixed the Episodes-per-Season form collapsing awkwardly on small screens.
- Fixed spacing between the fetched-metadata preview and the fields below it (Total Seasons, Runtime, etc.).
- Fixed adaptive icon artwork being cropped too tightly on some Android launchers with aggressive icon shaping, exposing white background around colored icon variants.
- Fixed GitHub Actions CI workflow failing on `npx cap add android` when the Android platform is already committed to the repo.
- Removed the non-functional "App Language" setting (previously did not translate any UI text).

### Build & tooling
- `compile_apk.py`: self-contained local build script that downloads its own Node/JDK/Android SDK and builds a versioned debug APK (`python3 compile_apk.py --version x.y.z`).
- GitHub Actions workflow to build a debug APK on push to `main`/`master` or on manual trigger, uploaded as a build artifact.
