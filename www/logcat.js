// SquashDB - Logcat: captures console.log/warn/error/info and uncaught errors
// into a bounded ring buffer in localStorage, since every page here is a full
// navigation (not an SPA) — an in-memory buffer would reset on every page
// load. Must load before any other script on every page so nothing is missed.
// Read by logcat.html (Settings → App Data → Logcat).

(function () {
  const STORAGE_KEY = "squashdb_logcat";
  const MAX_ENTRIES = 500;

  function readEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function writeEntries(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) { /* storage full/unavailable — drop silently, logging must never crash the app */ }
  }

  function stringifyArg(arg) {
    if (typeof arg === "string") return arg;
    if (arg instanceof Error) return `${arg.name}: ${arg.message}${arg.stack ? `\n${arg.stack}` : ""}`;
    try {
      return JSON.stringify(arg);
    } catch (e) {
      return String(arg);
    }
  }

  function appendEntry(level, args) {
    const entries = readEntries();
    entries.push({
      level,
      message: Array.from(args).map(stringifyArg).join(" "),
      page: (window.location.pathname.split("/").pop() || "").replace(".html", "") || "app",
      time: Date.now()
    });
    while (entries.length > MAX_ENTRIES) entries.shift();
    writeEntries(entries);
  }

  ["log", "info", "warn", "error"].forEach(level => {
    const original = console[level] ? console[level].bind(console) : () => {};
    console[level] = function (...args) {
      appendEntry(level === "log" ? "info" : level, args);
      original(...args);
    };
  });

  window.addEventListener("error", (event) => {
    appendEntry("error", [event.message || "Uncaught error", event.filename ? `(${event.filename}:${event.lineno})` : ""]);
  });

  window.addEventListener("unhandledrejection", (event) => {
    appendEntry("error", ["Unhandled promise rejection:", event.reason]);
  });

  window.squashdbLogcat = {
    getEntries: readEntries,
    clear: () => writeEntries([])
  };
})();
