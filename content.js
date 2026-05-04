(() => {
  const DEFAULT_WAIT_MS = 2000;
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
      if (isInsideExtensionPanel(el)) return false;

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

  function setStatus(message) {
    const el = document.getElementById("gh-comment-expander-status");
    if (el) el.textContent = message;
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
    let safety = 100;

    try {
      setStatus("Expanding all...");

      while (safety-- > 0) {
        const elements = getExpandElements();
        if (!elements.length) break;

        // Click ALL expand buttons
        for (const el of elements) {
          el.scrollIntoView({ block: "center" });
          el.click();
          total++;
        }

        setStatus(`Expanded ${total} section(s)...`);

        // Wait for GitHub to load new content
        await wait(DEFAULT_WAIT_MS);
      }

      const msg = `Expanded ${total} hidden section(s).`;
      setStatus(msg);

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

        const el = elements[elements.length - 1];

        el.scrollIntoView({ block: "center" });
        el.click();

        total++;
        setStatus(`Expanded ${total}/${count} section(s)...`);

        await wait(DEFAULT_WAIT_MS);
      }

      const msg = `Expanded ${total} hidden section(s).`;
      setStatus(msg);

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
      <button id="gh-expand-all-btn" style="padding:6px 10px;">Expand all Comments</button>
      <input id="gh-expand-count-input" type="number" min="1" value="${savedCount}" style="width:60px; padding:6px;" />
      <button id="gh-expand-last-btn" style="padding:6px 10px;">Expand last N</button>
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

    expandAllBtn.addEventListener("click", expandAll);

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

    const expandButtons = getExpandElements();
    if (!expandButtons.length) return;

    const saved = await chrome.storage.sync.get({ expandCount: DEFAULT_COUNT });
    const savedCount = Number(saved.expandCount) || DEFAULT_COUNT;

    createFloatingPanel(savedCount);
  }

  // Initial load
  if (isIssueOrPrPage()) {
    injectPanel();
  }

  // Handle dynamic GitHub updates
  const observer = new MutationObserver(() => {
    const hasHidden = getExpandElements().length > 0;
    const panelExists = document.getElementById(PANEL_ID);

    if (hasHidden && !panelExists) {
      injectPanel();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log("GitHub Hidden Comment Expander loaded on", location.href);
})();
