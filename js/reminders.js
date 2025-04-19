// Reminders functionality
let reminders = [];

function initializeReminders() {
  // Add event listeners
  document.getElementById("add-reminder").addEventListener("click", () => {
    openModal("reminder-modal");
  });

  // Form submission handling
  document
    .getElementById("reminder-form")
    .addEventListener("submit", function (e) {
      e.preventDefault();
      saveReminder();
    });

  // Show/hide URL input based on action type
  document
    .getElementById("reminder-action")
    .addEventListener("change", function () {
      const urlContainer = document.getElementById(
        "reminder-tab-url-container"
      );
      urlContainer.style.display = this.value === "open-tab" ? "block" : "none";
    });

  // Load saved reminders
  loadReminders();

  // Check for reminders that need to be triggered
  setInterval(checkReminders, 30000); // Check every 30 seconds
  checkReminders(); // Also check on page load
}

// Load reminders from storage
function loadReminders() {
  chrome.storage.sync.get("reminders", function (data) {
    if (data.reminders) {
      reminders = data.reminders;
      renderReminders();
    }
  });
}

// Save a new or edited reminder
function saveReminder() {
  const form = document.getElementById("reminder-form");
  const title = document.getElementById("reminder-title").value;
  const message = document.getElementById("reminder-message").value;
  const timeInput = document.getElementById("reminder-time").value;
  const recurring = document.getElementById("reminder-recurring").value;
  const action = document.getElementById("reminder-action").value;
  let tabUrl = "";

  if (action === "open-tab") {
    tabUrl = document.getElementById("reminder-tab-url").value;

    // Validate URL
    try {
      new URL(tabUrl);
    } catch (e) {
      alert("Please enter a valid URL");
      return;
    }
  }

  // Validate time (must be in the future)
  const scheduledTime = new Date(timeInput).getTime();
  if (scheduledTime <= Date.now() && recurring === "none") {
    alert("Please select a future date and time");
    return;
  }

  // Check if editing or creating new
  const editMode = form.dataset.mode === "edit";
  const editId = form.dataset.editId;

  if (editMode && editId) {
    // Update existing reminder
    const index = reminders.findIndex((reminder) => reminder.id === editId);
    if (index !== -1) {
      reminders[index] = {
        ...reminders[index],
        title,
        message,
        scheduledTime,
        recurring,
        action,
        tabUrl: action === "open-tab" ? tabUrl : "",
        updated: Date.now(),
      };
    }
  } else {
    // Create new reminder
    const newReminder = {
      id: generateId(),
      title,
      message,
      scheduledTime,
      recurring,
      action,
      tabUrl: action === "open-tab" ? tabUrl : "",
      created: Date.now(),
      updated: Date.now(),
    };

    reminders.push(newReminder);
  }

  // Save to storage
  chrome.storage.sync.set({ reminders: reminders }, function () {
    // Reset form and handlers
    form.reset();
    form.dataset.mode = "add";
    delete form.dataset.editId;
    document.getElementById("reminder-tab-url-container").style.display =
      "none";

    // Close modal
    closeAllModals();

    // Render updated list
    renderReminders();
  });
}

// Render reminders in the UI
function renderReminders() {
  const container = document.getElementById("reminders-list");
  container.innerHTML = "";

  // Filter out past non-recurring reminders that have been triggered
  const now = Date.now();
  const activeReminders = reminders.filter(
    (reminder) =>
      reminder.recurring !== "none" ||
      reminder.scheduledTime > now ||
      !reminder.triggered
  );

  // Sort by scheduled time
  activeReminders.sort((a, b) => a.scheduledTime - b.scheduledTime);

  if (activeReminders.length === 0) {
    container.innerHTML =
      '<p class="empty-list">No reminders. Click the + button to add one.</p>';
    return;
  }

  // Create reminder elements
  activeReminders.forEach((reminder) => {
    const reminderElement = document.createElement("div");
    reminderElement.className = "reminder-item";
    reminderElement.dataset.id = reminder.id;

    // Action description
    let actionDescription = "";
    if (reminder.action === "open-tab") {
      actionDescription = `Open: <span class="reminder-url">${reminder.tabUrl}</span>`;
    } else {
      actionDescription = "Show notification";
    }

    reminderElement.innerHTML = `
      <div class="reminder-header">
        <div class="reminder-title">${reminder.title}</div>
        <div class="reminder-time">⏰ ${formatDate(reminder.scheduledTime)}
          ${
            reminder.recurring !== "none"
              ? `<span class="reminder-recurring">${reminder.recurring}</span>`
              : ""
          }
        </div>
      </div>
      <div class="reminder-message">${reminder.message}</div>
      <div class="reminder-action">${actionDescription}</div>
      <div class="todo-actions">
        <button class="edit-reminder" data-id="${
          reminder.id
        }" title="Edit"><i class="fas fa-edit"></i></button>
        <button class="delete-reminder" data-id="${
          reminder.id
        }" title="Delete"><i class="fas fa-trash"></i></button>
      </div>
    `;

    // Add event listeners
    reminderElement
      .querySelector(".edit-reminder")
      .addEventListener("click", () => editReminder(reminder.id));
    reminderElement
      .querySelector(".delete-reminder")
      .addEventListener("click", () => deleteReminder(reminder.id));

    // Append to container
    container.appendChild(reminderElement);
  });
}

