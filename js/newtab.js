// Main NewTab+ functionality
document.addEventListener("DOMContentLoaded", function () {
  // Initialize date and time display
  updateDateTime();
  setInterval(updateDateTime, 1000);

  // Initialize modal functionality
  initModals();

  // Initialize theme functionality
  initTheme();

  // Load all modules
  initializeTimedTabs();
  initializeNotes();
  initializeTodos();
  initializeReminders();

  // Setup message listener for popup communication
  setupMessageListener();
});

// Listen for messages from the extension popup
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

    // Handle calendar-related actions
    if (message.action === "openCalendarTab") {
      document
        .getElementById("calendar-card")
        .scrollIntoView({ behavior: "smooth" });
      return true;
    }

    if (message.action === "editTodo" && message.todoId) {
      editTodoFromCalendar(message.todoId);
      return true;
    }

    if (message.action === "editReminder" && message.reminderId) {
      editReminderFromCalendar(message.reminderId);
      return true;
    }
  });
}

// Function to edit a todo from calendar
function editTodoFromCalendar(todoId) {
  chrome.storage.sync.get("todos", function (data) {
    if (data.todos) {
      const todo = data.todos.find((t) => t.id === todoId);
      if (todo) {
        editTodo(todoId); // Call the editTodo function from todos.js
      }
    }
  });
}

// Function to edit a reminder from calendar
function editReminderFromCalendar(reminderId) {
  chrome.storage.sync.get("reminders", function (data) {
    if (data.reminders) {
      const reminder = data.reminders.find((r) => r.id === reminderId);
      if (reminder) {
        editReminder(reminderId); // Call the editReminder function from reminders.js
      }
    }
  });
}

// Update date and time display
function updateDateTime() {
  const now = new Date();

  // Update time
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const seconds = now.getSeconds().toString().padStart(2, "0");
  document.getElementById(
    "current-time"
  ).textContent = `${hours}:${minutes}:${seconds}`;

  // Update date
  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  document.getElementById("current-date").textContent = now.toLocaleDateString(
    undefined,
    options
  );
}

// Modal handling
function initModals() {
  // Modal container
  const modalContainer = document.getElementById("modal-container");
  const modals = document.querySelectorAll(".modal");
  const closeButtons = document.querySelectorAll(".close-modal");

  // Close modal when clicking outside content
  modalContainer.addEventListener("click", function (e) {
    if (e.target === modalContainer) {
      closeAllModals();
    }
  });

  // Close modal when clicking close button
  closeButtons.forEach((button) => {
    button.addEventListener("click", closeAllModals);
  });

  // Close modal on Escape key
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeAllModals();
    }
  });
}

// Open a specific modal
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  const modalContainer = document.getElementById("modal-container");

  // Hide all modals first
  document.querySelectorAll(".modal").forEach((m) => {
    m.classList.remove("active");
  });

  // Show container and specific modal
  modalContainer.classList.remove("hidden");
  modal.classList.add("active");
}

// Close all modals
function closeAllModals() {
  const modalContainer = document.getElementById("modal-container");
  const modals = document.querySelectorAll(".modal");

  modalContainer.classList.add("hidden");
  modals.forEach((modal) => {
    modal.classList.remove("active");
  });
}

// Helper function to format date for display
function formatDate(dateObj) {
  const now = new Date();
  const date = new Date(dateObj);

  // If it's today, just show the time
  if (date.toDateString() === now.toDateString()) {
    return `Today, ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  // If it's tomorrow, show "Tomorrow"
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow, ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  // Otherwise show full date
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Helper function to generate a unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Show a notification
function showNotification(title, message, options = {}) {
  // Check if browser supports notifications
  if (!("Notification" in window)) {
    console.error("This browser does not support notifications");
    return;
  }

  // Check permission
  if (Notification.permission === "granted") {
    createNotification();
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        createNotification();
      }
    });
  }

  function createNotification() {
    const notification = new Notification(title, {
      body: message,
      icon: options.icon || "/images/icon48.png",
      silent: options.silent || false,
    });

    // Handle notification click
    notification.onclick =
      options.onClick ||
      function () {
        window.focus();
        notification.close();
      };

    // Auto close after 10 seconds if not specified
    setTimeout(() => notification.close(), options.timeout || 10000);
  }
}

// Initialize theme functionality
function initTheme() {
  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  const themeSelect = document.getElementById("theme-select");

  // Load saved theme or use system preference
  loadThemePreference();

  // Update icon based on current theme
  updateThemeIcon();

  // Add event listeners for theme switching
  themeToggleBtn.addEventListener("click", function () {
    const currentTheme =
      document.documentElement.getAttribute("data-theme") || "light";
    const newTheme = currentTheme === "dark" ? "light" : "dark";

    setTheme(newTheme);
    themeSelect.value = newTheme;
  });

  themeSelect.addEventListener("change", function () {
    setTheme(this.value);
  });

  // Listen for system preference changes
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      if (themeSelect.value === "system") {
        setTheme("system");
      }
    });
}

// Load saved theme preference or use system default
function loadThemePreference() {
  chrome.storage.sync.get("theme", function (data) {
    const savedTheme = data.theme || "system";
    const themeSelect = document.getElementById("theme-select");
    themeSelect.value = savedTheme;
    setTheme(savedTheme);
  });
}

// Set the theme and save preference
function setTheme(theme) {
  let appliedTheme = theme;

  // If system preference, check what the system is using
  if (theme === "system") {
    appliedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  // Apply theme to HTML element
  document.documentElement.setAttribute("data-theme", appliedTheme);

  // Save preference
  chrome.storage.sync.set({ theme: theme });

  // Update icon
  updateThemeIcon();
}

// Update the theme toggle icon based on current theme
function updateThemeIcon() {
  const themeIcon = document.querySelector("#theme-toggle-btn i");
  const currentTheme = document.documentElement.getAttribute("data-theme");

  if (currentTheme === "dark") {
    themeIcon.classList.remove("fa-moon");
    themeIcon.classList.add("fa-sun");
  } else {
    themeIcon.classList.remove("fa-sun");
    themeIcon.classList.add("fa-moon");
  }
}
