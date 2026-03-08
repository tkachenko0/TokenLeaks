const input = /** @type {HTMLInputElement} */ (document.getElementById("query"));
const searchBtn = /** @type {HTMLButtonElement} */ (document.getElementById("search"));
const pathEl = /** @type {HTMLParagraphElement} */ (document.getElementById("path"));
const loading = /** @type {HTMLParagraphElement} */ (document.getElementById("loading"));
const resultEl = /** @type {HTMLDivElement} */ (document.getElementById("result"));

const scanLoading = /** @type {HTMLParagraphElement} */ (document.getElementById("scan-loading"));
const rescanBtn = /** @type {HTMLButtonElement} */ (document.getElementById("rescan"));
const revealBtn = /** @type {HTMLButtonElement} */ (document.getElementById("reveal"));
const tabSelect = /** @type {HTMLSelectElement} */ (document.getElementById("tab-select"));
const keyPatternsEl = /** @type {HTMLTextAreaElement} */ (document.getElementById("key-patterns"));
const valuePatternsEl = /** @type {HTMLTextAreaElement} */ (document.getElementById("value-patterns"));
const localStorageEl = /** @type {HTMLDivElement} */ (document.getElementById("local-storage"));
const sessionStorageEl = /** @type {HTMLDivElement} */ (document.getElementById("session-storage"));
const cookiesEl = /** @type {HTMLDivElement} */ (document.getElementById("cookies"));

/** @typedef {{ local: [string, string][], session: [string, string][], cookies: [string, string][] }} ScanResult */

const state = { revealed: false };

const DEFAULT_KEY_PATTERNS = [
  "token", "session", "access", "refresh", "auth", "jwt", "api[_-]?key",
  "secret", "credential", "bearer", "id_token", "access_token",
  "refresh_token", "session_id", "csrf", "xsrf"
];

const DEFAULT_VALUE_PATTERNS = ["^eyJ"];

keyPatternsEl.value = DEFAULT_KEY_PATTERNS.join("\n");
valuePatternsEl.value = DEFAULT_VALUE_PATTERNS.join("\n");

/** @param {HTMLTextAreaElement} textarea */
function getPatterns(textarea) {
  return textarea.value.split("\n").map((l) => l.trim()).filter(Boolean).filter((p) => {
    try { new RegExp(p, "i"); return true; } catch { return false; }
  });
}

/**
 * @param {string} str
 * @param {number} [edge]
 */
function truncate(str, edge = 10) {
  if (str.length <= edge * 2) return "*".repeat(str.length);
  return `${str.slice(0, edge)}${"*".repeat(Math.min(str.length - edge * 2, 8))}${str.slice(-edge)}`;
}

/** @param {string} value */
function displayValue(value) {
  return state.revealed ? value : truncate(value, 15);
}

/**
 * @param {string} key
 * @param {string} value
 * @returns {HTMLDivElement}
 */
function createEntry(key, value) {
  const entry = document.createElement("div");
  entry.className = "entry";

  const info = document.createElement("div");
  info.className = "entry-info";

  const keySpan = document.createElement("span");
  keySpan.className = "entry-key";
  keySpan.textContent = key;

  const valueSpan = document.createElement("span");
  valueSpan.className = "entry-value";
  valueSpan.dataset.raw = value;
  valueSpan.textContent = ` ${displayValue(value)}`;

  info.appendChild(keySpan);
  info.appendChild(valueSpan);

  const btn = document.createElement("button");
  btn.className = "copy-btn";
  btn.textContent = "Copy";
  btn.addEventListener("click", () => {
    navigator.clipboard.writeText(value);
    btn.textContent = "Copied";
    setTimeout(() => { btn.textContent = "Copy"; }, 1000);
  });

  entry.appendChild(info);
  entry.appendChild(btn);
  return entry;
}

/**
 * @param {HTMLElement} container
 * @param {[string, string][]} entries
 */
function renderEntries(container, entries) {
  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No interesting keys found";
    container.appendChild(empty);
    return;
  }
  entries.forEach(([k, v]) => container.appendChild(createEntry(k, v)));
}

