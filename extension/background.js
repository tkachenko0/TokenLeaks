chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id, windowId: tab.windowId });
});

function notifyTabsChanged() {
  chrome.runtime.sendMessage({ type: "TABS_CHANGED" }).catch(() => {});
}

chrome.tabs.onCreated.addListener(notifyTabsChanged);
chrome.tabs.onRemoved.addListener(notifyTabsChanged);
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.title || changeInfo.url) notifyTabsChanged();
});
