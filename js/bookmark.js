// Main state variables
let currentFolderId = "0"; // Root folder by default
let breadcrumbPath = [{ id: "0", title: "Root" }];
let allBookmarksInFolder = [];
let allBookmarks = [];
let allFolders = [];
let searchMode = "global"; // 'global' or 'folder'
let viewMode = "list"; // 'list' or 'grid'
let isDarkMode = false;
let selectedBookmarks = new Set();
let tags = new Map();
let searchHistory = [];
let recentBookmarks = [];

// DOM Elements
const searchInput = document.getElementById("search-input");
const searchModeIndicator = document.getElementById("search-mode-indicator");
const sortSelect = document.getElementById("sort-select");
const bookmarksContainer = document.getElementById("bookmarks-container");
const foldersContainer = document.getElementById("folders-container");
const breadcrumbContainer = document.getElementById("breadcrumb");
const currentFolderName = document.getElementById("current-folder-name");
const itemCount = document.getElementById("item-count");
const totalBookmarksCount = document.getElementById("total-bookmarks");
const totalFoldersCount = document.getElementById("total-folders");
const tagsContainer = document.getElementById("tags-container");
const recentBookmarksContainer = document.getElementById("recent-bookmarks");
const searchResultsIndicator = document.getElementById(
  "search-results-indicator"
);
const searchTermDisplay = document.getElementById("search-term");
const clearSearchBtn = document.getElementById("clear-search");
const viewListBtn = document.getElementById("view-list");
const viewGridBtn = document.getElementById("view-grid");
const selectionCount = document.getElementById("selection-count");
const clearSelectionBtn = document.getElementById("clear-selection");

// Modal Elements
const bookmarkModal = document.getElementById("bookmark-modal");
const bookmarkForm = document.getElementById("bookmark-form");
const bookmarkTitleInput = document.getElementById("bookmark-title");
const bookmarkUrlInput = document.getElementById("bookmark-url");
const bookmarkTagsInput = document.getElementById("bookmark-tags");
const bookmarkIdInput = document.getElementById("bookmark-id");
const modalTitle = document.getElementById("modal-title");
const modalDeleteBtn = document.getElementById("modal-delete-btn");

// Settings Elements
const settingsModal = document.getElementById("settings-modal");
const settingGlobalSearch = document.getElementById("setting-global-search");
const settingSearchHistory = document.getElementById("setting-search-history");
const exportBtn = document.getElementById("export-btn");
const importBtn = document.getElementById("import-btn");
const resetSettingsBtn = document.getElementById("reset-settings");

/**
 * Initialize the app when DOM is loaded
 */
document.addEventListener("DOMContentLoaded", function () {
  loadSettings();
  setupEventListeners();
  initializeBookmarks();

  // Modal close handlers
  document.querySelectorAll(".bm-modal").forEach((modal) => {
    // Close on ESC key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("open")) {
        modal.classList.remove("open");
        document.body.style.overflow = "";
      }
    });
  });
});

/**
 * Load user settings from chrome.storage
 */
function loadSettings() {
  chrome.storage.sync.get(
    {
      darkMode: false,
      globalSearch: true,
      searchHistory: true,
    },
    (settings) => {
      isDarkMode = settings.darkMode;
      if (isDarkMode) {
        document.documentElement.classList.add("dark");
      }

      searchMode = settings.globalSearch ? "global" : "folder"; // 'global' or 'folder'
      settingGlobalSearch.checked = settings.globalSearch;
      updateSearchModeIndicator();

      settingSearchHistory.checked = settings.searchHistory;

      if (settings.searchHistory) {
        loadSearchHistory();
      }
    }
  );
}

/**
 * Set up all event listeners for the application
 */
function setupEventListeners() {
  searchInput.addEventListener("input", debounce(handleSearch, 300));
  searchModeIndicator.addEventListener("click", toggleSearchMode);
  clearSearchBtn.addEventListener("click", clearSearch);
  sortSelect.addEventListener("change", sortBookmarks);

  viewListBtn.addEventListener("click", () => setViewMode("list"));
  viewGridBtn.addEventListener("click", () => setViewMode("grid"));

  document
    .getElementById("add-bookmark-btn")
    .addEventListener("click", showAddBookmarkModal);
  document
    .getElementById("add-folder-btn")
    .addEventListener("click", showAddFolderModal);
  document
    .getElementById("settings-btn")
    .addEventListener("click", showSettingsModal);
  clearSelectionBtn.addEventListener("click", clearSelection);

  bookmarkForm.addEventListener("submit", handleBookmarkSubmit);
  document
    .getElementById("folder-form")
    .addEventListener("submit", handleFolderSubmit);
  document
    .getElementById("settings-form")
    .addEventListener("submit", saveSettings);

  document.addEventListener("keydown", handleKeyboardShortcuts);

  breadcrumbContainer.addEventListener("click", handleBreadcrumbClick);

  settingGlobalSearch.addEventListener("change", () => {
    searchMode = settingGlobalSearch.checked ? "global" : "folder";
    updateSearchModeIndicator();
    if (searchInput.value) {
      handleSearch();
    }
  });

  exportBtn.addEventListener("click", exportBookmarks);
  importBtn.addEventListener("click", importBookmarks);
  resetSettingsBtn.addEventListener("click", resetSettings);

  document
    .getElementById("collapse-folders")
    .addEventListener("click", toggleSection);
  document
    .getElementById("collapse-recent")
    .addEventListener("click", toggleSection);
  document
    .getElementById("collapse-tags")
    .addEventListener("click", toggleSection);
}

/**
 * Initialize bookmarks and folders
 */
function initializeBookmarks() {
  showLoadingState();

  chrome.bookmarks.getTree(function (bookmarkTreeNodes) {
    processEntireBookmarkTree(bookmarkTreeNodes);
    loadFolderContents(currentFolderId);
    updateStats();
    loadRecentBookmarks();
    renderTags();
  });
}

/**
 * Process the entire bookmark tree to collect all bookmarks and folders
 */
function processEntireBookmarkTree(bookmarkTreeNodes) {
  allBookmarks = [];
  allFolders = [];
  processBookmarkNodes(bookmarkTreeNodes);
  allFolders.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Recursively process bookmark tree nodes
 */
function processBookmarkNodes(bookmarkNodes, parentPath = "") {
  for (const node of bookmarkNodes) {
    const nodePath = parentPath
      ? `${parentPath} > ${node.title}`
      : node.title || "Root";

    const isRootFolder = node.parentId === "0" || !node.parentId;
    const displayPath = isRootFolder ? node.title || "Root" : nodePath;

    if (!node.url) {
      if (node.id !== "0") {
        allFolders.push({
          id: node.id,
          title: node.title || "Unnamed Folder",
          path: displayPath,
          parentId: node.parentId || "0",
          dateAdded: node.dateAdded,
        });
      }

      if (node.children) {
        processBookmarkNodes(node.children, displayPath);
      }
    } else {
      const { title: cleanTitle, tags: bookmarkTags } = extractTags(node.title);

      allBookmarks.push({
        id: node.id,
        title: cleanTitle || node.url,
        url: node.url,
        dateAdded: node.dateAdded,
        path: displayPath,
        parentId: node.parentId,
        tags: bookmarkTags,
      });

      bookmarkTags.forEach((tag) => {
        if (tags.has(tag)) {
          tags.set(tag, tags.get(tag) + 1);
        } else {
          tags.set(tag, 1);
        }
      });
    }
  }
}

/**
 * Extract tags from a bookmark title
 */
function extractTags(title) {
  if (!title) return { title: "", tags: [] };

  const tagRegex = /\[(.*?)\]$/;
  const match = title.match(tagRegex);

  if (match && match[1]) {
    const tags = match[1]
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag);
    const cleanTitle = title.replace(tagRegex, "").trim();
    return { title: cleanTitle, tags };
  }

  return { title, tags: [] };
}

