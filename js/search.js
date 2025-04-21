/**
 * Search functionality for NewTab+
 * Handles search engines management and search execution
 */

// Default search engines
const defaultSearchEngines = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    placeholder: "Search ChatGPT...",
    url: "https://chatgpt.com/search?q=%s",
    icon: "https://chatgpt.com/favicon.ico",
  },
  {
    id: "google",
    name: "Google",
    placeholder: "Search Google...",
    url: "https://www.google.com/search?q=%s",
    icon: "https://www.google.com/favicon.ico",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    placeholder: "Search Perplexity AI...",
    url: "https://www.perplexity.ai/search?q=%s",
    icon: "https://www.perplexity.ai/favicon.ico",
  },
  {
    id: "bing",
    name: "Bing",
    placeholder: "Search Bing...",
    url: "https://www.bing.com/search?q=%s",
    icon: "https://www.bing.com/favicon.ico",
  },
  {
    id: "duckduckgo",
    name: "DuckDuckGo",
    placeholder: "Search DuckDuckGo...",
    url: "https://duckduckgo.com/?q=%s",
    icon: "https://duckduckgo.com/favicon.ico",
  },
  {
    id: "grep",
    name: "Grep",
    placeholder: "Search code with Grep...",
    url: "https://grep.app/search?q=%s",
    icon: "https://grep.app/favicon.ico",
  },
  {
    id: "yandex",
    name: "Yandex",
    placeholder: "Search Yandex...",
    url: "https://yandex.com/search/?text=%s",
    icon: "https://yandex.com/favicon.ico",
  },
  {
    id: "qwantjunior",
    name: "Qwant Junior",
    placeholder: "Search Qwant Junior...",
    url: "https://www.qwantjunior.com/?q=%s&t=web",
    icon: "https://www.qwantjunior.com/favicon.ico",
  },
  {
    id: "ecosia",
    name: "Ecosia",
    placeholder: "Search Ecosia...",
    url: "https://www.ecosia.org/search?q=%s",
    icon: "https://www.ecosia.org/favicon.ico",
  },
  {
    id: "qwant",
    name: "Qwant",
    placeholder: "Search Qwant...",
    url: "https://www.qwant.com/?q=%s",
    icon: "https://www.qwant.com/favicon.ico",
  },
  {
    id: "wolframalpha",
    name: "Wolfram Alpha",
    placeholder: "Calculate with Wolfram Alpha...",
    url: "http://www.wolframalpha.com/input/?i=%s",
    icon: "http://www.wolframalpha.com/favicon.ico",
  },
  {
    id: "github",
    name: "GitHub",
    placeholder: "Search GitHub repositories...",
    url: "https://github.com/search?q=%s",
    icon: "https://github.com/favicon.ico",
  },
  {
    id: "stackoverflow",
    name: "Stack Overflow",
    placeholder: "Search Stack Overflow...",
    url: "https://stackoverflow.com/search?q=%s",
    icon: "https://stackoverflow.com/favicon.ico",
  },
];

// Global variables
let searchEngines = [];
let currentEngine = null;

/**
 * Initialize the search functionality
 */
function initializeSearch() {
  loadSearchEngines();
  setupEventListeners();
}

/**
 * Load search engines from storage
 */
function loadSearchEngines() {
  // Try to get user saved engines from storage
  chrome.storage.local.get(["searchEngines", "currentEngine"], (result) => {
    if (result.searchEngines && Array.isArray(result.searchEngines)) {
      searchEngines = result.searchEngines;
    } else {
      // Use defaults if no saved engines
      searchEngines = [...defaultSearchEngines];
      saveSearchEngines();
    }

    // Set current engine
    if (
      result.currentEngine &&
      searchEngines.some((engine) => engine.id === result.currentEngine)
    ) {
      currentEngine = result.currentEngine;
    } else {
      // Default to first engine
      currentEngine = searchEngines[0]?.id;
      saveCurrentEngine();
    }

    renderSearchEngines();
    setCurrentEngine();
  });
}

