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
  if (history.scrollRestoration) history.scrollRestoration = "manual";
  recordCurrentPage();

  document.querySelectorAll(".nav-item").forEach(navItem => {
    if (navItem.dataset.boundAppNav === "true") return;
    navItem.dataset.boundAppNav = "true";
    navItem.addEventListener("click", (e) => {
      const href = navItem.getAttribute("href");
      if (!href) return;
      e.preventDefault();
      // Bottom-bar items always navigate directly. The bar's order and
      // visibility still come from manage-nav-bar.html; opening a second
      // navigation sheet here made the selected page appear blank until the
      // user tapped again inside the popup.
      navigateToAppPage(href);
    });
  });
  setupSwipeBackGesture();
}

function navigateToAppPage(href) {
  recordCurrentPage();
  history.pushState({ squashdbPage: href }, "", href);
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
  const stack = getAppPageStack();
  const current = getCurrentPagePath();
  if (stack[stack.length - 1] === current) stack.pop();
  const previous = stack.pop();
  setAppPageStack(stack);
  animatePredictiveBack(() => { window.location.href = previous || fallback; });
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
  window.addEventListener("popstate", (e) => {
    const path = getCurrentPagePath();
    const stack = getAppPageStack();
    if (e.state?.squashdbPage === path || stack.length > 1) {
      navigateBackWithinApp("dashboard.html");
    }
  });

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
