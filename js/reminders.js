/**
 * Reminders module for NewTab+
 * Handles reminders creation, notification management and scheduling
 */

let reminders = [];

/**
 * Initialize reminders functionality
 */
function initializeReminders() {
  document.getElementById("add-reminder").addEventListener("click", () => {
    openModal("reminder-modal");
  });

  document
    .getElementById("reminder-form")
    .addEventListener("submit", function (e) {
      e.preventDefault();
      saveReminder();
    });

  document
    .getElementById("reminder-action")
    .addEventListener("change", function () {
      const urlContainer = document.getElementById(
        "reminder-tab-url-container"
      );
      urlContainer.style.display = this.value === "open-tab" ? "block" : "none";
    });

  loadReminders();
  setInterval(checkReminders, 60000);
  checkReminders();
}

/**
 * Load reminders from storage
 */
function loadReminders() {
  chrome.storage.sync.get("reminders", function (data) {
    if (data.reminders) {
      reminders = data.reminders;
      renderReminders();
    }
  });
}

/**
 * Save a new or edited reminder
 */
function saveReminder() {
  const form = document.getElementById("reminder-form");
  const title = document.getElementById("reminder-title").value;
  const message = document.getElementById("reminder-message").value;
  const timeInput = document.getElementById("reminder-time").value;
  const recurring = document.getElementById("reminder-recurring").value;
  const action = document.getElementById("reminder-action").value;
  const url =
    action === "open-tab"
      ? document.getElementById("reminder-tab-url").value
      : null;

  if (action === "open-tab" && url) {
    try {
      new URL(url);
    } catch (e) {
      alert("Please enter a valid URL");
      return;
    }
  }

  const time = new Date(timeInput).getTime();
  if (time <= Date.now()) {
    alert("Please select a future date and time");
    return;
  }

  const editMode = form.dataset.mode === "edit";
  const editId = form.dataset.editId;

  if (editMode && editId) {
    const index = reminders.findIndex((reminder) => reminder.id === editId);
    if (index !== -1) {
      reminders[index] = {
        ...reminders[index],
        title,
        message,
        time,
        recurring: recurring !== "none" ? recurring : null,
        action,
        url: action === "open-tab" ? url : null,
        updated: Date.now(),
      };
    }
  } else {
    const newReminder = {
      id: generateId(),
      title,
      message,
      time,
      recurring: recurring !== "none" ? recurring : null,
      action,
      url: action === "open-tab" ? url : null,
      created: Date.now(),
      updated: Date.now(),
    };

    reminders.push(newReminder);
  }

  reminders.sort((a, b) => a.time - b.time);

  chrome.storage.sync.set({ reminders: reminders }, function () {
    form.reset();
    form.dataset.mode = "add";
    delete form.dataset.editId;

    closeAllModals();
    renderReminders();
    updateCalendarWithReminders();

    showNotification("Reminder Saved", "Your reminder has been scheduled", {
      timeout: 3000,
    });
  });
}

/**
 * Render reminders in the UI
 */
function renderReminders() {
  const container = document.getElementById("reminders-list");
  if (!container) return;

  container.innerHTML = "";

  const now = Date.now();
  const activeReminders = reminders.filter(
    (reminder) => !reminder.triggered || reminder.recurring
  );

  if (activeReminders.length === 0) {
    container.innerHTML =
      '<p class="empty-list">No reminders. Click the + button to add one.</p>';
    return;
  }

  activeReminders.forEach((reminder) => {
    const reminderElement = document.createElement("div");
    reminderElement.className = "reminder-item";
    if (reminder.triggered) reminderElement.classList.add("triggered");

    reminderElement.dataset.id = reminder.id;

    const recurringText = reminder.recurring
      ? `<span class="reminder-recurring">${getRecurringText(
          reminder.recurring
        )}</span>`
      : "";

    reminderElement.innerHTML = `
      <div class="reminder-content">
        <div class="reminder-title">${reminder.title}</div>
        <div class="reminder-message">${reminder.message}</div>
        <div class="reminder-info">
          <span class="reminder-time">⏰ ${formatDate(reminder.time)}</span>
          ${recurringText}
          <span class="reminder-action">${
            reminder.action === "notification"
              ? "Notification"
              : `Open Tab: ${reminder.url}`
          }</span>
        </div>
      </div>
      <div class="reminder-actions">
        <button class="edit-reminder" title="Edit"><i class="fas fa-edit"></i></button>
        <button class="delete-reminder" title="Delete"><i class="fas fa-trash"></i></button>
      </div>
    `;

    reminderElement
      .querySelector(".edit-reminder")
      .addEventListener("click", () => {
        editReminder(reminder.id);
      });

    reminderElement
      .querySelector(".delete-reminder")
      .addEventListener("click", () => {
        deleteReminder(reminder.id);
      });

    container.appendChild(reminderElement);
  });
}