/**
 * Loads folder contents and updates the UI
 * @param {string} folderId - ID of the folder to load
 */
function loadFolderContents(folderId) {
  chrome.bookmarks.getSubTree(folderId, function (results) {
    if (!results || results.length === 0) {
      showToast("Error", "Could not load folder contents.", "error");
      return;
    }

    const folderNode = results[0];
    updateCurrentFolderInfo(folderNode);

    hideSearchResults();

    foldersContainer.innerHTML = "";
    bookmarksContainer.innerHTML = "";

    allBookmarksInFolder = [];

    if (!folderNode.children || folderNode.children.length === 0) {
      showEmptyState(foldersContainer, "No folders found", "folder");
      showEmptyState(bookmarksContainer, "No bookmarks found", "bookmark");
      updateItemCount(0);
      return;
    }

    const folders = [];
    const bookmarks = [];

    for (const node of folderNode.children) {
      if (node.url) {
        const { title: cleanTitle, tags: bookmarkTags } = extractTags(
          node.title
        );

        bookmarks.push({
          id: node.id,
          title: cleanTitle || node.url,
          url: node.url,
          dateAdded: node.dateAdded,
          tags: bookmarkTags,
        });

        allBookmarksInFolder.push({
          id: node.id,
          title: cleanTitle || node.url,
          url: node.url,
          dateAdded: node.dateAdded,
          tags: bookmarkTags,
        });
      } else {
        folders.push({
          id: node.id,
          title: node.title || "Unnamed Folder",
          dateAdded: node.dateAdded,
        });
      }
    }

    if (folders.length === 0) {
      showEmptyState(foldersContainer, "No folders found", "folder");
    } else {
      renderFolders(folders);
    }

    if (bookmarks.length === 0) {
      showEmptyState(bookmarksContainer, "No bookmarks found", "bookmark");
    } else {
      sortBookmarksByProperty(sortSelect.value, bookmarks);
      renderBookmarksList(bookmarks);
    }

    updateItemCount(folders.length + bookmarks.length);
  });
}

/**
 * Displays an empty state placeholder in the container
 * @param {Element} container - Container to show the empty state in
 * @param {string} message - Message to display
 * @param {string} type - Type of empty state (folder or bookmark)
 */
function showEmptyState(container, message, type) {
  const icon = type === "folder" ? "fa-folder-open" : "fa-bookmark";

  container.innerHTML = `
        <div class="empty-state">
        <div class="empty-state-icon">
        <i class="fas ${icon}"></i>
        </div>
        <div class="empty-state-text">${message}</div>
        </div>
        `;
}

/**
 * Shows loading indicators while data is being fetched
 */
function showLoadingState() {
  foldersContainer.innerHTML = `
        <div class="flex justify-center items-center py-4">
        <div class="loading-spinner"></div>
        <span class="ml-2 text-gray-600 dark:text-gray-400">Loading...</span>
        </div>
        `;

  bookmarksContainer.innerHTML = `
        <div class="flex justify-center items-center py-8">
        <div class="loading-spinner"></div>
        <span class="ml-2 text-gray-600 dark:text-gray-400">Loading...</span>
        </div>
        `;
}

/**
 * Updates folder info and breadcrumb navigation for the current folder
 * @param {Object} folder - The folder data object
 */
function updateCurrentFolderInfo(folder) {
  currentFolderName.textContent = folder.title || "Root";
  currentFolderId = folder.id;

  const existingIndex = breadcrumbPath.findIndex(
    (item) => item.id === folder.id
  );

  if (existingIndex >= 0) {
    breadcrumbPath = breadcrumbPath.slice(0, existingIndex + 1);
  } else {
    breadcrumbPath.push({ id: folder.id, title: folder.title || "Root" });
  }

  renderBreadcrumb();
}

/**
 * Renders the breadcrumb navigation path
 */
function renderBreadcrumb() {
  breadcrumbContainer.innerHTML = "";

  breadcrumbPath.forEach((item, index) => {
    const button = document.createElement("button");
    button.className = "breadcrumb-btn";
    button.setAttribute("data-folder-id", item.id);

    if (index === 0) {
      button.innerHTML = '<i class="fas fa-home mr-1"></i> ';
    } else {
      button.innerHTML = '<i class="fas fa-folder mr-1"></i> ';
    }

    button.innerHTML += item.title;
    breadcrumbContainer.appendChild(button);

    if (index < breadcrumbPath.length - 1) {
      const separator = document.createElement("span");
      separator.className = "breadcrumb-separator";
      separator.textContent = ">";
      breadcrumbContainer.appendChild(separator);
    }
  });
}

/**
 * Handles clicks on the breadcrumb navigation
 * @param {Event} e - The click event
 */
function handleBreadcrumbClick(e) {
  const folderButton = e.target.closest("button[data-folder-id]");
  if (folderButton) {
    const folderId = folderButton.getAttribute("data-folder-id");
    navigateToFolder(folderId);
  }
}

/**
 * Navigate to a specific folder
 * @param {string} folderId - ID of the folder to navigate to
 */
function navigateToFolder(folderId) {
  currentFolderId = folderId;
  loadFolderContents(folderId);

  searchInput.value = "";
}

/**
 * Render folders in the folder list
 * @param {Array} folders - Array of folder objects to render
 */
function renderFolders(folders) {
  foldersContainer.innerHTML = "";

  folders.sort((a, b) => a.title.localeCompare(b.title));

  folders.forEach((folder) => {
    const folderItem = document.createElement("div");
    folderItem.className = "folder-item flex items-center justify-between";
    folderItem.dataset.id = folder.id;
    folderItem.tabIndex = 0;

    const nameContainer = document.createElement("div");
    nameContainer.className = "flex items-center flex-grow overflow-hidden";
    nameContainer.innerHTML = `
                <i class="fas fa-folder mr-2 text-yellow-500"></i>
                <span class="truncate folder-title">${folder.title}</span>
                `;

    const actions = document.createElement("div");
    actions.className = "folder-actions flex space-x-1";
    actions.innerHTML = `
                <button class="edit-folder-btn p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400" title="Edit Folder">
                <i class="fas fa-pencil-alt"></i>
                </button>
                `;

    folderItem.appendChild(nameContainer);
    folderItem.appendChild(actions);

    folderItem.addEventListener("click", (e) => {
      if (!e.target.closest(".folder-actions")) {
        navigateToFolder(folder.id);
      }
    });

    folderItem.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showFolderContextMenu(e, folder);
    });

    folderItem
      .querySelector(".edit-folder-btn")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        showEditFolderModal(folder);
      });

    foldersContainer.appendChild(folderItem);
  });
}

