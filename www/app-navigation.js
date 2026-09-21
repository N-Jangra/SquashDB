// SquashDB navigation module.
// Loaded before app.js; these functions intentionally remain global so the
// existing multi-page HTML files and feature modules keep their API.

function getCurrentPageTab() {
  return document.getElementById("tab-dashboard") ? "tab-dashboard" :
    document.getElementById("tab-timeline") ? "tab-timeline" :
    document.getElementById("tab-discover") ? "tab-discover" :
    document.getElementById("tab-sources") ? "tab-sources" :
    document.getElementById("tab-explore") ? "tab-explore" :
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

function getPageScrollPositions() {
  try {
    const value = JSON.parse(sessionStorage.getItem("squashdb_page_scroll") || "{}");
    return value && typeof value === "object" ? value : {};
  } catch (e) {
    return {};
  }
}

function saveCurrentPageScroll() {
  const main = document.querySelector("main");
  const positions = getPageScrollPositions();
  positions[getCurrentPagePathWithQuery()] = {
    main: main?.scrollTop || 0,
    window: window.scrollY || 0
  };
  sessionStorage.setItem("squashdb_page_scroll", JSON.stringify(positions));
}

function restoreCurrentPageScroll() {
  const saved = getPageScrollPositions()[getCurrentPagePathWithQuery()];
  if (!saved) return;
  const restore = () => {
    const main = document.querySelector("main");
    if (main) main.scrollTop = Number(saved.main) || 0;
    window.scrollTo(0, Number(saved.window) || 0);
  };
  requestAnimationFrame(() => {
    restore();
    setTimeout(restore, 80);
  });
}

function recordCurrentPage() {
  const currentWithQuery = getCurrentPagePathWithQuery();
  const stack = getAppPageStack();
  const last = stack[stack.length - 1] || "";
  // Older builds stored only the filename. Compare both forms while those
  // sessions are being migrated, but store the complete URL from now on so
  // separate detail pages and source-search queries remain distinct.
  if (last !== currentWithQuery && last !== getCurrentPagePath()) {
    stack.push(currentWithQuery);
  } else if (last === getCurrentPagePath() && last !== currentWithQuery) {
    stack[stack.length - 1] = currentWithQuery;
    setAppPageStack(stack);
  }
  if (history.state?.squashdbPage !== currentWithQuery) {
    history.replaceState({ squashdbPage: currentWithQuery }, "", currentWithQuery);
  }
}

function setupAppNavigation() {
  if (history.scrollRestoration) history.scrollRestoration = "manual";
  recordCurrentPage();
  restoreCurrentPageScroll();
  if (document.body.dataset.pageScrollBound !== "true") {
    document.body.dataset.pageScrollBound = "true";
    window.addEventListener("pagehide", saveCurrentPageScroll);
  }

  document.querySelectorAll(".nav-item").forEach(navItem => {
    if (navItem.dataset.boundAppNav === "true") return;
    navItem.dataset.boundAppNav = "true";
    navItem.addEventListener("click", (e) => {
      const href = navItem.getAttribute("href");
      if (!href) return;
      e.preventDefault();
      const navigationSheetEnabled = typeof state !== "undefined" && Boolean(state.preferences?.navigationSheet);
      if (navigationSheetEnabled) {
        openNavigationSheet();
      } else {
        navigateToAppPage(href);
      }
    });
  });
  // Page links outside the bottom bar (Settings subpages, About pages,
  // metadata sources, and detail links) must also become part of the app
  // stack before the browser performs the normal navigation.
  if (document.body.dataset.internalLinkHistoryBound !== "true") {
    document.body.dataset.internalLinkHistoryBound = "true";
    document.addEventListener("click", event => {
      const link = event.target.closest("a[href]");
      if (!link || link.dataset.tab || link.target === "_blank" || link.hasAttribute("download")) return;
      const href = link.getAttribute("href") || "";
      if (!href || href.startsWith("#") || /^(https?:|mailto:|tel:|data:)/i.test(href)) return;
      saveCurrentPageScroll();
      recordCurrentPage();
    }, true);
  }
  setupSwipeBackGesture();
}

function navigateToAppPage(href) {
  recordCurrentPage();
  window.location.href = href;
}

function openNavigationSheet() {
  let sheet = document.getElementById("app-navigation-sheet");
  if (!sheet) {
    sheet = document.createElement("div");
    sheet.id = "app-navigation-sheet";
    sheet.className = "app-navigation-sheet-overlay";
    sheet.innerHTML = `<div class="app-navigation-sheet" role="dialog" aria-label="App navigation"><div class="app-navigation-sheet-handle"></div><div class="app-navigation-sheet-header"><strong>Navigate</strong><button type="button" data-nav-sheet-close aria-label="Close">×</button></div><div class="app-navigation-sheet-grid"></div></div>`;
    document.body.appendChild(sheet);
    sheet.addEventListener("click", event => {
      if (event.target === sheet || event.target.closest("[data-nav-sheet-close]")) closeNavigationSheet();
    });
  }
  const labels = { dashboard: "Dashboard", timeline: "Timeline", discover: "Discover", sources: "Sources", explore: "Explore", stats: "Statistics", settings: "Settings" };
  const grid = sheet.querySelector(".app-navigation-sheet-grid");
  grid.innerHTML = Array.from(document.querySelectorAll(".nav-item"))
    .filter(item => !item.hidden && item.style.display !== "none" && getComputedStyle(item).display !== "none")
    .map(item => {
    const href = item.getAttribute("href");
    const key = item.dataset.tab?.replace("tab-", "") || "";
    return `<button type="button" class="app-navigation-sheet-item${item.classList.contains("active") ? " active" : ""}" data-nav-sheet-href="${href}"><i data-lucide="${item.querySelector("svg")?.getAttribute("data-lucide") || item.querySelector("i")?.dataset.lucide || "circle"}"></i><span>${labels[key] || key}</span></button>`;
    }).join("");
  grid.querySelectorAll("[data-nav-sheet-href]").forEach(item => item.addEventListener("click", () => {
    const href = item.dataset.navSheetHref;
    closeNavigationSheet();
    if (href && href !== getCurrentPagePath()) navigateToAppPage(href);
  }));
  sheet.classList.add("active");
  if (window.lucide) lucide.createIcons();
}

function closeNavigationSheet() {
  document.getElementById("app-navigation-sheet")?.classList.remove("active");
}

function setupPageBackButtons() {
  document.querySelectorAll(".page-back-btn").forEach(btn => {
    if (btn.dataset.boundBack === "true") return;
    btn.dataset.boundBack = "true";
    btn.addEventListener("click", () => {
      navigateBackWithinApp(btn.getAttribute("data-back-fallback") || "settings.html");
    });
  });
}

function navigateBackWithinApp(fallback = "settings.html") {
  // Full-page navigation already creates the correct WebView history entry.
  // Prefer it so a back action returns to the exact previous page instead of
  // selecting an older route from the session stack.
  if (window.history.length > 1) {
    animatePredictiveBack(() => window.history.back());
    return true;
  }

  const stack = getAppPageStack();
  const current = getCurrentPagePathWithQuery();
  const currentPath = getCurrentPagePath();
  if (stack[stack.length - 1] === current || stack[stack.length - 1] === currentPath) stack.pop();
  const previous = stack.pop();
  setAppPageStack(stack);
  animatePredictiveBack(() => {
    if (previous) {
      window.location.href = previous;
    } else window.location.href = fallback;
  });
  return true;
}

function animatePredictiveBack(callback) {
  document.body.classList.add("app-predictive-back");
  setTimeout(() => {
    document.body.classList.remove("app-predictive-back");
    callback();
  }, 150);
}

function setupSwipeBackGesture() {
  if (document.body.dataset.swipeBackBound === "true") return;
  document.body.dataset.swipeBackBound = "true";
  let startX = 0;
  let startY = 0;
  let tracking = false;
  document.addEventListener("touchstart", event => {
    const target = event.target;
    if (target.closest("input, textarea, select, button, a, .modal-overlay")) return;
    const touch = event.touches[0];
    tracking = touch.clientX < 28;
    startX = touch.clientX;
    startY = touch.clientY;
  }, { passive: true });
  document.addEventListener("touchmove", event => {
    if (!tracking) return;
    const touch = event.touches[0];
    const dx = touch.clientX - startX;
    const dy = Math.abs(touch.clientY - startY);
    if (dx > 0 && dy < 80) document.documentElement.style.setProperty("--back-swipe-progress", `${Math.min(1, dx / 120)}`);
  }, { passive: true });
  document.addEventListener("touchend", event => {
    if (!tracking) return;
    tracking = false;
    const dx = event.changedTouches[0].clientX - startX;
    document.documentElement.style.removeProperty("--back-swipe-progress");
    if (dx > 80) navigateBackWithinApp("dashboard.html");
  }, { passive: true });
}

function setupHardwareBackButton() {
  const handler = (e) => {
    if (e) e.preventDefault();
    closeNavigationSheet();
    navigateBackWithinApp("dashboard.html");
  };

  if (!document.body || document.body.dataset.boundHardwareBack) return;
  document.body.dataset.boundHardwareBack = "true";
  document.addEventListener("backbutton", handler, false);
  // Browser history already performs the correct back navigation after a
  // normal swipe/back action. Do not also pop the app stack here, otherwise
  // one gesture can skip the previous page and land on Dashboard.
  window.addEventListener("popstate", closeNavigationSheet);

  const capApp = window.Capacitor?.Plugins?.App;
  if (capApp?.addListener) {
    capApp.addListener("backButton", () => {
    const current = getCurrentPagePath();
    const stack = getAppPageStack();
      const atRoot = current === "dashboard.html" && stack.length <= 1;
      if (atRoot) {
        if (capApp.exitApp) capApp.exitApp();
      } else {
        navigateBackWithinApp("dashboard.html");
      }
    });
  }
}
