// SquashDB - App logic

// Icon choices offered when creating a custom tracking category
const CATEGORY_ICON_CHOICES = [
  "list", "star", "bookmark", "heart", "tag", "package", "layers",
  "gamepad-2", "film", "tv", "book-open", "clapperboard", "book",
  "music", "camera", "palette", "shirt", "utensils", "dumbbell", "map"
];

// Default status set used for custom categories
const DEFAULT_CUSTOM_STATUSES = ["Backlog", "In Progress", "On Hold", "Dropped", "Completed"];

// Categories tracked by season/episode (TVmaze-backed) rather than volumes/chapters/playtime
const EPISODE_TRACKED_CATEGORIES = ["series", "kdrama", "cdrama", "anime"];

// Built-in category configuration
const BUILTIN_CATEGORIES = {
  game: {
    label: "Game",
    color: "#10b981",
    icon: "gamepad-2",
    statuses: ["Backlog", "Playing", "On Hold", "Dropped", "Completed"]
  },
  movie: {
    label: "Movie",
    color: "#f43f5e",
    icon: "film",
    statuses: ["Watchlist", "In Progress", "On Hold", "Dropped", "Completed"]
  },
  series: {
    label: "TV Series",
    color: "#8b5cf6",
    icon: "tv",
    statuses: ["Watchlist", "In Progress", "On Hold", "Dropped", "Completed"]
  },
  kdrama: {
    label: "K-Drama",
    color: "#a855f7",
    icon: "tv",
    statuses: ["Watchlist", "In Progress", "On Hold", "Dropped", "Completed"]
  },
  cdrama: {
    label: "C-Drama",
    color: "#22c55e",
    icon: "tv",
    statuses: ["Watchlist", "In Progress", "On Hold", "Dropped", "Completed"]
  },
  manga: {
    label: "Manga",
    color: "#f59e0b",
    icon: "book-open",
    statuses: ["Reading", "On Hold", "Dropped", "Completed", "Plan to Read"]
  },
  anime: {
    label: "Anime",
    color: "#0ea5e9",
    icon: "clapperboard",
    statuses: ["Watchlist", "In Progress", "On Hold", "Dropped", "Completed"]
  },
  novel: {
    label: "Novel",
    color: "#ec4899",
    icon: "book",
    statuses: ["Reading", "On Hold", "Dropped", "Completed", "Plan to Read"]
  }
};

// Palette cycled through when assigning a color to a new custom category
const CUSTOM_CATEGORY_COLORS = ["#14b8a6", "#f97316", "#6366f1", "#eab308", "#06b6d4", "#d946ef", "#84cc16", "#e11d48"];

// Merged map of built-in + user-created categories (rebuilt by rebuildCategories())
let CATEGORIES = { ...BUILTIN_CATEGORIES };

function rebuildCategories() {
  CATEGORIES = { ...BUILTIN_CATEGORIES, ...(state.preferences.customCategories || {}) };
}

function slugifyCategoryName(name) {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  let key = base || "list";
  let suffix = 1;
  while (CATEGORIES[key]) {
    key = `${base || "list"}-${++suffix}`;
  }
  return key;
}

function createCustomCategory({ label, icon, statuses }) {
  const key = slugifyCategoryName(label);
  const color = CUSTOM_CATEGORY_COLORS[Object.keys(state.preferences.customCategories || {}).length % CUSTOM_CATEGORY_COLORS.length];
  if (!state.preferences.customCategories) state.preferences.customCategories = {};
  state.preferences.customCategories[key] = {
    label: label.trim(),
    color,
    icon: icon || "list",
    statuses: (statuses && statuses.length) ? statuses : DEFAULT_CUSTOM_STATUSES,
    custom: true
  };
  rebuildCategories();
  state.preferences[key] = true;
  if (!state.preferences.categoryOrder.includes(key)) {
    state.preferences.categoryOrder.push(key);
  }
  saveData();
  return key;
}

function categoryHasItems(key) {
  return state.items.some(item => item.category === key);
}

function deleteCustomCategory(key) {
  if (!CATEGORIES[key] || !CATEGORIES[key].custom) return { ok: false, reason: "Only custom lists can be deleted." };
  if (categoryHasItems(key)) return { ok: false, reason: "This list still has tracked items. Remove or move them first." };
  delete state.preferences.customCategories[key];
  delete state.preferences[key];
  state.preferences.categoryOrder = state.preferences.categoryOrder.filter(k => k !== key);
  if (state.activeCategoryChip === key) state.activeCategoryChip = null;
  rebuildCategories();
  saveData();
  return { ok: true };
}

// Application State
let state = {
  items: [],
  watchLog: [],
  preferences: {
    game: false,
    movie: true,
    series: true,
    kdrama: false,
    cdrama: false,
    manga: false,
    anime: true,
    novel: true,
    customCategories: {},
    categoryOrder: ["series", "movie", "anime", "novel", "game", "kdrama", "cdrama", "manga"],
    defaultStartPage: "remember-last",
    ratingFormat: "5-stars",
    uiTheme: "dark",
    mainColor: "normal",
    dashboardRowActions: "menu",
    dashboardView: "list",
    metadataMode: "offline",
    metadataThumbnails: true,
    folderSyncDelay: "30000",
    animationSpeed: "normal",
    metadataSources: {
      builtinOrder: ["tvmaze", "wikidata", "openlibrary"],
      builtinEnabled: { tvmaze: true, wikidata: true, openlibrary: true },
      custom: []
    },
    navIcons: {
      dashboard: "layout-grid",
      timeline: "calendar",
      discover: "search",
      sources: "database",
      stats: "pie-chart",
      settings: "settings"
    },
    appLook: "default",
    appLock: {
      method: "none",           // "none" | "pin" | "pattern" | "alphanumeric"
      passwordHash: "",         // hex PBKDF2 hash of the PIN/pattern/password
      passwordSalt: "",         // hex random salt used for passwordHash
      securityQuestions: []     // [{ question, answerHash, answerSalt }, ...] (exactly 3 once set)
    }
  },
  theme: "dark",
  currentTab: "tab-dashboard",
  activeCategoryChip: null,
  statusFilter: "all",
  currentSort: "alphabetical-asc",
  lastEntryCategory: "game",
  searchQuery: "",
  timelineFilter: "all",
  timelineSearch: "",
  timelineMonth: "",
  timelineYear: "",
  activeRating: 0 // temp rating state for form
};

function thumbnailsEnabled() {
  return Boolean(state.preferences.metadataThumbnails);
}

// Every thumbnail slot is compulsory: real image if we have one and thumbnails
// are enabled, otherwise a "not found" placeholder icon — never an empty slot.
function thumbnailOrPlaceholder(thumbnailUrl, className) {
  if (thumbnailsEnabled() && thumbnailUrl) {
    return `<img class="${className}" src="${thumbnailUrl}" alt="" loading="lazy">`;
  }
  return `<span class="${className} thumb-placeholder" title="No thumbnail found"><i data-lucide="image-off"></i></span>`;
}

// Display name of the metadata source an item was tracked from. Items saved
// before the metadataSource field existed only leave a TVmaze id as a clue.
function itemSourceName(item) {
  const key = item.metadataSource || (item.tvmazeShowId ? "tvmaze" : "");
  if (!key) return "";
  return (typeof BUILTIN_METADATA_SOURCES !== "undefined" && BUILTIN_METADATA_SOURCES[key]?.name) || key;
}

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  loadData();

  // If a lock method is set and this session hasn't been unlocked yet, block all
  // further rendering until a correct PIN/pattern/password (or a security-question
  // reset) unlocks the session — see applock.js.
  if (guardAppLock()) {
    document.addEventListener("app-unlocked", runAppInit, { once: true });
    return;
  }
  runAppInit();
});

function runAppInit() {
  applyTheme();
  setupEventListeners();
  setupAppNavigation();
  setupPageBackButtons();
  setupHardwareBackButton();
  setupPickerModal();
  updateLayoutToggleButtons();
  initializePage();
  updateFabVisibility();
  updateSearchVisibility();
  updateCategoryChipVisibility();
  updateSettingsUI();
  applyNavIcons();
  checkBackupFolderOnStartup();
  renderNavIconPickers();
  renderAppIconPicker();
  lucide.createIcons();
}

window.addEventListener("pagehide", flushPendingSave);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushPendingSave();
});

// Load data from LocalStorage
function loadData() {
  const savedItems = localStorage.getItem("squashdb_items");
  if (savedItems) {
    try {
      state.items = JSON.parse(savedItems);
    } catch (e) {
      console.error("Error parsing items from local storage", e);
      state.items = [];
    }
  }

  const savedWatchLog = localStorage.getItem("squashdb_watch_log");
  if (savedWatchLog) {
    try {
      state.watchLog = JSON.parse(savedWatchLog);
    } catch (e) {
      console.error("Error parsing watch log from local storage", e);
      state.watchLog = [];
    }
  }

  const savedPrefs = localStorage.getItem("squashdb_prefs");
  if (savedPrefs) {
    try {
      state.preferences = { ...state.preferences, ...JSON.parse(savedPrefs) };
    } catch (e) {
      console.error("Error parsing preferences", e);
    }
  }
  if (!state.preferences.customCategories || typeof state.preferences.customCategories !== "object") {
    state.preferences.customCategories = {};
  }
  rebuildCategories();

  if (!Array.isArray(state.preferences.categoryOrder) || state.preferences.categoryOrder.length === 0) {
    state.preferences.categoryOrder = ["series", "movie", "anime", "novel", "game", "kdrama", "cdrama", "manga"];
  }
  state.preferences.categoryOrder = state.preferences.categoryOrder.filter(key => CATEGORIES[key]);
  Object.keys(CATEGORIES).forEach(key => {
    if (!state.preferences.categoryOrder.includes(key)) {
      state.preferences.categoryOrder.push(key);
    }
  });
  if (!state.preferences.defaultStartPage) {
    state.preferences.defaultStartPage = "remember-last";
  }
  if (!state.preferences.ratingFormat) state.preferences.ratingFormat = "5-stars";
  if (!state.preferences.uiTheme) state.preferences.uiTheme = "dark";
  if (!state.preferences.mainColor) state.preferences.mainColor = "normal";
  if (!state.preferences.dashboardRowActions) state.preferences.dashboardRowActions = "menu";
  if (!["list", "grid"].includes(state.preferences.dashboardView)) state.preferences.dashboardView = "list";
  if (!state.preferences.metadataMode) state.preferences.metadataMode = "offline";
  if (typeof state.preferences.metadataThumbnails !== "boolean") state.preferences.metadataThumbnails = true;
  if (!["0", "5000", "10000", "30000", "60000"].includes(String(state.preferences.folderSyncDelay))) {
    state.preferences.folderSyncDelay = "30000";
  }
  if (!["off", "fast", "normal", "slow"].includes(state.preferences.animationSpeed)) {
    state.preferences.animationSpeed = "normal";
  }
  normalizeMetadataSources();
  normalizeAppLock();
  if (!state.preferences.navIcons || typeof state.preferences.navIcons !== "object") {
    state.preferences.navIcons = { dashboard: "layout-grid", timeline: "calendar", discover: "search", sources: "database", stats: "pie-chart", settings: "settings" };
  }
  state.preferences.navIcons = {
    dashboard: state.preferences.navIcons.dashboard || "layout-grid",
    timeline: state.preferences.navIcons.timeline || "calendar",
    discover: state.preferences.navIcons.discover || "search",
    sources: state.preferences.navIcons.sources || "database",
    stats: state.preferences.navIcons.stats || "pie-chart",
    settings: state.preferences.navIcons.settings || "settings"
  };

  const savedTheme = localStorage.getItem("squashdb_theme");
  if (savedTheme) {
    state.theme = savedTheme;
  }
  state.theme = state.preferences.uiTheme || state.theme;
  state.preferences.uiTheme = localStorage.getItem("squashdb_ui_theme") || state.preferences.uiTheme;
  state.preferences.mainColor = localStorage.getItem("squashdb_main_color") || state.preferences.mainColor;
  state.preferences.ratingFormat = localStorage.getItem("squashdb_rating_format") || state.preferences.ratingFormat;
  applyPreferenceAttributes();

  const savedSort = localStorage.getItem("squashdb_sort");
  if (savedSort) {
    state.currentSort = savedSort;
  }

  const savedChip = localStorage.getItem("squashdb_category_chip");
  if (savedChip) {
    state.activeCategoryChip = savedChip;
  }

  const savedTimelineFilter = localStorage.getItem("squashdb_timeline_filter");
  if (savedTimelineFilter) {
    state.timelineFilter = savedTimelineFilter;
  }
  if (state.timelineFilter === "today") {
    state.timelineFilter = "all";
  }

  const savedLastCategory = localStorage.getItem("squashdb_last_entry_category");
  if (savedLastCategory) {
    state.lastEntryCategory = savedLastCategory;
  }

  const savedLastTab = localStorage.getItem("squashdb_last_tab");
  if (savedLastTab && document.querySelector(`.nav-item[data-tab="${savedLastTab}"]`)) {
    state.currentTab = savedLastTab;
  } else if (state.preferences.defaultStartPage && state.preferences.defaultStartPage !== "remember-last") {
    state.currentTab = state.preferences.defaultStartPage;
  }

  if (!state.activeCategoryChip) {
    state.activeCategoryChip = "series";
  }

}

function initializePage() {
  const pageTab = getCurrentPageTab();

  if (pageTab) {
    state.currentTab = pageTab;
    renderCategoryChips();
    renderCategorySelectOptions();
    switchTab(pageTab);
    if (pageTab === "tab-dashboard") {
      renderDashboard();
    }
  }

  // Standalone manage pages and shared page widgets
  renderTrackingChoicesSettings();
  renderCategoryOrderSettings();
  renderMetadataSourcesSettings();
  renderCategorySelectOptions();
  updateSettingsUI();
  updateBackupFolderStatusUI();
  lucide.createIcons();
}

function getCurrentPageTab() {
  return document.getElementById("tab-dashboard") ? "tab-dashboard" :
    document.getElementById("tab-timeline") ? "tab-timeline" :
    document.getElementById("tab-discover") ? "tab-discover" :
    document.getElementById("tab-sources") ? "tab-sources" :
    document.getElementById("tab-stats") ? "tab-stats" :
    document.getElementById("tab-settings") ? "tab-settings" :
    null;
}

function getCurrentPagePath() {
  return window.location.pathname.split("/").pop() || "index.html";
}

function getCurrentPagePathWithQuery() {
  return getCurrentPagePath() + window.location.search;
}

function getAppPageStack() {
  try {
    const raw = sessionStorage.getItem("squashdb_page_stack");
    const stack = raw ? JSON.parse(raw) : [];
    return Array.isArray(stack) ? stack : [];
  } catch (e) {
    return [];
  }
}

function setAppPageStack(stack) {
  sessionStorage.setItem("squashdb_page_stack", JSON.stringify(stack));
}

function recordCurrentPage() {
  const current = getCurrentPagePath();
  const currentWithQuery = getCurrentPagePathWithQuery();
  const stack = getAppPageStack();
  if (stack[stack.length - 1] !== current) {
    stack.push(current);
    setAppPageStack(stack);
  }
  if (history.state?.squashdbPage !== currentWithQuery) {
    history.replaceState({ squashdbPage: currentWithQuery }, "", currentWithQuery);
  }
}

function setupAppNavigation() {
  if (history.scrollRestoration) {
    history.scrollRestoration = "manual";
  }
  recordCurrentPage();

  document.querySelectorAll(".nav-item").forEach(navItem => {
    if (navItem.dataset.boundAppNav === "true") return;
    navItem.dataset.boundAppNav = "true";
    navItem.addEventListener("click", (e) => {
      const href = navItem.getAttribute("href");
      if (!href) return;
      e.preventDefault();
      recordCurrentPage();
      history.pushState({ squashdbPage: href }, "", href);
      window.location.href = href;
    });
  });
}

function setupPageBackButtons() {
  document.querySelectorAll(".page-back-btn").forEach(btn => {
    if (btn.dataset.boundBack === "true") return;
    btn.dataset.boundBack = "true";
    btn.addEventListener("click", () => {
      const fallback = btn.getAttribute("data-back-fallback") || "settings.html";
      navigateBackWithinApp(fallback);
    });
  });
}

function navigateBackWithinApp(fallback = "settings.html") {
  const stack = getAppPageStack();
  const current = getCurrentPagePath();
  if (stack[stack.length - 1] === current) {
    stack.pop();
  }
  const previous = stack.pop();
  setAppPageStack(stack);
  if (previous) {
    window.location.href = previous;
    return true;
  }
  window.location.href = fallback;
  return true;
}

function setupHardwareBackButton() {
  const handler = (e) => {
    if (e) e.preventDefault();
    navigateBackWithinApp("dashboard.html");
  };

  if (document.body && !document.body.dataset.boundHardwareBack) {
    document.body.dataset.boundHardwareBack = "true";
    document.addEventListener("backbutton", handler, false);
    window.addEventListener("popstate", (e) => {
      const path = getCurrentPagePath();
      const stack = getAppPageStack();
      if (e.state?.squashdbPage === path || stack.length > 1) {
        navigateBackWithinApp("dashboard.html");
      }
    });
  }
}