async function populateTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  tabSelect.innerHTML = "";
  tabs.forEach((tab) => {
    const label = tab.title || tab.url;
    if (!label) return;

    const option = document.createElement("option");
    option.value = String(tab.id);
    option.textContent = label;
    if (tab.id === activeTab.id) option.selected = true;
    tabSelect.appendChild(option);
  });
}

function getSelectedTabId() {
  return Number(tabSelect.value);
}

async function autoScan() {
  const tabId = getSelectedTabId();
  const keyPatterns = getPatterns(keyPatternsEl);
  const valuePatterns = getPatterns(valuePatternsEl);

  localStorageEl.innerHTML = "";
  sessionStorageEl.innerHTML = "";
  cookiesEl.innerHTML = "";
  scanLoading.style.display = "block";

  try {
    const [{ result }] = /** @type {chrome.scripting.InjectionResult<ScanResult>[]} */ (
      await chrome.scripting.executeScript({
      target: { tabId },
      func: (/** @type {string[]} */ keyPats, /** @type {string[]} */ valPats) => {
        /**
         * @param {string} key
         * @param {string} value
         */
        function isInteresting(key, value) {
          if (keyPats.some((p) => new RegExp(p, "i").test(key))) return true;
          if (valPats.some((p) => new RegExp(p, "i").test(value))) return true;
          return false;
        }

        /** @param {Storage} storage */
        function scan(storage) {
          const found = [];
          try {
            for (let i = 0; i < storage.length; i++) {
              const key = storage.key(i);
              if (!key) continue;
              const value = storage.getItem(key);
              if (value && isInteresting(key, value)) found.push([key, value]);
            }
          } catch (_) { /* storage not available */ }
          return found;
        }

        return {
          local: scan(localStorage),
          session: scan(sessionStorage),
          cookies: document.cookie
            .split(";")
            .map((c) => c.trim().split("="))
            .filter(([k, ...v]) => k && isInteresting(k, v.join("=")))
            .map(([k, ...v]) => [k, v.join("=")])
        };
      },
      args: [keyPatterns, valuePatterns]
    }));

    if (!result) return;
    renderEntries(localStorageEl, result.local);
    renderEntries(sessionStorageEl, result.session);
    renderEntries(cookiesEl, result.cookies);
  } catch (/** @type {any} */ err) {
    console.error("autoScan failed:", err);
    localStorageEl.innerHTML =
      `<p class="empty">Cannot scan this tab: ${err.message}</p>`;
  }

  scanLoading.style.display = "none";
}

populateTabs().then(autoScan);
rescanBtn.addEventListener("click", autoScan);
tabSelect.addEventListener("change", autoScan);

revealBtn.addEventListener("click", () => {
  state.revealed = !state.revealed;
  revealBtn.textContent = state.revealed ? "Hide" : "Reveal";
  revealBtn.classList.toggle("active", state.revealed);
  document.querySelectorAll(".entry-value").forEach((el) => {
    el.textContent = ` ${displayValue(/** @type {HTMLElement} */ (el).dataset.raw || "")}`;
  });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "TABS_CHANGED") populateTabs();
});

function clearResult() {
  pathEl.textContent = "";
  resultEl.querySelectorAll(".entry").forEach((el) => el.remove());
}

/** @param {number} tabId */
async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { ping: true });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
  }
}

async function search() {
  clearResult();
  loading.style.display = "block";

  try {
    const tabId = getSelectedTabId();
    await ensureContentScript(tabId);
    const response = /** @type {{ path: string, key: string, value: string }[] | null} */ (
      await chrome.tabs.sendMessage(tabId, { query: input.value })
    );

    loading.style.display = "none";

    if (response && response.length) {
      response.forEach((r) => {
        const entry = createEntry(`${r.path} (${r.key})`, r.value);
        resultEl.appendChild(entry);
      });
    } else {
      pathEl.textContent = "Nothing found";
    }
  } catch (/** @type {any} */ err) {
    loading.style.display = "none";
    console.error("search failed:", err);
    pathEl.textContent = `Cannot search this tab: ${err.message}`;
  }
}

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") search();
});

searchBtn.addEventListener("click", search);
