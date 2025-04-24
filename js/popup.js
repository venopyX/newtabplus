// Popup menu functionality
document.addEventListener("DOMContentLoaded", function () {
  // Fix for chrome:// links which can't be opened directly
  document
    .getElementById("open-newtab")
    .addEventListener("click", function (e) {
      e.preventDefault();
      chrome.tabs.create({ url: "chrome://newtab/" });
      window.close();
    });

  // View calendar
  document
    .getElementById("view-calendar")
    .addEventListener("click", function () {
      // Navigate to newtab page with calendar parameter
      chrome.tabs.create({ url: "chrome://newtab/?showCalendar=true" });
      window.close();
    });

  // Add tab timer
  document
    .getElementById("add-tab-timer")
    .addEventListener("click", function () {
      chrome.tabs.create({ url: "chrome://newtab/" }, function (tab) {
        // Send message to open tab timer modal
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
          if (tabId === tab.id && changeInfo.status === "complete") {
            chrome.tabs.sendMessage(tabId, { action: "openTabTimerModal" });
            chrome.tabs.onUpdated.removeListener(listener);
          }
        });
      });
      window.close();
    });

  // Add reminder
  document
    .getElementById("add-reminder")
    .addEventListener("click", function () {
      chrome.tabs.create({ url: "chrome://newtab/" }, function (tab) {
        // Send message to open reminder modal
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
          if (tabId === tab.id && changeInfo.status === "complete") {
            chrome.tabs.sendMessage(tabId, { action: "openReminderModal" });
            chrome.tabs.onUpdated.removeListener(listener);
          }
        });
      });
      window.close();
    });

  // Add todo
  document.getElementById("add-todo").addEventListener("click", function () {
    chrome.tabs.create({ url: "chrome://newtab/" }, function (tab) {
      // Send message to open todo modal
      chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
        if (tabId === tab.id && changeInfo.status === "complete") {
          chrome.tabs.sendMessage(tabId, { action: "openTodoModal" });
          chrome.tabs.onUpdated.removeListener(listener);
        }
      });
    });
    window.close();
  });

  // Add note
  document.getElementById("add-note").addEventListener("click", function () {
    chrome.tabs.create({ url: "chrome://newtab/" }, function (tab) {
      // Send message to open note modal
      chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
        if (tabId === tab.id && changeInfo.status === "complete") {
          chrome.tabs.sendMessage(tabId, { action: "openNoteModal" });
          chrome.tabs.onUpdated.removeListener(listener);
        }
      });
    });
    window.close();
  });

  // Open YouTube sidepanel
  document
    .getElementById("open-youtube")
    .addEventListener("click", function () {
      chrome.tabs.create({ url: "chrome://newtab/" }, function (tab) {
        // Send message to open YouTube sidepanel
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
          if (tabId === tab.id && changeInfo.status === "complete") {
            chrome.tabs.sendMessage(tabId, { action: "openYouTubeSidepanel" });
            chrome.tabs.onUpdated.removeListener(listener);
          }
        });
      });
      window.close();
    });

  // Open options
  document
    .getElementById("open-options")
    .addEventListener("click", function () {
      chrome.runtime.openOptionsPage
        ? chrome.runtime.openOptionsPage()
        : chrome.tabs.create({
            url: "chrome://extensions/?options=" + chrome.runtime.id,
          });
      window.close();
    });

  // Check for current version and update footer
  const manifest = chrome.runtime.getManifest();
  document.querySelector("footer").textContent = `NewTab+ v${manifest.version}`;
});
