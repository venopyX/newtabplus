// Main NewTab+ functionality
document.addEventListener("DOMContentLoaded", function () {
  // Initialize date and time display
  updateDateTime();
  setInterval(updateDateTime, 1000);

  // Initialize modal functionality
  initModals();

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
