/**
 * Main functionality for the NewTab+ extension
 * Handles core functionality, theme management, and initialization of components
 */

document.addEventListener("componentsLoaded", function () {
  updateDateTime();
  setInterval(updateDateTime, 1000);
  initModals();
  initTheme();

  document
    .getElementById("calendar-toggle-btn")
    .addEventListener("click", function () {
      const calendarCard = document.getElementById("calendar-card");
      if (calendarCard) {
        const wasHidden = calendarCard.style.display === "none";
        calendarCard.style.display = wasHidden ? "block" : "none";

        // Initialize calendar if it's being shown
        if (wasHidden && typeof initializeCalendar === "function") {
          initializeCalendar();

          // Load calendar events from todos, reminders and timed tabs
          updateCalendarEventsFromAll();
        }
      }
    });

  // YouTube toggle button
  const youtubeToggleBtn = document.getElementById("youtube-toggle-btn");
  if (youtubeToggleBtn) {
    youtubeToggleBtn.addEventListener("click", function () {
      toggleYouTubeSidepanel();
    });
  }

  initializeTimedTabs();
  initializeNotes();
  initializeTodos();
  initializeReminders();
  setupMessageListener();
});

document.addEventListener("DOMContentLoaded", function () {
  initTheme();
});

/**
 * Sets up message listeners for extension communication
 */
function setupMessageListener() {
  chrome.runtime.onMessage.addListener(function (
    message,
    sender,
    sendResponse
  ) {
    if (message.action === "openTabTimerModal") {
      openModal("tab-timer-modal");
      return true;
    }

    if (message.action === "openReminderModal") {
      openModal("reminder-modal");
      return true;
    }

    if (message.action === "openTodoModal") {
      openModal("todo-modal");
      return true;
    }

    if (message.action === "openNoteModal") {
      openModal("note-modal");
      return true;
    }

    if (message.action === "openYouTubeSidepanel") {
      if (typeof showYouTubeSidepanel === "function") {
        showYouTubeSidepanel();
      }
      return true;
    }

    if (message.action === "openCalendarTab") {
      const calendarCard = document.getElementById("calendar-card");
      if (calendarCard) {
        const wasHidden = calendarCard.style.display === "none";
        calendarCard.style.display = "block";

        // Initialize calendar
        if (typeof initializeCalendar === "function") {
          initializeCalendar();
          updateCalendarEventsFromAll();
        }
      }

      if (message.date) {
        navigateToDate(message.date);
      }
      return true;
    }
  });
}

/**
 * Opens todo edit form from calendar event
 * @param {string} todoId - Todo ID to edit
 */
function editTodoFromCalendar(todoId) {
  const todo = todos.find((t) => t.id === todoId);
  if (!todo) return;

  document.getElementById("todo-text").value = todo.text;

  if (todo.dueDate) {
    document.getElementById("todo-duedate").value = formatDateForInput(
      todo.dueDate
    );
  } else {
    document.getElementById("todo-duedate").value = "";
  }

  document.getElementById("todo-priority").value = todo.priority || "medium";
  document.getElementById("todo-recurring").value = todo.recurring || "none";

  const form = document.getElementById("todo-form");
  form.dataset.mode = "edit";
  form.dataset.editId = todoId;

  openModal("todo-modal");
}

/**
 * Opens reminder edit form from calendar event
 * @param {string} reminderId - Reminder ID to edit
 */
function editReminderFromCalendar(reminderId) {
  const reminder = reminders.find((r) => r.id === reminderId);
  if (!reminder) return;

  document.getElementById("reminder-title").value = reminder.title;
  document.getElementById("reminder-message").value = reminder.message;
  document.getElementById("reminder-time").value = formatDateForInput(
    reminder.time
  );
  document.getElementById("reminder-recurring").value =
    reminder.recurring || "none";
  document.getElementById("reminder-action").value =
    reminder.action || "notification";

  const urlContainer = document.getElementById("reminder-tab-url-container");
  if (reminder.action === "open-tab") {
    urlContainer.style.display = "block";
    document.getElementById("reminder-tab-url").value = reminder.url || "";
  } else {
    urlContainer.style.display = "none";
  }

  const form = document.getElementById("reminder-form");
  form.dataset.mode = "edit";
  form.dataset.editId = reminderId;

  openModal("reminder-modal");
}

/**
 * Updates the date and time display
 */
function updateDateTime() {
  const now = new Date();
  const timeElement = document.getElementById("current-time");
  const dateElement = document.getElementById("current-date");

  if (timeElement) {
    timeElement.textContent = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  if (dateElement) {
    dateElement.textContent = now.toLocaleDateString([], {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
}

/**
 * Initializes modal functionality
 */
function initModals() {
  const closeButtons = document.querySelectorAll(".close-modal");
  closeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      closeAllModals();
    });
  });

  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeAllModals();
      }
    });
  });
}

