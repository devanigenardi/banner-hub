// Clicking the extension icon opens Banner Hub in a new tab.
chrome.action.onClicked.addListener(function () {
  chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
});