// Save data to LocalStorage
let saveTimer = null;
let saveQueued = false;

function flushPendingSave() {
  if (!saveQueued) return;
  saveQueued = false;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  localStorage.setItem("squashdb_items", JSON.stringify(state.items));
  localStorage.setItem("squashdb_watch_log", JSON.stringify(state.watchLog || []));
  localStorage.setItem("squashdb_prefs", JSON.stringify(state.preferences));
  localStorage.setItem("squashdb_theme", state.theme);
  localStorage.setItem("squashdb_sort", state.currentSort);
  localStorage.setItem("squashdb_category_chip", state.activeCategoryChip);
  localStorage.setItem("squashdb_timeline_filter", state.timelineFilter);
  localStorage.setItem("squashdb_last_entry_category", state.lastEntryCategory);
  localStorage.setItem("squashdb_ui_theme", state.preferences.uiTheme);
  localStorage.setItem("squashdb_main_color", state.preferences.mainColor);
  localStorage.setItem("squashdb_rating_format", state.preferences.ratingFormat);
  applyPreferenceAttributes();
}

function saveData() {
  saveQueued = true;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushPendingSave, 120);
  scheduleFolderTreeAutoSync();
}

function normalizeSeasonEpisodes(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  Object.keys(raw).forEach(key => {
    const value = raw[key];
    if (value && typeof value === "object") {
      out[key] = {
        total: Math.max(0, parseInt(value.total) || 0),
        watched: Math.max(0, parseInt(value.watched) || 0),
        completed: Boolean(value.completed)
      };
      return;
    }
    const n = parseInt(value);
    if (!Number.isNaN(n) && n >= 0) {
      out[key] = { total: n, watched: n, completed: true };
    }
  });
  return out;
}

function getSeasonTotalEpisodes(item) {
  const seasonEpisodes = normalizeSeasonEpisodes(item.seasonEpisodes);
  return Object.values(seasonEpisodes).reduce((sum, season) => sum + (parseInt(season.total) || 0), 0);
}

function getSeasonWatchedEpisodes(item) {
  const seasonEpisodes = normalizeSeasonEpisodes(item.seasonEpisodes);
  return Object.values(seasonEpisodes).reduce((sum, season) => {
    const total = parseInt(season.total) || 0;
    const watched = season.completed ? total : (parseInt(season.watched) || 0);
    return sum + Math.min(total, watched);
  }, 0);
}

function getOrderedCategories() {
  return state.preferences.categoryOrder.filter(key => CATEGORIES[key]);
}

function getEnabledOrderedCategories() {
  return getOrderedCategories().filter(key => state.preferences[key]);
}

function saveCategoryOrder(newEnabledOrder) {
  const disabled = getOrderedCategories().filter(key => !state.preferences[key]);
  state.preferences.categoryOrder = [...newEnabledOrder.filter(key => CATEGORIES[key]), ...disabled];
  Object.keys(CATEGORIES).forEach(key => {
    if (!state.preferences.categoryOrder.includes(key)) {
      state.preferences.categoryOrder.push(key);
    }
  });
  saveData();
  renderCategoryChips();
  renderCategorySelectOptions();
  renderStats();
}

// Apply Theme
function applyTheme() {
  document.body.setAttribute("data-theme", state.preferences.uiTheme || state.theme);
}

function applyPreferenceAttributes() {
  const theme = state.preferences.uiTheme || state.theme || "dark";
  const accent = state.preferences.mainColor || "normal";
  document.body.setAttribute("data-theme", theme);
  document.body.setAttribute("data-accent", accent);
  applyAnimationSpeed();
}

function applyAnimationSpeed() {
  const speed = state.preferences.animationSpeed || "normal";
  const multiplier = ANIMATION_SPEED_MULTIPLIERS[speed] ?? 1;
  document.documentElement.style.setProperty("--anim-speed", multiplier);
}

function formatRatingValue(rating) {
  const value = Number(rating) || 0;
  const format = state.preferences.ratingFormat || "5-stars";
  if (format === "10-points") return `${Math.round(value * 2)}/10`;
  if (format === "10-decimal") return `${(value * 2).toFixed(1)}/10`;
  if (format === "100-points") return `${Math.round(value * 20)}/100`;
  return `${value}/5`;
}

function ratingToStoredValue(value) {
  const format = state.preferences.ratingFormat || "5-stars";
  const num = Number(value) || 0;
  if (format === "10-points" || format === "10-decimal") return Math.max(0, Math.min(5, num / 2));
  if (format === "100-points") return Math.max(0, Math.min(5, num / 20));
  return Math.max(0, Math.min(5, num));
}

// Setup Event Listeners
function setupEventListeners() {
  // Global Search
  const globalSearch = document.getElementById("global-search");
  if (globalSearch) {
    globalSearch.addEventListener("input", (e) => {
      state.searchQuery = e.target.value.toLowerCase().trim();
      renderDashboard();
    });
  }

  // Status filter button next to the search box
  const filterBtn = document.getElementById("dashboard-filter-btn");
  if (filterBtn) {
    filterBtn.addEventListener("click", openDashboardStatusFilter);
    updateDashboardFilterButton();
  }

  // Bottom Navigation tabs
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      switchTab(tabId);
    });
  });

  // Sort Selector
  const sortSelect = document.getElementById("sort-select");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      state.currentSort = e.target.value;
      saveData();
      renderDashboard();
    });
  }

  // Timeline filters
  document.querySelectorAll(".date-filter-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".date-filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.timelineFilter = btn.getAttribute("data-filter");
      saveData();
      renderTimeline();
    });
  });

  setupTimelineAdvancedFilter();

  // Floating Action Button
  const addFab = document.getElementById("add-fab");
  if (addFab) {
    addFab.addEventListener("click", () => {
      openModal();
    });
  }

  // Modal actions
  const modalClose = document.getElementById("modal-close-btn");
  if (modalClose) modalClose.addEventListener("click", closeModal);
  const modalCancel = document.getElementById("modal-cancel-btn");
  if (modalCancel) modalCancel.addEventListener("click", closeModal);
  const itemModal = document.getElementById("item-modal");
  if (itemModal && itemModal.dataset.bound !== "true") {
    itemModal.dataset.bound = "true";
    itemModal.addEventListener("click", (e) => {
      if (e.target === itemModal) closeModal();
    });
  }
  const trackerForm = document.getElementById("tracker-form");
  if (trackerForm) trackerForm.addEventListener("submit", handleFormSubmit);

  // Category switch dynamically adjusts fields in modal
  const entryCategory = document.getElementById("entry-category");
  if (entryCategory) {
    entryCategory.addEventListener("change", (e) => {
      state.lastEntryCategory = e.target.value;
      saveData();
      renderDynamicFormFields(e.target.value);
    });
  }

  // Settings preferences switches
  Object.keys(state.preferences).forEach(cat => {
    const checkbox = document.getElementById(`pref-${cat}`);
    if (checkbox) {
      checkbox.addEventListener("change", (e) => {
        state.preferences[cat] = e.target.checked;
        if (!e.target.checked && state.activeCategoryChip === cat) {
          state.activeCategoryChip = null;
        }
        saveData();
        renderCategoryChips();
        renderCategorySelectOptions();
        renderDashboard();
        renderStats();
      });
    }
  });

  // Backup Export
  const backupExport = document.getElementById("backup-export");
  if (backupExport) backupExport.addEventListener("click", exportData);

  // Backup Import
  const importTrigger = document.getElementById("backup-import-trigger");
  const importFileInput = document.getElementById("backup-import-file");
  if (importTrigger && importFileInput) {
    importTrigger.addEventListener("click", () => importFileInput.click());
    importFileInput.addEventListener("change", importData);
  }

  // Change Backup Folder
  const chooseFolderBtn = document.getElementById("backup-choose-folder");
  if (chooseFolderBtn) {
    if (backupFolderPluginAvailable()) {
      chooseFolderBtn.addEventListener("click", chooseBackupFolder);
    } else {
      chooseFolderBtn.style.display = "none";
    }
  }

  // Sync to Folder Tree (squash-db/<category>/<item>/index.json + .thumbnail)
  const syncFolderTreeBtn = document.getElementById("backup-sync-folder-tree");
  if (syncFolderTreeBtn) {
    if (backupFolderPluginAvailable()) {
      syncFolderTreeBtn.addEventListener("click", async () => {
        syncFolderTreeBtn.disabled = true;
        try {
          const summary = await syncFolderTreeMirror();
          if (!summary) {
            alert("Sync did not run — no backup folder is selected.");
          } else if (summary.syncErrors.length > 0) {
            alert(
              `Synced ${summary.syncedCount} of ${summary.totalItems} items.\n` +
              `${summary.syncErrors.length} failed:\n` +
              summary.syncErrors.slice(0, 5).join("\n") +
              (summary.syncErrors.length > 5 ? `\n...and ${summary.syncErrors.length - 5} more (see console log)` : "")
            );
          } else {
            alert(`Folder tree synced successfully! (${summary.syncedCount} written, ${summary.skippedUnchangedCount} already up to date)`);
          }
        } catch (err) {
          console.warn("Manual folder tree sync failed", err);
          alert("Could not sync folder tree. Please try again.");
        } finally {
          syncFolderTreeBtn.disabled = false;
        }
      });
    } else {
      syncFolderTreeBtn.style.display = "none";
    }
  }
  // Reset Database
  const dbReset = document.getElementById("db-reset");
  if (dbReset) {
    dbReset.addEventListener("click", () => {
      if (confirm("Are you absolutely sure you want to delete all entries? This action cannot be undone.")) {
        state.items = [];
        saveData();
        renderDashboard();
        renderTimeline();
        renderStats();
        alert("All SquashDB database data has been successfully wiped.");
        switchTab("tab-dashboard");
      }
    });
  }
}

// Switch between active navigation tabs
function switchTab(tabId) {
  state.currentTab = tabId;
  localStorage.setItem("squashdb_last_tab", tabId);
  updateFabVisibility();
  updateSearchVisibility();
  updateCategoryChipVisibility();
  
  // Update nav item active states
  document.querySelectorAll(".nav-item").forEach(item => {
    if (item.getAttribute("data-tab") === tabId) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // Display correct content block
  document.querySelectorAll(".tab-content").forEach(content => {
    if (content.id === tabId) {
      content.classList.add("active");
    } else {
      content.classList.remove("active");
    }
  });

  // Render operations specific to tabs
  if (tabId === "tab-timeline" && document.getElementById("timeline-container")) {
    renderTimeline();
  } else if (tabId === "tab-stats" && document.getElementById("stats-total")) {
    renderStats();
  } else if (tabId === "tab-dashboard" && document.getElementById("notes-container")) {
    renderCategoryChips();
    renderDashboard();
  } else if (tabId === "tab-settings") {
    updateSettingsUI();
  }

  lucide.createIcons();

  if (state.currentTab === "tab-dashboard") {
    renderDashboard();
  }
}

function updateFabVisibility() {
  const fab = document.getElementById("add-fab");
  if (!fab) return;
  fab.style.display = state.currentTab === "tab-dashboard" ? "flex" : "none";
}

function updateSearchVisibility() {
  const search = document.getElementById("search-container");
  if (!search) return;
  search.style.display = state.currentTab === "tab-dashboard" ? "flex" : "none";
}

function updateCategoryChipVisibility() {
  const chips = document.getElementById("category-chips");
  if (!chips) return;
  chips.style.display = state.currentTab === "tab-settings" ? "none" : "flex";
}

// Sync sort-select UI to current sort state
function updateLayoutToggleButtons() {
  const sortSelect = document.getElementById("sort-select");
  if (sortSelect) {
    sortSelect.value = state.currentSort;
  }
}

// Populate Settings Switch toggles in Settings Tab
function updateSettingsUI() {
  Object.keys(state.preferences).forEach(cat => {
    const checkbox = document.getElementById(`pref-${cat}`);
    if (checkbox) {
      checkbox.checked = state.preferences[cat];
    }
  });

  const timelineButtons = document.querySelectorAll(".date-filter-btn");
  timelineButtons.forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-filter") === state.timelineFilter);
  });

  updatePickerRowValues();
  setupSettingsPickers();

  renderCategoryOrderSettings();
  renderSettingsCards();
  updateAppLockSettingsSummary();
}

function updateAppLockSettingsSummary() {
  const summaryEl = document.getElementById("app-lock-settings-summary");
  if (!summaryEl) return;
  normalizeAppLock();
  const labels = { none: "Off", pin: "PIN", pattern: "Pattern", alphanumeric: "Password" };
  summaryEl.textContent = labels[state.preferences.appLock.method] || "Off";
}

const NAV_ICON_CHOICES = {
  dashboard: ["layout-grid", "home", "grid2x2", "layout-dashboard", "square-library", "book-marked", "library", "layout-list", "list-tree", "boxes", "compass", "rows", "menu", "folder-open", "box", "archive"],
  timeline: ["calendar", "clock", "history", "calendar-days", "calendar-clock", "hourglass", "timer", "calendar-heart", "calendar-check", "calendar-range", "alarm-clock", "clock4", "clock9", "calendar-plus", "sunrise", "moon"],
  discover: ["search", "compass", "globe", "telescope", "binoculars", "sparkles", "eye", "map", "navigation", "radar", "zap", "star", "search-check", "scan-search", "earth", "satellite-dish"],
  sources: ["database", "server", "layers", "package", "plug", "cloud", "hard-drive", "library-big", "antenna", "rss", "combine", "blocks", "cable", "boxes", "network", "warehouse"],
  stats: ["pie-chart", "bar-chart2", "bar-chart3", "trending-up", "activity", "line-chart", "gauge", "chart-bar", "chart-pie", "bar-chart-horizontal", "flame", "sigma", "chart-column", "area-chart", "radar", "target"],
  settings: ["settings", "sliders-horizontal", "cog", "wrench", "settings2", "sliders", "toggle-left", "circle-user", "sparkles", "square-menu", "list-checks", "user-cog", "sliders-vertical", "user-round-cog", "shield-check", "key"]
};

function renderNavIconPickers() {
  let needsIcons = false;
  Object.keys(NAV_ICON_CHOICES).forEach(navKey => {
    const grid = document.getElementById(`nav-icon-picker-${navKey}`);
    if (!grid) return;

    grid.innerHTML = "";
    const current = state.preferences.navIcons[navKey];

    NAV_ICON_CHOICES[navKey].forEach(iconName => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `icon-picker-option${iconName === current ? " active" : ""}`;
      btn.innerHTML = `<i data-lucide="${iconName}"></i>`;
      needsIcons = true;
      btn.addEventListener("click", () => {
        state.preferences.navIcons[navKey] = iconName;
        saveData();
        renderNavIconPickers();
        applyNavIcons();
      });
      grid.appendChild(btn);
    });
  });

  if (needsIcons && window.lucide) lucide.createIcons();
}

// App icon+name (Android home screen look, switched via native activity-alias).
// Each look bakes in both an icon and a matching name as a single pre-declared
// alias (see AndroidManifest.xml: Look_<key>), so there's one flat list to pick from.
const APP_LOOK_CHOICES = [
  { value: "default", label: "SquashDB", preview: "icons/previews/ic_launcher.png" },
  { value: "fire", label: "SquashDB", preview: "icons/previews/ic_launcher_fire.png" },
  { value: "pinklogo", label: "SquashDB", preview: "icons/previews/ic_launcher_pinklogo.png" },
  { value: "purple", label: "SquashDB", preview: "icons/previews/ic_launcher_purple.png" },
  { value: "backlog", label: "Backlog", preview: "icons/previews/ic_launcher_backlog.png" },
  { value: "bingelog", label: "Binge Log", preview: "icons/previews/ic_launcher_bingelog.png" },
  { value: "checklist", label: "Checklist", preview: "icons/previews/ic_launcher_checklist.png" },
  { value: "listkeeper", label: "ListKeeper", preview: "icons/previews/ic_launcher_listkeeper.png" },
  { value: "myfiles", label: "My Files", preview: "icons/previews/ic_launcher_myfiles.png" },
  { value: "mylists", label: "My Lists", preview: "icons/previews/ic_launcher_mylists.png" },
  { value: "mywatchlist", label: "My Watchlist", preview: "icons/previews/ic_launcher_mywatchlist.png" },
  { value: "notes", label: "Notes", preview: "icons/previews/ic_launcher_notes.png" },
  { value: "reminders", label: "Reminders", preview: "icons/previews/ic_launcher_reminders.png" },
  { value: "splash", label: "Splash", preview: "icons/previews/ic_launcher_splash.png" },
  { value: "squid", label: "Squid", preview: "icons/previews/ic_launcher_squid.png" },
  { value: "towatch", label: "ToWatch", preview: "icons/previews/ic_launcher_towatch.png" },
  { value: "tracker", label: "Tracker", preview: "icons/previews/ic_launcher_tracker.png" },
  { value: "vault", label: "Vault", preview: "icons/previews/ic_launcher_vault.png" },
  { value: "watchlist", label: "Watchlist", preview: "icons/previews/ic_launcher_watchlist.png" },
  { value: "capacitor", label: "Capacitor", preview: "icons/previews/ic_launcher_capacitor.png" },
  { value: "calculator", label: "Calculator", preview: "icons/previews/ic_launcher_calculator.png" },
  { value: "freeotp", label: "FreeOTP", preview: "icons/previews/ic_launcher_freeotp.png" },
  { value: "termux", label: "Termux", preview: "icons/previews/ic_launcher_termux.png" }
];

