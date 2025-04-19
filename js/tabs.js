// Timed Tabs functionality
let timedTabs = [];

function initializeTimedTabs() {
  // Add event listeners
  document.getElementById("add-timed-tab").addEventListener("click", () => {
    openModal("tab-timer-modal");
  });

  // Form submission handling
  document
    .getElementById("tab-timer-form")
    .addEventListener("submit", function (e) {
      e.preventDefault();
      saveTimedTab();
    });

  // Toggle open options visibility based on open type
  const openTypeRadios = document.querySelectorAll('input[name="open-type"]');
  openTypeRadios.forEach((radio) => {
    radio.addEventListener("change", function () {
      const openOptions = document.getElementById("open-options");
      openOptions.style.display = this.value === "auto" ? "block" : "none";
    });
  });

  // Load saved timed tabs
  loadTimedTabs();

  // Check for tabs that need to be processed every minute
  setInterval(checkTimedTabs, 60000); // Check every minute
  checkTimedTabs(); // Also check on page load
}

// Load timed tabs from storage
function loadTimedTabs() {
  chrome.storage.sync.get("timedTabs", function (data) {
    if (data.timedTabs) {
      timedTabs = data.timedTabs;
      renderTimedTabs();
    }
  });
}

// Save a new timed tab
function saveTimedTab() {
  const form = document.getElementById("tab-timer-form");
  const url = document.getElementById("tab-url").value;
  const title = document.getElementById("tab-title").value;
  const dateTime = document.getElementById("tab-date").value;
  const openType = document.querySelector(
    'input[name="open-type"]:checked'
  ).value;
  const openLocation =
    document.querySelector('input[name="open-location"]:checked')?.value ||
    "foreground";

  // Validate URL
  try {
    new URL(url);
  } catch (e) {
    alert("Please enter a valid URL");
    return;
  }

  // Validate date (must be in the future)
  const scheduledTime = new Date(dateTime).getTime();
  if (scheduledTime <= Date.now()) {
    alert("Please select a future date and time");
    return;
  }

  // Create new timed tab object
  const newTab = {
    id: generateId(),
    url: url,
    title: title,
    scheduledTime: scheduledTime,
    openType: openType, // 'auto' or 'notify'
    openLocation: openType === "auto" ? openLocation : null, // 'foreground' or 'background'
    created: Date.now(),
  };

  // Add to array
  timedTabs.push(newTab);

  // Sort by scheduled time
  timedTabs.sort((a, b) => a.scheduledTime - b.scheduledTime);

  // Save to Chrome storage
  chrome.storage.sync.set({ timedTabs: timedTabs }, function () {
    // Reset form
    form.reset();
    // Close modal
    closeAllModals();
    // Render updated list
    renderTimedTabs();
  });
}

// Render timed tabs in the UI
function renderTimedTabs() {
  const container = document.getElementById("timed-tabs-list");
  container.innerHTML = "";

  // Filter out past tabs
  const now = Date.now();
  const activeTabs = timedTabs.filter((tab) => tab.scheduledTime > now);

  if (activeTabs.length === 0) {
    container.innerHTML =
      '<p class="empty-list">No scheduled tabs. Click the + button to add one.</p>';
    return;
  }

  // Create tab elements
  activeTabs.forEach((tab) => {
    const tabElement = document.createElement("div");
    tabElement.className = "timed-tab-item";
    tabElement.innerHTML = `
      <div class="tab-info">
        <div class="tab-title">${tab.title}</div>
        <div class="tab-url">${tab.url}</div>
        <div class="tab-time">⏰ ${formatDate(tab.scheduledTime)} (${
      tab.openType === "auto" ? "Auto-open" : "Notify only"
    })</div>
      </div>
      <div class="tab-actions">
        <button class="edit-tab" data-id="${
          tab.id
        }" title="Edit"><i class="fas fa-edit"></i></button>
        <button class="delete-tab" data-id="${
          tab.id
        }" title="Delete"><i class="fas fa-trash"></i></button>
        <button class="open-now" data-id="${
          tab.id
        }" title="Open now"><i class="fas fa-external-link-alt"></i></button>
      </div>
    `;

    // Add event listeners
    tabElement
      .querySelector(".edit-tab")
      .addEventListener("click", () => editTimedTab(tab.id));
    tabElement
      .querySelector(".delete-tab")
      .addEventListener("click", () => deleteTimedTab(tab.id));
    tabElement
      .querySelector(".open-now")
      .addEventListener("click", () => openTimedTabNow(tab.id));

    // Append to container
    container.appendChild(tabElement);
  });
}