// Edit a reminder
function editReminder(id) {
  const reminder = reminders.find((r) => r.id === id);
  if (!reminder) return;

  // Populate form
  document.getElementById("reminder-title").value = reminder.title;
  document.getElementById("reminder-message").value = reminder.message;

  // Format date for datetime-local input
  const date = new Date(reminder.scheduledTime);
  const formattedDate = date.toISOString().slice(0, 16); // Format: YYYY-MM-DDThh:mm
  document.getElementById("reminder-time").value = formattedDate;

  document.getElementById("reminder-recurring").value = reminder.recurring;
  document.getElementById("reminder-action").value = reminder.action;

  // Show/hide URL input
  const urlContainer = document.getElementById("reminder-tab-url-container");
  urlContainer.style.display =
    reminder.action === "open-tab" ? "block" : "none";
  document.getElementById("reminder-tab-url").value = reminder.tabUrl || "";

  // Set form to edit mode
  const form = document.getElementById("reminder-form");
  form.dataset.mode = "edit";
  form.dataset.editId = id;

  // Open modal
  openModal("reminder-modal");
}

// Delete a reminder
function deleteReminder(id) {
  if (confirm("Are you sure you want to delete this reminder?")) {
    reminders = reminders.filter((reminder) => reminder.id !== id);

    // Save to storage
    chrome.storage.sync.set({ reminders: reminders }, function () {
      renderReminders();
    });
  }
}

// Check for reminders that need to be triggered
function checkReminders() {
  const now = Date.now();
  let updated = false;

  reminders.forEach((reminder) => {
    // If the scheduled time has passed and it hasn't been triggered yet
    if (reminder.scheduledTime <= now && !reminder.triggered) {
      // Mark as triggered
      reminder.triggered = true;
      updated = true;

      // Handle according to action type
      if (reminder.action === "open-tab" && reminder.tabUrl) {
        // Open the tab
        chrome.tabs.create({
          url: reminder.tabUrl,
          active: true,
        });
      }

      // Show notification for all reminders
      showNotification(reminder.title, reminder.message, {
        onClick: function () {
          if (reminder.action === "open-tab" && reminder.tabUrl) {
            chrome.tabs.create({ url: reminder.tabUrl, active: true });
          }
          window.focus();
          this.close();
        },
      });

      // If recurring, schedule the next occurrence
      if (reminder.recurring !== "none") {
        // Calculate next occurrence
        const nextScheduledTime = calculateNextReminderTime(
          reminder.scheduledTime,
          reminder.recurring
        );

        if (nextScheduledTime) {
          // Create new recurring instance
          const newReminder = {
            ...reminder,
            id: generateId(),
            scheduledTime: nextScheduledTime,
            triggered: false,
            created: now,
            updated: now,
          };

          reminders.push(newReminder);
        }
      }
    }
  });

  // If any reminders were triggered, update the storage
  if (updated) {
    // Remove non-recurring triggered reminders
    reminders = reminders.filter(
      (reminder) => reminder.recurring !== "none" || !reminder.triggered
    );

    // Save to storage
    chrome.storage.sync.set({ reminders: reminders }, function () {
      renderReminders();
    });
  }
}

// Calculate next occurrence time based on recurrence pattern
function calculateNextReminderTime(currentTime, recurring) {
  const date = new Date(currentTime);

  switch (recurring) {
    case "daily":
      date.setDate(date.getDate() + 1);
      break;
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    default:
      return null;
  }

  return date.getTime();
}