function isNativeApp() {
  return Boolean(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

function appIconPluginAvailable() {
  return isNativeApp() && window.Capacitor.Plugins && window.Capacitor.Plugins.AppIcon;
}

async function getCurrentAppLook() {
  let look = state.preferences.appLook || "default";

  if (appIconPluginAvailable()) {
    try {
      const result = await window.Capacitor.Plugins.AppIcon.getLook();
      if (result && result.look) look = result.look;
    } catch (err) {
      console.warn("Could not read current app look", err);
    }
  }
  return look;
}

async function applyAppLook(look) {
  state.preferences.appLook = look;
  saveData();

  if (!appIconPluginAvailable()) return;

  try {
    await window.Capacitor.Plugins.AppIcon.setLook({ look });
  } catch (err) {
    console.warn("Failed to switch app look", err);
    alert("Could not update the app icon/name. Please try again.");
  }
}

async function renderAppIconPicker() {
  const grid = document.getElementById("app-icon-picker");
  if (!grid) return;

  const note = document.getElementById("app-icon-native-note");
  if (note) note.style.display = appIconPluginAvailable() ? "none" : "block";

  const current = await getCurrentAppLook();

  grid.innerHTML = "";
  APP_LOOK_CHOICES.forEach(choice => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `app-icon-option${choice.value === current ? " active" : ""}`;
    btn.innerHTML = `
      <img src="${choice.preview}" alt="${choice.label} icon">
      <span>${choice.label}</span>
    `;
    btn.addEventListener("click", () => selectAppLook(choice.value));
    grid.appendChild(btn);
  });
}

async function selectAppLook(look) {
  await applyAppLook(look);
  renderAppIconPicker();
}

// Apply the saved nav icons to whichever bottom-nav is present on this page
function applyNavIcons() {
  const map = {
    "tab-dashboard": "dashboard",
    "tab-timeline": "timeline",
    "tab-discover": "discover",
    "tab-sources": "sources",
    "tab-stats": "stats",
    "tab-settings": "settings"
  };
  document.querySelectorAll(".bottom-nav .nav-item").forEach(navItem => {
    const navKey = map[navItem.dataset.tab];
    if (!navKey) return;
    const iconName = state.preferences.navIcons[navKey];
    if (!iconName) return;
    // Icon may already be a rendered <svg> (lucide.createIcons replaces <i>),
    // so replace whatever icon element is there with a fresh placeholder.
    const existingIcon = navItem.querySelector("i, svg");
    if (existingIcon) existingIcon.remove();
    navItem.insertAdjacentHTML("beforeend", `<i data-lucide="${iconName}"></i>`);
  });
  if (window.lucide) lucide.createIcons();
}

const SETTINGS_PICKERS = {
  ratingFormat: {
    default: "5-stars",
    options: [
      { value: "5-stars", label: "5 stars" },
      { value: "10-points", label: "10 points" },
      { value: "10-decimal", label: "10 points decimals" },
      { value: "100-points", label: "100 points" }
    ]
  },
  uiTheme: {
    default: "dark",
    options: [
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
      { value: "grey", label: "Grey" },
      { value: "amoled", label: "Amoled" },
      { value: "flashbang", label: "Flashbang" },
      { value: "material-you", label: "Material You" }
    ]
  },
  mainColor: {
    default: "normal",
    options: [
      { value: "normal", label: "Normal" },
      { value: "carnation-pink", label: "Carnation Pink" },
      { value: "dark-green", label: "Dark Green" },
      { value: "maroon", label: "Maroon" },
      { value: "navy-blue", label: "Navy Blue" },
      { value: "grey", label: "Grey" },
      { value: "white", label: "White" },
      { value: "brown", label: "Brown" },
      { value: "cool", label: "Cool" },
      { value: "fire", label: "Fire" },
      { value: "burple", label: "Burple" },
      { value: "gren", label: "Gren" },
      { value: "apple", label: "Apple" },
      { value: "banan", label: "Banan" },
      { value: "party", label: "Party" },
      { value: "pink-pain", label: "Pink Pain" },
      { value: "material-you", label: "Material You" }
    ]
  },
  dashboardRowActions: {
    default: "menu",
    options: [
      { value: "menu", label: "3-dot menu" },
      { value: "tap-hold", label: "Tap to edit, long-press to delete" },
      { value: "swipe", label: "Swipe to edit/delete" }
    ]
  },
  dashboardView: {
    default: "list",
    options: [
      { value: "list", label: "List" },
      { value: "grid", label: "Grid" }
    ]
  },
  metadataMode: {
    default: "offline",
    options: [
      { value: "offline", label: "Offline" },
      { value: "online", label: "Online" }
    ]
  },
  metadataThumbnails: {
    default: "true",
    stateKey: "metadataThumbnails",
    options: [
      { value: "true", label: "On" },
      { value: "false", label: "Off" }
    ]
  },
  folderSyncDelay: {
    default: "30000",
    options: [
      { value: "0", label: "Immediately" },
      { value: "5000", label: "5 seconds" },
      { value: "10000", label: "10 seconds" },
      { value: "30000", label: "30 seconds" },
      { value: "60000", label: "1 minute" }
    ]
  },
  animationSpeed: {
    default: "normal",
    options: [
      { value: "off", label: "Off" },
      { value: "fast", label: "Fast" },
      { value: "normal", label: "Normal" },
      { value: "slow", label: "Slow" }
    ]
  }
};

// Multiplier applied to every CSS transition/animation duration via --anim-speed.
const ANIMATION_SPEED_MULTIPLIERS = { off: 0.001, fast: 0.5, normal: 1, slow: 1.75 };

function getPickerValue(pref) {
  const picker = SETTINGS_PICKERS[pref];
  const source = picker.stateKey ? state : state.preferences;
  const value = source[picker.stateKey || pref];
  if (typeof value === "boolean") return value ? "true" : "false";
  return value || picker.default;
}

function setPickerValue(pref, value) {
  const picker = SETTINGS_PICKERS[pref];
  const source = picker.stateKey ? state : state.preferences;
  source[picker.stateKey || pref] = value === "true" ? true : value === "false" ? false : value;
}

function updatePickerRowValues() {
  Object.keys(SETTINGS_PICKERS).forEach(pref => {
    const picker = SETTINGS_PICKERS[pref];
    const row = document.querySelector(`[data-pref="${pref}"]`);
    if (!row) return;
    const valueEl = row.querySelector(".settings-row-value span");
    const current = getPickerValue(pref);
    const match = picker.options.find(o => o.value === current);
    if (valueEl) valueEl.textContent = match ? match.label : current;
  });
}

function setupSettingsPickers() {
  document.querySelectorAll(".settings-row-picker").forEach(row => {
    if (row.dataset.bound === "true") return;
    row.dataset.bound = "true";
    row.addEventListener("click", () => {
      openSettingsPicker(row.dataset.pref, row.closest(".settings-row-picker").querySelector("label").textContent);
    });
  });
}

// Bind the shared picker bottom-sheet's close/backdrop handlers (used by both
// settings pickers and the dashboard row-action menu)
function setupPickerModal() {
  const pickerClose = document.getElementById("picker-modal-close");
  if (pickerClose && pickerClose.dataset.bound !== "true") {
    pickerClose.dataset.bound = "true";
    pickerClose.addEventListener("click", closeSettingsPicker);
  }

  const pickerModal = document.getElementById("picker-modal");
  if (pickerModal && pickerModal.dataset.bound !== "true") {
    pickerModal.dataset.bound = "true";
    pickerModal.addEventListener("click", (e) => {
      if (e.target === pickerModal) closeSettingsPicker();
    });
  }
}

function openSettingsPicker(pref, title) {
  const picker = SETTINGS_PICKERS[pref];
  if (!picker) return;

  const modal = document.getElementById("picker-modal");
  const list = document.getElementById("picker-options-list");
  const titleEl = document.getElementById("picker-modal-title");
  if (!modal || !list) return;

  titleEl.textContent = title;
  const current = getPickerValue(pref);

  list.innerHTML = "";
  picker.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `picker-option${opt.value === current ? " active" : ""}`;
    btn.innerHTML = `<i data-lucide="check" class="picker-option-check"></i><span>${opt.label}</span>`;
    btn.addEventListener("click", () => {
      setPickerValue(pref, opt.value);
      saveData();
      applyTheme();
      updateLayoutToggleButtons();
      renderDashboard();
      renderTimeline();
      renderStats();
      updatePickerRowValues();
      closeSettingsPicker();
    });
    list.appendChild(btn);
  });

  modal.classList.add("active");
  if (window.lucide && list.childElementCount > 0) lucide.createIcons();
}

function closeSettingsPicker() {
  const modal = document.getElementById("picker-modal");
  if (modal) modal.classList.remove("active");
}

function renderCategoryOrderSettings() {
  const list = document.getElementById("category-order-list");
  if (!list) return;

  list.innerHTML = "";
  getEnabledOrderedCategories().forEach(key => {
    const item = document.createElement("div");
    item.className = "sortable-item";
    item.draggable = true;
    item.dataset.category = key;
    item.innerHTML = `
      <span class="drag-handle" aria-hidden="true">⋮⋮</span>
      <span class="sortable-label">${CATEGORIES[key].label}</span>
    `;
    list.appendChild(item);
  });

  let dragged = null;
  list.querySelectorAll(".sortable-item").forEach(item => {
    item.addEventListener("dragstart", () => {
      dragged = item;
      item.classList.add("dragging");
    });
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      dragged = null;
      const newOrder = Array.from(list.querySelectorAll(".sortable-item")).map(el => el.dataset.category);
      saveCategoryOrder(newOrder);
    });
    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!dragged || dragged === item) return;
      const rect = item.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      list.insertBefore(dragged, after ? item.nextSibling : item);
    });
  });

}

function renderTrackingChoicesSettings() {
  const container = document.getElementById("tracking-choices-list");
  if (!container) return;

  container.innerHTML = "";
  getOrderedCategories().forEach(cat => {
    const row = document.createElement("div");
    row.className = "setting-row";
    const deleteBtnHTML = CATEGORIES[cat].custom
      ? `<button type="button" class="note-action-btn delete-list-btn" data-cat="${cat}" title="Delete list"><i data-lucide="trash-2"></i></button>`
      : "";
    row.innerHTML = `
      <div class="setting-info">
        <span class="setting-label">${CATEGORIES[cat].label} Tracker</span>
        <span class="setting-desc">Track ${CATEGORIES[cat].label.toLowerCase()} progress</span>
      </div>
      ${deleteBtnHTML}
      <label class="switch">
        <input type="checkbox" id="pref-${cat}" ${state.preferences[cat] ? "checked" : ""}>
        <span class="slider"></span>
      </label>
    `;
    container.appendChild(row);
  });

  const createRow = document.createElement("button");
  createRow.type = "button";
  createRow.id = "create-list-btn";
  createRow.className = "btn btn-secondary";
  createRow.style.width = "100%";
  createRow.style.marginTop = "8px";
  createRow.innerHTML = `<i data-lucide="plus"></i> Create new list`;
  createRow.addEventListener("click", openCreateListModal);
  container.appendChild(createRow);

  container.querySelectorAll("input[type='checkbox']").forEach(checkbox => {
    const cat = checkbox.id.replace("pref-", "");
    checkbox.addEventListener("change", (e) => {
      state.preferences[cat] = e.target.checked;
      if (!e.target.checked && state.activeCategoryChip === cat) {
        state.activeCategoryChip = null;
      }
      saveData();
    });
  });

  container.querySelectorAll(".delete-list-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.cat;
      if (categoryHasItems(cat)) {
        alert("This list still has tracked items. Remove or move them first.");
        return;
      }
      if (!confirm(`Delete the "${CATEGORIES[cat].label}" list? This cannot be undone.`)) return;
      const result = deleteCustomCategory(cat);
      if (!result.ok) {
        alert(result.reason);
        return;
      }
      renderTrackingChoicesSettings();
      renderCategoryOrderSettings();
      lucide.createIcons();
    });
  });

  if (window.lucide) lucide.createIcons();
}

// Modal for creating a new custom tracking list
function openCreateListModal() {
  let modal = document.getElementById("create-list-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "create-list-modal";
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Create New List</h3>
          <button type="button" class="modal-close-btn" id="create-list-close"><i data-lucide="x"></i></button>
        </div>
        <div class="form-group">
          <label for="new-list-name">List Name</label>
          <input type="text" id="new-list-name" class="form-control" placeholder="e.g. Board Games" maxlength="30">
        </div>
        <div class="form-group">
          <label>Icon</label>
          <div id="new-list-icon-picker" class="icon-picker-grid"></div>
        </div>
        <div class="form-group">
          <label for="new-list-statuses">Statuses (comma separated)</label>
          <input type="text" id="new-list-statuses" class="form-control" value="${DEFAULT_CUSTOM_STATUSES.join(", ")}">
        </div>
        <button type="button" class="btn btn-primary" id="create-list-submit" style="width: 100%; margin-top: 8px;">Create List</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector("#create-list-close").addEventListener("click", () => modal.classList.remove("active"));
  }

  const iconPicker = modal.querySelector("#new-list-icon-picker");
  let selectedIcon = CATEGORY_ICON_CHOICES[0];
  iconPicker.innerHTML = "";
  CATEGORY_ICON_CHOICES.forEach((icon, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `icon-picker-option ${idx === 0 ? "active" : ""}`;
    btn.dataset.icon = icon;
    btn.innerHTML = `<i data-lucide="${icon}"></i>`;
    btn.addEventListener("click", () => {
      selectedIcon = icon;
      iconPicker.querySelectorAll(".icon-picker-option").forEach(b => b.classList.toggle("active", b === btn));
    });
    iconPicker.appendChild(btn);
  });

  modal.querySelector("#new-list-name").value = "";
  modal.querySelector("#new-list-statuses").value = DEFAULT_CUSTOM_STATUSES.join(", ");

  const submitBtn = modal.querySelector("#create-list-submit");
  const newSubmitBtn = submitBtn.cloneNode(true);
  submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
  newSubmitBtn.addEventListener("click", () => {
    const name = modal.querySelector("#new-list-name").value.trim();
    if (!name) {
      alert("Please enter a list name.");
      return;
    }
    const statuses = modal.querySelector("#new-list-statuses").value
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    createCustomCategory({ label: name, icon: selectedIcon, statuses });
    modal.classList.remove("active");
    renderTrackingChoicesSettings();
    renderCategoryOrderSettings();
  });

  modal.classList.add("active");
  lucide.createIcons();
}

function renderSettingsCards() {
  // Keep this lightweight on the standalone manage pages.
}

// Render dynamic quick filter category chips on dashboard top
function renderCategoryChips() {
  const container = document.getElementById("category-chips");
  if (!container) return;

  // Clear original contents
  container.innerHTML = "";

  // Render enabled chips
  getOrderedCategories().forEach(key => {
    if (state.preferences[key]) {
      const chip = document.createElement("div");
      chip.className = `chip ${state.activeCategoryChip === key ? "active" : ""}`;
      chip.dataset.category = key;
      chip.style.setProperty("--theme-color", CATEGORIES[key].color);
      chip.innerHTML = `<i data-lucide="${CATEGORIES[key].icon}"></i> ${CATEGORIES[key].label}`;
      chip.addEventListener("click", () => {
        state.activeCategoryChip = key;
        saveData();
        updateActiveChipUI();
        renderDashboard();
        renderTimeline();
        renderStats();
      });
      container.appendChild(chip);
    }
  });

  lucide.createIcons();
}

// Update UI active styles for selected category chip
function updateActiveChipUI() {
  const chips = document.querySelectorAll("#category-chips .chip");
  chips.forEach(chip => {
    chip.classList.toggle("active", chip.dataset.category === state.activeCategoryChip);
  });
}

// Render category select options inside Add Modal
function renderCategorySelectOptions() {
  const select = document.getElementById("entry-category");
  if (!select || select.tagName !== "SELECT") return;

  select.innerHTML = "";

  getOrderedCategories().forEach(key => {
    if (state.preferences[key]) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = CATEGORIES[key].label;
      select.appendChild(opt);
    }
  });

  if (select.options.length > 0) {
    if (select.querySelector(`option[value="${state.lastEntryCategory}"]`)) {
      select.value = state.lastEntryCategory;
    } else {
      select.value = select.options[0].value;
      state.lastEntryCategory = select.value;
      saveData();
    }
  }
}