/**
 * Render bookmarks list in either list or grid view
 * @param {Array} bookmarks - Array of bookmark objects to render
 */
function renderBookmarksList(bookmarks) {
  bookmarksContainer.innerHTML = "";

  if (bookmarks.length === 0) {
    showEmptyState(bookmarksContainer, "No bookmarks found", "bookmark");
    return;
  }

  bookmarksContainer.className = `max-h-96 overflow-y-auto ${
    viewMode === "grid" ? "view-as-grid" : ""
  }`;

  if (viewMode === "list") {
    const bookmarkList = document.createElement("ul");
    bookmarkList.className = "space-y-1";

    bookmarks.forEach((bookmark) => {
      const li = createBookmarkItem(bookmark);
      bookmarkList.appendChild(li);
    });

    bookmarksContainer.appendChild(bookmarkList);
  } else {
    bookmarks.forEach((bookmark) => {
      const item = createBookmarkItem(bookmark);
      bookmarksContainer.appendChild(item);
    });
  }
}

/**
 * Creates a bookmark item element for display
 * @param {Object} bookmark - The bookmark data object
 * @returns {HTMLElement} The created bookmark item element
 */
function createBookmarkItem(bookmark) {
  const isListView = viewMode === "list";
  const item = document.createElement(isListView ? "li" : "div");
  item.className = `bookmark-item ${
    isListView
      ? "border-b border-gray-200 dark:border-gray-700 pb-2 last:border-0"
      : ""
  }`;
  item.dataset.id = bookmark.id;
  item.tabIndex = 0;

  if (selectedBookmarks.has(bookmark.id)) {
    item.classList.add("selected");
  }

  const content = document.createElement("div");
  content.className = "flex items-start w-full";

  let faviconUrl;
  try {
    faviconUrl = `https://www.google.com/s2/favicons?domain=${
      new URL(bookmark.url).hostname
    }&sz=32`;
  } catch (e) {
    faviconUrl =
      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"%3E%3Cpath d="M8 3a.5.5 0 0 1 .5.5V9a.5.5 0 0 1-1 0V3.5A.5.5 0 0 1 8 3z"/%3E%3Cpath d="M8 1a2 2 0 0 1 2 2v.823l.696-.697a2 2 0 1 1 2.828 2.828l-3.535 3.535a2 2 0 0 1-2.828 0l-3.535-3.535A2 2 0 1 1 6.17 3.126l.696.697A2 2 0 0 1 8 1z"/%3E%3C/svg%3E';
  }

  const favicon = document.createElement("img");
  favicon.src = faviconUrl;
  favicon.className = `bookmark-favicon ${
    isListView ? "w-4 h-4 mt-1 mr-2 flex-shrink-0" : ""
  }`;
  favicon.onerror = () => {
    favicon.src =
      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"%3E%3Cpath d="M8 3a.5.5 0 0 1 .5.5V9a.5.5 0 0 1-1 0V3.5A.5.5 0 0 1 8 3z"/%3E%3Cpath d="M8 1a2 2 0 0 1 2 2v.823l.696-.697a2 2 0 1 1 2.828 2.828l-3.535 3.535a2 2 0 0 1-2.828 0l-3.535-3.535A2 2 0 1 1 6.17 3.126l.696.697A2 2 0 0 1 8 1z"/%3E%3C/svg%3E';
  };

  const textContent = document.createElement("div");
  textContent.className = "bookmark-content flex-grow overflow-hidden";

  const title = document.createElement("div");
  title.className =
    "bookmark-title text-blue-600 dark:text-blue-400 font-medium truncate";
  title.textContent = bookmark.title;

  const url = document.createElement("div");
  url.className =
    "bookmark-url text-gray-500 dark:text-gray-400 text-xs truncate";
  url.textContent = bookmark.url;

  let tagsElement = "";
  if (bookmark.tags && bookmark.tags.length > 0) {
    const tagsDiv = document.createElement("div");
    tagsDiv.className = "bookmark-tags flex flex-wrap gap-1 mt-1";

    bookmark.tags.forEach((tag) => {
      const tagSpan = document.createElement("span");
      tagSpan.className = "tag text-xs";
      tagSpan.textContent = tag;
      tagsDiv.appendChild(tagSpan);
    });

    tagsElement = tagsDiv.outerHTML;
  }

  textContent.appendChild(title);
  textContent.appendChild(url);
  if (tagsElement) {
    textContent.innerHTML += tagsElement;
  }

  const actions = document.createElement("div");
  actions.className = "bookmark-actions ml-2 flex space-x-1";
  actions.innerHTML = `
        <button class="edit-btn p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400" title="Edit Bookmark">
        <i class="fas fa-pencil-alt"></i>
        </button>
        <button class="open-btn p-1 text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400" title="Open Bookmark">
        <i class="fas fa-external-link-alt"></i>
        </button>
        `;

  content.appendChild(favicon);
  content.appendChild(textContent);
  content.appendChild(actions);

  item.appendChild(content);

  item.addEventListener("click", (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      toggleBookmarkSelection(bookmark.id);
      return;
    }

    if (!e.target.closest(".bookmark-actions")) {
      openBookmark(bookmark);
    }
  });

  item.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    showBookmarkContextMenu(e, bookmark);
  });

  const editBtn = actions.querySelector(".edit-btn");
  editBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showEditBookmarkModal(bookmark);
  });

  const openBtn = actions.querySelector(".open-btn");
  openBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openBookmark(bookmark);
  });

  return item;
}

/**
 * Toggle bookmark selection state
 * @param {string} bookmarkId - ID of the bookmark to toggle
 */
function toggleBookmarkSelection(bookmarkId) {
  if (selectedBookmarks.has(bookmarkId)) {
    selectedBookmarks.delete(bookmarkId);
  } else {
    selectedBookmarks.add(bookmarkId);
  }

  const bookmarkItem = bookmarksContainer.querySelector(
    `.bookmark-item[data-id="${bookmarkId}"]`
  );
  if (bookmarkItem) {
    bookmarkItem.classList.toggle(
      "selected",
      selectedBookmarks.has(bookmarkId)
    );
  }

  updateSelectionCount();
}

/**
 * Update selection count display
 */
function updateSelectionCount() {
  const count = selectedBookmarks.size;
  if (count > 0) {
    selectionCount.textContent = `${count} selected`;
    selectionCount.classList.remove("hidden");
    clearSelectionBtn.classList.remove("hidden");
  } else {
    selectionCount.classList.add("hidden");
    clearSelectionBtn.classList.add("hidden");
  }
}

/**
 * Clear all selected bookmarks
 */
function clearSelection() {
  selectedBookmarks.clear();
  document.querySelectorAll(".bookmark-item.selected").forEach((item) => {
    item.classList.remove("selected");
  });
  updateSelectionCount();
}

/**
 * Open a bookmark in a new tab
 * @param {Object} bookmark - The bookmark to open
 */
function openBookmark(bookmark) {
  chrome.tabs.create({ url: bookmark.url });
  addToRecentBookmarks(bookmark);
}

