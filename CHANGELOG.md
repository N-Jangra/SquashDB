# Changelog

All notable changes to SquashDB are documented in this file.

## [0.0.4]

### Show detail page (redesign)
- New native-app-style layout: poster/title header, a grouped "Tracking" card (Add to list, Status, Completion Date) reusing the app's bottom-sheet picker, and a pill-style season selector opening the same sheet.
- Episode rows now show a circular checkmark toggle, expand in place to reveal the synopsis when one exists, and open a full-image popup when the thumbnail is tapped — the show poster is tappable the same way.
- Star rating widget enlarged with a gold glow to match the active state.
- Topbar simplified to flat text links (`‹ Back` / category label); a delete icon replaces the old 3-dot menu, shown only while a title is still in Watchlist or In Progress.
- Fixed a bug where re-opening an already-tracked show from Discover created a duplicate entry instead of reusing the existing one — every metadata provider now carries a `providerId` used to detect this.

### Discover
- Added a per-category source filter (sliders icon next to the search bar): pick exactly which enabled sources a search should run against, down to just one. The choice is saved per category and persists across app restarts.
- Removed the separate Kdrama/Cdrama category chips — TVmaze has no first-class distinction for them, so searching "Series" now also surfaces Korean/Chinese dramas (still tagged with their real category once opened).

### Explore
- Now lists only currently-enabled metadata sources (previously showed every source, dimmed if disabled).
- Added a toolbox icon linking straight to Settings → Metadata Sources; Timeline/Statistics quick links moved below the sources grid, separated by a divider.

### Settings
- New **App Data** section: App Info (what the app does and how), Usage Guide (a walkthrough of every tab and setting, including a full per-page breakdown of Settings itself), Logcat (captured console/error logs with All/Info/Warnings/Errors filters and a clear button), Changelog (renders this file in-app), and a GitHub link.
- New **Font** setting: change the whole app's font. Six system stacks work fully offline; six Google Fonts download once, cache on-device via the Cache Storage API, and mirror to the backup folder (if one's configured) so they keep working offline afterward.
- Reordered the Appearance section: Theme, Font, Main Color, and Animation Speed (visual theming) now precede Dashboard View, Dashboard Row Actions, and Rating Format (dashboard-specific behavior).
- Icon pickers with long option lists (Bottom Menu Icons, Create New List) now scroll as a snapping horizontal carousel instead of wrapping into a tall grid.
- Every settings subpage's back button restyled to match the flat text-link topbar introduced on the show detail page.

### Backups
- Poster thumbnails synced to a backup folder are now accompanied by a `.nomedia` marker in `squash-db/`, so Android's media scanner stops surfacing them in the device photo gallery.

## [0.0.3]

### Discover (new search experience)
- New category-first Discover tab: pick a tracking category chip (same set as the Dashboard), see up to 15 top-rated suggestions immediately, then search scoped to just that category across every enabled metadata source in parallel — results merged and deduped by title.
- Each result card shows a badge naming the metadata source it came from.
- The selected category and typed query survive opening a result and coming back, instead of resetting to the first tab.
- Manga, novels, and games are now searchable online (previously only reachable through the old edit-modal's fetch button).

### Metadata sources (3 → 10 built-in)
- Added AniList, Jikan (MyAnimeList), and Kitsu for anime/manga, Google Books for novels/manga, OMDb and TMDB for movies/series, and RAWG for games — alongside the existing TVmaze, Wikidata, and Open Library.
- Sources that need a free API key (RAWG, OMDb, TMDB) ship disabled with a key field and sign-up link in Settings → Metadata Sources.
- Wikidata movie/game results now backfill poster images in one batched request (its search API returns no images).

### Show detail page (new)
- Full-page detail view for search results and tracked items: cover with wrap-around summary, release year/genres/runtime, network (Netflix, HBO...), a production-status badge (Running/Ended), and the item's metadata source.
- Season dropdown with a per-episode list (thumbnail, air date, runtime, rating, per-episode synopsis) — ticking an episode auto-marks all earlier ones watched, and the page opens on the first season that still has unwatched episodes.
- Status follows progress: ticking the final episode marks the item Completed with today's date; unticking below full (or starting from the watchlist) moves it to In Progress.
- "Add to list" picker (choose or correct the category), status, completion date, rating in your chosen format, and notes — all editable in place; volume/chapter progress fields for manga/novels.
- 3-dot menu with a delete action; opening a tracked TVmaze item online re-syncs its episodes and show metadata from the source.
- Movies, manga, and novels open this page from the Dashboard too (games keep the classic modal).

### Dashboard
- New **Dashboard View** setting: keep the list, or switch to a 3-column poster grid where each tile carries a progress strip — full purple for completed, green sized to progress for started items, none for untouched queue entries.
- List cards show a second meta line: genres, network, production status, and source.
- New status filter button in the search bar (filter by Watchlist / In Progress / Dropped / Completed etc. for the active category).

### Statistics
- Top Genres and Top Networks leaderboards, a local ratings summary with a top-rated list, weekly Time-Spent-Watching and Episodes-Watched column charts, and a Biggest Marathons board (most episodes of one show in a day) — powered by a new watch-event log recorded as you tick episodes.
- Durations escalate past hours into days, months, and years (e.g. "1d 4h", "2mo 15d").

### Navigation
- New **Explore** tab: quick links to Timeline and Statistics up top, then every metadata source as an icon tile grid; the standalone Sources page uses the same grid, and each source page offers search plus top-rated picks scoped to that source alone.
- New Settings → **Bottom Bar Layout** page: drag to reorder the bottom tabs and toggle which ones show. Explore stands in for Timeline/Sources/Statistics by default (bar becomes Dashboard · Discover · Explore · Settings); Timeline and Statistics share one slot outside Explore; Settings can never be hidden.
- Timeline and Statistics cross-link via floating buttons on each other's pages; Discover, Sources, and Explore all join the bottom-menu icon customization.
- Every settings subpage gets a compact circular back button at the top, matching the detail pages.

### Fixes
- Fixed in-app navigation silently stripping URL query strings (history.replaceState), which broke any page that relied on query parameters after the first render.
- Fixed the Android hardware back button and back-swipe gesture closing the app instead of navigating back (Capacitor never fires the legacy Cordova event the app was listening for).
- Fixed the metadata picker always showing a blank thumbnail for Wikidata game/movie matches even when an image existed.
- Fixed star-rating clicks being silently lost after the episode list rendered (icon re-processing detached the click handlers).

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