// Compute progress percentage
function calculateProgress(item) {
  const { category, status, seasonsDone, totalSeasons, episodesDone, totalEpisodes, chaptersRead, totalChapters } = item;
  
  if (status === "Completed") return 100;

  if (category === "series" || category === "kdrama" || category === "cdrama" || category === "anime") {
    const totalEp = parseInt(totalEpisodes) || getSeasonTotalEpisodes(item) || 0;
    const doneEp = parseInt(episodesDone) || 0;
    
    if (totalEp > 0) {
      return Math.min(100, Math.round((doneEp / totalEp) * 100));
    }
    
    const totalS = parseInt(totalSeasons) || 0;
    const doneS = parseInt(seasonsDone) || 0;
    if (totalS > 0) {
      return Math.min(100, Math.round((doneS / totalS) * 100));
    }
  } else if (category === "manga" || category === "novel") {
    const totalCh = parseInt(totalChapters) || 0;
    const doneCh = parseInt(chaptersRead) || 0;
    if (totalCh > 0) {
      return Math.min(100, Math.round((doneCh / totalCh) * 100));
    }
  }

  // Games / Movies with no numerical steps
  if (status === "Playing" || status === "In Progress" || status === "Reading") {
    return 50;
  }

  return 0;
}

// Estimated time to finish an item, in minutes. Returns { total, remaining } or
// null if the category/item doesn't have enough data to estimate (e.g. no runtime
// set). "remaining" accounts for progress already made; "total" ignores it.
function calculateTimeToComplete(item) {
  const { category } = item;

  if (category === "series" || category === "kdrama" || category === "cdrama" || category === "anime") {
    const runtime = parseInt(item.episodeRuntime) || 0;
    if (runtime <= 0) return null;
    const totalEp = parseInt(item.totalEpisodes) || getSeasonTotalEpisodes(item) || 0;
    if (totalEp <= 0) return null;
    const doneEp = Math.min(totalEp, parseInt(item.episodesDone) || 0);
    return {
      total: runtime * totalEp,
      remaining: item.status === "Completed" ? 0 : runtime * (totalEp - doneEp)
    };
  }

  if (category === "novel") {
    const minutesPerChapter = parseInt(item.minutesPerChapter) || 0;
    const totalCh = parseInt(item.totalChapters) || 0;
    if (minutesPerChapter <= 0 || totalCh <= 0) return null;
    const doneCh = Math.min(totalCh, parseInt(item.chaptersRead) || 0);
    return {
      total: minutesPerChapter * totalCh,
      remaining: item.status === "Completed" ? 0 : minutesPerChapter * (totalCh - doneCh)
    };
  }

  if (category === "movie") {
    const runtime = parseInt(item.playtime) || 0;
    if (runtime <= 0) return null;
    return {
      total: runtime,
      remaining: item.status === "Completed" ? 0 : runtime
    };
  }

  return null;
}

// Formats a minute count as e.g. "2h 15m", "45m", or "3h" for display.
function formatMinutesAsDuration(minutes) {
  const totalMinutes = Math.max(0, Math.round(minutes));
  const mins = totalMinutes % 60;
  let totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    return mins === 0 ? `${totalHours}h` : `${totalHours}h ${mins}m`;
  }

  const hours = totalHours % 24;
  let totalDays = Math.floor(totalHours / 24);
  if (totalDays < 30) {
    return hours === 0 ? `${totalDays}d` : `${totalDays}d ${hours}h`;
  }

  const days = totalDays % 30;
  let totalMonths = Math.floor(totalDays / 30);
  if (totalMonths < 12) {
    const parts = [`${totalMonths}mo`];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    return parts.join(" ");
  }

  const months = totalMonths % 12;
  const years = Math.floor(totalMonths / 12);
  const parts = [`${years}y`];
  if (months) parts.push(`${months}mo`);
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  return parts.join(" ");
}

// Render Dashboard Note Cards
// True when the status filter actually applies to the active category —
// a leftover filter from another category's status set is treated as off.
function dashboardStatusFilterActive() {
  return Boolean(state.statusFilter && state.statusFilter !== "all"
    && (CATEGORIES[state.activeCategoryChip]?.statuses || []).includes(state.statusFilter));
}

function updateDashboardFilterButton() {
  const btn = document.getElementById("dashboard-filter-btn");
  if (!btn) return;
  btn.classList.toggle("active", dashboardStatusFilterActive());
}

function openDashboardStatusFilter() {
  const modal = document.getElementById("picker-modal");
  const list = document.getElementById("picker-options-list");
  const titleEl = document.getElementById("picker-modal-title");
  if (!modal || !list) return;

  if (titleEl) titleEl.textContent = "Filter by Status";
  const statuses = CATEGORIES[state.activeCategoryChip]?.statuses || [];
  const current = dashboardStatusFilterActive() ? state.statusFilter : "all";

  list.innerHTML = "";
  ["all", ...statuses].forEach(value => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `picker-option${current === value ? " active" : ""}`;
    btn.innerHTML = `<i data-lucide="check" class="picker-option-check"></i><span>${value === "all" ? "All statuses" : value}</span>`;
    btn.addEventListener("click", () => {
      state.statusFilter = value;
      closeSettingsPicker();
      updateDashboardFilterButton();
      renderDashboard();
    });
    list.appendChild(btn);
  });

  modal.classList.add("active");
  lucide.createIcons();
}

function renderDashboard() {
  const container = document.getElementById("notes-container");
  const emptyState = document.getElementById("dashboard-empty");
  if (!container) return;
  updateDashboardFilterButton();

  container.innerHTML = "";

  if (!state.activeCategoryChip) {
    const firstEnabled = getOrderedCategories().find(key => state.preferences[key]);
    if (firstEnabled) {
      state.activeCategoryChip = firstEnabled;
      saveData();
    } else {
      emptyState.style.display = "flex";
      container.style.display = "none";
      return;
    }
  }

  // 1. Filter items based on active preferences, quick filter chip, and search query
  let filtered = state.items.filter(item => {
    // Check if category is enabled in settings
    if (!state.preferences[item.category]) return false;
    
    // Check quick filter chip selection
    if (item.category !== state.activeCategoryChip) return false;
    
    // Check search query matches Title or Notes
    if (state.searchQuery) {
      const titleMatch = item.title.toLowerCase().includes(state.searchQuery);
      const notesMatch = item.notes.toLowerCase().includes(state.searchQuery);
      if (!titleMatch && !notesMatch) return false;
    }

    // Status filter from the search-bar funnel button. A filter carried over
    // from another category's status set is ignored rather than hiding everything.
    if (state.statusFilter && state.statusFilter !== "all"
      && (CATEGORIES[state.activeCategoryChip]?.statuses || []).includes(state.statusFilter)
      && item.status !== state.statusFilter) return false;

    return true;
  });

  // 2. Sort items
  filtered.sort((a, b) => {
    if (state.currentSort === "alphabetical-asc") {
      return a.title.localeCompare(b.title);
    } else if (state.currentSort === "alphabetical-desc") {
      return b.title.localeCompare(a.title);
    } else if (state.currentSort === "created-desc") {
      return b.created - a.created;
    } else if (state.currentSort === "created-asc") {
      return a.created - b.created;
    } else if (state.currentSort === "progress-desc") {
      return calculateProgress(b) - calculateProgress(a);
    } else if (state.currentSort === "progress-asc") {
      return calculateProgress(a) - calculateProgress(b);
    }
    return 0;
  });

  // 3. Render note elements incrementally: only a first batch is built up front,
  // more are appended as the user scrolls near the bottom (see setupDashboardLazyLoad).
  if (filtered.length === 0) {
    emptyState.style.display = "flex";
    container.style.display = "none";
    teardownDashboardLazyLoad();
  } else {
    emptyState.style.display = "none";
    const isGrid = state.preferences.dashboardView === "grid";
    container.style.display = isGrid ? "grid" : "flex";
    container.classList.toggle("notes-grid-view", isGrid);
    container.dataset.rowActions = state.preferences.dashboardRowActions || "menu";
    setupDashboardLazyLoad(container, filtered);
  }
}

const DASHBOARD_BATCH_SIZE = 30;
let dashboardLazyLoadObserver = null;

// Grid view: poster-only card with a progress strip along the bottom edge —
// full purple bar for completed items, green partial bar for anything the
// user has started or is actively on, no bar for untouched queue entries.
function buildGridCard(item) {
  const card = document.createElement("div");
  card.className = "grid-card";
  card.dataset.id = item.id;

  const progress = calculateProgress(item);
  const isCompleted = item.status === "Completed";
  const activeStatuses = new Set(["In Progress", "Playing", "Reading", "On Hold"]);
  const started = progress > 0 || activeStatuses.has(item.status);

  let barHTML = "";
  if (isCompleted) {
    barHTML = `<div class="grid-card-bar grid-card-bar-complete"></div>`;
  } else if (started) {
    barHTML = `<div class="grid-card-bar grid-card-bar-progress" style="width:${Math.max(progress, 6)}%"></div>`;
  }

  card.innerHTML = `
    ${thumbnailOrPlaceholder(item.thumbnail, "grid-card-thumb")}
    ${barHTML ? `<div class="grid-card-bar-track">${barHTML}</div>` : ""}
  `;
  card.addEventListener("click", () => openItemForCategory(item.id));
  return card;
}

function buildNoteCard(item) {
  const rowActions = state.preferences.dashboardRowActions || "menu";
  const card = document.createElement("div");
  const isCompleted = item.status === "Completed";
  card.className = `note-card ${isCompleted ? "completed" : ""}`;
  card.dataset.id = item.id;
  card.style.setProperty("--theme-color", CATEGORIES[item.category].color);

  const progress = calculateProgress(item);
  const subtitleParts = [item.status];
  const showProgressPercent = !isCompleted && progress > 0 && (item.category === "series" || item.category === "kdrama" || item.category === "cdrama" || item.category === "anime" || item.category === "manga" || item.category === "novel");
  if (showProgressPercent) subtitleParts.push(`${progress}%`);
  if (item.rating) subtitleParts.push(formatRatingValue(item.rating));
  const timeToComplete = calculateTimeToComplete(item);
  if (timeToComplete && !isCompleted && timeToComplete.remaining > 0) {
    subtitleParts.push(`${formatMinutesAsDuration(timeToComplete.remaining)} left`);
  }

  // Second meta line from captured online metadata; hidden when the item
  // predates metadata capture and has none of these fields.
  const metaParts = [];
  if (Array.isArray(item.genres) && item.genres.length) metaParts.push(item.genres.slice(0, 2).join(", "));
  if (item.network) metaParts.push(item.network);
  if (item.productionStatus) metaParts.push(item.productionStatus);
  const sourceName = itemSourceName(item);
  if (sourceName) metaParts.push(sourceName);
  const metaLineHTML = metaParts.length ? `<span class="note-meta-line">${metaParts.join(" · ")}</span>` : "";

  const actionsHTML = rowActions === "menu"
    ? `<button class="note-action-btn menu-btn" data-id="${item.id}" title="More"><i data-lucide="more-vertical"></i></button>`
    : "";

  const swipeActionsHTML = rowActions === "swipe" ? `
    <div class="note-row-swipe-actions">
      <button class="note-action-btn edit-btn" data-id="${item.id}" title="Edit"><i data-lucide="edit-2"></i></button>
      <button class="note-action-btn delete-btn" data-id="${item.id}" title="Delete"><i data-lucide="trash-2"></i></button>
    </div>
  ` : "";

  card.innerHTML = `
    ${swipeActionsHTML}
    <div class="note-row-content">
      <input type="checkbox" class="note-checkbox" ${isCompleted ? "checked" : ""} data-id="${item.id}" title="Toggle Completion">
      ${thumbnailOrPlaceholder(item.thumbnail, "note-thumb")}
      <div class="note-row-body">
        <span class="note-title">${item.title}</span>
        <span class="note-subtitle">${subtitleParts.join(" · ")}</span>
        ${metaLineHTML}
      </div>
      <span class="note-tag" style="--theme-color: ${CATEGORIES[item.category].color}">${CATEGORIES[item.category].label}</span>
      ${actionsHTML}
    </div>
  `;
  return card;
}

function teardownDashboardLazyLoad() {
  if (dashboardLazyLoadObserver) {
    dashboardLazyLoadObserver.disconnect();
    dashboardLazyLoadObserver = null;
  }
}

// Renders `filtered` in batches: an initial batch up front, then more batches
// as a sentinel element at the end of the list scrolls into view. Avoids building
// hundreds of DOM nodes synchronously for large watchlists on every render.
function setupDashboardLazyLoad(container, filtered) {
  teardownDashboardLazyLoad();
  container.innerHTML = "";

  let renderedCount = 0;
  const sentinel = document.createElement("div");
  sentinel.className = "dashboard-lazy-sentinel";

  function renderNextBatch() {
    const nextItems = filtered.slice(renderedCount, renderedCount + DASHBOARD_BATCH_SIZE);
    if (nextItems.length === 0) return;

    const fragment = document.createDocumentFragment();
    const isGrid = state.preferences.dashboardView === "grid";
    nextItems.forEach(item => fragment.appendChild(isGrid ? buildGridCard(item) : buildNoteCard(item)));
    container.insertBefore(fragment, sentinel);
    renderedCount += nextItems.length;

    attachCardEvents();
    lucide.createIcons();

    if (renderedCount >= filtered.length) {
      teardownDashboardLazyLoad();
      sentinel.remove();
    }
  }

  container.appendChild(sentinel);
  renderNextBatch();

  if (renderedCount < filtered.length) {
    dashboardLazyLoadObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) renderNextBatch();
    }, { root: null, rootMargin: "400px" });
    dashboardLazyLoadObserver.observe(sentinel);
  }
}

// Generate stars icon HTML for note cards
function getStarsHTML(rating) {
  let stars = `<div class="detail-item" style="color: var(--color-manga);">`;
  for (let i = 1; i <= 5; i++) {
    if (i <= rating) {
      stars += `<i data-lucide="star" style="fill: currentColor; width: 12px; height: 12px;"></i>`;
    } else {
      stars += `<i data-lucide="star" style="width: 12px; height: 12px;"></i>`;
    }
  }
  stars += `</div>`;
  return stars;
}

// Render Timeline completed history items
function setupTimelineAdvancedFilter() {
  const openBtn = document.getElementById("timeline-advanced-filter-btn");
  const modal = document.getElementById("timeline-filter-modal");
  const closeBtn = document.getElementById("timeline-filter-close");
  const applyBtn = document.getElementById("timeline-filter-apply");
  const clearBtn = document.getElementById("timeline-filter-clear");
  const searchInput = document.getElementById("timeline-filter-search");
  const monthSelect = document.getElementById("timeline-filter-month");
  const yearSelect = document.getElementById("timeline-filter-year");
  if (!openBtn || !modal) return;

  const close = () => modal.classList.remove("active");

  openBtn.addEventListener("click", () => {
    // Populate years from completed items' dates
    const years = new Set(
      state.items
        .filter(item => item.completionDate)
        .map(item => new Date(item.completionDate).getFullYear())
    );
    yearSelect.innerHTML = '<option value="">Any Year</option>' +
      Array.from(years).sort((a, b) => b - a).map(y => `<option value="${y}">${y}</option>`).join("");

    searchInput.value = state.timelineSearch;
    monthSelect.value = state.timelineMonth;
    yearSelect.value = state.timelineYear;

    modal.classList.add("active");
  });

  closeBtn.addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

  applyBtn.addEventListener("click", () => {
    state.timelineSearch = searchInput.value.trim();
    state.timelineMonth = monthSelect.value;
    state.timelineYear = yearSelect.value;
    saveData();
    renderTimeline();
    close();
  });

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    monthSelect.value = "";
    yearSelect.value = "";
    state.timelineSearch = "";
    state.timelineMonth = "";
    state.timelineYear = "";
    saveData();
    renderTimeline();
    close();
  });
}

function renderTimeline() {
  const container = document.getElementById("timeline-container");
  const emptyState = document.getElementById("timeline-empty");
  if (!container) return;

  container.innerHTML = "";

  const activeCategory = state.activeCategoryChip || localStorage.getItem("squashdb_category_chip");

  // 1. Gather and filter only completed items with a date
  let completedItems = state.items.filter(item => {
    if (activeCategory && item.category !== activeCategory) return false;
    return item.status === "Completed" && item.completionDate && state.preferences[item.category];
  });

  // Apply Date Filter range selection
  const now = new Date();
  
  // Calculate start of current week (assuming Monday start)
  const currentDay = now.getDay();
  const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday).getTime();
  
  // Start of current month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  completedItems = completedItems.filter(item => {
    const compTime = new Date(item.completionDate).getTime();

    if (state.timelineFilter === "week") {
      return compTime >= weekStart;
    } else if (state.timelineFilter === "month") {
      return compTime >= monthStart;
    }
    return true;
  });

  // Advanced filters: search by name, specific month, specific year
  if (state.timelineSearch) {
    const q = state.timelineSearch.toLowerCase();
    completedItems = completedItems.filter(item => item.title.toLowerCase().includes(q));
  }
  if (state.timelineMonth !== "" && state.timelineMonth !== null && state.timelineMonth !== undefined) {
    const month = parseInt(state.timelineMonth);
    completedItems = completedItems.filter(item => new Date(item.completionDate).getMonth() === month);
  }
  if (state.timelineYear) {
    const year = parseInt(state.timelineYear);
    completedItems = completedItems.filter(item => new Date(item.completionDate).getFullYear() === year);
  }

  // 2. Sort by completion date descending
  completedItems.sort((a, b) => {
    return new Date(b.completionDate) - new Date(a.completionDate);
  });

  if (completedItems.length === 0) {
    emptyState.style.display = "flex";
    container.style.display = "none";
    teardownTimelineLazyLoad();
    return;
  }

  emptyState.style.display = "none";
  container.style.display = "block";

  setupTimelineLazyLoad(container, completedItems);
}

