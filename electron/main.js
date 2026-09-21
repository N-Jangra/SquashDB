// Electron main process for the SquashDB desktop app (Linux / Windows).
//
// The renderer (the existing web app in www/) stays sandboxed: no Node, no
// direct filesystem. All durable data lives in a SQLite database owned by this
// main process, reached from the page through the contextBridge API defined in
// preload.js and the IPC handlers registered below.
//
// Storage model mirrors the app's three data domains as JSON-per-row tables:
//   items(id TEXT PRIMARY KEY, data JSON, updated INTEGER)
//   watch_log(id INTEGER PRIMARY KEY AUTOINCREMENT, data JSON)
//   prefs(key TEXT PRIMARY KEY, value JSON)
// This is a near drop-in for the current in-memory objects and already gives
// per-item writes instead of whole-database rewrites.

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");

let Database;
try {
  Database = require("better-sqlite3");
} catch (err) {
  // Surfaced clearly instead of a cryptic crash if the native module is missing.
  console.error("better-sqlite3 is not installed / not rebuilt for Electron.", err);
}

let db = null;

function openDatabase() {
  if (!Database) return null;
  const dbPath = path.join(app.getPath("userData"), "squashdb.db");
  const database = new Database(dbPath);
  database.pragma("journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated INTEGER
    );
    CREATE TABLE IF NOT EXISTS watch_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS prefs (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return database;
}

// ---- IPC handlers: the desktop "database bridge" ---------------------------

function registerIpc() {
  // Read the whole dataset at startup (fast: three table scans).
  ipcMain.handle("db:load", () => {
    if (!db) return { items: [], watchLog: [], preferences: null };
    const items = db.prepare("SELECT data FROM items").all().map(r => JSON.parse(r.data));
    const watchLog = db.prepare("SELECT data FROM watch_log ORDER BY id").all().map(r => JSON.parse(r.data));
    const prefsRow = db.prepare("SELECT value FROM prefs WHERE key = 'preferences'").get();
    const preferences = prefsRow ? JSON.parse(prefsRow.value) : null;
    return { items, watchLog, preferences };
  });

  // Persist items with per-row diffing: upsert changed/new rows, delete removed.
  ipcMain.handle("db:saveItems", (_e, items) => {
    if (!db || !Array.isArray(items)) return false;
    const upsert = db.prepare(
      "INSERT INTO items (id, data, updated) VALUES (@id, @data, @updated) " +
      "ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated = excluded.updated"
    );
    const delStmt = db.prepare("DELETE FROM items WHERE id = ?");
    const tx = db.transaction((list) => {
      const keep = new Set();
      for (const item of list) {
        if (item == null || item.id == null) continue;
        const id = String(item.id);
        keep.add(id);
        upsert.run({ id, data: JSON.stringify(item), updated: Number(item.updated || item.lastUpdated || item.created) || 0 });
      }
      for (const row of db.prepare("SELECT id FROM items").all()) {
        if (!keep.has(row.id)) delStmt.run(row.id);
      }
    });
    tx(items);
    return true;
  });

  // Watch log is append-heavy and small; rewrite it wholesale in one transaction.
  ipcMain.handle("db:saveWatchLog", (_e, watchLog) => {
    if (!db || !Array.isArray(watchLog)) return false;
    const ins = db.prepare("INSERT INTO watch_log (data) VALUES (?)");
    const tx = db.transaction((list) => {
      db.prepare("DELETE FROM watch_log").run();
      for (const entry of list) ins.run(JSON.stringify(entry));
    });
    tx(watchLog);
    return true;
  });

  ipcMain.handle("db:savePreferences", (_e, preferences) => {
    if (!db) return false;
    db.prepare(
      "INSERT INTO prefs (key, value) VALUES ('preferences', @value) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run({ value: JSON.stringify(preferences || {}) });
    return true;
  });

  ipcMain.handle("db:wipe", () => {
    if (!db) return false;
    db.exec("DELETE FROM items; DELETE FROM watch_log; DELETE FROM prefs;");
    return true;
  });
}

// ---- Window ----------------------------------------------------------------

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: "#000000",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,   // renderer cannot touch Node directly
      nodeIntegration: false,
      sandbox: false            // preload needs require(); page stays isolated
    }
  });

  // Open external links (GitHub, metadata provider pages) in the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  win.loadFile(path.join(__dirname, "..", "www", "index.html"));
}

app.whenReady().then(() => {
  db = openDatabase();
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (db) { try { db.close(); } catch (e) {} }
  if (process.platform !== "darwin") app.quit();
});
