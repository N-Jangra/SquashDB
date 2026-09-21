// Desktop shell: at wide widths (>= 900px) inject a left sidebar built from the
// existing bottom-nav links, and switch the body to a desktop layout. On phones
// (< 900px) nothing is injected and the current mobile bottom-nav UI is used
// unchanged. Pure progressive enhancement — no per-page HTML edits required.

(function () {
  const DESKTOP_MIN_WIDTH = 900;
  const mql = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);

  // Map lucide icon names (used in the bottom nav) to sidebar labels/icons.
  function navItemsFromBottomNav() {
    const nav = document.querySelector(".bottom-nav");
    if (!nav) return [];
    return Array.from(nav.querySelectorAll(".nav-item")).map(a => ({
      href: a.getAttribute("href") || "#",
      label: a.getAttribute("aria-label") || "",
      icon: a.querySelector("[data-lucide]")?.getAttribute("data-lucide") || "circle",
      active: a.classList.contains("active"),
      tab: a.getAttribute("data-tab") || ""
    }));
  }

  function buildSidebar() {
    if (document.querySelector(".desktop-sidebar")) return;
    const items = navItemsFromBottomNav();
    if (!items.length) return;

    // Settings goes in the footer; everything else in the main menu.
    const settings = items.find(i => i.tab === "tab-settings" || /settings/i.test(i.label));
    const mainItems = items.filter(i => i !== settings);

    const navLink = (i) => `
      <a class="desktop-nav-item${i.active ? " active" : ""}" href="${i.href}" data-tab="${i.tab}" aria-label="${i.label}">
        <i data-lucide="${i.icon}" class="desktop-nav-icon"></i>
        <span>${i.label}</span>
      </a>`;

    const sidebar = document.createElement("aside");
    sidebar.className = "desktop-sidebar";
    sidebar.innerHTML = `
      <div class="desktop-brand">
        <span class="desktop-brand-icon"><img src="squashdb-logo.svg" alt="" width="20" height="20"></span>
        SquashDB
      </div>
      <button type="button" class="desktop-add-btn" id="desktop-new-entry">
        <i data-lucide="plus"></i> New Entry
      </button>
      <nav class="desktop-nav">
        ${mainItems.map(navLink).join("")}
      </nav>
      <div class="desktop-sidebar-footer">
        ${settings ? navLink(settings) : ""}
      </div>
    `;
    document.body.insertBefore(sidebar, document.body.firstChild);

    // "New Entry" reuses the existing add-item flow. On the dashboard the FAB is
    // present and wired; elsewhere, route to the dashboard which opens on load.
    const newEntry = sidebar.querySelector("#desktop-new-entry");
    newEntry.addEventListener("click", () => {
      const fab = document.getElementById("add-fab");
      if (fab) { fab.click(); return; }
      if (typeof openModal === "function") { openModal(); return; }
      window.location.href = "static/pages/main/dashboard.html?add=1";
    });

    if (window.lucide) lucide.createIcons();
  }

  function removeSidebar() {
    const sidebar = document.querySelector(".desktop-sidebar");
    if (sidebar) sidebar.remove();
  }

  function apply() {
    if (mql.matches) {
      document.body.classList.add("desktop-shell");
      buildSidebar();
    } else {
      document.body.classList.remove("desktop-shell");
      removeSidebar();
    }
  }

  function init() {
    apply();
    // Re-evaluate on viewport changes (window resize, device rotation).
    if (mql.addEventListener) mql.addEventListener("change", apply);
    else if (mql.addListener) mql.addListener(apply);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