/**
 * Add a bookmark to recent bookmarks list
 * @param {Object} bookmark - The bookmark to add
 */
function addToRecentBookmarks(bookmark) {
  recentBookmarks = recentBookmarks.filter((b) => b.id !== bookmark.id);

  recentBookmarks.unshift({
    ...bookmark,
    lastAccessed: Date.now(),
  });

  if (recentBookmarks.length > 20) {
    recentBookmarks = recentBookmarks.slice(0, 20);
  }

  chrome.storage.local.set({ recentBookmarks });
  loadRecentBookmarks();
}

/**
 * Load recent bookmarks from storage
 */
function loadRecentBookmarks() {
  chrome.storage.local.get({ recentBookmarks: [] }, (data) => {
    recentBookmarks = data.recentBookmarks || [];
    renderRecentBookmarks();
  });
}

/**
 * Render recent bookmarks in the UI
 */
function renderRecentBookmarks() {
  if (!recentBookmarksContainer) return;

  if (recentBookmarks.length === 0) {
    recentBookmarksContainer.innerHTML = `
                <div class="text-gray-500 dark:text-gray-400 text-center py-2 text-sm italic">
                No recent bookmarks
                </div>
                `;
    return;
  }

  recentBookmarksContainer.innerHTML = "";
  const bookmarkList = document.createElement("ul");
  bookmarkList.className = "space-y-1";

  // Show only the first 5 recent bookmarks
  recentBookmarks.slice(0, 5).forEach((bookmark) => {
    const li = document.createElement("li");
    li.className = "bookmark-item py-1 px-0";

    let faviconUrl;
    try {
      faviconUrl = `https://www.google.com/s2/favicons?domain=${
        new URL(bookmark.url).hostname
      }`;
    } catch (e) {
      faviconUrl =
        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"%3E%3Cpath d="M8 3a.5.5 0 0 1 .5.5V9a.5.5 0 0 1-1 0V3.5A.5.5 0 0 1 8 3z"/%3E%3Cpath d="M8 1a2 2 0 0 1 2 2v.823l.696-.697a2 2 0 1 1 2.828 2.828l-3.535 3.535a2 2 0 0 1-2.828 0l-3.535-3.535A2 2 0 1 1 6.17 3.126l.696.697A2 2 0 0 1 8 1z"/%3E%3C/svg%3E';
    }

    const link = document.createElement("div");
    link.className = "flex items-center cursor-pointer";
    link.innerHTML = `
                <img src="${faviconUrl}" class="w-3 h-3 mr-1 flex-shrink-0" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' fill=\'currentColor\' viewBox=\'0 0 16 16\'%3E%3Cpath d=\'M8 3a.5.5 0 0 1 .5.5V9a.5.5 0 0 1-1 0V3.5A.5.5 0 0 1 8 3z\'/%3E%3Cpath d=\'M8 1a2 2 0 0 1 2 2v.823l.696-.697a2 2 0 1 1 2.828 2.828l-3.535 3.535a2 2 0 0 1-2.828 0l-3.535-3.535A2 2 0 1 1 6.17 3.126l.696.697A2 2 0 0 1 8 1z\'/%3E%3C/svg%3E'">
                <div class="truncate text-sm text-blue-600 dark:text-blue-400 hover:underline">${bookmark.title}</div>
                `;

    link.addEventListener("click", () => {
      openBookmark(bookmark);
    });

    li.appendChild(link);
    bookmarkList.appendChild(li);
  });

  recentBookmarksContainer.appendChild(bookmarkList);
}

/**
 * Shows context menu for a bookmark
 * @param {Event} event - The triggering event
 * @param {Object} bookmark - The bookmark data object
 */
function showBookmarkContextMenu(event, bookmark) {
  hideContextMenus();

  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.style.top = `${event.clientY}px`;
  menu.style.left = `${event.clientX}px`;

  menu.innerHTML = `
        <div class="context-menu-item edit-item">
        <i class="fas fa-pencil-alt"></i> Edit
        </div>
        <div class="context-menu-item open-item">
        <i class="fas fa-external-link-alt"></i> Open
        </div>
        <div class="context-menu-item open-new-item">
        <i class="fas fa-external-link-square-alt"></i> Open in New Tab
        </div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item copy-item">
        <i class="fas fa-copy"></i> Copy URL
        </div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item delete-item text-red-600 dark:text-red-400">
        <i class="fas fa-trash-alt"></i> Delete
        </div>
        `;

  document.body.appendChild(menu);

  const menuRect = menu.getBoundingClientRect();
  if (menuRect.right > window.innerWidth) {
    menu.style.left = `${window.innerWidth - menuRect.width - 5}px`;
  }
  if (menuRect.bottom > window.innerHeight) {
    menu.style.top = `${window.innerHeight - menuRect.height - 5}px`;
  }

  menu.querySelector(".edit-item").addEventListener("click", () => {
    hideContextMenus();
    showEditBookmarkModal(bookmark);
  });

  menu.querySelector(".open-item").addEventListener("click", () => {
    hideContextMenus();
    openBookmark(bookmark);
  });

  menu.querySelector(".open-new-item").addEventListener("click", () => {
    hideContextMenus();
    chrome.tabs.create({ url: bookmark.url, active: false });
    addToRecentBookmarks(bookmark);
  });

  menu.querySelector(".copy-item").addEventListener("click", () => {
    hideContextMenus();
    navigator.clipboard
      .writeText(bookmark.url)
      .then(() => showToast("Success", "URL copied to clipboard", "success"))
      .catch(() => showToast("Error", "Failed to copy URL", "error"));
  });

  menu.querySelector(".delete-item").addEventListener("click", () => {
    hideContextMenus();

    if (confirm(`Are you sure you want to delete "${bookmark.title}"?`)) {
      chrome.bookmarks.remove(bookmark.id, () => {
        if (chrome.runtime.lastError) {
          showToast(
            "Error",
            `Failed to delete bookmark: ${chrome.runtime.lastError.message}`,
            "error"
          );
        } else {
          showToast("Success", "Bookmark deleted", "success");
          refreshBookmarks();
        }
      });
    }
  });

  document.addEventListener("click", hideContextMenus);
}

/**
 * Shows context menu for a folder
 * @param {Event} event - The triggering event
 * @param {Object} folder - The folder data object
 */
