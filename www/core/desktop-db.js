// Renderer-side desktop database helper.
//
// On the Electron desktop build, window.desktopDB is injected by preload.js and
// talks to a SQLite database in the main process. On Android and in the browser
// this object is absent, and every function here is a safe no-op so the same
// app.js code path works everywhere (it already keeps the localStorage mirror,
// which persists on desktop too — SQLite is the durable, per-item store on top).

function desktopDbAvailable() {
  return typeof window !== "undefined" && window.desktopDB && window.desktopDB.isDesktop === true;
}

// Returns { items, watchLog, preferences } or null when not on desktop.
async function desktopDbLoad() {
  if (!desktopDbAvailable()) return null;
  try {
    return await window.desktopDB.load();
  } catch (err) {
    console.warn("Desktop DB load failed", err);
    return null;
  }
}

async function desktopDbSaveItems(items) {
  if (!desktopDbAvailable()) return false;
  try { return await window.desktopDB.saveItems(items); }
  catch (err) { console.warn("Desktop DB saveItems failed", err); return false; }
}

async function desktopDbSaveWatchLog(watchLog) {
  if (!desktopDbAvailable()) return false;
  try { return await window.desktopDB.saveWatchLog(watchLog); }
  catch (err) { console.warn("Desktop DB saveWatchLog failed", err); return false; }
}

async function desktopDbSavePreferences(preferences) {
  if (!desktopDbAvailable()) return false;
  try { return await window.desktopDB.savePreferences(preferences); }
  catch (err) { console.warn("Desktop DB savePreferences failed", err); return false; }
}

async function desktopDbWipe() {
  if (!desktopDbAvailable()) return false;
  try { return await window.desktopDB.wipe(); }
  catch (err) { console.warn("Desktop DB wipe failed", err); return false; }
}
