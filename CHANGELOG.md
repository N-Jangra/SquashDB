# Changelog

All notable changes to SquashDB are documented in this file.

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
