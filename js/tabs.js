/**
 * Timed Tabs module for NewTab+
 * Handles scheduling browser tabs to open at specific times
 */

let timedTabs = [];

/**
 * Initialize timed tabs functionality
 */
function initializeTimedTabs() {
  document.getElementById("add-timed-tab").addEventListener("click", () => {
    openModal("tab-timer-modal");
  });

  document
    .getElementById("tab-timer-form")
    .addEventListener("submit", function (e) {
      e.preventDefault();
      saveTimedTab();
    });

  const openTypeRadios = document.querySelectorAll('input[name="open-type"]');
  openTypeRadios.forEach((radio) => {
    radio.addEventListener("change", function () {
      const openOptions = document.getElementById("open-options");
      openOptions.style.display = this.value === "auto" ? "block" : "none";
    });
  });

  loadTimedTabs();
  setInterval(checkTimedTabs, 60000);
  checkTimedTabs();
}

/**
 * Load timed tabs from storage
 */
function loadTimedTabs() {
  chrome.storage.sync.get("timedTabs", function (data) {
    if (data.timedTabs) {
      timedTabs = data.timedTabs;
      renderTimedTabs();
    }
  });
}

/**
 * Save a new or edited timed tab
 */
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

  try {
    new URL(url);
  } catch (e) {
    alert("Please enter a valid URL");
    return;
  }

  const scheduledTime = new Date(dateTime).getTime();
  if (scheduledTime <= Date.now()) {
    alert("Please select a future date and time");
    return;
  }

  const editMode = form.dataset.mode === "edit";
  const editId = form.dataset.editId;

  if (editMode && editId) {
    const index = timedTabs.findIndex((tab) => tab.id === editId);
    if (index !== -1) {
      timedTabs[index] = {
        ...timedTabs[index],
        url: url,
        title: title,
        scheduledTime: scheduledTime,
        openType: openType,
        openLocation: openType === "auto" ? openLocation : null,
      };
    }
  } else {
    const newTab = {
      id: generateId(),
      url: url,
      title: title,
      scheduledTime: scheduledTime,
      openType: openType,
      openLocation: openType === "auto" ? openLocation : null,
      created: Date.now(),
    };

    timedTabs.push(newTab);
  }

  timedTabs.sort((a, b) => a.scheduledTime - b.scheduledTime);

  chrome.storage.sync.set({ timedTabs: timedTabs }, function () {
    form.reset();
    form.dataset.mode = "add";
    delete form.dataset.editId;

    closeAllModals();
    renderTimedTabs();

    showNotification(
      "Tab Scheduled",
      "The tab has been scheduled successfully",
      {
        timeout: 3000,
      }
    );
  });
}

/**
 * Render timed tabs in the UI
 */
function renderTimedTabs() {
  const container = document.getElementById("timed-tabs-list");
  if (!container) return;

  container.innerHTML = "";

  const now = Date.now();
  const activeTabs = timedTabs.filter((tab) => tab.scheduledTime > now);

  if (activeTabs.length === 0) {
    container.innerHTML =
      '<p class="empty-list">No scheduled tabs. Click the + button to add one.</p>';
    return;
  }

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
        <button class="edit-tab" title="Edit"><i class="fas fa-edit"></i></button>
        <button class="delete-tab" title="Delete"><i class="fas fa-trash"></i></button>
        <button class="open-now" title="Open now"><i class="fas fa-external-link-alt"></i></button>
      </div>
    `;

    tabElement.dataset.id = tab.id;

    tabElement
      .querySelector(".edit-tab")
      .addEventListener("click", () => editTimedTab(tab.id));
    tabElement
      .querySelector(".delete-tab")
      .addEventListener("click", () => deleteTimedTab(tab.id));
    tabElement
      .querySelector(".open-now")
      .addEventListener("click", () => openTimedTabNow(tab.id));

    container.appendChild(tabElement);
  });
}

/**
 * Edit a timed tab
 * @param {string} id - Tab ID to edit
 */
function editTimedTab(id) {
  const tab = timedTabs.find((t) => t.id === id);
  if (!tab) return;

  document.getElementById("tab-url").value = tab.url;
  document.getElementById("tab-title").value = tab.title;
  document.getElementById("tab-date").value = formatDateForInput(
    tab.scheduledTime
  );

  document.getElementById(
    tab.openType === "auto" ? "open-auto" : "open-notify"
  ).checked = true;

  document.getElementById("open-options").style.display =
    tab.openType === "auto" ? "block" : "none";

  if (tab.openLocation) {
    document.getElementById(
      tab.openLocation === "foreground" ? "open-foreground" : "open-background"
    ).checked = true;
  }

  const form = document.getElementById("tab-timer-form");
  form.dataset.mode = "edit";
  form.dataset.editId = id;

  openModal("tab-timer-modal");
}

/**
 * Delete a timed tab
 * @param {string} id - Tab ID to delete
 */
function deleteTimedTab(id) {
  if (confirm("Are you sure you want to delete this scheduled tab?")) {
    timedTabs = timedTabs.filter((tab) => tab.id !== id);

    chrome.storage.sync.set({ timedTabs: timedTabs }, function () {
      renderTimedTabs();

      showNotification("Tab Removed", "The scheduled tab has been removed", {
        timeout: 3000,
      });
    });
  }
}

/**
 * Open a timed tab immediately
 * @param {string} id - Tab ID to open
 */
function openTimedTabNow(id) {
  const tab = timedTabs.find((t) => t.id === id);
  if (!tab) return;

  chrome.tabs.create({ url: tab.url, active: true });

  if (confirm("Tab opened. Remove it from the scheduled list?")) {
    deleteTimedTab(id);
  }
}

/**
 * Check for timed tabs that need to be processed
 */
function checkTimedTabs() {
  const now = Date.now();
  let updated = false;

  timedTabs.forEach((tab) => {
    if (tab.scheduledTime <= now && !tab.processed) {
      tab.processed = true;
      updated = true;

      if (tab.openType === "auto") {
        chrome.tabs.create({
          url: tab.url,
          active: tab.openLocation === "foreground",
        });

        showNotification(
          "Tab Opened",
          `The scheduled tab "${tab.title}" has been opened.`
        );
      } else {
        showNotification(
          "Tab Reminder",
          `Scheduled time for "${tab.title}" has arrived.`,
          {
            timeout: 10000,
          }
        );
      }
    }
  });

  if (updated) {
    timedTabs = timedTabs.filter((tab) => !tab.processed);

    chrome.storage.sync.set({ timedTabs: timedTabs }, function () {
      renderTimedTabs();
    });
  }
}
