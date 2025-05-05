/**
 * Bookmark Dock System
 *
 * Provides a floating, collapsible dock for bookmark functionality
 * that integrates with the main extension without affecting other components
 */
class BookmarkDock {
  constructor() {
    this.isActive = false;
    this.hasUpdates = false;
    this.loaded = false;
    this.eventsBound = false;
    this.dockElement = null;
    this.dockTab = null;
    this.dockContainer = null;
    this.closeButton = null;
    this.bookmarkFrame = null;
    this.currentTheme = "system"; // Track current theme
  }

  /**
   * Initialize the bookmark dock system
   */
  init() {
    console.log("Initializing bookmark dock system");
    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () =>
        this.waitForComponents()
      );
    } else {
      this.waitForComponents();
    }
  }

  /**
   * Wait for the component loader to finish loading all components
   */
  waitForComponents() {
    console.log("Waiting for components to be loaded");

    // If components are already loaded, setup immediately
    if (document.querySelector(".bookmark-dock-system")) {
      console.log("Components already loaded, setting up bookmark dock");
      this.setup();
      return;
    }

    // Listen for the componentsLoaded event from the component loader
    document.addEventListener("componentsLoaded", () => {
      console.log("Components loaded event received, setting up bookmark dock");
      // Give a small delay to ensure DOM is fully updated
      setTimeout(() => this.setup(), 100);
    });
  }

  /**
   * Set up the dock element and event listeners
   */
  setup() {
    console.log("Setting up bookmark dock");
    this.dockElement = document.querySelector(".bookmark-dock-system");
    if (!this.dockElement) {
      console.error("Bookmark dock element not found");
      return;
    }

    this.dockTab = document.getElementById("bookmark-dock-tab");
    this.dockContainer = document.getElementById("bookmark-dock-container");
    this.closeButton = document.getElementById("bookmark-dock-close");
    this.bookmarkFrame = document.getElementById("bookmark-frame");

    console.log("Dock tab found:", this.dockTab);
    console.log("Dock container found:", this.dockContainer);

    this.bindEvents();
    this.initTheme();

    // Load user preference from storage
    chrome.storage.local.get({ bookmarkDockActive: false }, (result) => {
      if (result.bookmarkDockActive) {
        this.openDock(false); // Open without animation
      }
    });

    this.setupIframeIntegration();
  }

  /**
   * Initialize theme functionality
   */
  initTheme() {
    // Get theme from chrome storage
    chrome.storage.sync.get("theme", (data) => {
      const savedTheme = data.theme || "system";
      this.currentTheme = savedTheme;

      // Set up listener for theme changes in chrome storage
      chrome.storage.onChanged.addListener((changes) => {
        if (changes.theme) {
          this.currentTheme = changes.theme.newValue;
          this.syncThemeWithIframe(this.getThemeMode());
        }
      });
    });

    // Add listener for system color scheme changes
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        if (this.currentTheme === "system") {
          this.syncThemeWithIframe(this.getThemeMode());
        }
      });
  }

  /**
   * Get the current theme mode (dark or light) based on settings
   * @returns {boolean} True if dark mode, false if light mode
   */
  getThemeMode() {
    if (this.currentTheme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return this.currentTheme === "dark";
  }

  /**
   * Bind event handlers
   */
  bindEvents() {
    if (this.eventsBound) return;

    console.log("Binding events for bookmark dock");

    if (this.dockTab) {
      this.dockTab.addEventListener("click", () => {
        console.log("Dock tab clicked");
        this.toggleDock();
      });
    }

    if (this.closeButton) {
      this.closeButton.addEventListener("click", () => {
        console.log("Close button clicked");
        this.closeDock();
      });
    }

    // Listen for external theme changes to sync with iframe
    document.addEventListener("themeChanged", (e) => {
      this.syncThemeWithIframe(e.detail.isDark);
    });

    // Listen for Escape key to close dock
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isActive) {
        this.closeDock();
      }
    });

    this.eventsBound = true;
  }

  /**
   * Set up the integration with the bookmark iframe
   */
  setupIframeIntegration() {
    // Listen to messages from the iframe
    window.addEventListener("message", (event) => {
      if (!event.data || !event.data.type) return;

      switch (event.data.type) {
        case "bookmark-update":
          this.setUpdateIndicator(true);
          break;
        case "theme-request":
          // Iframe is requesting the current theme
          this.syncThemeWithIframe(this.getThemeMode());
          break;
      }
    });

    // Handle iframe load
    if (this.bookmarkFrame) {
      this.bookmarkFrame.addEventListener("load", () => {
        console.log("Bookmark iframe loaded");
        this.loaded = true;

        // Sync theme with iframe using our theme management system
        this.syncThemeWithIframe(this.getThemeMode());
      });
    }
  }

  /**
   * Toggle the dock open/closed state
   */
  toggleDock() {
    console.log("Toggling dock state, current state:", this.isActive);
    if (this.isActive) {
      this.closeDock();
    } else {
      this.openDock();
    }
  }

  /**
   * Open the dock
   * @param {boolean} animate - Whether to animate the transition
   */
  openDock(animate = true) {
    console.log("Opening dock, animate:", animate);
    if (!animate) {
      this.dockElement.style.transition = "none";
      setTimeout(() => {
        this.dockElement.style.transition = "";
      }, 100);
    }

    this.isActive = true;
    this.dockElement.classList.add("active");
    this.setUpdateIndicator(false);

    // Save state to storage
    chrome.storage.local.set({ bookmarkDockActive: true });

    // Dispatch event that dock is opened
    document.dispatchEvent(new CustomEvent("bookmarkDockOpened"));
  }

  /**
   * Close the dock
   */
  closeDock() {
    console.log("Closing dock");
    this.isActive = false;
    this.dockElement.classList.remove("active");

    // Save state to storage
    chrome.storage.local.set({ bookmarkDockActive: false });

    // Dispatch event that dock is closed
    document.dispatchEvent(new CustomEvent("bookmarkDockClosed"));
  }

  /**
   * Set the update indicator state
   * @param {boolean} hasUpdates - Whether there are updates
   */
  setUpdateIndicator(hasUpdates) {
    this.hasUpdates = hasUpdates;

    if (hasUpdates && !this.isActive) {
      this.dockTab.classList.add("has-updates");
    } else {
      this.dockTab.classList.remove("has-updates");
    }
  }

  /**
   * Sync the theme with the iframe
   * @param {boolean} isDark - Whether dark mode is enabled
   */
  syncThemeWithIframe(isDark) {
    if (!this.loaded || !this.bookmarkFrame) return;

    // Send theme to iframe
    this.bookmarkFrame.contentWindow.postMessage(
      {
        type: "theme-change",
        theme: isDark ? "dark" : "light",
      },
      "*"
    );
  }
}

// Initialize the bookmark dock
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing bookmark dock");
  const bookmarkDock = new BookmarkDock();
  bookmarkDock.init();
});