const TIMELINE_BATCH_SIZE = 30;
let timelineLazyLoadObserver = null;

function teardownTimelineLazyLoad() {
  if (timelineLazyLoadObserver) {
    timelineLazyLoadObserver.disconnect();
    timelineLazyLoadObserver = null;
  }
}

// Renders completedItems in batches (grouped by month), appending more as a
// sentinel scrolls into view, instead of building every timeline entry at once.
function setupTimelineLazyLoad(container, completedItems) {
  teardownTimelineLazyLoad();
  container.innerHTML = "";

  let renderedCount = 0;
  let currentMonth = "";
  let monthGroup = null;
  const sentinel = document.createElement("div");
  sentinel.className = "dashboard-lazy-sentinel";

  function renderNextBatch() {
    const nextItems = completedItems.slice(renderedCount, renderedCount + TIMELINE_BATCH_SIZE);
    if (nextItems.length === 0) return;

    nextItems.forEach(item => {
      const monthYear = new Date(item.completionDate).toLocaleString("default", { month: "long", year: "numeric" });

      if (monthYear !== currentMonth) {
        currentMonth = monthYear;
        monthGroup = document.createElement("div");
        monthGroup.className = "timeline-month-group";
        monthGroup.innerHTML = `
          <div class="timeline-month-marker">
            <span class="timeline-month-dot" style="--theme-color: ${CATEGORIES[item.category].color}"></span>
            <span class="timeline-month-title">${currentMonth}</span>
          </div>
          <div class="timeline-month-items"></div>
        `;
        container.insertBefore(monthGroup, sentinel);
      }

      const tItem = document.createElement("div");
      tItem.className = "timeline-item";
      tItem.style.setProperty("--theme-color", CATEGORIES[item.category].color);
      tItem.innerHTML = `
        ${thumbnailOrPlaceholder(item.thumbnail, "timeline-item-thumb")}
        <div class="timeline-item-content">
          <span class="timeline-item-text">${item.title}</span>
          <span class="timeline-item-meta">Completed on ${formatDate(item.completionDate)}</span>
        </div>
      `;
      monthGroup.querySelector(".timeline-month-items").appendChild(tItem);
    });

    renderedCount += nextItems.length;
    lucide.createIcons();

    if (renderedCount >= completedItems.length) {
      teardownTimelineLazyLoad();
      sentinel.remove();
    }
  }

  container.appendChild(sentinel);
  renderNextBatch();

  if (renderedCount < completedItems.length) {
    timelineLazyLoadObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) renderNextBatch();
    }, { root: null, rootMargin: "400px" });
    timelineLazyLoadObserver.observe(sentinel);
  }
}

// Render Statistics dashboard
function renderStats() {
  const totalEl = document.getElementById("stats-total");
  const completedEl = document.getElementById("stats-completed");
  const activeEl = document.getElementById("stats-active");
  const queuedEl = document.getElementById("stats-queued");
  const rateEl = document.getElementById("stats-rate");
  const timeLeftCard = document.getElementById("stats-time-left-card");
  const timeLeftEl = document.getElementById("stats-time-left");
  const timeDoneCard = document.getElementById("stats-time-done-card");
  const timeDoneEl = document.getElementById("stats-time-done");

  if (!totalEl) return;

  const activeCategory = state.activeCategoryChip || localStorage.getItem("squashdb_category_chip") || getOrderedCategories().find(key => state.preferences[key]);
  if (activeCategory && !state.activeCategoryChip) {
    state.activeCategoryChip = activeCategory;
    saveData();
  }

  // Filter items in enabled categories and selected category
  const activeItems = state.items.filter(item => state.preferences[item.category] && (!activeCategory || item.category === activeCategory));
  const completedItems = activeItems.filter(item => item.status === "Completed");
  const inProgressItems = activeItems.filter(item => item.status === "Playing" || item.status === "In Progress" || item.status === "Reading");
  const queuedStatuses = new Set(["Watchlist", "Playlist", "Backlog", "Plan to Read", "Plan to Watch", "Want to Play"]);
  const queuedItems = activeItems.filter(item => queuedStatuses.has(item.status));

  const totalCount = activeItems.length;
  const completedCount = completedItems.length;
  const activeCount = inProgressItems.length;
  const queuedCount = queuedItems.length;
  const rate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  totalEl.textContent = totalCount;
  completedEl.textContent = completedCount;
  activeEl.textContent = activeCount;
  if (queuedEl) queuedEl.textContent = queuedCount;
  rateEl.textContent = `${rate}%`;

  // Time-to-complete aggregates: only shown when at least one item in the
  // active view has enough data (runtime/reading speed) to estimate from.
  let minutesLeft = 0;
  let minutesDone = 0;
  let hasEstimableItem = false;
  activeItems.forEach(item => {
    const time = calculateTimeToComplete(item);
    if (!time) return;
    hasEstimableItem = true;
    minutesLeft += time.remaining;
    minutesDone += (time.total - time.remaining);
  });

  if (timeLeftCard && timeLeftEl) {
    timeLeftCard.style.display = hasEstimableItem ? "flex" : "none";
    timeLeftEl.textContent = formatMinutesAsDuration(minutesLeft);
  }
  if (timeDoneCard && timeDoneEl) {
    timeDoneCard.style.display = hasEstimableItem ? "flex" : "none";
    timeDoneEl.textContent = formatMinutesAsDuration(minutesDone);
  }

  const activeItemIds = new Set(activeItems.map(item => item.id));
  renderStatsGenres(activeItems);
  renderStatsNetworks(activeItems);
  renderStatsRatings(activeItems);
  renderStatsWatchCharts(activeItemIds);
}

// Top genres leaderboard, scoped to whatever category chip is active. Genres
// are only captured going forward (see show-detail.js), so older tracked
// items may simply have no genres array yet.
function renderStatsGenres(activeItems) {
  const card = document.getElementById("stats-genres-card");
  const chart = document.getElementById("stats-genres-chart");
  if (!card || !chart) return;

  const counts = {};
  activeItems.forEach(item => {
    (item.genres || []).forEach(g => {
      counts[g] = (counts[g] || 0) + 1;
    });
  });

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (entries.length === 0) {
    card.style.display = "none";
    return;
  }

  card.style.display = "flex";
  const max = entries[0][1];
  chart.innerHTML = entries.map(([genre, count]) => `
    <div class="bar-item">
      <div class="bar-labels"><span>${genre}</span><span>${count}</span></div>
      <div class="bar-bg"><div class="bar-fill" style="width:${Math.round((count / max) * 100)}%; background: var(--primary);"></div></div>
    </div>
  `).join("");
}

function renderStatsNetworks(activeItems) {
  const card = document.getElementById("stats-networks-card");
  const chart = document.getElementById("stats-networks-chart");
  if (!card || !chart) return;

  const counts = {};
  activeItems.forEach(item => {
    if (item.network) counts[item.network] = (counts[item.network] || 0) + 1;
  });

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (entries.length === 0) {
    card.style.display = "none";
    return;
  }

  card.style.display = "flex";
  const max = entries[0][1];
  chart.innerHTML = entries.map(([network, count]) => `
    <div class="bar-item">
      <div class="bar-labels"><span>${network}</span><span>${count}</span></div>
      <div class="bar-bg"><div class="bar-fill" style="width:${Math.round((count / max) * 100)}%; background: var(--primary);"></div></div>
    </div>
  `).join("");
}

// Local single-user equivalent of a "voted ratings" card: your own average
// rating and a top-rated leaderboard, scoped to the active category.
function renderStatsRatings(activeItems) {
  const card = document.getElementById("stats-ratings-card");
  const avgEl = document.getElementById("stats-avg-rating");
  const countEl = document.getElementById("stats-rated-count");
  const listEl = document.getElementById("stats-top-rated-list");
  if (!card || !avgEl || !countEl || !listEl) return;

  const ratedItems = activeItems.filter(item => item.rating > 0);
  if (ratedItems.length === 0) {
    card.style.display = "none";
    return;
  }

  card.style.display = "flex";
  const avg = ratedItems.reduce((sum, item) => sum + item.rating, 0) / ratedItems.length;
  avgEl.textContent = formatRatingValue(avg);
  countEl.textContent = ratedItems.length;

  const topRated = [...ratedItems].sort((a, b) => b.rating - a.rating).slice(0, 5);
  listEl.innerHTML = topRated.map(item => `
    <div class="leaderboard-row">
      <span class="leaderboard-row-title">${item.title}</span>
      <span class="leaderboard-row-meta">${formatRatingValue(item.rating)}</span>
    </div>
  `).join("");
}

// Weekly time-series (hours + episode count) built from state.watchLog, plus
// a "biggest marathons" leaderboard (most episodes of one show in a single
// day). Only reflects episodes ticked after watch-logging shipped.
function renderStatsWatchCharts(activeItemIds) {
  const timeCard = document.getElementById("stats-weekly-time-card");
  const timeChart = document.getElementById("stats-weekly-time-chart");
  const epCard = document.getElementById("stats-weekly-episodes-card");
  const epChart = document.getElementById("stats-weekly-episodes-chart");
  const marathonsCard = document.getElementById("stats-marathons-card");
  const marathonsList = document.getElementById("stats-marathons-list");
  if (!timeCard || !timeChart || !epCard || !epChart || !marathonsCard || !marathonsList) return;

  const log = (state.watchLog || []).filter(entry => activeItemIds.has(entry.itemId));
  if (log.length === 0) {
    timeCard.style.display = "none";
    epCard.style.display = "none";
    marathonsCard.style.display = "none";
    return;
  }

  // Bucket into the last 8 ISO weeks (Mon-Sun), oldest first.
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7; // 0 = Monday
  const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek).getTime();

  const weekBuckets = Array.from({ length: 8 }, (_, i) => {
    const weekStart = startOfThisWeek - (7 - i) * msPerWeek;
    return { weekStart, weekEnd: weekStart + msPerWeek, minutes: 0, episodes: 0 };
  });

  const dayTotals = {}; // "itemId|YYYY-MM-DD" -> { title, count }
  log.forEach(entry => {
    const bucket = weekBuckets.find(w => entry.watchedAt >= w.weekStart && entry.watchedAt < w.weekEnd);
    if (bucket) {
      bucket.minutes += entry.runtime || 0;
      bucket.episodes += 1;
    }
    const dayKey = `${entry.itemId}|${new Date(entry.watchedAt).toISOString().slice(0, 10)}`;
    if (!dayTotals[dayKey]) dayTotals[dayKey] = { title: entry.title, count: 0, minutes: 0 };
    dayTotals[dayKey].count += 1;
    dayTotals[dayKey].minutes += entry.runtime || 0;
  });

  timeCard.style.display = "flex";
  epCard.style.display = "flex";
  const maxMinutes = Math.max(...weekBuckets.map(w => w.minutes), 1);
  const maxEpisodes = Math.max(...weekBuckets.map(w => w.episodes), 1);

  timeChart.innerHTML = weekBuckets.map(w => `
    <div class="column-chart-col">
      <span class="column-chart-value">${w.minutes ? formatMinutesAsDuration(w.minutes) : ""}</span>
      <div class="column-chart-bar" style="height:${Math.round((w.minutes / maxMinutes) * 100)}%"></div>
      <span class="column-chart-label">${new Date(w.weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
    </div>
  `).join("");

  epChart.innerHTML = weekBuckets.map(w => `
    <div class="column-chart-col">
      <span class="column-chart-value">${w.episodes || ""}</span>
      <div class="column-chart-bar" style="height:${Math.round((w.episodes / maxEpisodes) * 100)}%"></div>
      <span class="column-chart-label">${new Date(w.weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
    </div>
  `).join("");

  const marathons = Object.values(dayTotals).sort((a, b) => b.count - a.count).slice(0, 5);
  if (marathons.length === 0) {
    marathonsCard.style.display = "none";
  } else {
    marathonsCard.style.display = "flex";
    marathonsList.innerHTML = marathons.map(m => `
      <div class="leaderboard-row">
        <span class="leaderboard-row-title">${m.title}</span>
        <span class="leaderboard-row-meta"><span>${m.count} ep</span><span>${formatMinutesAsDuration(m.minutes)}</span></span>
      </div>
    `).join("");
  }
}

// Attach listeners to note cards (checkbox click, edits, deletion, quick increments)
// Binds listeners only to elements not already bound (tracked via data-bound),
// so this can be called repeatedly as batches of cards are appended incrementally
// without stacking duplicate listeners on already-bound cards.
function attachCardEvents() {
  const rowActions = state.preferences.dashboardRowActions || "menu";

  const bindOnce = (selector, bind) => {
    document.querySelectorAll(`${selector}:not([data-bound])`).forEach(el => {
      el.dataset.bound = "true";
      bind(el);
    });
  };

  // Checkbox toggle
  bindOnce(".note-checkbox", chk => {
    chk.addEventListener("change", (e) => {
      const id = chk.getAttribute("data-id");
      toggleCompletion(id, e.target.checked);
    });
    chk.addEventListener("click", (e) => e.stopPropagation());
  });

  // Edit action
  bindOnce(".edit-btn", btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      openItemForCategory(id);
    });
  });

  // Delete action
  bindOnce(".delete-btn", btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      confirmDelete(btn.getAttribute("data-id"));
    });
  });

  // Menu action (3-dot)
  bindOnce(".menu-btn", btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openRowActionMenu(btn.getAttribute("data-id"));
    });
  });

  // Increment Episode/Chapter progress actions
  bindOnce(".inc-btn", btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const type = btn.getAttribute("data-type");
      incrementProgress(id, type);
    });
  });

  bindOnce(".note-card", card => {
    if (rowActions === "tap-hold") {
      bindTapHold(card);
    } else if (rowActions === "swipe") {
      bindSwipe(card);
    }
    // "menu" mode: no row-tap handler — edit/delete only via the 3-dot menu
  });
}

// Row action mode: tap = edit, long-press (~500ms) = delete confirm
function bindTapHold(card) {
  let pressTimer = null;
  let longPressed = false;

  const start = () => {
    longPressed = false;
    pressTimer = setTimeout(() => {
      longPressed = true;
      confirmDelete(card.dataset.id);
    }, 500);
  };
  const cancel = () => clearTimeout(pressTimer);

  card.addEventListener("mousedown", start);
  card.addEventListener("touchstart", start, { passive: true });
  card.addEventListener("mouseup", cancel);
  card.addEventListener("mouseleave", cancel);
  card.addEventListener("touchend", cancel);
  card.addEventListener("touchmove", cancel);
  card.addEventListener("click", () => {
    if (!longPressed) openItemForCategory(card.dataset.id);
  });
}

// Row action mode: swipe left reveals delete, swipe right reveals edit
function bindSwipe(card) {
  const content = card.querySelector(".note-row-content");
  let startX = 0;
  let currentX = 0;
  let dragging = false;

  const onStart = (x) => {
    startX = x;
    dragging = true;
    content.style.transition = "none";
  };
  const onMove = (x) => {
    if (!dragging) return;
    currentX = Math.max(-80, Math.min(80, x - startX));
    content.style.transform = `translateX(${currentX}px)`;
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    content.style.transition = "transform calc(0.2s * var(--anim-speed)) ease";
    if (currentX <= -40) {
      content.style.transform = "translateX(-80px)";
    } else if (currentX >= 40) {
      content.style.transform = "translateX(80px)";
    } else {
      content.style.transform = "translateX(0)";
    }
  };

  card.addEventListener("touchstart", (e) => onStart(e.touches[0].clientX), { passive: true });
  card.addEventListener("touchmove", (e) => onMove(e.touches[0].clientX), { passive: true });
  card.addEventListener("touchend", onEnd);

  card.addEventListener("mousedown", (e) => onStart(e.clientX));
  card.addEventListener("mousemove", (e) => onMove(e.clientX));
  card.addEventListener("mouseup", onEnd);
  card.addEventListener("mouseleave", () => { if (dragging) onEnd(); });

  content.addEventListener("click", () => {
    if (Math.abs(currentX) < 5) {
      openItemForCategory(card.dataset.id);
    }
  });
}

