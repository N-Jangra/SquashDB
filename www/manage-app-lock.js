// SquashDB - App Password setup page (manage-app-lock.html)
// Depends on globals from app.js/applock.js: state, saveData(), normalizeAppLock(),
// setAppLockSecret(), setSecurityQuestions(), renderPatternGrid(), serializePattern().

const APP_LOCK_METHOD_CHOICES = [
  { value: "none", label: "None", desc: "No password — the app opens directly." },
  { value: "pin", label: "PIN", desc: "A numeric code, 4 or more digits." },
  { value: "pattern", label: "Pattern", desc: "Connect 2 or more dots in any order." },
  { value: "alphanumeric", label: "Alphanumeric Password", desc: "Any combination of letters, numbers, symbols." }
];

let appLockDraftMethod = null;
let appLockPendingSecret = null; // set once the PIN/pattern/password step is completed

function renderAppLockMethodPicker() {
  const container = document.getElementById("app-lock-method-picker");
  if (!container) return;

  normalizeAppLock();
  if (!appLockDraftMethod) appLockDraftMethod = state.preferences.appLock.method;

  container.innerHTML = "";
  APP_LOCK_METHOD_CHOICES.forEach(choice => {
    const row = document.createElement("div");
    row.className = "setting-row";
    row.innerHTML = `
      <div class="setting-info">
        <span class="setting-label">${choice.label}</span>
        <span class="setting-desc">${choice.desc}</span>
      </div>
      <input type="radio" name="app-lock-method" value="${choice.value}" ${appLockDraftMethod === choice.value ? "checked" : ""}>
    `;
    container.appendChild(row);
  });

  container.querySelectorAll('input[name="app-lock-method"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      appLockDraftMethod = e.target.value;
      appLockPendingSecret = null;
      renderAppLockSetupArea();
    });
  });

  renderAppLockSetupArea();
}

function renderAppLockSetupArea() {
  const setupSection = document.getElementById("app-lock-setup-section");
  const questionsSection = document.getElementById("app-lock-questions-section");
  const setupArea = document.getElementById("app-lock-setup-area");
  const setupTitle = document.getElementById("app-lock-setup-title");
  if (!setupSection || !setupArea) return;

  if (appLockDraftMethod === "none") {
    setupSection.style.display = "none";
    questionsSection.style.display = "none";
    // Selecting "None" takes effect immediately — no secret to set, nothing to confirm.
    state.preferences.appLock.method = "none";
    state.preferences.appLock.passwordHash = "";
    state.preferences.appLock.passwordSalt = "";
    saveData();
    updateAppLockSettingsSummary();
    return;
  }

  setupSection.style.display = "block";
  setupTitle.textContent = appLockDraftMethod === "pin" ? "Set Your PIN"
    : appLockDraftMethod === "pattern" ? "Draw Your Pattern"
    : "Set Your Password";

  if (appLockDraftMethod === "pattern") {
    setupArea.innerHTML = `<p class="setting-desc" id="app-lock-pattern-status">Draw a pattern (2+ dots).</p>`;
    const gridWrap = document.createElement("div");
    setupArea.appendChild(gridWrap);
    renderPatternGrid(gridWrap, (cells) => {
      appLockPendingSecret = serializePattern(cells);
      document.getElementById("app-lock-pattern-status").textContent = `Pattern captured (${cells.length} dots). You can redraw it or continue to security questions below.`;
      renderAppLockQuestionsArea();
    });
  } else {
    setupArea.innerHTML = `
      <div class="form-group">
        <input type="${appLockDraftMethod === "pin" ? "password" : "text"}" ${appLockDraftMethod === "pin" ? 'inputmode="numeric" pattern="[0-9]*"' : ""} id="app-lock-secret-input" class="form-control" placeholder="${appLockDraftMethod === "pin" ? "New PIN (4+ digits)" : "New password"}">
      </div>
      <p class="app-lock-error" id="app-lock-setup-error" style="display:none;"></p>
    `;
    const input = document.getElementById("app-lock-secret-input");
    input.addEventListener("input", () => {
      const value = input.value;
      const errorEl = document.getElementById("app-lock-setup-error");
      const valid = appLockDraftMethod === "pin" ? /^\d{4,}$/.test(value) : value.length >= 4;
      if (valid) {
        appLockPendingSecret = value;
        errorEl.style.display = "none";
      } else {
        appLockPendingSecret = null;
        errorEl.textContent = appLockDraftMethod === "pin" ? "PIN must be at least 4 digits." : "Password must be at least 4 characters.";
        errorEl.style.display = value ? "block" : "none";
      }
      renderAppLockQuestionsArea();
    });
  }

  renderAppLockQuestionsArea();
}

function renderAppLockQuestionsArea() {
  const questionsSection = document.getElementById("app-lock-questions-section");
  const questionsArea = document.getElementById("app-lock-questions-area");
  if (!questionsSection || !questionsArea) return;

  if (!appLockPendingSecret) {
    questionsSection.style.display = "none";
    return;
  }

  questionsSection.style.display = "block";
  if (questionsArea.childElementCount > 0) return; // don't wipe answers already typed

  const existing = state.preferences.appLock.securityQuestions;
  questionsArea.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const group = document.createElement("div");
    group.className = "form-group";
    group.innerHTML = `
      <label>Question ${i + 1}</label>
      <input type="text" class="form-control app-lock-question-input" data-index="${i}" placeholder="e.g. What was your first pet's name?" value="${existing[i]?.question || ""}">
      <input type="text" class="form-control app-lock-answer-input" data-index="${i}" placeholder="Answer" style="margin-top:6px;">
    `;
    questionsArea.appendChild(group);
  }
}

function setupAppLockSaveButton() {
  const saveBtn = document.getElementById("app-lock-save-btn");
  if (!saveBtn || saveBtn.dataset.bound) return;
  saveBtn.dataset.bound = "true";

  saveBtn.addEventListener("click", async () => {
    if (!appLockPendingSecret) {
      alert("Please finish setting your PIN, pattern, or password first.");
      return;
    }

    const questions = Array.from(document.querySelectorAll(".app-lock-question-input"))
      .sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
      .map(el => el.value.trim());
    const answers = Array.from(document.querySelectorAll(".app-lock-answer-input"))
      .sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
      .map(el => el.value);

    if (questions.some(q => !q) || answers.some(a => !a.trim())) {
      alert("Please fill in all 3 security questions and answers.");
      return;
    }

    await setAppLockSecret(appLockDraftMethod, appLockPendingSecret);
    await setSecurityQuestions(questions.map((question, i) => ({ question, answer: answers[i] })));

    alert("App password set successfully.");
    appLockPendingSecret = null;
    updateAppLockSettingsSummary();
    window.location.href = "settings.html";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // Runs after app.js's own DOMContentLoaded handler (script order in the HTML),
  // so state is already loaded by the time this fires.
  const tryInit = () => {
    if (!document.getElementById("app-lock-method-picker")) return;
    renderAppLockMethodPicker();
    setupAppLockSaveButton();
  };
  // app.js may still be mid-unlock-gate on this page; wait for app-unlocked if so.
  if (typeof appLockShouldBlockPage === "function" && appLockShouldBlockPage()) {
    document.addEventListener("app-unlocked", tryInit, { once: true });
  } else {
    tryInit();
  }
});