function showFolderContextMenu(event, folder) {
  hideContextMenus();

  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.style.top = `${event.clientY}px`;
  menu.style.left = `${event.clientX}px`;

  menu.innerHTML = `
        <div class="context-menu-item open-item">
        <i class="fas fa-folder-open"></i> Open
        </div>
        <div class="context-menu-item edit-item">
        <i class="fas fa-pencil-alt"></i> Edit
        </div>
        <div class="context-menu-item add-bookmark-item">
        <i class="fas fa-bookmark"></i> Add Bookmark
        </div>
        <div class="context-menu-item add-folder-item">
        <i class="fas fa-folder-plus"></i> Add Folder
        </div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item delete-item text-red-600 dark:text-red-400">
        <i class="fas fa-trash-alt"></i> Delete
        </div>
        `;

  document.body.appendChild(menu);

  const menuRect = menu.getBoundingClientRect();
  if (menuRect.right > window.innerWidth) {
    menu.style.left = `${window.innerWidth - menuRect.width - 5}px`;
  }
  if (menuRect.bottom > window.innerHeight) {
    menu.style.top = `${window.innerHeight - menuRect.height - 5}px`;
  }

  menu.querySelector(".open-item").addEventListener("click", () => {
    hideContextMenus();
    navigateToFolder(folder.id);
  });

  menu.querySelector(".edit-item").addEventListener("click", () => {
    hideContextMenus();
    showEditFolderModal(folder);
  });

  menu.querySelector(".add-bookmark-item").addEventListener("click", () => {
    hideContextMenus();
    currentFolderId = folder.id;
    showAddBookmarkModal();
  });

  menu.querySelector(".add-folder-item").addEventListener("click", () => {
    hideContextMenus();
    currentFolderId = folder.id;
    showAddFolderModal();
  });

  menu.querySelector(".delete-item").addEventListener("click", () => {
    hideContextMenus();

    chrome.bookmarks.getChildren(folder.id, (children) => {
      if (chrome.runtime.lastError) {
        showToast(
          "Error",
          `Could not check folder contents: ${chrome.runtime.lastError.message}`,
          "error"
        );
        return;
      }

      if (children.length > 0) {
        showToast(
          "Warning",
          "Cannot delete folder because it is not empty",
          "warning"
        );
        return;
      }

      if (confirm(`Are you sure you want to delete "${folder.title}"?`)) {
        chrome.bookmarks.remove(folder.id, () => {
          if (chrome.runtime.lastError) {
            showToast(
              "Error",
              `Failed to delete folder: ${chrome.runtime.lastError.message}`,
              "error"
            );
          } else {
            showToast("Success", "Folder deleted", "success");
            const parentFolder = allFolders.find(
              (f) => f.id === folder.parentId
            );
            if (parentFolder) {
              navigateToFolder(parentFolder.id);
            } else {
              navigateToFolder("0"); // Root
            }
          }
        });
      }
    });
  });

  document.addEventListener("click", hideContextMenus);
}

/**
 * Hides all context menus
 */
function hideContextMenus() {
  document.querySelectorAll(".context-menu").forEach((menu) => menu.remove());
  document.removeEventListener("click", hideContextMenus);
}

/**
 * Shows a toast notification
 * @param {string} title - Toast title
 * @param {string} message - Toast message
 * @param {string} type - Toast type: 'info', 'success', 'error', or 'warning'
 */
function showToast(title, message, type = "info") {
  const toastContainer = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  toast.innerHTML = `
        <div class="flex items-center">
        <div class="flex-shrink-0 mr-2">
        <i class="fas ${
          type === "success"
            ? "fa-check-circle"
            : type === "error"
            ? "fa-exclamation-circle"
            : type === "warning"
            ? "fa-exclamation-triangle"
            : "fa-info-circle"
        }"></i>
        </div>
        <div>
        <h4 class="font-semibold">${title}</h4>
        <div class="text-sm">${message}</div>
        </div>
        </div>
        <button class="ml-auto text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200">
        <i class="fas fa-times"></i>
        </button>
        `;

  toastContainer.appendChild(toast);

  const closeBtn = toast.querySelector("button");
  closeBtn.addEventListener("click", () => {
    toast.classList.add("toast-hide");
    setTimeout(() => toast.remove(), 300);
  });

  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add("toast-hide");
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
}

/**
 * Updates item count display
 * @param {number} count - Number of items
 */
function updateItemCount(count) {
  if (itemCount) {
    itemCount.textContent = `${count} item${count !== 1 ? "s" : ""}`;
  }
}

/**
 * Updates bookmark and folder statistics
 */
function updateStats() {
  if (totalBookmarksCount) {
    totalBookmarksCount.textContent = allBookmarks.length;
  }
  if (totalFoldersCount) {
    totalFoldersCount.textContent = allFolders.length;
  }
}

/**
 * Handles search input and triggers appropriate search method
 */
function handleSearch() {
  const searchTerm = searchInput.value.trim().toLowerCase();

  if (!searchTerm) {
    clearSearch();
    return;
  }

  saveSearchToHistory(searchTerm);
  showSearchResults(searchTerm);

  if (searchMode === "global") {
    performGlobalSearch(searchTerm);
  } else {
    performFolderSearch(searchTerm);
  }
}

/**
 * Performs global search across all bookmarks
 * @param {string} searchTerm - Search term
 */
function performGlobalSearch(searchTerm) {
  const results = allBookmarks.filter(
    (bookmark) =>
      bookmark.title.toLowerCase().includes(searchTerm) ||
      bookmark.url.toLowerCase().includes(searchTerm) ||
      bookmark.tags.some((tag) => tag.includes(searchTerm))
  );

  results.sort((a, b) => {
    const aTitleMatch = a.title.toLowerCase().includes(searchTerm);
    const bTitleMatch = b.title.toLowerCase().includes(searchTerm);

    if (aTitleMatch && !bTitleMatch) return -1;
    if (!aTitleMatch && bTitleMatch) return 1;

    return b.dateAdded - a.dateAdded;
  });

  renderSearchResults(results);
}

/**
 * Performs search within the current folder
 * @param {string} searchTerm - Search term
 */
function performFolderSearch(searchTerm) {
  const results = allBookmarksInFolder.filter(
    (bookmark) =>
      bookmark.title.toLowerCase().includes(searchTerm) ||
      bookmark.url.toLowerCase().includes(searchTerm) ||
      (bookmark.tags && bookmark.tags.some((tag) => tag.includes(searchTerm)))
  );

  results.sort((a, b) => {
    const aTitleMatch = a.title.toLowerCase().includes(searchTerm);
    const bTitleMatch = b.title.toLowerCase().includes(searchTerm);

    if (aTitleMatch && !bTitleMatch) return -1;
    if (!aTitleMatch && bTitleMatch) return 1;

    return sortBookmarksByProperty(sortSelect.value, [a, b]);
  });

  renderBookmarksList(results);
}

/**
 * Renders search results with path information
 * @param {Array} results - Search results array
 */
