# What's safe to delete or keep out of GitHub

Current folder size: ~1.4 GB. Breakdown and recommended action:

| Path | Size | Action |
|---|---|---|
| `build_env/` | **1.3 GB** | **Delete / never commit.** Locally-downloaded Android SDK + build tools (`android_sdk` 458M, `tools` 838M). Local dev dependency, not project source — huge, machine-specific, and regenerable. |
| `android/app/build/` | 26 MB | Gitignore. Standard Gradle build output, regenerated on every build. |
| `android/.gradle/` | 1.6 MB | Gitignore. Gradle's local cache. |
| `android/capacitor-cordova-android-plugins/build/` | 468 KB | Gitignore. Build output. |
| `node_modules/` | 21 MB | Gitignore. Regenerated via `npm install` from `package.json`. |
| `__pycache__/` | 24 KB | Gitignore/delete. Python bytecode cache. |
| `www/` | 564 KB | **Keep & commit.** Actual app source. |
| `android/` (minus build/.gradle) | ~1 MB | Keep & commit. Native project config/source. |

No `.gitignore` exists yet, and this folder is not yet a git repository.

## Next steps
1. Create a proper `.gitignore` (Android/Node/Capacitor template).
2. Delete `build_env/`, `node_modules/`, `__pycache__/`, and the Gradle build dirs from disk (or just untrack them if you'd rather keep them locally).
3. Run `git init` and make the first commit.