/**
 * Save search engines to storage
 */
function saveSearchEngines() {
  chrome.storage.local.set({ searchEngines });
}

/**
 * Save current engine to storage
 */
function saveCurrentEngine() {
  chrome.storage.local.set({ currentEngine });
}

/**
 * Render search engines in the dropdown
 */
function renderSearchEngines() {
  const dropdown = document.getElementById("search-engine-dropdown");
  if (!dropdown) return;

  // Clear previous items
  dropdown.innerHTML = "";

  // Add search engines items
  searchEngines.forEach((engine) => {
    const item = document.createElement("div");
    item.className = `search-engine-item ${
      engine.id === currentEngine ? "active" : ""
    }`;
    item.dataset.id = engine.id;
    item.innerHTML = `
      <img src="${engine.icon}" alt="${
      engine.name
    }" onerror="this.src='../images/icon16.png';" />
      <span class="engine-name">${engine.name}</span>
      <div class="engine-actions">
        <button class="edit-engine" title="Edit" data-id="${engine.id}">
          <i class="fas fa-pencil-alt"></i>
        </button>
        <button class="delete-engine" title="Delete" data-id="${engine.id}" ${
      searchEngines.length <= 1 ? "disabled" : ""
    }>
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    `;
    dropdown.appendChild(item);
  });

  // Add "Add New Engine" button
  const addButton = document.createElement("div");
  addButton.className = "add-engine-btn";
  addButton.innerHTML = `<i class="fas fa-plus"></i> Add New Search Engine`;
  dropdown.appendChild(addButton);

  // Attach event listeners to dropdown items
  attachDropdownEventListeners();
}

/**
 * Set the current search engine
 */
function setCurrentEngine() {
  const searchInput = document.getElementById("search-input");
  const iconElement = document.getElementById("search-engine-icon");

  // Find the current engine object
  const engine =
    searchEngines.find((e) => e.id === currentEngine) || searchEngines[0];

  if (engine) {
    // Set input placeholder
    if (searchInput) {
      searchInput.placeholder = engine.placeholder;
    }

    // Set icon
    if (iconElement) {
      iconElement.src = engine.icon;
      iconElement.alt = engine.name;

      // Set fallback for icon load errors
      iconElement.onerror = () => {
        iconElement.src = "../images/icon16.png";
      };
    }
  }
}

/**
 * Set up all event listeners for search functionality
 */
function setupEventListeners() {
  // Search engine dropdown toggle
  const searchEngineBtn = document.getElementById("search-engine-button");
  const searchEngineDropdown = document.getElementById(
    "search-engine-dropdown"
  );

  if (searchEngineBtn && searchEngineDropdown) {
    searchEngineBtn.addEventListener("click", (e) => {
      e.preventDefault();
      searchEngineDropdown.classList.toggle("hidden");
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (
      searchEngineDropdown &&
      !searchEngineDropdown.contains(e.target) &&
      e.target.id !== "search-engine-button" &&
      !searchEngineBtn?.contains(e.target)
    ) {
      searchEngineDropdown.classList.add("hidden");
    }
  });

  // Search form submission
  const searchForm = document.getElementById("search-form");
  if (searchForm) {
    searchForm.addEventListener("submit", handleSearch);
  }

  // Set up modal event listeners
  setupModalListeners();
}

/**
 * Handle search form submission
 * @param {Event} e - Submit event
 */
function handleSearch(e) {
  e.preventDefault();

  const searchInput = document.getElementById("search-input");
  if (!searchInput || !searchInput.value.trim()) return;

  const engine =
    searchEngines.find((e) => e.id === currentEngine) || searchEngines[0];
  if (!engine) return;

  // Create search URL by replacing %s with the query
  const query = encodeURIComponent(searchInput.value.trim());
  const searchUrl = engine.url.replace("%s", query);

  // Open in new tab
  chrome.tabs.create({ url: searchUrl });

  // Clear input
  searchInput.value = "";
}

/**
 * Attach event listeners to dropdown items
 */
function attachDropdownEventListeners() {
  // Select search engine
  const engineItems = document.querySelectorAll(".search-engine-item");
  engineItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      // Don't select if clicking on action buttons
      if (
        e.target.closest(".engine-actions") ||
        e.target.closest(".edit-engine") ||
        e.target.closest(".delete-engine")
      ) {
        return;
      }

      currentEngine = item.dataset.id;
      saveCurrentEngine();
      setCurrentEngine();

      // Mark item as active and hide dropdown
      document.querySelectorAll(".search-engine-item").forEach((i) => {
        i.classList.remove("active");
      });
      item.classList.add("active");
      document.getElementById("search-engine-dropdown").classList.add("hidden");
    });
  });

  // Edit engine
  const editButtons = document.querySelectorAll(".edit-engine");
  editButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const engineId = button.dataset.id;
      openEditEngineModal(engineId);
    });
  });

  // Delete engine
  const deleteButtons = document.querySelectorAll(".delete-engine");
  deleteButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const engineId = button.dataset.id;
      deleteSearchEngine(engineId);
    });
  });

  // Add new engine
  const addButton = document.querySelector(".add-engine-btn");
  if (addButton) {
    addButton.addEventListener("click", () => {
      openAddEngineModal();
    });
  }
}