function renderSearchResults(results) {
  bookmarksContainer.innerHTML = "";

  if (results.length === 0) {
    showEmptyState(
      bookmarksContainer,
      "No bookmarks found matching your search",
      "search"
    );
    return;
  }

  const resultsList = document.createElement("div");
  resultsList.className = "space-y-2";

  results.forEach((bookmark) => {
    const resultItem = document.createElement("div");
    resultItem.className =
      "bookmark-item py-2 px-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md";
    resultItem.dataset.id = bookmark.id;

    const folderName = getFolderNameByBookmarkId(bookmark.id);

    let faviconUrl;
    try {
      faviconUrl = `https://www.google.com/s2/favicons?domain=${
        new URL(bookmark.url).hostname
      }`;
    } catch (e) {
      faviconUrl =
        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"%3E%3Cpath d="M8 3a.5.5 0 0 1 .5.5V9a.5.5 0 0 1-1 0V3.5A.5.5 0 0 1 8 3z"/%3E%3Cpath d="M8 1a2 2 0 0 1 2 2v.823l.696-.697a2 2 0 1 1 2.828 2.828l-3.535 3.535a2 2 0 0 1-2.828 0l-3.535-3.535A2 2 0 1 1 6.17 3.126l.696.697A2 2 0 0 1 8 1z"/%3E%3C/svg%3E';
    }

    const searchTerm = searchInput.value.trim().toLowerCase();
    const highlightedTitle = highlightText(bookmark.title, searchTerm);
    const highlightedUrl = highlightText(bookmark.url, searchTerm);

    resultItem.innerHTML = `
                <div class="flex items-start">
                <img src="${faviconUrl}" class="w-4 h-4 mt-1 mr-2 flex-shrink-0" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' fill=\'currentColor\' viewBox=\'0 0 16 16\'%3E%3Cpath d=\'M8 3a.5.5 0 0 1 .5.5V9a.5.5 0 0 1-1 0V3.5A.5.5 0 0 1 8 3z\'/%3E%3Cpath d=\'M8 1a2 2 0 0 1 2 2v.823l.696-.697a2 2 0 1 1 2.828 2.828l-3.535 3.535a2 2 0 0 1-2.828 0l-3.535-3.535A2 2 0 1 1 6.17 3.126l.696.697A2 2 0 0 1 8 1z\'/%3E%3C/svg%3E'">
                <div class="flex-grow overflow-hidden">
                <div class="text-blue-600 dark:text-blue-400 font-medium">${highlightedTitle}</div>
                <div class="text-gray-500 dark:text-gray-400 text-xs">${highlightedUrl}</div>
                <div class="flex items-center mt-1">
                <div class="text-xs text-gray-600 dark:text-gray-300 flex items-center">
                <i class="fas fa-folder text-yellow-500 mr-1"></i>
                <span>${folderName}</span>
                </div>
                ${
                  bookmark.tags && bookmark.tags.length
                    ? `
                        <div class="flex flex-wrap gap-1 ml-2">
                        ${bookmark.tags
                          .map(
                            (tag) => `
                                <span class="tag text-xs ${
                                  tag.includes(searchTerm) ? "active" : ""
                                }">${tag}</span>
                                `
                          )
                          .join("")}
                                </div>
                                `
                    : ""
                }
                                </div>
                                </div>
                                <div class="bookmark-actions ml-2 flex space-x-1">
                                <button class="goto-folder-btn p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400" title="Go to folder">
                                <i class="fas fa-folder-open"></i>
                                </button>
                                <button class="open-btn p-1 text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400" title="Open Bookmark">
                                <i class="fas fa-external-link-alt"></i>
                                </button>
                                </div>
                                </div>
                                `;

    resultItem.addEventListener("click", (e) => {
      if (!e.target.closest(".bookmark-actions")) {
        openBookmark(bookmark);
      }
    });

    const gotoFolderBtn = resultItem.querySelector(".goto-folder-btn");
    if (gotoFolderBtn) {
      gotoFolderBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        navigateToFolderByBookmarkId(bookmark.id);
      });
    }

    const openBtn = resultItem.querySelector(".open-btn");
    if (openBtn) {
      openBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openBookmark(bookmark);
      });
    }

    resultsList.appendChild(resultItem);
  });

  bookmarksContainer.appendChild(resultsList);
}

/**
 * Gets folder name by bookmark ID
 * @param {string} bookmarkId - ID of the bookmark
 * @returns {string} Folder path or "Unknown folder"
 */
function getFolderNameByBookmarkId(bookmarkId) {
  const bookmark = allBookmarks.find((b) => b.id === bookmarkId);
  if (bookmark && bookmark.path) {
    return bookmark.path;
  }
  return "Unknown folder";
}

/**
 * Navigates to folder containing a specific bookmark
 * @param {string} bookmarkId - ID of the bookmark
 */
function navigateToFolderByBookmarkId(bookmarkId) {
  chrome.bookmarks.get(bookmarkId, (results) => {
    if (chrome.runtime.lastError || !results || !results.length) {
      showToast("Error", "Could not find bookmark", "error");
      return;
    }

    const bookmark = results[0];
    navigateToFolder(bookmark.parentId);

    setTimeout(() => {
      const bookmarkElement = document.querySelector(
        `.bookmark-item[data-id="${bookmarkId}"]`
      );
      if (bookmarkElement) {
        bookmarkElement.classList.add("highlight-item");
        bookmarkElement.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          bookmarkElement.classList.remove("highlight-item");
        }, 2000);
      }
    }, 300);
  });
}

/**
 * Highlights search term in text
 * @param {string} text - Text to search in
 * @param {string} term - Term to highlight
 * @returns {string} HTML with highlighted term
 */
