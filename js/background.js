// Background service worker for NewTab+
// Handles background tasks, notifications, and alarms

// Listen for installation
chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === "install") {
    // First installation
    showWelcomeNotification();
  } else if (details.reason === "update") {
    // Extension updated
    const thisVersion = chrome.runtime.getManifest().version;
    console.log(
      "Updated from " + details.previousVersion + " to " + thisVersion
    );
  }
});

// Show welcome notification
function showWelcomeNotification() {
  chrome.notifications.create("welcome", {
    type: "basic",
    iconUrl: "/images/icon128.png",
    title: "Welcome to NewTab+",
    message: "Open a new tab to start using your productivity dashboard!",
    buttons: [{ title: "Open Now" }],
    priority: 2,
  });
}

// Listen for notification button clicks
chrome.notifications.onButtonClicked.addListener(function (
  notificationId,
  buttonIndex
) {
  if (notificationId === "welcome" && buttonIndex === 0) {
    chrome.tabs.create({ url: "chrome://newtab/" });
  }
});

// Alarm handling for recurring tasks
chrome.alarms.onAlarm.addListener(function (alarm) {
  // Check if the alarm is for a scheduled tab
  if (alarm.name.startsWith("tab_")) {
    const tabId = alarm.name.replace("tab_", "");

    // Get the tab details from storage
    chrome.storage.sync.get("timedTabs", function (data) {
      if (data.timedTabs) {
        const tab = data.timedTabs.find((t) => t.id === tabId);

        if (tab) {
          // Handle according to open type
          if (tab.openType === "auto") {
            // Open the tab automatically
            chrome.tabs.create({
              url: tab.url,
              active: tab.openLocation === "foreground",
            });

            // Show a notification
            chrome.notifications.create(tab.id, {
              type: "basic",
              iconUrl: "/images/icon128.png",
              title: "Tab Opened",
              message: `The scheduled tab "${tab.title}" has been opened.`,
              priority: 1,
            });
          } else {
            // Show notification with action
            chrome.notifications.create(tab.id, {
              type: "basic",
              iconUrl: "/images/icon128.png",
              title: "Tab Reminder",
              message: `Scheduled time for "${tab.title}" has arrived.`,
              buttons: [{ title: "Open Now" }],
              priority: 1,
            });
          }

          // Remove tab from list if it's not recurring
          if (!tab.recurring || tab.recurring === "none") {
            const updatedTabs = data.timedTabs.filter((t) => t.id !== tabId);
            chrome.storage.sync.set({ timedTabs: updatedTabs });
          }
        }
      }
    });
  }

  // Check if the alarm is for a reminder
  if (alarm.name.startsWith("reminder_")) {
    const reminderId = alarm.name.replace("reminder_", "");

    // Get the reminder details from storage
    chrome.storage.sync.get("reminders", function (data) {
      if (data.reminders) {
        const reminder = data.reminders.find((r) => r.id === reminderId);

        if (reminder) {
          // Handle according to action type
          if (reminder.action === "open-tab" && reminder.tabUrl) {
            // Open the tab
            chrome.tabs.create({
              url: reminder.tabUrl,
              active: true,
            });
          }

          // Show notification for all reminders
          chrome.notifications.create(reminder.id, {
            type: "basic",
            iconUrl: "/images/icon128.png",
            title: reminder.title,
            message: reminder.message,
            buttons:
              reminder.action === "open-tab" ? [{ title: "Open Tab" }] : [],
            priority: 2,
          });

          // If recurring, schedule the next occurrence
          if (reminder.recurring && reminder.recurring !== "none") {
            const nextDate = new Date(reminder.scheduledTime);
            switch (reminder.recurring) {
              case "daily":
                nextDate.setDate(nextDate.getDate() + 1);
                break;
              case "weekly":
                nextDate.setDate(nextDate.getDate() + 7);
                break;
              case "monthly":
                nextDate.setMonth(nextDate.getMonth() + 1);
                break;
            }

            // Create a new reminder with updated time
            const newReminder = {
              ...reminder,
              id:
                Date.now().toString(36) + Math.random().toString(36).substr(2),
              scheduledTime: nextDate.getTime(),
            };

            const updatedReminders = data.reminders.filter(
              (r) => r.id !== reminderId
            );
            updatedReminders.push(newReminder);
            chrome.storage.sync.set({ reminders: updatedReminders });

            // Set alarm for the new reminder
            chrome.alarms.create("reminder_" + newReminder.id, {
              when: newReminder.scheduledTime,
            });
          } else {
            // Remove non-recurring reminder
            const updatedReminders = data.reminders.filter(
              (r) => r.id !== reminderId
            );
            chrome.storage.sync.set({ reminders: updatedReminders });
          }
        }
      }
    });
  }
});

// Listen for notification clicks
chrome.notifications.onClicked.addListener(function (notificationId) {
  // Focus on an existing new tab or open a new one
  chrome.tabs.query({ url: "chrome://newtab/" }, function (tabs) {
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { active: true });
    } else {
      chrome.tabs.create({ url: "chrome://newtab/" });
    }
  });
});

// Listen for notification button clicks
chrome.notifications.onButtonClicked.addListener(function (
  notificationId,
  buttonIndex
) {
  // Check if it's a tab notification
  chrome.storage.sync.get("timedTabs", function (data) {
    if (data.timedTabs) {
      const tab = data.timedTabs.find((t) => t.id === notificationId);
      if (tab && buttonIndex === 0) {
        chrome.tabs.create({ url: tab.url, active: true });
      }
    }
  });

  // Check if it's a reminder notification
  chrome.storage.sync.get("reminders", function (data) {
    if (data.reminders) {
      const reminder = data.reminders.find((r) => r.id === notificationId);
      if (reminder && buttonIndex === 0 && reminder.action === "open-tab") {
        chrome.tabs.create({ url: reminder.tabUrl, active: true });
      }
    }
  });
});

// On startup, set up all necessary alarms
chrome.runtime.onStartup.addListener(function () {
  // Set up alarms for timed tabs
  chrome.storage.sync.get("timedTabs", function (data) {
    if (data.timedTabs) {
      data.timedTabs.forEach((tab) => {
        // Only set alarms for future tabs
        if (tab.scheduledTime > Date.now()) {
          chrome.alarms.create("tab_" + tab.id, { when: tab.scheduledTime });
        }
      });
    }
  });

  // Set up alarms for reminders
  chrome.storage.sync.get("reminders", function (data) {
    if (data.reminders) {
      data.reminders.forEach((reminder) => {
        // Only set alarms for future reminders
        if (reminder.scheduledTime > Date.now()) {
          chrome.alarms.create("reminder_" + reminder.id, {
            when: reminder.scheduledTime,
          });
        }
      });
    }
  });
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === "createTabTimer") {
    // Create a new timed tab
    const tabInfo = message.tabInfo;
    chrome.alarms.create("tab_" + tabInfo.id, { when: tabInfo.scheduledTime });
    sendResponse({ success: true });
    return true;
  }

  if (message.action === "cancelTabTimer") {
    // Cancel a timed tab
    chrome.alarms.clear("tab_" + message.tabId);
    sendResponse({ success: true });
    return true;
  }

  if (message.action === "createReminder") {
    // Create a new reminder alarm
    const reminder = message.reminder;
    chrome.alarms.create("reminder_" + reminder.id, {
      when: reminder.scheduledTime,
    });
    sendResponse({ success: true });
    return true;
  }

  if (message.action === "cancelReminder") {
    // Cancel a reminder
    chrome.alarms.clear("reminder_" + message.reminderId);
    sendResponse({ success: true });
    return true;
  }
});
