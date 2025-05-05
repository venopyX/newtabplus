/**
 * Iframe Integration Module
 *
 * Handles communication between the bookmark iframe and the parent window
 * for syncing theme, sending updates, etc.
 */

// Theme state
let currentTheme = "system";

// Listen for messages from parent
window.addEventListener("message", (event) => {
  if (!event.data || !event.data.type) return;

  switch (event.data.type) {
    case "theme-change":
      // Parent is sending theme change info
      applyTheme(event.data.theme);
      break;
  }
});

/**
 * Initialize theme functionality when in standalone mode
 * This allows the iframe to work independently if needed
 */
function initTheme() {
  // Only initialize if we're not in an iframe
  if (window.self === window.top) {
    chrome.storage.sync.get("theme", function (data) {
      const savedTheme = data.theme || "system";
      currentTheme = savedTheme;
      applyThemeFromPreference(savedTheme);
    });

    // Listen for changes in theme setting
    chrome.storage.onChanged.addListener(function (changes) {
      if (changes.theme) {
        currentTheme = changes.theme.newValue;
        applyThemeFromPreference(changes.theme.newValue);
      }
    });

    // Listen for system theme changes
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        if (currentTheme === "system") {
          applyThemeFromPreference("system");
        }
      });
  }
}

/**
 * Apply theme based on user preference (system, light, or dark)
 * @param {string} preference - Theme preference: 'system', 'light', or 'dark'
 */
function applyThemeFromPreference(preference) {
  if (preference === "system") {
    const isDarkMode = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    applyTheme(isDarkMode ? "dark" : "light");
  } else {
    applyTheme(preference);
  }
}

/**
 * Apply theme based on parent's theme setting
 * @param {string} theme - Theme name ('light' or 'dark')
 */
function applyTheme(theme) {
  // Set dark mode checkbox to match parent's theme
  const darkModeCheckbox = document.getElementById("setting-dark-mode");
  const isDark = theme === "dark";

  if (darkModeCheckbox) {
    darkModeCheckbox.checked = isDark;
  }

  // Apply theme to document
  document.documentElement.classList.toggle("dark", isDark);

  // Update internal dark mode state
  if (typeof window.isDarkMode !== "undefined") {
    window.isDarkMode = isDark;
  }
}

// When iframe loads, handle initialization
document.addEventListener("DOMContentLoaded", () => {
  // Set the iframe communicator to ready state
  const communicator = document.getElementById("iframe-communicator");
  if (communicator) {
    communicator.dataset.state = "ready";
  }

  // Initialize theme if not in iframe
  if (window.self === window.top) {
    initTheme();
  } else {
    // Request theme from parent if we're in an iframe
    window.parent.postMessage(
      {
        type: "theme-request",
      },
      "*"
    );
  }
});

/**
 * Notify parent about bookmark changes/updates
 */
function notifyParentOfUpdate() {
  window.parent.postMessage(
    {
      type: "bookmark-update",
    },
    "*"
  );
}

// Make functions available globally
window.notifyParentOfUpdate = notifyParentOfUpdate;
window.applyTheme = applyTheme;