function highlightText(text, term) {
  if (!term) return text;
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedTerm})`, "gi");
  return text.replace(regex, '<span class="search-highlight">$1</span>');
}

/**
 * Shows search results indicator with search term
 * @param {string} term - Search term to display
 */
function showSearchResults(term) {
  if (!searchResultsIndicator) return;
  searchTermDisplay.textContent = term;
  searchResultsIndicator.classList.remove("hidden");
}

/**
 * Hides search results indicator
 */
function hideSearchResults() {
  if (!searchResultsIndicator) return;
  searchResultsIndicator.classList.add("hidden");
}

/**
 * Clears search input and results
 */
function clearSearch() {
  searchInput.value = "";
  hideSearchResults();
  loadFolderContents(currentFolderId);
}

/**
 * Saves search term to history
 * @param {string} term - Search term to save
 */
function saveSearchToHistory(term) {
  if (!settingSearchHistory || !settingSearchHistory.checked) return;
  if (searchHistory.length > 0 && searchHistory[0].term === term) return;

  searchHistory.unshift({
    term,
    timestamp: Date.now(),
  });

  if (searchHistory.length > 20) {
    searchHistory = searchHistory.slice(0, 20);
  }

  chrome.storage.local.set({ searchHistory });
}

/**
 * Loads search history from storage
 */
function loadSearchHistory() {
  chrome.storage.local.get({ searchHistory: [] }, (data) => {
    searchHistory = data.searchHistory || [];
  });
}

/**
 * Toggles search mode between global and folder
 */
function toggleSearchMode() {
  searchMode = searchMode === "global" ? "folder" : "global";
  chrome.storage.sync.set({ globalSearch: searchMode === "global" });
  updateSearchModeIndicator();

  if (searchInput.value.trim()) {
    handleSearch();
  }
}

/**
 * Updates search mode indicator based on current mode
 */
function updateSearchModeIndicator() {
  if (!searchModeIndicator) return;

  if (searchMode === "global") {
    searchModeIndicator.className = "fas fa-globe text-blue-500 cursor-pointer";
    searchModeIndicator.parentElement.setAttribute(
      "data-tooltip",
      "Global search is active"
    );
    searchInput.placeholder = "Search across all bookmarks...";
  } else {
    searchModeIndicator.className =
      "fas fa-folder text-blue-500 cursor-pointer";
    searchModeIndicator.parentElement.setAttribute(
      "data-tooltip",
      "Folder search is active"
    );
    searchInput.placeholder = "Search in current folder...";
  }
}

/**
 * Sets the view mode (list or grid)
 * @param {string} mode - View mode to set ("list" or "grid")
 */
function setViewMode(mode) {
  viewMode = mode;
  viewListBtn.classList.toggle("active", mode === "list");
  viewGridBtn.classList.toggle("active", mode === "grid");
  bookmarksContainer.classList.toggle("view-as-grid", mode === "grid");
  renderBookmarksList(allBookmarksInFolder);
  chrome.storage.sync.set({ viewMode });
}

/**
 * Toggles dark mode on/off
 * @param {Event} event - Click event
 * @param {boolean} forcedState - Force to specific state if provided
 */
function toggleDarkMode(event, forcedState) {
  const newState = forcedState !== undefined ? forcedState : !isDarkMode;
  isDarkMode = newState;
  document.documentElement.classList.toggle("dark", isDarkMode);
  chrome.storage.sync.set({ darkMode: isDarkMode });

  if (settingDarkMode && settingDarkMode.checked !== isDarkMode) {
    settingDarkMode.checked = isDarkMode;
  }
}

/**
 * Toggles section visibility
 * @param {Event} e - Click event
 */
function toggleSection(e) {
  const section = e.target.closest("div").nextElementSibling;
  const icon = e.target;

  if (section.style.display === "none") {
    section.style.display = "block";
    icon.className = icon.className.replace(
      "fa-chevron-right",
      "fa-chevron-down"
    );
  } else {
    section.style.display = "none";
    icon.className = icon.className.replace(
      "fa-chevron-down",
      "fa-chevron-right"
    );
  }
}

/**
 * Handles keyboard shortcuts
 * @param {KeyboardEvent} e - Keyboard event
 */
function handleKeyboardShortcuts(e) {
  if (e.key === "Escape") {
    hideContextMenus();
    document.querySelectorAll(".bm-modal").forEach((modal) => {
      modal.classList.remove("open");
    });
  }

  if ((e.ctrlKey || e.metaKey) && e.key === "f") {
    e.preventDefault();
    searchInput.focus();
  }
}

// ---- BOOKMARK CRUD OPERATIONS ----

/**
 * Shows modal to add a new bookmark
 */
function showAddBookmarkModal() {
  modalTitle.textContent = "Add Bookmark";
  bookmarkForm.reset();
  bookmarkIdInput.value = "";

  document.getElementById("modal-delete-btn").classList.add("hidden");

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      bookmarkUrlInput.value = tabs[0].url;
      bookmarkTitleInput.value = tabs[0].title;
    }
  });

  openModal("bookmark-modal");
}

/**
 * Shows modal to edit an existing bookmark
 * @param {Object} bookmark - The bookmark to edit
 */
function showEditBookmarkModal(bookmark) {
  modalTitle.textContent = "Edit Bookmark";
  bookmarkTitleInput.value = bookmark.title;
  bookmarkUrlInput.value = bookmark.url;
  bookmarkIdInput.value = bookmark.id;

  if (bookmark.tags && bookmark.tags.length) {
    bookmarkTagsInput.value = bookmark.tags.join(", ");
  } else {
    bookmarkTagsInput.value = "";
  }

  document.getElementById("modal-delete-btn").classList.remove("hidden");

  openModal("bookmark-modal");
}

/**
 * Handles bookmark form submission
 * @param {Event} e - The submit event
 */
function handleBookmarkSubmit(e) {
  e.preventDefault();

  const title = bookmarkTitleInput.value;
  const url = bookmarkUrlInput.value;
  const id = bookmarkIdInput.value;

  const tagInput = bookmarkTagsInput.value.trim();
  let tags = [];
  if (tagInput) {
    tags = tagInput
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag);
  }

  let finalTitle = title;
  if (tags.length > 0) {
    finalTitle = `${title} [${tags.join(", ")}]`;
  }

  if (id) {
    chrome.bookmarks.update(id, { title: finalTitle, url }, () => {
      if (chrome.runtime.lastError) {
        showToast(
          "Error",
          `Failed to update bookmark: ${chrome.runtime.lastError.message}`,
          "error"
        );
      } else {
        closeModal("bookmark-modal");
        showToast("Success", "Bookmark updated", "success");
        refreshBookmarks();
      }
    });
  } else {
    chrome.bookmarks.create(
      { parentId: currentFolderId, title: finalTitle, url },
      () => {
        if (chrome.runtime.lastError) {
          showToast(
            "Error",
            `Failed to create bookmark: ${chrome.runtime.lastError.message}`,
            "error"
          );
        } else {
          closeModal("bookmark-modal");
          showToast("Success", "Bookmark created", "success");
          refreshBookmarks();
        }
      }
    );
  }
}

/**
 * Deletes the current bookmark
 */
function deleteBookmark() {
  const id = bookmarkIdInput.value;

  if (!id) {
    closeModal("bookmark-modal");
    return;
  }

  if (confirm("Are you sure you want to delete this bookmark?")) {
    chrome.bookmarks.remove(id, () => {
      if (chrome.runtime.lastError) {
        showToast(
          "Error",
          `Failed to delete bookmark: ${chrome.runtime.lastError.message}`,
          "error"
        );
      } else {
        closeModal("bookmark-modal");
        showToast("Success", "Bookmark deleted", "success");
        refreshBookmarks();
      }
    });
  }
}

// ---- FOLDER CRUD OPERATIONS ----

/**
 * Shows modal to add a new folder
 */
function showAddFolderModal() {
  document.getElementById("folder-modal-title").textContent = "Add Folder";
  document.getElementById("folder-form").reset();
  document.getElementById("folder-id").value = "";

  document.getElementById("folder-modal-delete-btn").classList.add("hidden");

  openModal("folder-modal");
}

/**
 * Shows modal to edit an existing folder
 * @param {Object} folder - The folder to edit
 */
function showEditFolderModal(folder) {
  document.getElementById("folder-modal-title").textContent = "Edit Folder";
  document.getElementById("folder-name").value = folder.title;
  document.getElementById("folder-id").value = folder.id;

  document.getElementById("folder-modal-delete-btn").classList.remove("hidden");

  openModal("folder-modal");
}

/**
 * Handles folder form submission
 * @param {Event} e - The submit event
 */
function handleFolderSubmit(e) {
  e.preventDefault();

  const name = document.getElementById("folder-name").value;
  const id = document.getElementById("folder-id").value;

  if (id) {
    chrome.bookmarks.update(id, { title: name }, () => {
      if (chrome.runtime.lastError) {
        showToast(
          "Error",
          `Failed to update folder: ${chrome.runtime.lastError.message}`,
          "error"
        );
      } else {
        closeModal("folder-modal");
        showToast("Success", "Folder updated", "success");
        refreshBookmarks();
      }
    });
  } else {
    chrome.bookmarks.create({ parentId: currentFolderId, title: name }, () => {
      if (chrome.runtime.lastError) {
        showToast(
          "Error",
          `Failed to create folder: ${chrome.runtime.lastError.message}`,
          "error"
        );
      } else {
        closeModal("folder-modal");
        showToast("Success", "Folder created", "success");
        refreshBookmarks();
      }
    });
  }
}

/**
 * Delete folder after verifying it's empty
 */
function deleteFolder() {
  const id = document.getElementById("folder-id").value;

  if (!id) {
    closeModal("folder-modal");
    return;
  }

  chrome.bookmarks.getChildren(id, (children) => {
    if (chrome.runtime.lastError) {
      showToast(
        "Error",
        `Failed to check folder contents: ${chrome.runtime.lastError.message}`,
        "error"
      );
      return;
    }

    if (children && children.length > 0) {
      showToast(
        "Warning",
        "Cannot delete folder because it is not empty",
        "warning"
      );
      return;
    }

    if (confirm("Are you sure you want to delete this folder?")) {
      chrome.bookmarks.remove(id, () => {
        if (chrome.runtime.lastError) {
          showToast(
            "Error",
            `Failed to delete folder: ${chrome.runtime.lastError.message}`,
            "error"
          );
        } else {
          closeModal("folder-modal");
          showToast("Success", "Folder deleted", "success");
          refreshBookmarks();
        }
      });
    }
  });
}

// ---- SETTINGS OPERATIONS ----

/**
 * Shows settings modal
 */
function showSettingsModal() {
  openModal("settings-modal");
}

/**
 * Saves user settings
 * @param {Event} e - The submit event
 */
function saveSettings(e) {
  e.preventDefault();

  const settings = {
    darkMode: settingDarkMode.checked,
    globalSearch: settingGlobalSearch.checked,
    searchHistory: settingSearchHistory.checked,
  };

  chrome.storage.sync.set(settings, () => {
    closeModal("settings-modal");
    showToast("Success", "Settings saved", "success");

    isDarkMode = settings.darkMode;
    searchMode = settings.globalSearch ? "global" : "folder";

    document.documentElement.classList.toggle("dark", isDarkMode);
    updateSearchModeIndicator();
  });
}

/**
 * Resets all settings to default values
 */
function resetSettings() {
  if (confirm("Are you sure you want to reset all settings to default?")) {
    const defaultSettings = {
      darkMode: false,
      globalSearch: true,
      searchHistory: true,
      viewMode: "list",
    };

    chrome.storage.sync.set(defaultSettings, () => {
      settingDarkMode.checked = defaultSettings.darkMode;
      settingGlobalSearch.checked = defaultSettings.globalSearch;
      settingSearchHistory.checked = defaultSettings.searchHistory;

      isDarkMode = defaultSettings.darkMode;
      searchMode = defaultSettings.globalSearch ? "global" : "folder";
      viewMode = defaultSettings.viewMode;

      document.documentElement.classList.toggle("dark", isDarkMode);
      setViewMode(viewMode);
      updateSearchModeIndicator();

      showToast("Success", "Settings reset to default", "success");
    });
  }
}

// ---- EXPORT/IMPORT OPERATIONS ----

/**
 * Exports all bookmarks, folders, and tags to a JSON file
 */
function exportBookmarks() {
  const exportData = {
    bookmarks: allBookmarks,
    folders: allFolders,
    tags: Array.from(tags.entries()),
    version: "1.0",
    exportDate: new Date().toISOString(),
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `bookmarks_export_${
    new Date().toISOString().split("T")[0]
  }.json`;
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);

  showToast("Success", "Bookmarks exported", "success");
}

/**
 * Handles importing bookmarks from a JSON file
 */
function importBookmarks() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";

  input.addEventListener("change", (e) => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const importData = JSON.parse(event.target.result);

        if (!importData.bookmarks || !importData.folders) {
          throw new Error("Invalid import file format");
        }

        if (
          confirm(
            `Import ${importData.bookmarks.length} bookmarks and ${importData.folders.length} folders?`
          )
        ) {
          showToast(
            "Info",
            "Import functionality is not yet implemented",
            "info"
          );
        }
      } catch (error) {
        showToast(
          "Error",
          `Failed to parse import file: ${error.message}`,
          "error"
        );
      }
    };

    reader.readAsText(file);
  });

  input.click();
}

// ---- TAG OPERATIONS ----

/**
 * Renders tag collection in the UI
 */
function renderTags() {
  if (!tagsContainer) return;

  if (tags.size === 0) {
    tagsContainer.innerHTML = '<span class="tag">No tags yet</span>';
    return;
  }

  const sortedTags = Array.from(tags.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15); // Show top 15 tags

  tagsContainer.innerHTML = "";
  const tagsDiv = document.createElement("div");
  tagsDiv.className = "flex flex-wrap gap-1";

  sortedTags.forEach(([tag, count]) => {
    const tagSpan = document.createElement("span");
    tagSpan.className = "tag";
    tagSpan.innerHTML = `${tag} <span class="ml-1 text-gray-500 dark:text-gray-400">${count}</span>`;

    tagSpan.addEventListener("click", () => {
      searchInput.value = tag;
      handleSearch();
    });

    tagsDiv.appendChild(tagSpan);
  });

  tagsContainer.appendChild(tagsDiv);
}

// ---- UTILITY FUNCTIONS ----

/**
 * Open a modal
 * @param {string} modalId - ID of the modal to open
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("open");
    document.body.style.overflow = "hidden";

    // Add event listener for the close button
    const closeButtons = modal.querySelectorAll(".modal-close, .modal-cancel");
    closeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        closeModal(modalId);
      });
    });

    // Add event listener to close modal when clicking outside the content
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal(modalId);
      }
    });
  }
}

/**
 * Close a modal
 * @param {string} modalId - ID of the modal to close
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("open");
    document.body.style.overflow = "";
  }
}

/**
 * Filter bookmarks based on search term
 */
function filterBookmarks() {
  const searchTerm = searchInput.value.toLowerCase();

  if (!searchTerm) {
    loadFolderContents(currentFolderId);
    return;
  }

  handleSearch();
}

/**
 * Sort bookmarks based on selected property
 */
function sortBookmarks() {
  const bookmarks = [...allBookmarksInFolder];
  sortBookmarksByProperty(sortSelect.value, bookmarks);
  renderBookmarksList(bookmarks);
}

/**
 * Sort bookmarks by a specific property
 * @param {string} property - Property to sort by
 * @param {Array} bookmarks - Bookmarks array to sort
 * @returns {Array} Sorted bookmarks array
 */
function sortBookmarksByProperty(property, bookmarks) {
  bookmarks.sort((a, b) => {
    if (property === "dateAdded") {
      return b.dateAdded - a.dateAdded; // Newest first
    } else if (property === "visits") {
      const aVisits = getVisitCount(a.id);
      const bVisits = getVisitCount(b.id);
      return bVisits - aVisits; // Most visited first
    } else {
      const valueA = a[property].toLowerCase();
      const valueB = b[property].toLowerCase();
      return valueA.localeCompare(valueB);
    }
  });

  return bookmarks;
}

/**
 * Get visit count for a bookmark
 * @param {string} bookmarkId - Bookmark ID
 * @returns {number} Visit count
 */
function getVisitCount(bookmarkId) {
  return recentBookmarks.filter((b) => b.id === bookmarkId).length;
}

/**
 * Refresh all bookmarks data
 */
function refreshBookmarks() {
  chrome.bookmarks.getTree(function (bookmarkTreeNodes) {
    processEntireBookmarkTree(bookmarkTreeNodes);
    loadFolderContents(currentFolderId);
    updateStats();
    renderTags();
  });
}

/**
 * Debounce function for search input
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}
