(() => {
  const DEFAULT_WAIT_MS = 1200;
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

  function getExpandElements() {
    const elements = Array.from(document.querySelectorAll("a, button"));

    return elements.filter((el) => {
      const text = (el.textContent || "").trim().toLowerCase();
      const aria = (el.getAttribute("aria-label") || "").trim().toLowerCase();
      const title = (el.getAttribute("title") || "").trim().toLowerCase();

      const combined = `${text} ${aria} ${title}`.replace(/\s+/g, " ").trim();

      return (
        combined.includes("view more") ||
        combined.includes("load more") ||
        combined.includes("show more") ||
        combined.includes("expand") ||
        combined.includes("expand comment") ||
        combined.includes("expand comments") ||
        combined.includes("hidden comment")
      );
    }).filter(isVisible);
  }

  async function clickExpandElement(el) {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    await wait(250);

    el.click();

    await wait(DEFAULT_WAIT_MS);
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
      while (safety-- > 0) {
        const elements = getExpandElements();
        if (!elements.length) break;

        // expand from the end/latest hidden range
        const target = elements[elements.length - 1];
        await clickExpandElement(target);
        total++;
      }

      return { ok: true, message: `Expanded ${total} hidden section(s).` };
    } catch (err) {
      console.error("Expand all failed:", err);
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
      while (total < count) {
        const elements = getExpandElements();
        if (!elements.length) break;

        const target = elements[elements.length - 1];
        await clickExpandElement(target);
        total++;
      }

      return { ok: true, message: `Expanded ${total} hidden section(s).` };
    } catch (err) {
      console.error("Expand last N failed:", err);
      return { ok: false, message: "Failed while expanding comments." };
    } finally {
      isRunning = false;
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;

    if (message.type === "EXPAND_ALL_COMMENTS") {
      expandAll().then(sendResponse);
      return true;
    }

    if (message.type === "EXPAND_LAST_N_COMMENTS") {
      const count = Number(message.count) || 10;
      expandLastN(count).then(sendResponse);
      return true;
    }
  });

  console.log("GitHub Hidden Comment Expander loaded on", location.href);
})();