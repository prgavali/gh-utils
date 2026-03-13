(() => {
  const DEFAULT_WAIT_MS = 1200;
  const DEFAULT_COUNT = 10;
  const PANEL_ID = "gh-comment-expander-panel";
  let isRunning = false;

  function isIssueOrPrPage() {
    return /\/[^/]+\/[^/]+\/issues\/\d+/.test(location.pathname) ||
           /\/[^/]+\/[^/]+\/pull\/\d+/.test(location.pathname);
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isVisible(el) {
    if (!el) return false;

    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden"
    );
  }

  function isInsideExtensionPanel(el) {
    return !!el.closest(`#${PANEL_ID}`);
  }

  function getExpandElements() {
    const elements = Array.from(document.querySelectorAll("a, button"));

    return elements.filter((el) => {
      if (!isVisible(el)) return false;
      if (isInsideExtensionPanel(el)) return false; // important fix

      const text = (el.textContent || "").trim().toLowerCase();
      const aria = (el.getAttribute("aria-label") || "").trim().toLowerCase();
      const title = (el.getAttribute("title") || "").trim().toLowerCase();

      const combined = `${text} ${aria} ${title}`.replace(/\s+/g, " ").trim();

      return (
        combined.includes("view more") ||
        combined.includes("load more") ||
        combined.includes("show more") 
      );
    });
  }

  async function clickExpandElement(el) {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    await wait(250);
    el.click();
    await wait(DEFAULT_WAIT_MS);
  }

  function setStatus(message) {
    const el = document.getElementById("gh-comment-expander-status");
    if (el) el.textContent = message;
  }

  function hidePanelIfNoHiddenBlocks() {
  const panel = document.getElementById(PANEL_ID);
  const hiddenBlocks = getExpandElements();

  if (panel && hiddenBlocks.length === 0) {
    panel.remove();
  }
}

  async function expandAll() {
    if (isRunning) {
      return { ok: false, message: "Already expanding comments." };
    }

    if (!isIssueOrPrPage()) {
      return { ok: false, message: "This page is not a GitHub issue or PR." };
    }

    isRunning = true;
    let total = 0;
    let safety = 200;

    try {
      setStatus("Expanding all...");

      while (safety-- > 0) {
        const elements = getExpandElements();
        if (!elements.length) break;

        const target = elements[elements.length - 1];
        await clickExpandElement(target);
        total++;
        setStatus(`Expanded ${total} section(s)...`);
      }

      const msg = `Expanded ${total} hidden section(s).`;
      setStatus(msg);
      hidePanelIfNoHiddenBlocks()
      return { ok: true, message: msg };
    } catch (err) {
      console.error("Expand all failed:", err);
      setStatus("Failed while expanding comments.");
      return { ok: false, message: "Failed while expanding comments." };
    } finally {
      isRunning = false;
    }
  }

  async function expandLastN(count) {
    if (isRunning) {
      return { ok: false, message: "Already expanding comments." };
    }

    if (!isIssueOrPrPage()) {
      return { ok: false, message: "This page is not a GitHub issue or PR." };
    }

    isRunning = true;
    let total = 0;

    try {
      setStatus(`Expanding last ${count}...`);

      while (total < count) {
        const elements = getExpandElements();
        if (!elements.length) break;

        const target = elements[elements.length - 1];
        await clickExpandElement(target);
        total++;
        setStatus(`Expanded ${total}/${count} section(s)...`);
      }

      const msg = `Expanded ${total} hidden section(s).`;
      setStatus(msg);

      hidePanelIfNoHiddenBlocks()
      return { ok: true, message: msg };
    } catch (err) {
      console.error("Expand last N failed:", err);
      setStatus("Failed while expanding comments.");
      return { ok: false, message: "Failed while expanding comments." };
    } finally {
      isRunning = false;
    }
  }

  function createFloatingPanel(savedCount = DEFAULT_COUNT) {
    if (document.getElementById(PANEL_ID)) return;

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.cssText = `
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 999999;
      background: white;
      border: 1px solid #d0d7de;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding: 10px;
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: 12px;
      font-family: Arial, sans-serif;
    `;

    panel.innerHTML = `
      <button id="gh-expand-all-btn" type="button" style="padding:6px 10px; cursor:pointer;">Expand all Commnets</button>
      <input id="gh-expand-count-input" type="number" min="1" value="${savedCount}" style="width:60px; padding:6px;" />
      <button id="gh-expand-last-btn" type="button" style="padding:6px 10px; cursor:pointer;">Expand last N Sections</button>
      <span id="gh-comment-expander-status" style="max-width:220px; color:#57606a;"></span>
    `;

    document.body.appendChild(panel);

    const countInput = document.getElementById("gh-expand-count-input");
    const expandAllBtn = document.getElementById("gh-expand-all-btn");
    const expandLastBtn = document.getElementById("gh-expand-last-btn");

    countInput.addEventListener("change", async () => {
      let value = Number(countInput.value);
      if (!value || value < 1) value = DEFAULT_COUNT;
      countInput.value = String(value);
      await chrome.storage.sync.set({ expandCount: value });
    });

    expandAllBtn.addEventListener("click", async () => {
      await expandAll();
    });

    expandLastBtn.addEventListener("click", async () => {
      let count = Number(countInput.value);
      if (!count || count < 1) count = DEFAULT_COUNT;
      countInput.value = String(count);
      await chrome.storage.sync.set({ expandCount: count });
      await expandLastN(count);
    });
  }

async function injectPanel() {
  if (!isIssueOrPrPage()) return;
  if (document.getElementById(PANEL_ID)) return;

  // NEW: only show panel if hidden comments exist
  const expandButtons = getExpandElements();
  if (!expandButtons || expandButtons.length === 0) {
    return;
  }

  const saved = await chrome.storage.sync.get({ expandCount: DEFAULT_COUNT });
  const savedCount = Number(saved.expandCount) || DEFAULT_COUNT;

  createFloatingPanel(savedCount);
}

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;

    if (message.type === "EXPAND_ALL_COMMENTS") {
      expandAll().then(sendResponse);
      return true;
    }

    if (message.type === "EXPAND_LAST_N_COMMENTS") {
      const count = Number(message.count) || DEFAULT_COUNT;
      expandLastN(count).then(sendResponse);
      return true;
    }
  });

  if (isIssueOrPrPage()) {
    injectPanel();
  }

  console.log("GitHub Hidden Comment Expander loaded on", location.href);
})();

if (isIssueOrPrPage()) {
  injectPanel();

  const observer = new MutationObserver(() => {
    const hasHidden = getExpandElements().length > 0;
    const panelExists = document.getElementById(PANEL_ID);

    if (hasHidden && !panelExists) {
      injectPanel();
    }

    if (!hasHidden && panelExists) {
      panelExists.remove();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}