// Edit a timed tab
function editTimedTab(id) {
  const tab = timedTabs.find((t) => t.id === id);
  if (!tab) return;

  // Populate form
  document.getElementById("tab-url").value = tab.url;
  document.getElementById("tab-title").value = tab.title;

  // Format date for datetime-local input
  const date = new Date(tab.scheduledTime);
  const formattedDate = date.toISOString().slice(0, 16); // Format: YYYY-MM-DDThh:mm
  document.getElementById("tab-date").value = formattedDate;

  // Set open type
  document.getElementById(
    tab.openType === "auto" ? "open-auto" : "open-notify"
  ).checked = true;

  // Show/hide open options
  document.getElementById("open-options").style.display =
    tab.openType === "auto" ? "block" : "none";

  // Set open location if applicable
  if (tab.openLocation) {
    document.getElementById(
      tab.openLocation === "foreground" ? "open-foreground" : "open-background"
    ).checked = true;
  }

  // Set form to edit mode
  const form = document.getElementById("tab-timer-form");
  form.dataset.mode = "edit";
  form.dataset.editId = id;

  // Override form submit
  form.onsubmit = function (e) {
    e.preventDefault();

    // Update tab
    const index = timedTabs.findIndex((t) => t.id === id);
    if (index !== -1) {
      const openType = document.querySelector(
        'input[name="open-type"]:checked'
      ).value;
      const openLocation =
        document.querySelector('input[name="open-location"]:checked')?.value ||
        "foreground";

      timedTabs[index] = {
        ...timedTabs[index],
        url: document.getElementById("tab-url").value,
        title: document.getElementById("tab-title").value,
        scheduledTime: new Date(
          document.getElementById("tab-date").value
        ).getTime(),
        openType: openType,
        openLocation: openType === "auto" ? openLocation : null,
      };

      // Save to storage
      chrome.storage.sync.set({ timedTabs: timedTabs }, function () {
        // Reset form and handlers
        form.reset();
        form.onsubmit = function (e) {
          e.preventDefault();
          saveTimedTab();
        };

        // Close modal
        closeAllModals();

        // Render updated list
        renderTimedTabs();
      });
    }
  };

  // Open modal
  openModal("tab-timer-modal");
}

// Delete a timed tab
function deleteTimedTab(id) {
  if (confirm("Are you sure you want to delete this scheduled tab?")) {
    timedTabs = timedTabs.filter((tab) => tab.id !== id);

    // Save to storage
    chrome.storage.sync.set({ timedTabs: timedTabs }, function () {
      renderTimedTabs();
    });
  }
}

// Open a timed tab immediately
function openTimedTabNow(id) {
  const tab = timedTabs.find((t) => t.id === id);
  if (!tab) return;

  // Open the tab
  chrome.tabs.create({ url: tab.url, active: true });

  // Ask if user wants to remove this timed tab
  if (confirm("Tab opened. Remove it from the scheduled list?")) {
    deleteTimedTab(id);
  }
}

// Check for timed tabs that need to be processed
function checkTimedTabs() {
  const now = Date.now();
  let updated = false;

  timedTabs.forEach((tab) => {
    // If the scheduled time has passed and it hasn't been processed yet
    if (tab.scheduledTime <= now && !tab.processed) {
      // Mark as processed
      tab.processed = true;
      updated = true;

      // Handle according to open type
      if (tab.openType === "auto") {
        // Open the tab automatically
        chrome.tabs.create({
          url: tab.url,
          active: tab.openLocation === "foreground",
        });

        // Show a notification
        showNotification(
          "Tab Opened",
          `The scheduled tab "${tab.title}" has been opened.`
        );
      } else {
        // Show notification with action
        showNotification(
          "Tab Reminder",
          `Scheduled time for "${tab.title}" has arrived.`,
          {
            onClick: function () {
              chrome.tabs.create({ url: tab.url, active: true });
              window.focus();
              this.close();
            },
          }
        );
      }
    }
  });

  // If any tabs were processed, update the storage
  if (updated) {
    // Remove processed tabs
    timedTabs = timedTabs.filter((tab) => !tab.processed);

    // Save to storage
    chrome.storage.sync.set({ timedTabs: timedTabs }, function () {
      renderTimedTabs();
    });
  }
}
