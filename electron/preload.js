// Preload: the only bridge between the sandboxed renderer (the web app) and the
// SQLite-owning main process. Exposes a small, explicit async API on
// window.desktopDB — the renderer can call these but has no other Node access.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopDB", {
  // Marker the app checks to know it is running under Electron (vs Android/browser).
  isDesktop: true,
  load: () => ipcRenderer.invoke("db:load"),
  saveItems: (items) => ipcRenderer.invoke("db:saveItems", items),
  saveWatchLog: (watchLog) => ipcRenderer.invoke("db:saveWatchLog", watchLog),
  savePreferences: (preferences) => ipcRenderer.invoke("db:savePreferences", preferences),
  wipe: () => ipcRenderer.invoke("db:wipe")
});