// 3-dot menu: reuse the settings picker bottom-sheet for Edit/Delete
function openRowActionMenu(id) {
  const modal = document.getElementById("picker-modal");
  const list = document.getElementById("picker-options-list");
  const titleEl = document.getElementById("picker-modal-title");
  if (!modal || !list) return;

  titleEl.textContent = "Item Actions";
  list.innerHTML = "";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "picker-option";
  editBtn.innerHTML = `<i data-lucide="edit-2" class="picker-option-check" style="visibility:visible;"></i><span>Edit</span>`;
  editBtn.addEventListener("click", () => {
    closeSettingsPicker();
    openItemForCategory(id);
  });
  list.appendChild(editBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "picker-option";
  deleteBtn.innerHTML = `<i data-lucide="trash-2" class="picker-option-check" style="visibility:visible;"></i><span>Delete</span>`;
  deleteBtn.addEventListener("click", () => {
    confirmDelete(id);
  });
  list.appendChild(deleteBtn);

  modal.classList.add("active");
  if (window.lucide) lucide.createIcons();
}

// Custom in-app delete confirmation (avoids relying on window.confirm in WebViews)
function confirmDelete(id) {
  const modal = document.getElementById("picker-modal");
  const list = document.getElementById("picker-options-list");
  const titleEl = document.getElementById("picker-modal-title");
  if (!modal || !list) return;

  titleEl.textContent = "Delete this tracker?";
  list.innerHTML = "";

  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "picker-option";
  confirmBtn.innerHTML = `<i data-lucide="trash-2" class="picker-option-check" style="visibility:visible; color: var(--danger);"></i><span style="color: var(--danger);">Delete</span>`;
  confirmBtn.addEventListener("click", () => {
    closeSettingsPicker();
    deleteEntry(id);
  });
  list.appendChild(confirmBtn);

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "picker-option";
  cancelBtn.innerHTML = `<i data-lucide="x" class="picker-option-check" style="visibility:visible;"></i><span>Cancel</span>`;
  cancelBtn.addEventListener("click", closeSettingsPicker);
  list.appendChild(cancelBtn);

  modal.classList.add("active");
  if (window.lucide) lucide.createIcons();
}

// Toggle Completion state
function toggleCompletion(id, isChecked) {
  const itemIndex = state.items.findIndex(item => item.id === id);
  if (itemIndex === -1) return;

  const item = state.items[itemIndex];
  
  if (isChecked) {
    item.status = "Completed";
    
    // Set completion date to local time today
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localDateStr = new Date(now.getTime() - (offset * 60 * 1000)).toISOString().split("T")[0];
    item.completionDate = localDateStr;
    
    // Max progress if numerical fields exist
    if (item.category === "series" || item.category === "kdrama" || item.category === "cdrama" || item.category === "anime") {
      const seasonTotal = getSeasonTotalEpisodes(item);
      const seasonWatched = getSeasonWatchedEpisodes(item);
      if (seasonTotal > 0) item.totalEpisodes = seasonTotal;
    if (seasonWatched > 0) item.episodesDone = seasonWatched;
  } else if (item.category === "manga" || item.category === "novel") {
      if (parseInt(item.totalVolumes) > 0) item.volumesRead = item.totalVolumes;
    }
  } else {
    // Revert status to In Progress / Playing
    if (item.category === "game") {
      item.status = "Playing";
    } else if (item.category === "movie") {
      item.status = "Watchlist";
    } else if (item.category === "series" || item.category === "kdrama" || item.category === "cdrama" || item.category === "anime") {
      item.status = "In Progress";
    } else if (item.category === "manga" || item.category === "novel") {
      item.status = "Reading";
    }
    item.completionDate = null;
  }

  saveData();
  renderDashboard();
  renderTimeline();
  renderStats();
}

// Increment quick progress (Episodes / Chapters)
function incrementProgress(id, type) {
  const itemIndex = state.items.findIndex(item => item.id === id);
  if (itemIndex === -1) return;

  const item = state.items[itemIndex];
  
  if (type === "ep") {
    let currentEp = parseInt(item.episodesDone) || 0;
    let totalEp = parseInt(item.totalEpisodes) || getSeasonTotalEpisodes(item) || 0;
    
    currentEp += 1;
    if (totalEp > 0 && currentEp >= totalEp) {
      currentEp = totalEp;
      toggleCompletion(id, true);
      return;
    }
    item.episodesDone = currentEp;
  } else if (type === "ch") {
    let currentCh = parseInt(item.volumesRead) || 0;
    let totalCh = parseInt(item.totalVolumes) || 0;
    
    currentCh += 1;
    if (totalCh > 0 && currentCh >= totalCh) {
      currentCh = totalCh;
      toggleCompletion(id, true);
      return;
    }
    item.volumesRead = currentCh;
  }

  saveData();
  renderDashboard();
  renderStats();
}

// Delete Tracking Entry
function deleteEntry(id) {
  state.items = state.items.filter(item => item.id !== id);
  saveData();
  renderDashboard();
  renderTimeline();
  renderStats();
}

// Opens the right editor for an existing item: the full season/episode detail
// page for episode-tracked categories (series/kdrama/cdrama/anime), or the
// classic edit modal for everything else (movie/game/manga/novel).
const SHOW_DETAIL_PAGE_CATEGORIES = [...EPISODE_TRACKED_CATEGORIES, "movie", "manga", "novel"];

function openItemForCategory(id) {
  const item = state.items.find(i => i.id === id);
  if (item && SHOW_DETAIL_PAGE_CATEGORIES.includes(item.category)) {
    window.location.href = `show-detail.html?source=local&itemId=${encodeURIComponent(id)}`;
    return;
  }
  openModal(id);
}

// Open Form Modal (Add / Edit)
function openModal(editId = null) {
  const modal = document.getElementById("item-modal");
  const modalTitle = document.getElementById("modal-title");
  const form = document.getElementById("tracker-form");
  
  form.reset();
  state.activeRating = 0;
  fetchedMetadataDraft = null;
  hideMetadataResults();

  // Clear inputs
  document.getElementById("entry-id").value = "";
  const categoryField = document.getElementById("entry-category");
  const categoryLabel = document.getElementById("entry-category-label");
  
  // Make sure at least one active category is selected
  const activeCats = Object.keys(CATEGORIES).filter(k => state.preferences[k]);
  if (activeCats.length === 0) {
    alert("Please enable at least one Tracking Category in the Settings tab first!");
    switchTab("tab-settings");
    return;
  }

  if (editId) {
    modalTitle.textContent = "Edit Tracking Entry";
    const item = state.items.find(i => i.id === editId);
    if (!item) return;

    document.getElementById("entry-id").value = item.id;
    document.getElementById("entry-title").value = item.title;
    if (categoryField) categoryField.value = item.category;
    if (categoryLabel) categoryLabel.textContent = CATEGORIES[item.category].label;
    state.lastEntryCategory = item.category;
    document.getElementById("entry-notes").value = item.notes || "";
    
    state.activeRating = item.rating || 0;

    // Render category fields first
    renderDynamicFormFields(item.category);

    // Populate dynamic fields
    const statusSelect = document.getElementById("field-status");
    if (statusSelect) statusSelect.value = item.status;

    const ratingVal = document.getElementById("field-rating-val");
    if (ratingVal) ratingVal.value = item.rating || 0;
    updateStarsUI(item.rating || 0);

    const compDate = document.getElementById("field-completion-date");
    if (compDate) {
      compDate.value = item.completionDate || "";
      toggleCompletionDateVisibility(item.status);
    }

    if (item.thumbnail) {
      if (!thumbnailsEnabled()) {
        clearMetadataPreview();
      } else {
        applyMetadataPreview({
          title: item.title,
          meta: item.status || "",
          image: item.thumbnail
        });
      }
    } else {
      clearMetadataPreview();
    }

    if (item.category === "series" || item.category === "kdrama" || item.category === "cdrama" || item.category === "anime") {
      document.getElementById("field-total-seasons").value = item.totalSeasons || "";
      renderSeasonEpisodeFields(item.totalSeasons || Object.keys(item.seasonEpisodes || {}).length || 1);
      const seasonEpisodes = normalizeSeasonEpisodes(item.seasonEpisodes);
      Object.keys(seasonEpisodes).forEach(seasonKey => {
        const seasonNum = seasonKey.replace("season", "");
        const totalInput = document.getElementById(`field-season-total-${seasonNum}`);
        const watchedInput = document.getElementById(`field-season-watched-${seasonNum}`);
        const completeInput = document.getElementById(`field-season-complete-${seasonNum}`);
        const season = seasonEpisodes[seasonKey];
        if (totalInput) totalInput.value = season.total || 0;
        if (watchedInput) watchedInput.value = season.completed ? (season.total || 0) : (season.watched || 0);
        if (completeInput) {
          completeInput.checked = Boolean(season.completed);
          completeInput.closest(".season-episode-row")?.classList.toggle("season-done", completeInput.checked);
        }
      });
      const watchedCount = Object.values(seasonEpisodes).filter(s => s.completed).length;
      const seasonsWatchedInput = document.getElementById("field-seasons-watched");
      if (seasonsWatchedInput) seasonsWatchedInput.value = watchedCount || "";
      const episodeRuntimeInput = document.getElementById("field-episode-runtime");
      if (episodeRuntimeInput) episodeRuntimeInput.value = item.episodeRuntime || "";
    } else if (item.category === "manga") {
      document.getElementById("field-total-volumes").value = item.totalVolumes || "";
      document.getElementById("field-volumes-read").value = item.volumesRead || 0;
    } else if (item.category === "novel") {
      document.getElementById("field-total-volumes").value = item.totalVolumes || "";
      document.getElementById("field-volumes-read").value = item.volumesRead || 0;
      document.getElementById("field-total-chapters").value = item.totalChapters || "";
      document.getElementById("field-chapters-read").value = item.chaptersRead || 0;
      document.getElementById("field-minutes-per-chapter").value = item.minutesPerChapter || 15;
    } else if (item.category === "movie") {
      const totalMinutes = parseInt(item.playtime) || 0;
      document.getElementById("field-playtime").value = totalMinutes || "";
      document.getElementById("field-playtime-hours").value = totalMinutes ? Math.floor(totalMinutes / 60) : "";
      document.getElementById("field-playtime-minutes").value = totalMinutes ? totalMinutes % 60 : "";
    }

  } else {
    modalTitle.textContent = "Add Tracking Entry";
    const preferredCat = state.activeCategoryChip && state.preferences[state.activeCategoryChip]
      ? state.activeCategoryChip
      : (state.preferences[state.lastEntryCategory] ? state.lastEntryCategory : activeCats[0]);
    if (categoryField) categoryField.value = preferredCat;
    if (categoryLabel) categoryLabel.textContent = CATEGORIES[preferredCat].label;
    state.lastEntryCategory = preferredCat;
    renderDynamicFormFields(preferredCat);
    clearMetadataPreview();
  }

  modal.classList.add("active");
}

// Close Modal
function closeModal() {
  const modal = document.getElementById("item-modal");
  modal.classList.remove("active");
}

// Render dynamic fields inside modal depending on category
function renderDynamicFormFields(category) {
  const container = document.getElementById("dynamic-fields");
  if (!container) return;

  container.innerHTML = "";
  hideMetadataResults();

  const config = CATEGORIES[category];
  
  // Status Dropdown Options
  let statusOptions = "";
  config.statuses.forEach(st => {
    statusOptions += `<option value="${st}">${st}</option>`;
  });

  // Compile Dynamic HTML
  let fieldsHTML = `
    <div class="form-group">
      <label for="field-status">Status</label>
      <select id="field-status" class="form-control" required>
        ${statusOptions}
      </select>
    </div>
  `;

  if ((category === "series" || category === "kdrama" || category === "cdrama" || category === "anime" || category === "movie") && state.preferences.metadataMode === "online") {
    fieldsHTML += `
      <div class="form-group" id="metadata-hint" style="margin-top: 8px;">
        <button type="button" class="btn btn-secondary" id="metadata-fetch-btn" style="width: 100%;">
          <i data-lucide="search"></i> Fetch metadata
        </button>
        <p class="settings-row-note" style="margin: 8px 2px 0;">Online mode will try to fill counts and show a thumbnail from public metadata sources.</p>
      </div>
    `;
  }

  fieldsHTML += `
    <div class="metadata-preview" id="metadata-preview" style="display:none;">
      <img id="metadata-preview-thumb" alt="" />
      <div class="metadata-preview-body">
        <div class="metadata-preview-title" id="metadata-preview-title"></div>
        <div class="metadata-preview-meta" id="metadata-preview-meta"></div>
      </div>
    </div>
  `;

  fieldsHTML += `
    <div class="metadata-results" id="metadata-results" style="display:none;">
      <div class="metadata-results-title">Select a match</div>
      <div id="metadata-results-list" class="metadata-results-list"></div>
    </div>
  `;

  fieldsHTML += `
    <div class="form-group" id="comp-date-group" style="display: none;">
      <label for="field-completion-date">Completion Date</label>
      <input type="date" id="field-completion-date" class="form-control">
    </div>
  `;

  if (category === "series" || category === "kdrama" || category === "cdrama" || category === "anime") {
    fieldsHTML += `
      <div class="form-row">
        <div class="form-group">
          <label for="field-total-seasons">Total Seasons</label>
          <input type="number" id="field-total-seasons" class="form-control" min="0" placeholder="e.g. 5">
        </div>
        <div class="form-group">
          <label for="field-seasons-watched">Seasons Watched</label>
          <input type="number" id="field-seasons-watched" class="form-control" min="0" placeholder="e.g. 2">
        </div>
      </div>
      <div class="season-episodes-wrap">
        <label class="season-episodes-title">Episodes per Season</label>
        <div id="season-episodes-fields" class="season-episodes-fields"></div>
      </div>
      <div class="form-group">
        <label for="field-episode-runtime">Avg. Episode Runtime (minutes)</label>
        <input type="number" id="field-episode-runtime" class="form-control" min="0" placeholder="e.g. 24">
      </div>
    `;
  } else if (category === "manga") {
    fieldsHTML += `
      <div class="form-row">
        <div class="form-group">
          <label for="field-total-volumes">Total Volumes</label>
          <input type="number" id="field-total-volumes" class="form-control" min="0" placeholder="e.g. 12">
        </div>
        <div class="form-group">
          <label for="field-volumes-read">Volumes Read</label>
          <input type="number" id="field-volumes-read" class="form-control" min="0" value="0">
        </div>
      </div>
    `;
  } else if (category === "novel") {
    fieldsHTML += `
      <div class="form-row">
        <div class="form-group">
          <label for="field-total-volumes">Total Volumes</label>
          <input type="number" id="field-total-volumes" class="form-control" min="0" placeholder="e.g. 12">
        </div>
        <div class="form-group">
          <label for="field-volumes-read">Volumes Read</label>
          <input type="number" id="field-volumes-read" class="form-control" min="0" value="0">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="field-total-chapters">Total Chapters</label>
          <input type="number" id="field-total-chapters" class="form-control" min="0" placeholder="e.g. 150">
        </div>
        <div class="form-group">
          <label for="field-chapters-read">Chapters Read</label>
          <input type="number" id="field-chapters-read" class="form-control" min="0" value="0">
        </div>
      </div>
      <div class="form-group">
        <label for="field-minutes-per-chapter">Avg. Reading Time per Chapter (minutes)</label>
        <input type="number" id="field-minutes-per-chapter" class="form-control" min="0" placeholder="e.g. 15" value="15">
      </div>
    `;
  } else if (category === "movie") {
    fieldsHTML += `
      <input type="hidden" id="field-playtime">
      <div class="form-row">
        <div class="form-group">
          <label for="field-playtime-hours">Runtime (hours)</label>
          <input type="number" id="field-playtime-hours" class="form-control" min="0" placeholder="e.g. 2">
        </div>
        <div class="form-group">
          <label for="field-playtime-minutes">Runtime (minutes)</label>
          <input type="number" id="field-playtime-minutes" class="form-control" min="0" max="59" placeholder="e.g. 32">
        </div>
      </div>
    `;
  }

  const ratingFormat = state.preferences.ratingFormat || "5-stars";
  if (ratingFormat === "5-stars") {
    fieldsHTML += `
      <div class="form-group" style="margin-top: 10px;">
        <label>Rating</label>
        <input type="hidden" id="field-rating-val" value="0">
        <div class="rating-container" id="stars-picker">
          <i class="star" data-rating="1" data-lucide="star"></i>
          <i class="star" data-rating="2" data-lucide="star"></i>
          <i class="star" data-rating="3" data-lucide="star"></i>
          <i class="star" data-rating="4" data-lucide="star"></i>
          <i class="star" data-rating="5" data-lucide="star"></i>
        </div>
      </div>
    `;
  } else {
    const maxRating = ratingFormat === "100-points" ? 100 : 10;
    const step = ratingFormat === "10-decimal" ? "0.1" : "1";
    const currentValue = ratingFormat === "100-points"
      ? Math.round((state.activeRating || 0) * 20)
      : Math.round((state.activeRating || 0) * 2);
    fieldsHTML += `
      <div class="form-group" style="margin-top: 10px;">
        <label for="field-rating-score">Rating</label>
        <input type="number" id="field-rating-score" class="form-control" min="0" max="${maxRating}" step="${step}" value="${currentValue}">
        <input type="hidden" id="field-rating-val" value="${state.activeRating || 0}">
      </div>
    `;
  }

  container.innerHTML = fieldsHTML;
  lucide.createIcons();

  const totalSeasonsInput = document.getElementById("field-total-seasons");
  if (totalSeasonsInput) {
    totalSeasonsInput.addEventListener("input", (e) => {
      renderSeasonEpisodeFields(parseInt(e.target.value) || 0);
    });
  }

  const seasonsWatchedInput = document.getElementById("field-seasons-watched");
  if (seasonsWatchedInput) {
    seasonsWatchedInput.addEventListener("input", (e) => {
      const watchedCount = parseInt(e.target.value) || 0;
      const totalSeasons = parseInt(totalSeasonsInput?.value) || 0;
      for (let i = 1; i <= totalSeasons; i++) {
        const completeInput = document.getElementById(`field-season-complete-${i}`);
        if (!completeInput) continue;
        completeInput.checked = i <= watchedCount;
        completeInput.dispatchEvent(new Event("change"));
      }
    });
  }

  const playtimeHoursInput = document.getElementById("field-playtime-hours");
  const playtimeMinutesInput = document.getElementById("field-playtime-minutes");
  const playtimeHiddenInput = document.getElementById("field-playtime");
  if (playtimeHoursInput && playtimeMinutesInput && playtimeHiddenInput) {
    const syncPlaytime = () => {
      const hours = parseInt(playtimeHoursInput.value) || 0;
      const minutes = parseInt(playtimeMinutesInput.value) || 0;
      const total = hours * 60 + minutes;
      playtimeHiddenInput.value = total || "";
    };
    playtimeHoursInput.addEventListener("input", syncPlaytime);
    playtimeMinutesInput.addEventListener("input", syncPlaytime);
  }

  // Attach status change watcher to toggle completion date input
  const statusSelect = document.getElementById("field-status");
  statusSelect.addEventListener("change", (e) => {
    toggleCompletionDateVisibility(e.target.value);
  });

  const metadataFetchBtn = document.getElementById("metadata-fetch-btn");
  if (metadataFetchBtn) {
    metadataFetchBtn.addEventListener("click", async () => {
      await fetchAndApplyMetadataFromTitle();
    });
  }

  const titleInput = document.getElementById("entry-title");
  if (titleInput && !titleInput.dataset.boundMetadataLookup) {
    titleInput.dataset.boundMetadataLookup = "true";
    let titleLookupTimer = null;
    const scheduleLookup = () => {
      if (state.preferences.metadataMode !== "online") return;
      clearTimeout(titleLookupTimer);
      titleLookupTimer = setTimeout(() => {
        fetchAndApplyMetadataFromTitle();
      }, 700);
    };
    titleInput.addEventListener("blur", scheduleLookup);
    titleInput.addEventListener("input", scheduleLookup);
  }

  if (ratingFormat === "5-stars") {
    const stars = document.querySelectorAll("#stars-picker .star");
    stars.forEach(star => {
      star.addEventListener("click", () => {
        const val = parseInt(star.getAttribute("data-rating"));
        state.activeRating = val;
        document.getElementById("field-rating-val").value = val;
        updateStarsUI(val);
      });
    });
    updateStarsUI(state.activeRating);
  } else {
    const ratingInput = document.getElementById("field-rating-score");
    if (ratingInput) {
      ratingInput.addEventListener("input", (e) => {
        state.activeRating = ratingToStoredValue(e.target.value);
        const ratingVal = document.getElementById("field-rating-val");
        if (ratingVal) ratingVal.value = state.activeRating;
      });
    }
  }

  const metadataResultsList = document.getElementById("metadata-results-list");
  if (metadataResultsList && !metadataResultsList.dataset.boundPick) {
    metadataResultsList.dataset.boundPick = "true";
    const handlePick = (e) => {
      const btn = e.target.closest("[data-metadata-index]");
      if (!btn) return;
      e.preventDefault();
      const idx = parseInt(btn.dataset.metadataIndex);
      selectMetadataResult(idx);
    };
    metadataResultsList.addEventListener("pointerdown", handlePick);
    metadataResultsList.addEventListener("click", handlePick);
  }
}

function applySeriesMetadata(meta) {
  const totalSeasonsInput = document.getElementById("field-total-seasons");
  if (!totalSeasonsInput || !meta) return;

  const totalSeasons = parseInt(meta.totalSeasons) || 0;
  if (totalSeasons <= 0) return;

  totalSeasonsInput.value = totalSeasons;
  renderSeasonEpisodeFields(totalSeasons);

  const perSeason = Array.isArray(meta.seasons) ? meta.seasons : [];
  for (let i = 1; i <= totalSeasons; i++) {
    const totalInput = document.getElementById(`field-season-total-${i}`);
    const watchedInput = document.getElementById(`field-season-watched-${i}`);
    const completeInput = document.getElementById(`field-season-complete-${i}`);
    const seasonTotal = parseInt(perSeason[i - 1]) || 0;
    if (totalInput) totalInput.value = seasonTotal;
    if (watchedInput) watchedInput.value = 0;
    if (completeInput) completeInput.checked = false;
  }

  const totalEpisodes = parseInt(meta.totalEpisodes) || 0;
  if (totalEpisodes > 0) {
    const statusSelect = document.getElementById("field-status");
    if (statusSelect && statusSelect.value === "Watchlist") {
      statusSelect.value = "In Progress";
      toggleCompletionDateVisibility("In Progress");
    }
  }
}

function renderSeasonEpisodeFields(totalSeasons) {
  const container = document.getElementById("season-episodes-fields");
  if (!container) return;

  const count = Math.max(0, parseInt(totalSeasons) || 0);
  container.innerHTML = "";
  for (let i = 1; i <= count; i++) {
    const row = document.createElement("div");
    row.className = "season-episode-row";
    row.innerHTML = `
      <label class="season-row-label">
        <input type="checkbox" id="field-season-complete-${i}" class="season-complete-checkbox">
        <span>Season ${i}</span>
      </label>
      <div class="season-row-controls">
        <div class="season-mini-field">
          <label for="field-season-total-${i}">Total</label>
          <input type="number" id="field-season-total-${i}" class="form-control" min="0" value="0" placeholder="20">
        </div>
        <div class="season-mini-field">
          <label for="field-season-watched-${i}">Watched</label>
          <input type="number" id="field-season-watched-${i}" class="form-control" min="0" value="0" placeholder="0">
        </div>
      </div>
    `;
    container.appendChild(row);

    const totalInput = row.querySelector(`#field-season-total-${i}`);
    const watchedInput = row.querySelector(`#field-season-watched-${i}`);
    const completeInput = row.querySelector(`#field-season-complete-${i}`);

    const syncRow = () => {
      const total = parseInt(totalInput.value) || 0;
      if (completeInput.checked) {
        watchedInput.value = total;
        watchedInput.readOnly = true;
      } else {
        watchedInput.readOnly = false;
      }
      if (parseInt(watchedInput.value) > total && total > 0) {
        watchedInput.value = total;
      }
      row.classList.toggle("season-done", completeInput.checked);
    };

    totalInput.addEventListener("input", syncRow);
    watchedInput.addEventListener("input", () => {
      completeInput.checked = false;
      watchedInput.readOnly = false;
      syncRow();
    });
    completeInput.addEventListener("change", syncRow);
    syncRow();
  }
}

// Toggle completion date field visibility
function toggleCompletionDateVisibility(status) {
  const dateGroup = document.getElementById("comp-date-group");
  const dateInput = document.getElementById("field-completion-date");
  if (!dateGroup) return;

  if (status === "Completed") {
    dateGroup.style.display = "flex";
    if (!dateInput.value) {
      // Set to today's date in local system time
      const now = new Date();
      const offset = now.getTimezoneOffset();
      const localDateStr = new Date(now.getTime() - (offset * 60 * 1000)).toISOString().split("T")[0];
      dateInput.value = localDateStr;
    }
  } else {
    dateGroup.style.display = "none";
    dateInput.value = "";
  }
}

// Update stars outline/fill classes in Modal picker
function updateStarsUI(rating) {
  const stars = document.querySelectorAll("#stars-picker .star");
  stars.forEach(star => {
    const rVal = parseInt(star.getAttribute("data-rating"));
    if (rVal <= rating) {
      star.classList.add("active");
      star.style.fill = "currentColor";
    } else {
      star.classList.remove("active");
      star.style.fill = "none";
    }
  });
}

// Handle Form Submission for Tracker (Create / Update)
function handleFormSubmit(e) {
  e.preventDefault();
  
  const id = document.getElementById("entry-id").value;
  const title = document.getElementById("entry-title").value.trim();
  const category = document.getElementById("entry-category").value;
  const notes = document.getElementById("entry-notes").value.trim();

  const status = document.getElementById("field-status").value;
  const rating = parseInt(document.getElementById("field-rating-val").value) || 0;
  const completionDate = document.getElementById("field-completion-date") ? document.getElementById("field-completion-date").value : null;

  let extraData = {};

  if (category === "series" || category === "anime") {
    const totalSeasons = parseInt(document.getElementById("field-total-seasons").value) || 0;
    const seasonEpisodes = {};
    for (let i = 1; i <= totalSeasons; i++) {
      const total = parseInt(document.getElementById(`field-season-total-${i}`)?.value) || 0;
      const complete = document.getElementById(`field-season-complete-${i}`)?.checked || false;
      const watchedInput = parseInt(document.getElementById(`field-season-watched-${i}`)?.value) || 0;
      seasonEpisodes[`season${i}`] = {
        total,
        watched: complete ? total : watchedInput,
        completed: complete
      };
    }
    const totalEpisodesFromSeasons = Object.values(seasonEpisodes).reduce((sum, season) => sum + (parseInt(season.total) || 0), 0);
    const watchedEpisodesFromSeasons = Object.values(seasonEpisodes).reduce((sum, season) => sum + ((season.completed ? (parseInt(season.total) || 0) : (parseInt(season.watched) || 0))), 0);
    extraData = {
      totalSeasons,
      episodesDone: watchedEpisodesFromSeasons,
      totalEpisodes: totalEpisodesFromSeasons,
      seasonEpisodes,
      episodeRuntime: parseInt(document.getElementById("field-episode-runtime").value) || ""
    };

    // If progress shows complete, force status
    if (extraData.totalEpisodes > 0 && extraData.episodesDone >= extraData.totalEpisodes && status !== "Completed") {
      alert("Episode count matches or exceeds total episodes. Setting status to Completed.");
      return; // let user adjust or re-submit
    }
  } else if (category === "manga" || category === "novel") {
    extraData = {
      volumesRead: parseInt(document.getElementById("field-volumes-read").value) || 0,
      totalVolumes: parseInt(document.getElementById("field-total-volumes").value) || ""
    };

    if (category === "novel") {
      extraData.totalChapters = parseInt(document.getElementById("field-total-chapters").value) || "";
      extraData.chaptersRead = parseInt(document.getElementById("field-chapters-read").value) || 0;
      extraData.minutesPerChapter = parseInt(document.getElementById("field-minutes-per-chapter").value) || 15;
    }

    if (extraData.totalVolumes > 0 && extraData.volumesRead >= extraData.totalVolumes && status !== "Completed") {
      alert("Volumes read count matches or exceeds total volumes. Setting status to Completed.");
      return;
    }
  } else if (category === "movie") {
    extraData = {
      playtime: parseInt(document.getElementById("field-playtime").value) || ""
    };
  }

  if (id) {
    // Edit existing item
    const itemIndex = state.items.findIndex(item => item.id === id);
    if (itemIndex !== -1) {
      state.items[itemIndex] = {
        ...state.items[itemIndex],
        title,
        category,
        status,
        rating,
        completionDate,
        notes,
        thumbnail: thumbnailsEnabled() ? (fetchedMetadataDraft?.thumbnail || state.items[itemIndex].thumbnail || "") : "",
        ...extraData
      };
    }
  } else {
    // Create new item
    const newItem = {
      id: crypto.randomUUID(),
      title,
      category,
      status,
      rating,
      completionDate,
      notes,
      created: Date.now(),
      thumbnail: thumbnailsEnabled() ? (fetchedMetadataDraft?.thumbnail || "") : "",
      ...extraData
    };
    state.items.push(newItem);
  }

  state.lastEntryCategory = category;
  saveData();
  closeModal();
  renderDashboard();
  renderTimeline();
  renderStats();
}

// Format date into human readable form
function formatDate(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  
  // Format nicely (e.g., Jul 8, 2026) without local offset shift issues
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function buildBackupPayload(includePreferences = true) {
  const payload = {
    version: "1.0",
    appName: "SquashDB",
    exportDate: new Date().toISOString(),
    items: state.items
  };

  if (includePreferences) {
    payload.preferences = state.preferences;
    payload.lastEntryCategory = state.lastEntryCategory;
    payload.activeCategoryChip = state.activeCategoryChip || "";
  }

  return payload;
}

function restoreBackupData(parsedData, includePreferences = true) {
  if (!parsedData || parsedData.appName !== "SquashDB" || !Array.isArray(parsedData.items)) {
    alert("Invalid file format. Please select a valid SquashDB JSON backup file.");
    return false;
  }

  const currentIds = new Set(state.items.map(item => item.id));
  parsedData.items.forEach(item => {
    if (!currentIds.has(item.id)) {
      state.items.push(item);
    }
  });

  if (includePreferences && parsedData.preferences) {
    state.preferences = { ...state.preferences, ...parsedData.preferences };
  }

  if (includePreferences && parsedData.lastEntryCategory) {
    state.lastEntryCategory = parsedData.lastEntryCategory;
  }

  if (includePreferences && typeof parsedData.activeCategoryChip === "string") {
    state.activeCategoryChip = parsedData.activeCategoryChip;
  }

  saveData();
  renderCategoryChips();
  renderCategorySelectOptions();
  renderDashboard();
  renderTimeline();
  renderStats();
  updateSettingsUI();
  return true;
}

// Turns a title/key into a filesystem-safe folder name (lowercase, underscores,
// no characters illegal in FAT/SAF paths).
function slugifyForFolder(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[/\\:*?"<>|]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80) || "untitled";
}

// Appends a short id suffix if another item already claimed this slug within the category.
function uniqueItemSlug(item, usedSlugs) {
  const base = slugifyForFolder(item.title);
  if (!usedSlugs.has(base)) {
    usedSlugs.add(base);
    return base;
  }
  const suffixed = `${base}_${item.id.slice(0, 8)}`;
  usedSlugs.add(suffixed);
  return suffixed;
}

// Fetches a remote thumbnail URL and re-encodes it as WebP, returning base64
// (without the data-URL prefix) ready for writeNestedBinaryFile. Returns null
// on any failure (offline, broken URL, decode error) so sync can skip it.
async function thumbnailUrlToWebpBase64(url) {
  if (typeof url !== "string" || !url) return null;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();

    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0);

    const webpBlob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.9));
    if (!webpBlob) return null;

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(webpBlob);
    });

    const match = dataUrl.match(/^data:.*;base64,(.*)$/s);
    return match ? match[1] : null;
  } catch (err) {
    console.warn("Could not convert thumbnail to WebP", url, err);
    return null;
  }
}