/**
 * Opens a modal by ID
 * @param {string} modalId - ID of the modal to open
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    // Find the modal's overlay container
    const modalOverlay =
      document.getElementById(`${modalId}-overlay`) ||
      modal.closest(".modal-overlay");

    if (modalOverlay) {
      modalOverlay.classList.add("active");
    }

    document.getElementById("modal-container").classList.remove("hidden");

    // Special handling for specific modals
    if (modalId === "tab-timer-modal") {
      const dateInput = document.getElementById("tab-date");
      if (dateInput) {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 5);
        dateInput.value = formatDateForInput(now);
      }
    }

    if (modalId === "reminder-modal") {
      const actionSelect = document.getElementById("reminder-action");
      if (actionSelect) {
        const urlContainer = document.getElementById(
          "reminder-tab-url-container"
        );

        urlContainer.style.display =
          actionSelect.value === "open-tab" ? "block" : "none";

        actionSelect.addEventListener("change", function () {
          urlContainer.style.display =
            this.value === "open-tab" ? "block" : "none";
        });
      }
    }
  }
}

/**
 * Closes all open modals
 */
function closeAllModals() {
  document.getElementById("modal-container").classList.add("hidden");
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.classList.remove("active");
  });

  document.querySelectorAll("form").forEach((form) => {
    form.reset();
    delete form.dataset.mode;
    delete form.dataset.editId;
  });
}

/**
 * Initializes theme functionality
 */
function initTheme() {
  const themeSelect = document.getElementById("theme-select");
  const themeToggle = document.getElementById("theme-toggle-btn");

  chrome.storage.sync.get("theme", function (data) {
    const savedTheme = data.theme || "system";

    if (themeSelect) {
      themeSelect.value = savedTheme;
    }

    applyTheme(savedTheme);
  });

  if (themeSelect) {
    themeSelect.addEventListener("change", function () {
      const theme = this.value;
      applyTheme(theme);
      saveThemePreference(theme);
    });
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      const newTheme = currentTheme === "dark" ? "light" : "dark";

      applyTheme(newTheme);

      if (themeSelect) {
        themeSelect.value = newTheme;
      }

      saveThemePreference(newTheme);
    });
  }
}

/**
 * Applies the selected theme
 * @param {string} theme - Theme to apply (light, dark, or system)
 */
function applyTheme(theme) {
  if (theme === "system") {
    const isDarkMode = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    document.documentElement.setAttribute(
      "data-theme",
      isDarkMode ? "dark" : "light"
    );
    updateThemeIcon(isDarkMode ? "dark" : "light");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
    updateThemeIcon(theme);
  }
}

/**
 * Updates the theme toggle icon
 * @param {string} theme - Current theme
 */
function updateThemeIcon(theme) {
  const icon = document.querySelector("#theme-toggle-btn i");
  if (icon) {
    icon.className = theme === "dark" ? "fas fa-sun" : "fas fa-moon";
  }
}

/**
 * Saves theme preference to storage
 * @param {string} theme - Theme to save
 */
function saveThemePreference(theme) {
  chrome.storage.sync.set({ theme: theme });
}

/**
 * Formats a date for input elements
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDateForInput(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }

  return (
    date.getFullYear().toString() +
    "-" +
    (date.getMonth() + 1).toString().padStart(2, "0") +
    "-" +
    date.getDate().toString().padStart(2, "0") +
    "T" +
    date.getHours().toString().padStart(2, "0") +
    ":" +
    date.getMinutes().toString().padStart(2, "0")
  );
}

/**
 * Generates a unique ID
 * @returns {string} Unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Formats a date for display
 * @param {number|string|Date} timestamp - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return (
      "Today, " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return (
      "Yesterday, " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }

  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(now.getDate() - 7);
  if (date > oneWeekAgo) {
    return (
      date.toLocaleDateString([], { weekday: "long" }) +
      ", " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }

  return (
    date.toLocaleDateString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
    }) +
    ", " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

/**
 * Shows a notification
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {Object} options - Additional options
 */
function showNotification(title, message, options = {}) {
  const notification = document.createElement("div");
  notification.className = "notification";
  notification.innerHTML = `
    <div class="notification-title">${title}</div>
    <div class="notification-message">${message}</div>
  `;

  document.body.appendChild(notification);

  setTimeout(() => notification.classList.add("show"), 10);

  const timeout = options.timeout || 5000;
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, timeout);
}

/**
 * Updates calendar events from all sources (todos, reminders, timed tabs)
 */
function updateCalendarEventsFromAll() {
  let events = [];

  // Add events from todos
  if (typeof todos !== "undefined" && Array.isArray(todos)) {
    const todoEvents = todos
      .map((todo) => ({
        id: todo.id,
        title: todo.text,
        date: new Date(todo.dueDate),
        type: "todo",
        priority: todo.priority || "medium",
      }))
      .filter((event) => !isNaN(event.date));

    events = events.concat(todoEvents);
  }

  // Add events from reminders
  if (typeof reminders !== "undefined" && Array.isArray(reminders)) {
    const reminderEvents = reminders
      .map((reminder) => ({
        id: reminder.id,
        title: reminder.title,
        date: new Date(reminder.time),
        type: "reminder",
      }))
      .filter((event) => !isNaN(event.date));

    events = events.concat(reminderEvents);
  }

  // Add events from timed tabs
  if (typeof timedTabs !== "undefined" && Array.isArray(timedTabs)) {
    const tabEvents = timedTabs
      .map((tab) => ({
        id: tab.id,
        title: tab.title || tab.url,
        date: new Date(tab.scheduledTime),
        type: "timedTab",
      }))
      .filter((event) => !isNaN(event.date));

    events = events.concat(tabEvents);
  }

  // Update the calendar with the events
  if (typeof updateCalendarEvents === "function") {
    updateCalendarEvents(events);
  }
}