/**
 * Delete a search engine
 * @param {string} engineId - Engine ID to delete
 */
function deleteSearchEngine(engineId) {
  // Prevent deleting the last engine
  if (searchEngines.length <= 1) return;

  // Ask for confirmation
  if (!confirm("Are you sure you want to delete this search engine?")) return;

  // Remove the engine
  searchEngines = searchEngines.filter((engine) => engine.id !== engineId);
  saveSearchEngines();

  // If current engine was deleted, set a new one
  if (currentEngine === engineId) {
    currentEngine = searchEngines[0]?.id;
    saveCurrentEngine();
  }

  // Re-render engines and set current
  renderSearchEngines();
  setCurrentEngine();
}

/**
 * Open modal to add a new search engine
 */
function openAddEngineModal() {
  const modal = document.getElementById("search-engine-modal");
  if (!modal) {
    console.error("Search engine modal not found");
    return;
  }

  // Find the modal's overlay container (this is how modals are structured in this app)
  const modalOverlay =
    document.getElementById("search-engine-modal-overlay") ||
    modal.closest(".modal-overlay");

  const form = document.getElementById("search-engine-form");
  const titleElement = document.getElementById("search-engine-modal-title");
  const actionInput = document.getElementById("engine-action");

  // Reset form and set title for add mode
  if (form) form.reset();
  if (titleElement) titleElement.textContent = "Add Search Engine";
  if (actionInput) actionInput.value = "add";

  // Clear ID field for new engine
  const idInput = document.getElementById("engine-id");
  if (idInput) idInput.value = "";

  // Reset preview
  const preview = document.getElementById("icon-preview");
  if (preview) preview.src = "";

  // Show modal using the application's standard approach
  if (modalOverlay) {
    modalOverlay.classList.add("active");
    document.getElementById("modal-container").classList.remove("hidden");
  }
}

/**
 * Open modal to edit an existing search engine
 * @param {string} engineId - Engine ID to edit
 */
function openEditEngineModal(engineId) {
  const engine = searchEngines.find((e) => e.id === engineId);
  if (!engine) return;

  const modal = document.getElementById("search-engine-modal");
  // Find the modal's overlay container
  const modalOverlay =
    document.getElementById("search-engine-modal-overlay") ||
    modal.closest(".modal-overlay");

  const form = document.getElementById("search-engine-form");
  const titleElement = document.getElementById("search-engine-modal-title");
  const actionInput = document.getElementById("engine-action");

  if (!modal || !form) return;

  // Reset form and set title for edit mode
  form.reset();
  if (titleElement) titleElement.textContent = "Edit Search Engine";
  if (actionInput) actionInput.value = "edit";

  // Fill fields with engine data
  document.getElementById("engine-id").value = engine.id;
  document.getElementById("engine-name").value = engine.name;
  document.getElementById("engine-placeholder").value = engine.placeholder;
  document.getElementById("engine-url").value = engine.url;
  document.getElementById("engine-icon").value = engine.icon;

  // Set preview
  const preview = document.getElementById("icon-preview");
  if (preview) {
    preview.src = engine.icon;
    preview.onerror = () => {
      preview.src = "../images/icon16.png";
    };
  }

  // Show modal using the application's standard approach
  if (modalOverlay) {
    modalOverlay.classList.add("active");
    document.getElementById("modal-container").classList.remove("hidden");
  }
}