// Mirrors state.items into squash-db/<category>/<item_slug>/index.json (+ .thumbnail)
// on the chosen backup folder. Additive only: never deletes or moves existing folders,
// so items removed/recategorized in-app leave their old folder behind.
async function syncFolderTreeMirror() {
  if (!backupFolderPluginAvailable()) return;

  const plugin = window.Capacitor.Plugins.BackupFolder;
  let folderUri;
  try {
    folderUri = await getOrPickBackupFolderUri();
  } catch (err) {
    console.warn("Folder tree sync skipped: no backup folder selected", err);
    return;
  }

  const syncedHashes = JSON.parse(localStorage.getItem("squashdb_synced_item_hashes") || "{}");
  const usedSlugsByCategory = {};
  const syncErrors = [];
  let syncedCount = 0;
  let skippedUnchangedCount = 0;

  for (const item of state.items) {
    const categorySlug = slugifyForFolder(item.category);
    if (!usedSlugsByCategory[categorySlug]) usedSlugsByCategory[categorySlug] = new Set();

    const itemHash = JSON.stringify(item);
    if (syncedHashes[item.id] === itemHash) {
      skippedUnchangedCount++;
      continue;
    }

    const itemSlug = uniqueItemSlug(item, usedSlugsByCategory[categorySlug]);
    const dirPath = ["squash-db", categorySlug, itemSlug];

    try {
      await plugin.writeNestedFile({
        uri: folderUri,
        dirPath,
        fileName: "index.json",
        content: JSON.stringify(item, null, 2)
      });

      const base64Thumb = await thumbnailUrlToWebpBase64(item.thumbnail);
      if (base64Thumb) {
        await plugin.writeNestedBinaryFile({
          uri: folderUri,
          dirPath,
          fileName: "thumbnail.webp",
          base64Content: base64Thumb
        });
      }

      syncedHashes[item.id] = itemHash;
      syncedCount++;
    } catch (err) {
      console.error(`Folder tree sync failed for item "${item.title}" (${item.id})`, err);
      syncErrors.push(`${item.title || item.id}: ${err?.message || err}`);
    }
  }

  localStorage.setItem("squashdb_synced_item_hashes", JSON.stringify(syncedHashes));

  console.log(`Folder tree sync: ${syncedCount} written, ${skippedUnchangedCount} unchanged/skipped, ${syncErrors.length} failed (of ${state.items.length} total items)`);
  if (syncErrors.length > 0) {
    console.error("Folder tree sync errors:", syncErrors);
  }

  try {
    normalizeMetadataSources();
    const redactedSources = {
      ...state.preferences.metadataSources,
      custom: state.preferences.metadataSources.custom.map(src => ({
        ...src,
        apiKey: src.apiKey ? "***REDACTED***" : ""
      }))
    };
    await plugin.writeNestedFile({
      uri: folderUri,
      dirPath: ["squash-db", "settings"],
      fileName: "metadata-sources.json",
      content: JSON.stringify(redactedSources, null, 2)
    });
  } catch (err) {
    console.warn("Failed to sync metadata source settings to folder tree", err);
  }

  return { syncedCount, skippedUnchangedCount, syncErrors, totalItems: state.items.length };
}

