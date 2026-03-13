const countInput = document.getElementById("count");
const expandAllBtn = document.getElementById("expandAllBtn");
const expandLastBtn = document.getElementById("expandLastBtn");
const statusEl = document.getElementById("status");

const DEFAULT_COUNT = 10;

function setStatus(msg) {
  statusEl.textContent = msg;
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function isGitHubIssueOrPr(url = "") {
  return /^https:\/\/github\.ibm\.com\/[^/]+\/[^/]+\/(issues|pull)\/\d+/.test(url);
}

async function sendCommandToTab(message) {
  const tab = await getActiveTab();

  if (!tab || !tab.id) {
    setStatus("Could not find active tab.");
    return;
  }

  if (!isGitHubIssueOrPr(tab.url || "")) {
    setStatus("Open a GitHub issue or pull request page first.");
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, message);
    if (response?.ok) {
      setStatus(response.message || "Started.");
    } else {
      setStatus(response?.message || "Command sent.");
    }
  } catch (err) {
    console.error(err);
    setStatus("Content script not available. Refresh the GitHub page and try again.");
  }
}

chrome.storage.sync.get({ expandCount: DEFAULT_COUNT }, (result) => {
  countInput.value = result.expandCount;
});

countInput.addEventListener("change", () => {
  let value = Number(countInput.value);
  if (!value || value < 1) value = DEFAULT_COUNT;
  countInput.value = value;
  chrome.storage.sync.set({ expandCount: value });
});

expandAllBtn.addEventListener("click", async () => {
  setStatus("Sending expand-all command...");
  await sendCommandToTab({ type: "EXPAND_ALL_COMMENTS" });
});

expandLastBtn.addEventListener("click", async () => {
  let count = Number(countInput.value);
  if (!count || count < 1) count = DEFAULT_COUNT;

  countInput.value = count;
  chrome.storage.sync.set({ expandCount: count });

  setStatus(`Sending expand-last-${count} command...`);
  await sendCommandToTab({
    type: "EXPAND_LAST_N_COMMENTS",
    count
  });
});