/**
 * Set up modal event listeners
 */
function setupModalListeners() {
  // Modal close buttons
  document.querySelectorAll(".close-modal").forEach((button) => {
    button.addEventListener("click", (e) => {
      e.preventDefault();
      const modal = button.closest(".modal-overlay");
      if (modal) {
        modal.classList.remove("active");
        document.getElementById("modal-container").classList.add("hidden");
      }
    });
  });

  // Modal click outside to close
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("active");
        document.getElementById("modal-container").classList.add("hidden");
      }
    });
  });

  // Icon URL input for preview
  const iconInput = document.getElementById("engine-icon");
  const iconPreview = document.getElementById("icon-preview");

  if (iconInput && iconPreview) {
    iconInput.addEventListener("input", () => {
      iconPreview.src = iconInput.value || "";
      iconPreview.onerror = () => {
        iconPreview.src = "../images/icon16.png";
      };
    });
  }

  // Form submission handler
  const form = document.getElementById("search-engine-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      handleSearchEngineFormSubmit();
    });
  }
}

/**
 * Handle search engine form submission
 */
function handleSearchEngineFormSubmit() {
  const form = document.getElementById("search-engine-form");
  if (!form) return;

  // Get form values
  const nameInput = document.getElementById("engine-name");
  const placeholderInput = document.getElementById("engine-placeholder");
  const urlInput = document.getElementById("engine-url");
  const iconInput = document.getElementById("engine-icon");
  const idInput = document.getElementById("engine-id");
  const actionInput = document.getElementById("engine-action");

  // Validate required fields
  if (
    !nameInput.value.trim() ||
    !placeholderInput.value.trim() ||
    !urlInput.value.trim()
  ) {
    alert("Please fill in all required fields.");
    return;
  }

  // Validate URL contains %s
  if (!urlInput.value.includes("%s")) {
    alert("Search URL must contain '%s' where the query should be inserted.");
    return;
  }

  // Prepare engine object
  const engineData = {
    name: nameInput.value.trim(),
    placeholder: placeholderInput.value.trim(),
    url: urlInput.value.trim(),
    icon: iconInput.value.trim() || "../images/icon16.png",
  };

  // Handle add vs edit
  if (actionInput.value === "add") {
    // Generate unique ID for new engine
    engineData.id = `engine-${Date.now()}`;
    searchEngines.push(engineData);
  } else {
    // Update existing engine
    const engineId = idInput.value;
    const index = searchEngines.findIndex((e) => e.id === engineId);
    if (index !== -1) {
      engineData.id = engineId;
      searchEngines[index] = engineData;
    } else {
      // If engine not found, add as new
      engineData.id = `engine-${Date.now()}`;
      searchEngines.push(engineData);
    }
  }

  // Save changes
  saveSearchEngines();

  // Re-render engines
  renderSearchEngines();
  setCurrentEngine();

  // Close modal using the application's standard approach
  const modalOverlay =
    document.getElementById("search-engine-modal-overlay") ||
    document.querySelector(".modal-overlay:not(.hidden)");
  if (modalOverlay) {
    modalOverlay.classList.remove("active");
    document.getElementById("modal-container").classList.add("hidden");
  }
}

// Initialize search when components are loaded
document.addEventListener("componentsLoaded", initializeSearch);