let folderSyncIdleTimer = null;
function scheduleFolderTreeAutoSync() {
  if (!backupFolderPluginAvailable()) return;
  if (!localStorage.getItem("squashdb_backup_folder_uri")) return;
  if (folderSyncIdleTimer) clearTimeout(folderSyncIdleTimer);

  const delay = parseInt(state.preferences.folderSyncDelay, 10) || 0;
  if (delay === 0) {
    syncFolderTreeMirror();
    return;
  }
  folderSyncIdleTimer = setTimeout(syncFolderTreeMirror, delay);
}

function backupFolderPluginAvailable() {
  return isNativeApp() && window.Capacitor.Plugins && window.Capacitor.Plugins.BackupFolder;
}

// Silently checks the saved backup folder URI at app startup — never opens the
// native picker. If it's missing or no longer valid (e.g. the folder was moved,
// deleted, or its SAF grant was revoked), records that so Settings can show a
// "Backup folder needs to be re-selected" notice without an intrusive popup.
async function checkBackupFolderOnStartup() {
  if (!backupFolderPluginAvailable()) return;

  const savedUri = localStorage.getItem("squashdb_backup_folder_uri");
  if (!savedUri) {
    localStorage.setItem("squashdb_backup_folder_invalid", "true");
    return;
  }

  let valid = false;
  try {
    const check = await window.Capacitor.Plugins.BackupFolder.hasPersistedFolder({ uri: savedUri });
    valid = Boolean(check?.valid);
    localStorage.setItem("squashdb_backup_folder_invalid", valid ? "false" : "true");
  } catch (err) {
    console.warn("Could not validate saved backup folder on startup", err);
    localStorage.setItem("squashdb_backup_folder_invalid", "true");
  }

  updateBackupFolderStatusUI();

  if (valid) runAutoBackupIfDue(savedUri);
}

const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const AUTO_BACKUP_KEEP_COUNT = 3;

// Runs on every app launch (see checkBackupFolderOnStartup). There is no background
// process while the app is closed, so "every 24 hours" means "on the next app open
// that happens 24h+ after the last auto-backup" rather than a literal daily timer.
async function runAutoBackupIfDue(folderUri) {
  const lastRun = parseInt(localStorage.getItem("squashdb_last_auto_backup_at") || "0", 10);
  if (Date.now() - lastRun < AUTO_BACKUP_INTERVAL_MS) return;
  if (state.items.length === 0) return; // nothing worth backing up yet

  try {
    const dateStr = new Date().toISOString().split("T")[0];
    await writeTarBackup(folderUri, dateStr);
    localStorage.setItem("squashdb_last_auto_backup_at", String(Date.now()));
    await pruneOldAutoBackups(folderUri);
    console.log("Auto-backup completed:", dateStr);
  } catch (err) {
    console.warn("Auto-backup failed", err);
  }
}

// Keeps only the newest AUTO_BACKUP_KEEP_COUNT squashdb_backup_*.tar files at the
// folder root (plus their same-dated .json sibling, written alongside each tar),
// deleting older ones. Only touches dated backup archives — never squash-db/
// itself or anything else in the folder.
async function pruneOldAutoBackups(folderUri) {
  const plugin = window.Capacitor.Plugins.BackupFolder;
  const { files } = await plugin.listFiles({ uri: folderUri });

  const backupFileRe = /^squashdb_backup_(\d{4}-\d{2}-\d{2})\.(tar|json)$/;
  const matched = (files || [])
    .map(f => ({ ...f, match: f.name.match(backupFileRe) }))
    .filter(f => f.match);

  const distinctDates = [...new Set(matched.map(f => f.match[1]))].sort((a, b) => b.localeCompare(a));
  const datesToDelete = new Set(distinctDates.slice(AUTO_BACKUP_KEEP_COUNT));

  const toDelete = matched.filter(f => datesToDelete.has(f.match[1]));
  for (const file of toDelete) {
    try {
      await plugin.deleteFile({ uri: file.uri });
    } catch (err) {
      console.warn(`Could not delete old auto-backup "${file.name}"`, err);
    }
  }
}

function updateBackupFolderStatusUI() {
  const notice = document.getElementById("backup-folder-status-notice");
  if (notice) {
    const invalid = localStorage.getItem("squashdb_backup_folder_invalid") === "true";
    notice.style.display = invalid ? "block" : "none";
  }

  const pathEl = document.getElementById("backup-folder-path-display");
  if (pathEl) {
    const uri = localStorage.getItem("squashdb_backup_folder_uri");
    pathEl.textContent = uri ? `Current folder: ${friendlyFolderPathFromUri(uri)}` : "No backup folder selected yet.";
  }
}

// Best-effort human-readable path from a SAF tree content:// URI, so the user can
// visually confirm Sync/Export/Import are targeting the folder they expect —
// e.g. "content://...tree/primary%3ADocuments%2FSquashBackups" -> "/Documents/SquashBackups".
function friendlyFolderPathFromUri(uri) {
  try {
    const decoded = decodeURIComponent(uri);
    const match = decoded.match(/\/tree\/(.+)$/);
    if (!match) return uri;
    return "/" + match[1].replace(/^primary:/, "").replace(/^[^:]+:/, "");
  } catch (err) {
    return uri;
  }
}

// Resolves the SAF folder URI to store backups in, prompting the native folder
// picker only if none is saved yet or the previously saved one is no longer valid.
async function getOrPickBackupFolderUri() {
  const plugin = window.Capacitor.Plugins.BackupFolder;
  const savedUri = localStorage.getItem("squashdb_backup_folder_uri");

  if (savedUri) {
    try {
      const check = await plugin.hasPersistedFolder({ uri: savedUri });
      if (check && check.valid) return savedUri;
    } catch (err) {
      console.warn("Could not validate saved backup folder", err);
    }
  }

  const picked = await plugin.pickFolder();
  if (!picked || !picked.uri) throw new Error("No folder selected");
  localStorage.setItem("squashdb_backup_folder_uri", picked.uri);
  localStorage.setItem("squashdb_backup_folder_invalid", "false");
  updateBackupFolderStatusUI();
  await checkForExistingBackupToRestore(picked.uri);
  return picked.uri;
}

// Writes a full tar snapshot (squash-db/ tree + the current state JSON) into
// folderUri, named squashdb_backup_<YYYY-MM-DD>.tar / .json. Shared by the manual
// Export button and the daily auto-backup, so both produce identical archives.
async function writeTarBackup(folderUri, dateStr) {
  const dataStr = JSON.stringify(buildBackupPayload(true), null, 2);
  const jsonName = `squashdb_backup_${dateStr}.json`;
  const tarName = `squashdb_backup_${dateStr}.tar`;

  await syncFolderTreeMirror();
  await window.Capacitor.Plugins.BackupFolder.exportTarArchive({
    uri: folderUri,
    sourceDirPath: ["squash-db"],
    tarFileName: tarName,
    extraJsonFileName: jsonName,
    extraJsonContent: dataStr
  });
  return tarName;
}

async function exportData() {
  const dateStr = new Date().toISOString().split("T")[0];

  if (backupFolderPluginAvailable()) {
    try {
      const folderUri = await getOrPickBackupFolderUri();
      await writeTarBackup(folderUri, dateStr);
      alert("Backup saved successfully!");
    } catch (err) {
      console.warn("Backup export failed", err);
      alert("Could not save backup. Please choose a folder and try again.");
    }
    return;
  }

  const dataStr = JSON.stringify(buildBackupPayload(true), null, 2);
  const exportFileDefaultName = `squashdb_backup_${dateStr}.json`;

  if (window.showSaveFilePicker) {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: exportFileDefaultName,
        types: [
          {
            description: "JSON Backup",
            accept: { "application/json": [".json"] }
          }
        ]
      });
      const writable = await fileHandle.createWritable();
      await writable.write(dataStr);
      await writable.close();
      alert("Backup saved successfully!");
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return;
    }
  }

  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const linkElement = document.createElement("a");
  linkElement.href = url;
  linkElement.download = exportFileDefaultName;
  linkElement.click();
  URL.revokeObjectURL(url);
}

// Lets the user pick (or re-pick) the folder backups are saved to on native platforms.
async function chooseBackupFolder() {
  if (!backupFolderPluginAvailable()) return;
  try {
    const picked = await window.Capacitor.Plugins.BackupFolder.pickFolder();
    if (picked && picked.uri) {
      localStorage.setItem("squashdb_backup_folder_uri", picked.uri);
      localStorage.setItem("squashdb_backup_folder_invalid", "false");
      updateBackupFolderStatusUI();
      await checkForExistingBackupToRestore(picked.uri);
      alert("Backup folder updated.");
    }
  } catch (err) {
    console.warn("Could not change backup folder", err);
  }
}

// Backup Import Database (JSON file upload)
// Parses a minimal POSIX (ustar) tar buffer and returns its top-level entries
// as { name, content: Uint8Array }[]. Mirrors the layout written natively by
// BackupFolderPlugin.TarWriter: 512-byte header, size as octal ASCII at offset
// 124/12 bytes, content padded to a 512-byte boundary, trailing zero blocks.
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// If the app has no items yet (fresh install, or a chosen folder was never used
// before) and the just-picked SAF folder already contains backup files — from a
// previous install that used this same folder — offer to restore from the newest
// one instead of silently starting empty. Prefers a .tar (full snapshot) over a
// bare .json export if both exist, since the tar is the more complete source.
async function checkForExistingBackupToRestore(folderUri) {
  if (state.items.length > 0) return;
  if (!backupFolderPluginAvailable()) return;

  const plugin = window.Capacitor.Plugins.BackupFolder;
  let files;
  try {
    const result = await plugin.listFiles({ uri: folderUri });
    files = result?.files || [];
  } catch (err) {
    console.warn("Could not list backup folder contents for auto-restore check", err);
    return;
  }

  const backupFileRe = /^squashdb_backup_(\d{4}-\d{2}-\d{2})\.(tar|json)$/;
  const candidates = files
    .map(f => ({ ...f, match: f.name.match(backupFileRe) }))
    .filter(f => f.match)
    .sort((a, b) => {
      // Newest date first; prefer .tar over .json on the same date (fuller snapshot).
      if (a.match[1] !== b.match[1]) return b.match[1].localeCompare(a.match[1]);
      return a.match[2] === "tar" ? -1 : 1;
    });

  if (candidates.length > 0) {
    const newest = candidates[0];

    if (!confirm(
      `Found an existing backup in this folder: "${newest.name}".\n\n` +
      `Your app has no items yet — restore from this backup now?`
    )) {
      return;
    }

    try {
      if (newest.match[2] === "tar") {
        const { base64Content } = await plugin.readBinaryFile({ uri: newest.uri });
        const entries = parseTarArchive(base64ToArrayBuffer(base64Content));
        const jsonEntry = entries.find(entry => !entry.name.includes("/") && entry.name.endsWith(".json"));
        if (!jsonEntry) {
          alert("Could not find backup data inside that tar file.");
          return;
        }
        applyImportedBackupJson(JSON.parse(new TextDecoder("utf-8").decode(jsonEntry.content)));
      } else {
        const { content } = await plugin.readFile({ uri: newest.uri });
        applyImportedBackupJson(JSON.parse(content));
      }
    } catch (err) {
      console.warn("Auto-restore from existing backup failed", err);
      alert("Could not restore from the existing backup. You can try importing it manually from Backups & Restore.");
    }
    return;
  }

  // No dated backup archive at the folder root — fall back to reconstructing
  // items directly from an existing squash-db/<category>/<item>/index.json tree
  // (e.g. left behind by a previous install that only ever auto-synced, and
  // never had a manual Export produce a .tar/.json file).
  const squashDbFolder = files.find(f => f.name === "squash-db");
  if (!squashDbFolder) return;

  let reconstructedItems;
  try {
    reconstructedItems = await reconstructItemsFromFolderTree(squashDbFolder.uri);
  } catch (err) {
    console.warn("Could not read squash-db/ tree for auto-restore check", err);
    return;
  }

  if (reconstructedItems.length === 0) return;

  if (!confirm(
    `Found ${reconstructedItems.length} item(s) synced from a previous install in this folder's squash-db/ tree.\n\n` +
    `Your app has no items yet — restore them now?`
  )) {
    return;
  }

  applyImportedBackupJson({ appName: "SquashDB", items: reconstructedItems });
}

// Walks squash-db/<category>/<item>/index.json (2 levels deep under the given
// squash-db/ folder URI) and returns every parsed Item found. Best-effort: a
// single unreadable/corrupt index.json is skipped, not fatal to the whole scan.
async function reconstructItemsFromFolderTree(squashDbUri) {
  const plugin = window.Capacitor.Plugins.BackupFolder;
  const items = [];

  const { files: categoryFolders } = await plugin.listFiles({ uri: squashDbUri });
  for (const categoryFolder of categoryFolders || []) {
    if (categoryFolder.name === "settings") continue; // metadata-sources.json lives here, not items

    let itemFolders;
    try {
      const result = await plugin.listFiles({ uri: categoryFolder.uri });
      itemFolders = result?.files || [];
    } catch (err) {
      continue;
    }

    for (const itemFolder of itemFolders) {
      try {
        const { files: itemFiles } = await plugin.listFiles({ uri: itemFolder.uri });
        const indexJsonFile = (itemFiles || []).find(f => f.name === "index.json");
        if (!indexJsonFile) continue;
        const { content } = await plugin.readFile({ uri: indexJsonFile.uri });
        const item = JSON.parse(content);
        if (item && item.id && item.title) items.push(item);
      } catch (err) {
        console.warn(`Skipping unreadable item folder during auto-restore: ${itemFolder.name}`, err);
      }
    }
  }

  return items;
}

function parseTarArchive(buffer) {
  const bytes = new Uint8Array(buffer);
  const entries = [];
  let offset = 0;

  const readString = (start, length) => {
    let end = start;
    while (end < start + length && bytes[end] !== 0) end++;
    return new TextDecoder("utf-8").decode(bytes.subarray(start, end));
  };
  const readOctal = (start, length) => {
    const str = readString(start, length).trim();
    return str ? parseInt(str, 8) : 0;
  };

  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every(b => b === 0)) break; // zero block: end of archive

    const name = readString(offset, 100);
    const size = readOctal(offset + 124, 12);
    offset += 512;

    if (name) {
      entries.push({ name, content: bytes.slice(offset, offset + size) });
    }

    offset += Math.ceil(size / 512) * 512;
  }

  return entries;
}

function applyImportedBackupJson(parsedData) {
  if (!parsedData || parsedData.appName !== "SquashDB" || !Array.isArray(parsedData.items)) {
    alert("Invalid file format. Please select a valid SquashDB backup file.");
    return;
  }

  if (confirm(`Do you want to restore ${parsedData.items.length} items? This will merge with your current watchlist.`)) {
    const includePreferences = parsedData.preferences ? window.confirm(
      "This backup also contains system settings.\n\nChoose OK to restore settings too.\nChoose Cancel to restore app data only."
    ) : false;

    if (restoreBackupData(parsedData, includePreferences)) {
      alert("Backup restored successfully!");
    }
  }
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const isTar = file.name.toLowerCase().endsWith(".tar");

  if (isTar) {
    const fileReader = new FileReader();
    fileReader.onload = function (event) {
      try {
        const entries = parseTarArchive(event.target.result);
        // The writer places the state JSON at the tar root (e.g. squashdb_backup_2026-07-09.json),
        // separate from the squash-db/ folder tree entries.
        const jsonEntry = entries.find(entry => !entry.name.includes("/") && entry.name.endsWith(".json"));
        if (!jsonEntry) {
          alert("Could not find a SquashDB backup JSON inside this tar file.");
          return;
        }
        const jsonText = new TextDecoder("utf-8").decode(jsonEntry.content);
        applyImportedBackupJson(JSON.parse(jsonText));
      } catch (err) {
        console.warn("Failed to read tar backup", err);
        alert("Error reading tar file. Make sure it's not corrupted.");
      }
    };
    fileReader.readAsArrayBuffer(file);
    return;
  }

  const fileReader = new FileReader();
  fileReader.onload = function (event) {
    try {
      applyImportedBackupJson(JSON.parse(event.target.result));
    } catch (err) {
      alert("Error reading JSON file. Make sure it's not corrupted.");
    }
  };
  fileReader.readAsText(file);
}