/**
 * Edit a reminder
 * @param {string} id - Reminder ID to edit
 */
function editReminder(id) {
  const reminder = reminders.find((r) => r.id === id);
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
  form.dataset.editId = id;

  openModal("reminder-modal");
}

/**
 * Delete a reminder
 * @param {string} id - Reminder ID to delete
 */
function deleteReminder(id) {
  if (!confirm("Are you sure you want to delete this reminder?")) {
    return;
  }

  reminders = reminders.filter((reminder) => reminder.id !== id);

  chrome.storage.sync.set({ reminders: reminders }, function () {
    renderReminders();
    updateCalendarWithReminders();

    showNotification("Reminder Deleted", "The reminder has been removed", {
      timeout: 3000,
    });
  });
}

/**
 * Check for reminders that need to be triggered
 */
function checkReminders() {
  const now = Date.now();
  let updated = false;

  reminders.forEach((reminder) => {
    if (reminder.time <= now && (!reminder.triggered || reminder.recurring)) {
      triggerReminder(reminder);

      if (reminder.recurring) {
        const nextTime = calculateNextOccurrence(
          new Date(reminder.time),
          reminder.recurring
        );

        if (nextTime) {
          reminder.time = nextTime.getTime();
          reminder.triggered = false;
          updated = true;
        }
      } else {
        reminder.triggered = true;
        updated = true;
      }
    }
  });

  if (updated) {
    chrome.storage.sync.set({ reminders: reminders }, function () {
      renderReminders();
      updateCalendarWithReminders();
    });
  }
}

/**
 * Trigger a reminder action (notification or open tab)
 * @param {Object} reminder - Reminder object to trigger
 */
function triggerReminder(reminder) {
  if (reminder.action === "open-tab" && reminder.url) {
    chrome.tabs.create({ url: reminder.url, active: true });
  }

  chrome.notifications.create({
    type: "basic",
    iconUrl: "../images/icon128.png",
    title: reminder.title,
    message: reminder.message,
    priority: 2,
  });
}

/**
 * Calculate the next occurrence of a recurring reminder
 * @param {Date} currentTime - Current scheduled time
 * @param {string} recurrence - Recurrence pattern
 * @returns {Date} Next scheduled time
 */
function calculateNextOccurrence(currentTime, recurrence) {
  const nextTime = new Date(currentTime);

  switch (recurrence) {
    case "daily":
      nextTime.setDate(nextTime.getDate() + 1);
      break;
    case "weekdays":
      let addDays = 1;
      if (nextTime.getDay() === 5) addDays = 3;
      if (nextTime.getDay() === 6) addDays = 2;
      nextTime.setDate(nextTime.getDate() + addDays);
      break;
    case "weekly":
      nextTime.setDate(nextTime.getDate() + 7);
      break;
    case "biweekly":
      nextTime.setDate(nextTime.getDate() + 14);
      break;
    case "monthly":
      nextTime.setMonth(nextTime.getMonth() + 1);
      break;
    case "quarterly":
      nextTime.setMonth(nextTime.getMonth() + 3);
      break;
    case "yearly":
      nextTime.setFullYear(nextTime.getFullYear() + 1);
      break;
    default:
      return null;
  }

  return nextTime;
}

/**
 * Update calendar with reminder dates
 */
function updateCalendarWithReminders() {
  const reminderDates = reminders
    .filter((reminder) => !reminder.triggered)
    .map((reminder) => ({
      id: reminder.id,
      date: new Date(reminder.time),
      title: reminder.title,
      type: "reminder",
    }));

  if (typeof updateCalendarEvents === "function") {
    updateCalendarEvents(reminderDates);
  }
}
