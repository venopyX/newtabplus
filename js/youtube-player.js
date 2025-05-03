/**
 * YouTube Player functionality for NewTab+
 * Standalone window implementation
 */

const YouTubePlayer = (() => {
  const state = {
    currentVideoId: "",
    isPlaying: false,
    currentResultsList: [],
    playerReady: false,
    timeUpdateInterval: null,
    videoData: {},
    estimatedCurrentTime: 0,
    lastUpdateTime: 0,
    queue: [],
    favorites: [],
    playlists: [],
    activeTab: "search",
    activePlaylist: null,
    currentVideoIndex: -1,
    tempVideoId: null,
    tempPlaylistData: null,
    tabVisible: true,
    videoStartTime: 0,
    expectedEndTime: 0,
  };

  const dom = {};

  function initialize() {
    cacheDOMElements();
    setupEventListeners();
    setupPlayer();
    loadUserData();

    initTheme();

    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get("v");
    if (videoId) {
      fetchVideoInfo(videoId)
        .then((info) => {
          if (info) {
            state.videoData[videoId] = {
              title: info.title,
              thumbnail: info.thumbnailUrl,
              duration: convertDurationToSeconds(info.duration),
            };
            playVideo(videoId, info.title, info.thumbnailUrl);
          }
        })
        .catch((err) => {
          console.error("Error fetching initial video:", err);
        });
    }
  }

  /**
   * Initializes theme functionality
   */
  function initTheme() {
    chrome.storage.sync.get("theme", function (data) {
      const savedTheme = data.theme || "system";
      applyTheme(savedTheme);
    });

    chrome.storage.onChanged.addListener(function (changes) {
      if (changes.theme) {
        applyTheme(changes.theme.newValue);
      }
    });
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
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }

  function cacheDOMElements() {
    const elements = [
      // Base elements
      "yt-search-input",
      "yt-search-button",
      "yt-results-container",
      "yt-player-container",
      "yt-play-pause",
      "yt-current-time",
      "yt-duration",
      "yt-progress",
      "yt-now-playing-thumbnail",
      "yt-now-playing-title",
      "yt-loading",
      "yt-results-heading",
      "yt-no-results",
      "yt-error-message",
      "yt-volume-slider",
      "yt-volume-icon",

      // Tab navigation
      "tab-search",
      "tab-queue",
      "tab-favorites",
      "tab-playlists",

      "tab-content-search",
      "tab-content-queue",
      "tab-content-favorites",
      "tab-content-playlists",

      // Queue elements
      "yt-queue-container",
      "yt-queue-empty",
      "yt-queue-clear",
      "yt-queue-save",

      // Favorites elements
      "yt-favorites-container",
      "yt-favorites-empty",
      "yt-url-input",
      "yt-add-by-url",

      // Playlist elements
      "yt-playlists-list",
      "yt-playlists-empty",
      "yt-create-playlist",

      // Player controls
      "yt-prev",
      "yt-next",
      "yt-now-playing-favorite",
      "yt-now-playing-queue",
      "yt-now-playing-playlist",

      // Modals
      "yt-playlist-modal",
      "yt-playlist-modal-title",
      "playlist-name",
      "playlist-description",
      "playlist-tracks-container",
      "playlist-tracks-list",
      "yt-playlist-cancel",
      "yt-playlist-save",

      "yt-add-to-playlist-modal",
      "yt-no-playlists-message",
      "yt-playlists-for-selection",
      "yt-add-to-playlist-cancel",
      "yt-create-and-add",
    ];

    elements.forEach((id) => {
      dom[id] = document.getElementById(id);
    });
  }

  function setupEventListeners() {
    // Base event listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (dom["yt-search-button"]) {
      dom["yt-search-button"].addEventListener("click", performSearch);
    }

    if (dom["yt-search-input"]) {
      dom["yt-search-input"].addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          performSearch();
        }
      });
    }

    if (dom["yt-play-pause"]) {
      dom["yt-play-pause"].addEventListener("click", togglePlayPause);
    }

    if (dom["yt-progress"]) {
      dom["yt-progress"].addEventListener("input", handleProgressChange);
    }

    if (dom["yt-volume-slider"]) {
      dom["yt-volume-slider"].addEventListener("input", handleVolumeChange);
    }

    if (dom["yt-volume-icon"]) {
      dom["yt-volume-icon"].addEventListener("click", toggleMute);
    }

    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        switchTab(tab.dataset.tab);
      });
    });

    if (dom["yt-prev"]) {
      dom["yt-prev"].addEventListener("click", playPreviousTrack);
    }
    if (dom["yt-next"]) {
      dom["yt-next"].addEventListener("click", playNextTrack);
    }

    if (dom["yt-now-playing-favorite"]) {
      dom["yt-now-playing-favorite"].addEventListener(
        "click",
        toggleCurrentFavorite
      );
    }
    if (dom["yt-now-playing-queue"]) {
      dom["yt-now-playing-queue"].addEventListener("click", () =>
        addToQueue(state.currentVideoId)
      );
    }
    if (dom["yt-now-playing-playlist"]) {
      dom["yt-now-playing-playlist"].addEventListener("click", () =>
        showAddToPlaylistModal(state.currentVideoId)
      );
    }

    if (dom["yt-queue-clear"]) {
      dom["yt-queue-clear"].addEventListener("click", clearQueue);
    }
    if (dom["yt-queue-save"]) {
      dom["yt-queue-save"].addEventListener("click", () =>
        showPlaylistModal("queue")
      );
    }

    if (dom["yt-add-by-url"]) {
      dom["yt-add-by-url"].addEventListener("click", addByUrl);
    }
    if (dom["yt-url-input"]) {
      dom["yt-url-input"].addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          addByUrl();
        }
      });
    }

    if (dom["yt-create-playlist"]) {
      dom["yt-create-playlist"].addEventListener("click", () =>
        showPlaylistModal()
      );
    }

    document.querySelectorAll(".close-modal").forEach((btn) => {
      btn.addEventListener("click", closeAllModals);
    });

    if (dom["yt-playlist-cancel"]) {
      dom["yt-playlist-cancel"].addEventListener("click", closeAllModals);
    }
    if (dom["yt-playlist-save"]) {
      dom["yt-playlist-save"].addEventListener("click", savePlaylist);
    }

    if (dom["yt-add-to-playlist-cancel"]) {
      dom["yt-add-to-playlist-cancel"].addEventListener(
        "click",
        closeAllModals
      );
    }
    if (dom["yt-create-and-add"]) {
      dom["yt-create-and-add"].addEventListener("click", () => {
        closeAllModals();
        showPlaylistModal("new", state.tempVideoId);
      });
    }

    window.addEventListener("message", handleMessages);
    window.addEventListener("beforeunload", cleanup);

    // Add listener for system color scheme changes
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        chrome.storage.sync.get("theme", function (data) {
          if (data.theme === "system") {
            applyTheme("system");
          }
        });
      });
  }

  function switchTab(tabId) {
    if (!tabId) return;

    // Update active tab state
    state.activeTab = tabId;

    // Update tab buttons
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.classList.remove("active");
    });
    const activeTabBtn = document.getElementById(`tab-${tabId}`);
    if (activeTabBtn) activeTabBtn.classList.add("active");

    // Update tab content visibility
    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.remove("active");
    });
    const activeContent = document.getElementById(`tab-content-${tabId}`);
    if (activeContent) activeContent.classList.add("active");

    // Perform tab-specific actions
    switch (tabId) {
      case "queue":
        renderQueue();
        break;
      case "favorites":
        renderFavorites();
        break;
      case "playlists":
        renderPlaylists();
        break;
    }
  }

  /**
   * Renders the queue tab content
   */
  function renderQueue() {
    if (!dom["yt-queue-container"] || !dom["yt-queue-empty"]) return;

    if (state.queue.length === 0) {
      dom["yt-queue-empty"].style.display = "block";
      dom["yt-queue-container"].innerHTML = "";
      return;
    }

    dom["yt-queue-empty"].style.display = "none";
    dom["yt-queue-container"].innerHTML = "";

    state.queue.forEach((video, index) => {
      const resultItem = document.createElement("div");
      resultItem.className = "result-item";
      resultItem.dataset.videoId = video.id;
      resultItem.dataset.index = index;

      if (video.id === state.currentVideoId) {
        resultItem.classList.add("active");
      }

      resultItem.innerHTML = `
        <img class="thumbnail" src="${video.thumbnail}" alt="${video.title}">
        <div class="info">
          <div class="title">${video.title}</div>
          <div class="duration">${formatTime(video.duration)}</div>
        </div>
        <div class="item-actions">
          <button class="icon-button remove-from-queue" title="Remove from queue">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;

      // Add click event for playing the item
      resultItem.addEventListener("click", (e) => {
        if (!e.target.closest(".icon-button")) {
          playVideo(video.id, video.title, video.thumbnail, index);
          highlightResult(resultItem);
        }
      });

      // Add remove button functionality
      const removeBtn = resultItem.querySelector(".remove-from-queue");
      if (removeBtn) {
        removeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          removeFromQueue(index);
        });
      }

      dom["yt-queue-container"].appendChild(resultItem);
    });
  }

  function renderFavorites() {
    if (!dom["yt-favorites-container"] || !dom["yt-favorites-empty"]) return;

    if (state.favorites.length === 0) {
      dom["yt-favorites-empty"].style.display = "block";
      dom["yt-favorites-container"].innerHTML = "";
      return;
    }

    dom["yt-favorites-empty"].style.display = "none";
    dom["yt-favorites-container"].innerHTML = "";

    state.favorites.forEach((video, index) => {
      const resultItem = document.createElement("div");
      resultItem.className = "result-item";
      resultItem.dataset.videoId = video.id;
      resultItem.dataset.index = index;

      resultItem.innerHTML = `
        <img class="thumbnail" src="${video.thumbnail}" alt="${video.title}">
        <div class="info">
          <div class="title">${video.title}</div>
          <div class="duration">${formatTime(video.duration)}</div>
        </div>
        <div class="item-actions">
          <button class="icon-button add-to-queue" title="Add to queue">
            <i class="fas fa-list-ol"></i>
          </button>
          <button class="icon-button add-to-playlist" title="Add to playlist">
            <i class="fas fa-icons"></i>
          </button>
          <button class="icon-button remove-from-favorites" title="Remove from favorites">
            <i class="fas fa-star"></i>
          </button>
        </div>
      `;

      // Add click event for playing the item
      resultItem.addEventListener("click", (e) => {
        if (!e.target.closest(".icon-button")) {
          playVideo(video.id, video.title, video.thumbnail);
          highlightResult(resultItem);
        }
      });

      const queueBtn = resultItem.querySelector(".add-to-queue");
      if (queueBtn) {
        queueBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          addToQueue(video.id);
        });
      }

      const playlistBtn = resultItem.querySelector(".add-to-playlist");
      if (playlistBtn) {
        playlistBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          showAddToPlaylistModal(video.id);
        });
      }

      const removeBtn = resultItem.querySelector(".remove-from-favorites");
      if (removeBtn) {
        removeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          removeFromFavorites(video.id);
        });
      }

      dom["yt-favorites-container"].appendChild(resultItem);
    });
  }

  function renderPlaylists() {
    if (!dom["yt-playlists-list"] || !dom["yt-playlists-empty"]) return;

    if (state.playlists.length === 0) {
      dom["yt-playlists-empty"].style.display = "block";
      dom["yt-playlists-list"].innerHTML = "";
      return;
    }

    dom["yt-playlists-empty"].style.display = "none";
    dom["yt-playlists-list"].innerHTML = "";

    state.playlists.forEach((playlist, index) => {
      const playlistItem = document.createElement("div");
      playlistItem.className = "playlist-item";
      playlistItem.dataset.playlistId = playlist.id;

      const thumbnailSrc =
        playlist.tracks.length > 0
          ? playlist.tracks[0].thumbnail
          : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 34' fill='%23ddd'%3E%3Crect width='60' height='34'/%3E%3Cpath d='M30 17 L42 10 L42 24 L30 17 Z' fill='%23aaa'/%3E%3C/svg%3E";

      playlistItem.innerHTML = `
        <div class="playlist-cover">
          <img src="${thumbnailSrc}" alt="${playlist.name}">
        </div>
        <div class="playlist-info">
          <div class="playlist-title">${playlist.name}</div>
          <div class="playlist-meta">
            <span>${playlist.tracks.length} tracks</span>
            <span>·</span>
            <span>${formatDate(playlist.createdAt)}</span>
          </div>
        </div>
        <div class="playlist-actions">
          <button class="icon-button delete-playlist" title="Delete playlist">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;

      // Open playlist on click
      playlistItem.addEventListener("click", (e) => {
        if (!e.target.closest(".icon-button")) {
          openPlaylist(playlist.id);
        }
      });

      // Delete action
      const deleteBtn = playlistItem.querySelector(".delete-playlist");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          deletePlaylist(playlist.id);
        });
      }

      dom["yt-playlists-list"].appendChild(playlistItem);
    });
  }

  /**
   * Loads user data (favorites, playlists, etc.) from local storage
   */
  function loadUserData() {
    try {
      // Load favorites
      const savedFavorites = localStorage.getItem("yt-favorites");
      if (savedFavorites) {
        state.favorites = JSON.parse(savedFavorites);
      }

      // Load playlists
      const savedPlaylists = localStorage.getItem("yt-playlists");
      if (savedPlaylists) {
        state.playlists = JSON.parse(savedPlaylists);
      }

      // Load queue
      const savedQueue = localStorage.getItem("yt-queue");
      if (savedQueue) {
        state.queue = JSON.parse(savedQueue);
      }
    } catch (e) {
      console.error("Error loading YouTube player data:", e);
    }
  }

  function saveUserData(dataType = "all") {
    try {
      if (dataType === "all" || dataType === "favorites") {
        localStorage.setItem("yt-favorites", JSON.stringify(state.favorites));
      }
      if (dataType === "all" || dataType === "playlists") {
        localStorage.setItem("yt-playlists", JSON.stringify(state.playlists));
      }
      if (dataType === "all" || dataType === "queue") {
        localStorage.setItem("yt-queue", JSON.stringify(state.queue));
      }
    } catch (e) {
      console.error("Error saving YouTube player data:", e);
    }
  }

  function addToFavorites(videoId) {
    // Check if already exists
    if (state.favorites.some((item) => item.id === videoId)) {
      showNotification("Already in favorites");
      return;
    }

    const videoData = state.videoData[videoId];
    if (!videoData) {
      console.error("No video data for ID:", videoId);
      return;
    }

    state.favorites.unshift({
      id: videoId,
      title: videoData.title,
      thumbnail: videoData.thumbnail,
      duration: videoData.duration,
      addedAt: Date.now(),
    });

    saveUserData("favorites");
    renderFavorites();
    updateFavoriteButtonState();
    showNotification("Added to favorites");
  }

  function removeFromFavorites(videoId) {
    const index = state.favorites.findIndex((item) => item.id === videoId);
    if (index !== -1) {
      state.favorites.splice(index, 1);
      saveUserData("favorites");
      renderFavorites();
      updateFavoriteButtonState();
      showNotification("Removed from favorites");
    }
  }

  function toggleCurrentFavorite() {
    if (!state.currentVideoId) return;

    if (isInFavorites(state.currentVideoId)) {
      removeFromFavorites(state.currentVideoId);
    } else {
      addToFavorites(state.currentVideoId);
    }
  }

  function isInFavorites(videoId) {
    return state.favorites.some((item) => item.id === videoId);
  }

  /**
   * Updates the favorite button state based on current video
   */
  function updateFavoriteButtonState() {
    if (!dom["yt-now-playing-favorite"]) return;

    const isFavorite = isInFavorites(state.currentVideoId);
    const iconElement = dom["yt-now-playing-favorite"].querySelector("i");

    if (iconElement) {
      if (isFavorite) {
        iconElement.className = "fas fa-star";
        dom["yt-now-playing-favorite"].classList.add("active");
      } else {
        iconElement.className = "far fa-star";
        dom["yt-now-playing-favorite"].classList.remove("active");
      }
    }
  }

  /**
   * Adds a video to the queue
   * @param {string} videoId - YouTube video ID
   * @param {boolean} [playNow=false] - Whether to play the video immediately
   */
  function addToQueue(videoId, playNow = false) {
    // Check for duplicates
    if (state.queue.some((item) => item.id === videoId)) {
      showNotification("Already in queue");
      return;
    }

    const videoData = state.videoData[videoId];
    if (!videoData) {
      console.error("No video data for ID:", videoId);
      return;
    }

    const queueItem = {
      id: videoId,
      title: videoData.title,
      thumbnail: videoData.thumbnail,
      duration: videoData.duration,
      addedAt: Date.now(),
    };

    state.queue.push(queueItem);
    saveUserData("queue");

    if (playNow) {
      playVideo(
        videoId,
        videoData.title,
        videoData.thumbnail,
        state.queue.length - 1
      );
    }

    renderQueue();
    showNotification("Added to queue");
  }

  /**
   * Removes a video from the queue
   * @param {number} index - Index of the video in the queue
   */
  function removeFromQueue(index) {
    if (index >= 0 && index < state.queue.length) {
      // Check if we're removing currently playing item
      const isCurrentlyPlaying = state.currentVideoIndex === index;

      // Remove the item
      state.queue.splice(index, 1);
      saveUserData("queue");

      // Update current index if needed
      if (state.currentVideoIndex >= index) {
        state.currentVideoIndex = isCurrentlyPlaying
          ? -1
          : state.currentVideoIndex - 1;
      }

      renderQueue();
      showNotification("Removed from queue");
    }
  }

  /**
   * Clears the entire queue
   */
  function clearQueue() {
    if (state.queue.length === 0) return;

    state.queue = [];
    state.currentVideoIndex = -1;
    saveUserData("queue");
    renderQueue();
    showNotification("Queue cleared");
  }

  /**
   * Shows the playlist creation/edit modal
   * @param {string} [source="new"] - Source of the operation: "new", "edit", or "queue"
   * @param {string} [videoId=null] - Optional video ID to add to the new playlist
   */
  function showPlaylistModal(source = "new", videoId = null) {
    if (!dom["yt-playlist-modal"]) return;

    const isQueue = source === "queue";
    const playlistTracks = [];

    // Reset modal fields
    if (dom["playlist-name"]) dom["playlist-name"].value = "";
    if (dom["playlist-description"]) dom["playlist-description"].value = "";

    if (dom["yt-playlist-modal-title"]) {
      dom["yt-playlist-modal-title"].textContent = isQueue
        ? "Save Queue as Playlist"
        : "Create New Playlist";
    }

    // If source is queue, use queue items
    if (isQueue && state.queue.length > 0) {
      state.queue.forEach((item) => playlistTracks.push(item));

      // Display tracks in the modal
      if (dom["playlist-tracks-container"])
        dom["playlist-tracks-container"].classList.remove("hidden");
      if (dom["playlist-tracks-list"]) {
        dom["playlist-tracks-list"].innerHTML = "";

        let tracksList = "";
        playlistTracks.forEach((track, idx) => {
          tracksList += `<div class="playlist-track-item">
            ${idx + 1}. ${track.title}
          </div>`;
        });

        dom["playlist-tracks-list"].innerHTML = tracksList;
      }
    } else {
      // Not showing queue tracks
      if (dom["playlist-tracks-container"])
        dom["playlist-tracks-container"].classList.add("hidden");
    }

    // Store data for later use when saving
    state.tempPlaylistData = {
      source,
      videoId,
      tracks: playlistTracks,
    };

    // Show modal
    dom["yt-playlist-modal"].classList.add("active");
  }

  /**
   * Shows the "Add to Playlist" modal for a video
   * @param {string} videoId - YouTube video ID to add to a playlist
   */
  function showAddToPlaylistModal(videoId) {
    if (!dom["yt-add-to-playlist-modal"]) return;

    state.tempVideoId = videoId;

    // Check if we have any playlists
    if (state.playlists.length === 0) {
      if (dom["yt-no-playlists-message"])
        dom["yt-no-playlists-message"].classList.remove("hidden");
      if (dom["yt-playlists-for-selection"])
        dom["yt-playlists-for-selection"].innerHTML = "";
    } else {
      if (dom["yt-no-playlists-message"])
        dom["yt-no-playlists-message"].classList.add("hidden");
      if (dom["yt-playlists-for-selection"]) {
        dom["yt-playlists-for-selection"].innerHTML = "";

        // Create playlist selection items
        state.playlists.forEach((playlist) => {
          const item = document.createElement("div");
          item.className = "playlist-select-item";
          item.dataset.playlistId = playlist.id;

          item.innerHTML = `
            <div class="playlist-select-icon">
              <i class="fas fa-music"></i>
            </div>
            <div class="playlist-select-info">
              <div class="playlist-select-title">${playlist.name}</div>
              <div class="playlist-select-details">${playlist.tracks.length} tracks</div>
            </div>
          `;

          item.addEventListener("click", () => {
            addToExistingPlaylist(playlist.id, videoId);
          });

          dom["yt-playlists-for-selection"].appendChild(item);
        });
      }
    }

    // Show modal
    dom["yt-add-to-playlist-modal"].classList.add("active");
  }

  /**
   * Closes all modals
   */
  function closeAllModals() {
    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
      overlay.classList.remove("active");
    });
  }

  /**
   * Saves a playlist from the modal
   */
  function savePlaylist() {
    if (!dom["playlist-name"] || !dom["playlist-name"].value.trim()) {
      showNotification("Please enter a playlist name", "error");
      return;
    }

    const playlistName = dom["playlist-name"].value.trim();
    const description = dom["playlist-description"]
      ? dom["playlist-description"].value.trim()
      : "";
    const playlistId = `playlist_${Date.now()}`;

    const newPlaylist = {
      id: playlistId,
      name: playlistName,
      description: description,
      createdAt: Date.now(),
      tracks: [],
    };

    // Add tracks based on the source
    if (state.tempPlaylistData) {
      // Add tracks from queue if saving queue
      if (state.tempPlaylistData.source === "queue") {
        newPlaylist.tracks = [...state.tempPlaylistData.tracks];
      }

      // Add single video if provided
      if (state.tempPlaylistData.videoId) {
        const videoId = state.tempPlaylistData.videoId;
        const videoData = state.videoData[videoId];

        if (videoData) {
          newPlaylist.tracks.push({
            id: videoId,
            title: videoData.title,
            thumbnail: videoData.thumbnail,
            duration: videoData.duration,
            addedAt: Date.now(),
          });
        }
      }
    }

    // Add playlist to state
    state.playlists.push(newPlaylist);
    saveUserData("playlists");
    renderPlaylists();

    // Close modal
    closeAllModals();
    showNotification("Playlist created successfully");

    // Switch to playlists tab
    switchTab("playlists");
  }

  /**
   * Adds a video to an existing playlist
   * @param {string} playlistId - ID of the playlist to add to
   * @param {string} videoId - YouTube video ID to add
   */
  function addToExistingPlaylist(playlistId, videoId) {
    const playlistIndex = state.playlists.findIndex((p) => p.id === playlistId);
    if (playlistIndex === -1) return;

    const videoData = state.videoData[videoId];
    if (!videoData) {
      console.error("No video data for ID:", videoId);
      return;
    }

    // Check if video is already in playlist
    if (
      state.playlists[playlistIndex].tracks.some(
        (track) => track.id === videoId
      )
    ) {
      showNotification("Video already in playlist");
      closeAllModals();
      return;
    }

    // Add to playlist
    state.playlists[playlistIndex].tracks.push({
      id: videoId,
      title: videoData.title,
      thumbnail: videoData.thumbnail,
      duration: videoData.duration,
      addedAt: Date.now(),
    });

    saveUserData("playlists");
    closeAllModals();
    showNotification("Added to playlist");
  }

  /**
   * Deletes a playlist
   * @param {string} playlistId - ID of the playlist to delete
   */
  function deletePlaylist(playlistId) {
    const index = state.playlists.findIndex((p) => p.id === playlistId);
    if (index !== -1) {
      // If this was the active playlist, clear it
      if (state.activePlaylist === playlistId) {
        state.activePlaylist = null;
      }

      state.playlists.splice(index, 1);
      saveUserData("playlists");
      renderPlaylists();
      showNotification("Playlist deleted");
    }
  }

  /**
   * Opens a playlist for viewing/playing
   * @param {string} playlistId - ID of the playlist to open
   */
  function openPlaylist(playlistId) {
    const playlist = state.playlists.find((p) => p.id === playlistId);
    if (!playlist) return;

    // Update state
    state.activePlaylist = playlistId;

    // Clear the search results container and repurpose it for playlist view
    if (dom["tab-content-search"] && dom["yt-results-container"]) {
      // Switch to search tab since we're using its container
      switchTab("search");

      // Hide search elements
      if (dom["yt-search-container"])
        dom["yt-search-container"].classList.add("hidden");
      if (dom["yt-results-heading"])
        dom["yt-results-heading"].classList.add("hidden");
      if (dom["yt-no-results"]) dom["yt-no-results"].classList.add("hidden");

      // Ensure results container is visible
      if (dom["yt-results-container"])
        dom["yt-results-container"].style.display = "block";

      // Create playlist header
      const header = document.createElement("div");
      header.className = "playlist-header";
      header.innerHTML = `
        <div class="playlist-header-info">
          <h2>${playlist.name}</h2>
          <p>${playlist.tracks.length} tracks</p>
          ${
            playlist.description
              ? `<p class="playlist-description">${playlist.description}</p>`
              : ""
          }
        </div>
        <div class="playlist-header-actions">
          <button id="yt-back-to-playlists" class="action-button">
            <i class="fas fa-arrow-left"></i> Back
          </button>
          <button id="yt-play-playlist" class="action-button">
            <i class="fas fa-play"></i> Play All
          </button>
        </div>
      `;

      // Add before results container
      dom["tab-content-search"].insertBefore(
        header,
        dom["yt-results-container"]
      );

      // Add back button functionality
      const backBtn = document.getElementById("yt-back-to-playlists");
      if (backBtn) {
        backBtn.addEventListener("click", () => {
          // Remove playlist header
          if (header && header.parentNode) {
            header.parentNode.removeChild(header);
          }

          // Show search elements again
          if (dom["yt-search-container"])
            dom["yt-search-container"].classList.remove("hidden");
          if (dom["yt-results-heading"])
            dom["yt-results-heading"].classList.remove("hidden");

          // Switch to playlists tab
          switchTab("playlists");
        });
      }

      // Add play all button functionality
      const playBtn = document.getElementById("yt-play-playlist");
      if (playBtn) {
        playBtn.addEventListener("click", () => {
          if (playlist.tracks.length > 0) {
            // Clear queue and add playlist items
            state.queue = [...playlist.tracks];
            saveUserData("queue");

            // Play first track
            const firstTrack = playlist.tracks[0];
            playVideo(firstTrack.id, firstTrack.title, firstTrack.thumbnail, 0);

            // Show notification
            showNotification("Playing playlist");
          }
        });
      }

      // Render playlist tracks
      dom["yt-results-container"].innerHTML = "";

      if (playlist.tracks.length === 0) {
        dom["yt-results-container"].innerHTML = `
          <div class="empty-list-message">This playlist has no tracks yet</div>
        `;
      } else {
        playlist.tracks.forEach((track, index) => {
          // Create track elements
          const trackElement = document.createElement("div");
          trackElement.className = "result-item";
          trackElement.dataset.videoId = track.id;
          trackElement.dataset.index = index;

          trackElement.innerHTML = `
            <img class="thumbnail" src="${track.thumbnail}" alt="${
            track.title
          }">
            <div class="info">
              <div class="title">${track.title}</div>
              <div class="duration">${formatTime(track.duration)}</div>
            </div>
            <div class="item-actions">
              <button class="icon-button remove-from-playlist" title="Remove from playlist">
                <i class="fas fa-times"></i>
              </button>
            </div>
          `;

          // Play on click
          trackElement.addEventListener("click", (e) => {
            if (!e.target.closest(".icon-button")) {
              // Add all playlist tracks to queue
              state.queue = [...playlist.tracks];
              saveUserData("queue");

              // Play the clicked track
              playVideo(track.id, track.title, track.thumbnail, index);
            }
          });

          // Remove button functionality
          const removeBtn = trackElement.querySelector(".remove-from-playlist");
          if (removeBtn) {
            removeBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              removeFromPlaylist(playlistId, track.id);
            });
          }

          dom["yt-results-container"].appendChild(trackElement);
        });
      }
    }
  }

  /**
   * Removes a track from a playlist
   * @param {string} playlistId - ID of the playlist
   * @param {string} videoId - ID of the video to remove
   */
  function removeFromPlaylist(playlistId, videoId) {
    const playlistIndex = state.playlists.findIndex((p) => p.id === playlistId);
    if (playlistIndex === -1) return;

    const trackIndex = state.playlists[playlistIndex].tracks.findIndex(
      (t) => t.id === videoId
    );
    if (trackIndex === -1) return;

    // Remove the track
    state.playlists[playlistIndex].tracks.splice(trackIndex, 1);
    saveUserData("playlists");

    // Update the display
    openPlaylist(playlistId);
    showNotification("Track removed from playlist");
  }

  /**
   * Add a video by URL input
   */
  function addByUrl() {
    if (!dom["yt-url-input"]) return;

    const url = dom["yt-url-input"].value.trim();
    if (!url) {
      showNotification("Please enter a YouTube URL", "error");
      return;
    }

    // Extract video ID from URL
    const videoId = extractYouTubeId(url);
    if (!videoId) {
      showNotification("Invalid YouTube URL", "error");
      return;
    }

    // Show loading
    showLoading(true);

    // Fetch video info
    fetchVideoInfo(videoId)
      .then((info) => {
        if (info) {
          // Add to favorites
          state.videoData[videoId] = {
            title: info.title,
            thumbnail: info.thumbnailUrl,
            duration: convertDurationToSeconds(info.duration),
          };

          addToFavorites(videoId);
          dom["yt-url-input"].value = "";
        } else {
          showNotification("Could not fetch video information", "error");
        }
      })
      .catch((err) => {
        console.error("Error fetching video info:", err);
        showNotification("Error fetching video information", "error");
      })
      .finally(() => {
        showLoading(false);
      });
  }

  /**
   * Fetches information about a YouTube video
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} - Video information object
   */
  async function fetchVideoInfo(videoId) {
    try {
      const response = await fetch(
        `https://yt-me-venopyx.vercel.app/api/video?id=${videoId}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch video info");
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching video info:", error);
      throw error;
    }
  }

  /**
   * Extracts YouTube video ID from various YouTube URL formats
   * @param {string} url - YouTube URL
   * @returns {string|null} - Video ID or null if not found
   */
  function extractYouTubeId(url) {
    // Regular formats: youtu.be/ID or youtube.com/watch?v=ID
    const regExp =
      /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[7].length === 11 ? match[7] : null;
  }

  /**
   * Formats a date for display
   * @param {number} timestamp - Timestamp in milliseconds
   * @returns {string} - Formatted date string
   */
  function formatDate(timestamp) {
    if (!timestamp) return "";

    const date = new Date(timestamp);
    return date.toLocaleDateString();
  }

  /**
   * Shows a notification to the user
   * @param {string} message - Notification message
   * @param {string} [type="success"] - Notification type: "success" or "error"
   */
  function showNotification(message, type = "success") {
    // Create notification element if it doesn't exist
    let notification = document.getElementById("yt-notification");
    if (!notification) {
      notification = document.createElement("div");
      notification.id = "yt-notification";
      notification.className = "notification";
      document.body.appendChild(notification);

      // Add CSS if not already added
      const existingStyle = document.getElementById("yt-notification-style");
      if (!existingStyle) {
        const style = document.createElement("style");
        style.id = "yt-notification-style";
        style.textContent = `
          .notification {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 20px;
            border-radius: 4px;
            color: white;
            font-size: 14px;
            z-index: 2000;
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.3s ease;
          }
          
          .notification.show {
            opacity: 1;
            transform: translateY(0);
          }
          
          .notification.success {
            background-color: var(--priority-normal, #4caf50);
          }
          
          .notification.error {
            background-color: var(--priority-high, #f44336);
          }
        `;
        document.head.appendChild(style);
      }
    }

    // Update notification content and show it
    notification.textContent = message;
    notification.className = `notification ${type}`;

    // Show the notification
    setTimeout(() => {
      notification.classList.add("show");

      // Auto hide after 3 seconds
      setTimeout(() => {
        notification.classList.remove("show");
      }, 3000);
    }, 10);
  }

  /**
   * Sets up YouTube player with CSP-compatible approach
   */
  function setupPlayer() {
    const playerContainer = document.createElement("div");
    playerContainer.id = "youtube-player-container";
    playerContainer.style.display = "none";
    document.body.appendChild(playerContainer);

    const iframe = document.createElement("iframe");
    iframe.id = "youtube-player-iframe";
    iframe.width = "1";
    iframe.height = "1";
    iframe.style.visibility = "hidden";
    iframe.style.position = "absolute";
    iframe.style.top = "-9999px";
    iframe.style.left = "-9999px";
    iframe.allow = "autoplay";
    iframe.src = "about:blank"; // Start with blank page

    playerContainer.appendChild(iframe);
    state.playerReady = true;

    // Add message listener for player events
    window.addEventListener("message", (event) => {
      if (!event.data || typeof event.data !== "string") return;

      try {
        const data = JSON.parse(event.data);

        // Handle player ready event
        if (data.event === "onReady") {
          console.log("Player ready");
          requestVideoData(); // Request duration immediately
        }

        // Handle state changes
        if (data.event === "onStateChange") {
          handlePlayerStateChange(data.info);
        }

        // Handle info delivery (duration, current time)
        if (data.event === "infoDelivery") {
          if (data.info) {
            if (data.info.duration) {
              const duration = Math.floor(data.info.duration);
              if (state.currentVideoId && duration > 0) {
                state.videoData[state.currentVideoId].duration = duration;
                updateTimeDisplay(state.estimatedCurrentTime, duration);
                setupDurationCheck(duration);
              }
            }
            if (data.info.currentTime !== undefined) {
              state.estimatedCurrentTime = data.info.currentTime;
              state.lastUpdateTime = Date.now() / 1000;
              updateTimeDisplay(
                data.info.currentTime,
                state.videoData[state.currentVideoId]?.duration
              );
            }
          }
        }
      } catch (e) {
        console.error("Error processing player message:", e);
      }
    });
  }

  /**
   * Handles messages from the YouTube iframe
   * @param {MessageEvent} event - Message event containing data from YouTube iframe
   */
  function handleMessages(event) {
    const trustedOrigins = ["https://www.youtube.com", "https://youtube.com"];
    if (!trustedOrigins.includes(event.origin)) {
      console.warn("Untrusted message origin:", event.origin);
      return;
    }

    if (!event.data || typeof event.data !== "string") {
      return;
    }

    try {
      const data = JSON.parse(event.data);

      if (data.event === "onStateChange") {
        handlePlayerStateChange(data.info);
      } else if (data.event === "infoDelivery") {
        if (data.info && data.info.currentTime !== undefined) {
          state.estimatedCurrentTime = data.info.currentTime;
          state.lastUpdateTime = Date.now() / 1000;
          updateTimeDisplay(data.info.currentTime, data.info.duration);
        }
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }

  /**
   * Performs YouTube search with the current search input value
   */
  async function performSearch() {
    if (!dom["yt-search-input"]) {
      return;
    }

    const query = dom["yt-search-input"].value.trim();
    if (query === "") {
      return;
    }

    showLoading(true);
    hideError();

    try {
      const response = await fetch(
        `https://yt-me-venopyx.vercel.app/api/search?q=${encodeURIComponent(
          query
        )}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to search for videos");
      }

      displayResults(data.results);
    } catch (error) {
      console.error("Search error:", error);
      showError(`Error searching for "${query}": ${error.message}`);
      hideResults();
    } finally {
      showLoading(false);
    }
  }

  /**
   * Displays YouTube search results
   * @param {Array} results - Array of video results
   */
  function displayResults(results) {
    if (
      !dom["yt-results-container"] ||
      !dom["yt-results-heading"] ||
      !dom["yt-no-results"]
    ) {
      return;
    }

    state.currentResultsList = results;

    if (!results || results.length === 0) {
      showNoResults();
      return;
    }

    dom["yt-results-container"].innerHTML = "";
    results.forEach((video, index) => {
      state.videoData[video.id] = {
        duration: convertDurationToSeconds(video.duration),
        title: video.title,
        thumbnail: video.thumbnailUrl,
      };

      const resultItem = document.createElement("div");
      resultItem.className = "result-item";
      resultItem.dataset.videoId = video.id;
      resultItem.dataset.index = index;

      resultItem.innerHTML = `
        <img class="thumbnail" src="${video.thumbnailUrl}" alt="${video.title}">
        <div class="info">
          <div class="title">${video.title}</div>
          <div class="channel">${video.channelName}</div>
          <div class="meta">
            <span class="duration">${video.duration}</span>
            <span class="views">${formatViews(video.views)} views</span>
          </div>
        </div>
        <div class="item-actions">
          <button class="icon-button favorite-btn" title="Add to favorites">
            <i class="${isInFavorites(video.id) ? "fas" : "far"} fa-star"></i>
          </button>
          <button class="icon-button queue-btn" title="Add to queue">
            <i class="fas fa-list-ol"></i>
          </button>
          <button class="icon-button playlist-btn" title="Add to playlist">
            <i class="fas fa-icons"></i>
          </button>
        </div>
      `;

      // Play on click (but not when clicking buttons)
      resultItem.addEventListener("click", (e) => {
        if (!e.target.closest(".icon-button")) {
          playVideo(video.id, video.title, video.thumbnail);
          highlightResult(resultItem);
        }
      });

      // Add action button event listeners
      const favoriteBtn = resultItem.querySelector(".favorite-btn");
      if (favoriteBtn) {
        favoriteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (isInFavorites(video.id)) {
            removeFromFavorites(video.id);
            favoriteBtn.querySelector("i").className = "far fa-star";
          } else {
            addToFavorites(video.id);
            favoriteBtn.querySelector("i").className = "fas fa-star";
          }
        });
      }

      const queueBtn = resultItem.querySelector(".queue-btn");
      if (queueBtn) {
        queueBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          addToQueue(video.id);
        });
      }

      const playlistBtn = resultItem.querySelector(".playlist-btn");
      if (playlistBtn) {
        playlistBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          showAddToPlaylistModal(video.id);
        });
      }

      dom["yt-results-container"].appendChild(resultItem);
    });

    showResults();
  }

  /**
   * Converts duration string to seconds
   * @param {string} durationStr - Duration in format "MM:SS" or "HH:MM:SS"
   * @returns {number} - Duration in seconds
   */
  function convertDurationToSeconds(durationStr) {
    if (!durationStr) {
      return 0;
    }

    const parts = durationStr.split(":");
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else if (parts.length === 3) {
      return (
        parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2])
      );
    }
    return 0;
  }

  /**
   * Formats view count with appropriate suffixes
   * @param {number} views - Number of views
   * @returns {string} - Formatted view count
   */
  function formatViews(views) {
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`;
    } else if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`;
    }
    return views;
  }

  /**
   * Plays a YouTube video
   * @param {string} videoId - YouTube video ID
   * @param {string} title - Video title
   * @param {string} thumbnail - Video thumbnail URL
   * @param {number} [index] - Optional index in the current queue or playlist
   */
  function playVideo(videoId, title, thumbnail, index) {
    // Skip if already playing this video
    if (state.currentVideoId === videoId && state.isPlaying) {
      pauseAudio();
      return;
    } else if (state.currentVideoId === videoId && !state.isPlaying) {
      playAudio();
      return;
    }

    // Reset state
    state.estimatedCurrentTime = 0;
    state.lastUpdateTime = Date.now() / 1000;
    state.currentVideoIndex = index !== undefined ? index : -1;
    state.currentVideoId = videoId;

    // Clear all intervals
    if (state.timeUpdateInterval) clearInterval(state.timeUpdateInterval);
    if (state.durationCheckInterval) clearInterval(state.durationCheckInterval);
    stopBackgroundPlaybackTracking();

    // Update UI
    if (dom["yt-now-playing-title"])
      dom["yt-now-playing-title"].textContent = title;
    if (dom["yt-now-playing-thumbnail"]) {
      if (thumbnail && thumbnail.startsWith("http")) {
        dom["yt-now-playing-thumbnail"].src = thumbnail;
      } else {
        dom[
          "yt-now-playing-thumbnail"
        ].src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      }
      dom["yt-now-playing-thumbnail"].onerror = function () {
        this.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        this.onerror = function () {
          this.src =
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 34' fill='%23ddd'%3E%3Crect width='60' height='34'/%3E%3Cpath d='M30 17 L42 10 L42 24 L30 17 Z' fill='%23aaa'/%3E%3C/svg%3E";
        };
      };
    }

    // Set up video with duration
    const duration = state.videoData[videoId]?.duration || 0;
    updateTimeDisplay(0, duration);

    const iframe = document.getElementById("youtube-player-iframe");
    if (iframe) {
      iframe.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&controls=0&disablekb=1&modestbranding=1&fs=0&rel=0&origin=${encodeURIComponent(
        window.location.origin
      )}`;

      setTimeout(() => {
        state.timeUpdateInterval = setInterval(updateProgressWithEstimate, 250);
        requestVideoData();
        if (duration > 0) setupDurationCheck(duration);
      }, 1000);
    }

    state.isPlaying = true;
    updatePlayPauseButton();
    updateFavoriteButtonState();

    if (dom["yt-player-container"]) {
      dom["yt-player-container"].style.display = "flex";
    }
  }

  /**
   * Updates progress using time estimation between YouTube API updates
   */
  function updateProgressWithEstimate() {
    if (!state.isPlaying) return;

    const currentRealTime = Date.now() / 1000;
    const elapsedSinceUpdate = currentRealTime - state.lastUpdateTime;
    const currentEstimatedTime =
      state.estimatedCurrentTime + elapsedSinceUpdate;

    // Get duration from video data or request it if not available
    const duration = state.videoData[state.currentVideoId]?.duration;

    if (duration && currentEstimatedTime >= duration - 1) {
      if (state.timeUpdateInterval) {
        clearInterval(state.timeUpdateInterval);
        state.timeUpdateInterval = null;
      }
      handlePlayerStateChange(0);
      return;
    }

    updateTimeDisplay(currentEstimatedTime, duration);
    requestVideoData();
  }

  /**
   * Requests duration and current time from YouTube iframe
   */
  function requestVideoData() {
    const iframe = document.getElementById("youtube-player-iframe");
    if (!iframe || !iframe.contentWindow) return;

    try {
      // Request duration
      iframe.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func: "getDuration",
          args: [],
        }),
        "*"
      );

      // Request current time
      iframe.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func: "getCurrentTime",
          args: [],
        }),
        "*"
      );
    } catch (e) {
      console.error("Error requesting video data:", e);
    }
  }

  /**
   * Updates time display with current time and duration
   * @param {number} currentTime - Current playback position in seconds
   * @param {number} duration - Total video duration in seconds
   */
  function updateTimeDisplay(currentTime, duration) {
    if (!dom["yt-current-time"] || !dom["yt-duration"] || !dom["yt-progress"]) {
      return;
    }

    if (!duration && state.videoData[state.currentVideoId]) {
      duration = state.videoData[state.currentVideoId].duration;
    }

    dom["yt-current-time"].textContent = formatTime(currentTime);

    if (duration) {
      dom["yt-duration"].textContent = formatTime(duration);
    }

    if (
      duration &&
      !dom["yt-progress"].getAttribute("dragging") &&
      duration > 0
    ) {
      dom["yt-progress"].value = Math.min((currentTime / duration) * 100, 100);
    }
  }

  /**
   * Sets up duration checking for video end detection
   * @param {number} duration - Video duration in seconds
   */
  function setupDurationCheck(duration) {
    if (state.durationCheckInterval) {
      clearInterval(state.durationCheckInterval);
    }

    state.durationCheckInterval = setInterval(() => {
      if (!state.isPlaying) {
        clearInterval(state.durationCheckInterval);
        return;
      }

      const currentTime = state.estimatedCurrentTime;

      if (duration > 0 && currentTime >= duration - 1) {
        // Check 1 second before end
        clearInterval(state.durationCheckInterval);
        handlePlayerStateChange(0); // Trigger ended state
      }
    }, 1000);
  }

  /**
   * Handles YouTube player state changes
   * @param {number} playerState - Player state code
   */
  function handlePlayerStateChange(playerState) {
    switch (playerState) {
      case -1: // Unstarted
        state.isPlaying = false;
        updatePlayPauseButton();
        break;

      case 0: // Ended
        state.isPlaying = false;
        updatePlayPauseButton();

        // Clear time update interval
        if (state.timeUpdateInterval) {
          clearInterval(state.timeUpdateInterval);
          state.timeUpdateInterval = null;
        }

        if (state.durationCheckInterval) {
          clearInterval(state.durationCheckInterval);
          state.durationCheckInterval = null;
        }

        // Important: Add slight delay before playing next track
        setTimeout(() => {
          // Play next track based on current context
          if (state.currentVideoIndex !== -1) {
            // We're in a queue or playlist
            playNextTrack();
          } else if (state.activePlaylist) {
            // We're in a playlist view but not in queue
            const playlist = state.playlists.find(
              (p) => p.id === state.activePlaylist
            );
            if (playlist) {
              const currentIndex = playlist.tracks.findIndex(
                (track) => track.id === state.currentVideoId
              );
              if (
                currentIndex !== -1 &&
                currentIndex < playlist.tracks.length - 1
              ) {
                const nextTrack = playlist.tracks[currentIndex + 1];
                playVideo(
                  nextTrack.id,
                  nextTrack.title,
                  nextTrack.thumbnail,
                  currentIndex + 1
                );
              }
            }
          } else if (state.currentResultsList.length > 0) {
            // We're in search results
            const currentIndex = state.currentResultsList.findIndex(
              (video) => video.id === state.currentVideoId
            );
            if (
              currentIndex !== -1 &&
              currentIndex < state.currentResultsList.length - 1
            ) {
              const nextVideo = state.currentResultsList[currentIndex + 1];
              playVideo(nextVideo.id, nextVideo.title, nextVideo.thumbnailUrl);
            }
          }
        }, 1000);
        break;

      case 1: // Playing
        state.isPlaying = true;
        updatePlayPauseButton();

        // Reset time update interval
        if (state.timeUpdateInterval) {
          clearInterval(state.timeUpdateInterval);
        }
        state.timeUpdateInterval = setInterval(updateProgressWithEstimate, 250);

        // Ensure we have duration data
        requestVideoData();

        // Start background tracking
        startBackgroundPlaybackTracking();
        break;

      case 2: // Paused
        state.isPlaying = false;
        updatePlayPauseButton();

        // Clear time update interval
        if (state.timeUpdateInterval) {
          clearInterval(state.timeUpdateInterval);
          state.timeUpdateInterval = null;
        }

        // Clear background tracking
        stopBackgroundPlaybackTracking();
        break;

      case 3: // Buffering
        // Keep current state but ensure time updates continue
        break;

      case 5: // Video cued
        state.isPlaying = false;
        updatePlayPauseButton();
        break;
    }
  }

  /**
   * Updates play/pause button display based on playback state
   */
  function updatePlayPauseButton() {
    if (dom["yt-play-pause"]) {
      const iconElement =
        dom["yt-play-pause"].querySelector("i") || document.createElement("i");
      iconElement.className = state.isPlaying ? "fas fa-pause" : "fas fa-play";

      // If the icon doesn't exist yet, append it
      if (!dom["yt-play-pause"].contains(iconElement)) {
        dom["yt-play-pause"].innerHTML = "";
        dom["yt-play-pause"].appendChild(iconElement);
      }
    }
  }

  /**
   * Toggles play/pause state
   */
  function togglePlayPause() {
    if (state.isPlaying) {
      pauseAudio();
    } else {
      playAudio();
    }
  }

  /**
   * Plays audio for current video
   */
  function playAudio() {
    if (!state.currentVideoId) {
      return;
    }

    const iframe = document.getElementById("youtube-player-iframe");
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage(
          JSON.stringify({
            event: "command",
            func: "playVideo",
            args: [],
          }),
          "*"
        );

        state.lastUpdateTime = Date.now() / 1000;

        if (!state.timeUpdateInterval) {
          state.timeUpdateInterval = setInterval(
            updateProgressWithEstimate,
            250
          );
        }
      } catch (e) {
        console.error("Error playing video:", e);
      }
    }

    state.isPlaying = true;
    updatePlayPauseButton();
  }

  /**
   * Pauses audio for current video
   */
  function pauseAudio() {
    const iframe = document.getElementById("youtube-player-iframe");
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage(
          JSON.stringify({
            event: "command",
            func: "pauseVideo",
            args: [],
          }),
          "*"
        );

        if (state.timeUpdateInterval) {
          clearInterval(state.timeUpdateInterval);
          state.timeUpdateInterval = null;
        }
      } catch (e) {
        console.error("Error pausing video:", e);
      }
    }

    state.isPlaying = false;
    updatePlayPauseButton();
  }

  /**
   * Formats time in MM:SS format
   * @param {number} seconds - Time in seconds
   * @returns {string} - Formatted time string
   */
  function formatTime(seconds) {
    seconds = Math.floor(seconds);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
  }

  /**
   * Handles progress bar change events
   */
  function handleProgressChange() {
    if (!dom["yt-progress"]) {
      return;
    }

    const iframe = document.getElementById("youtube-player-iframe");
    if (!iframe || !iframe.contentWindow) {
      return;
    }

    const percent = parseInt(dom["yt-progress"].value);
    let duration = 0;

    if (state.videoData[state.currentVideoId]) {
      duration = state.videoData[state.currentVideoId].duration;
    }

    if (!duration && dom["yt-duration"]) {
      const parts = dom["yt-duration"].textContent.split(":");
      if (parts.length === 2) {
        duration = parseInt(parts[0]) * 60 + parseInt(parts[1]);
      }
    }

    if (!duration) {
      duration = 100;
    }

    const seekToTime = (percent / 100) * duration;

    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func: "seekTo",
          args: [seekToTime, true],
        }),
        "*"
      );

      state.estimatedCurrentTime = seekToTime;
      state.lastUpdateTime = Date.now() / 1000;
      updateTimeDisplay(seekToTime, duration);
    } catch (e) {
      console.error("Error seeking:", e);
    }
  }

  /**
   * Handles volume slider changes
   */
  function handleVolumeChange() {
    if (!dom["yt-volume-slider"] || !dom["yt-volume-icon"]) {
      return;
    }

    const volume = dom["yt-volume-slider"].value;

    const iframe = document.getElementById("youtube-player-iframe");
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage(
          JSON.stringify({
            event: "command",
            func: "setVolume",
            args: [volume],
          }),
          "*"
        );
      } catch (e) {
        console.error("Error setting volume:", e);
      }
    }

    // Update volume icon
    const iconElement =
      dom["yt-volume-icon"].querySelector("i") || document.createElement("i");
    if (parseInt(volume) === 0) {
      iconElement.className = "fas fa-volume-mute";
    } else if (parseInt(volume) < 50) {
      iconElement.className = "fas fa-volume-down";
    } else {
      iconElement.className = "fas fa-volume-up";
    }

    // If the icon doesn't exist yet, append it
    if (!dom["yt-volume-icon"].contains(iconElement)) {
      dom["yt-volume-icon"].innerHTML = "";
      dom["yt-volume-icon"].appendChild(iconElement);
    }
  }

  /**
   * Toggles mute state
   */
  function toggleMute() {
    if (!dom["yt-volume-icon"]) {
      return;
    }

    const iframe = document.getElementById("youtube-player-iframe");
    if (!iframe || !iframe.contentWindow) {
      return;
    }

    const iconElement = dom["yt-volume-icon"].querySelector("i");
    const isMuted =
      iconElement && iconElement.classList.contains("fa-volume-mute");

    try {
      if (isMuted) {
        iframe.contentWindow.postMessage(
          JSON.stringify({
            event: "command",
            func: "unMute",
            args: [],
          }),
          "*"
        );
        const iconElement =
          dom["yt-volume-icon"].querySelector("i") ||
          document.createElement("i");
        iconElement.className = "fas fa-volume-up";

        // If the icon doesn't exist yet, append it
        if (!dom["yt-volume-icon"].contains(iconElement)) {
          dom["yt-volume-icon"].innerHTML = "";
          dom["yt-volume-icon"].appendChild(iconElement);
        }

        // Reset volume slider
        if (dom["yt-volume-slider"]) {
          dom["yt-volume-slider"].value = 100;
        }
      } else {
        iframe.contentWindow.postMessage(
          JSON.stringify({
            event: "command",
            func: "mute",
            args: [],
          }),
          "*"
        );
        const iconElement =
          dom["yt-volume-icon"].querySelector("i") ||
          document.createElement("i");
        iconElement.className = "fas fa-volume-mute";

        // If the icon doesn't exist yet, append it
        if (!dom["yt-volume-icon"].contains(iconElement)) {
          dom["yt-volume-icon"].innerHTML = "";
          dom["yt-volume-icon"].appendChild(iconElement);
        }
      }
    } catch (e) {
      console.error("Error toggling mute:", e);
    }
  }

  /**
   * Plays next track in queue or playlist
   */
  function playNextTrack() {
    // Always prioritize queue if items exist
    if (state.queue.length > 0) {
      // If we have a current index in the queue, try to play the next one
      if (state.currentVideoIndex !== -1) {
        let nextIndex = state.currentVideoIndex + 1;
        if (nextIndex < state.queue.length) {
          const nextVideo = state.queue[nextIndex];
          playVideo(
            nextVideo.id,
            nextVideo.title,
            nextVideo.thumbnail,
            nextIndex
          );

          if (state.activeTab === "queue") {
            const nextResultItem = dom["yt-queue-container"].querySelector(
              `.result-item[data-index="${nextIndex}"]`
            );
            if (nextResultItem) {
              highlightResult(nextResultItem);
              nextResultItem.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
              });
            }
          }
          return;
        }
      }
      // No current index but we have items in queue - play the first one
      else if (state.queue.length > 0) {
        const firstVideo = state.queue[0];
        playVideo(firstVideo.id, firstVideo.title, firstVideo.thumbnail, 0);
        return;
      }
    }

    // If no queue or at end of queue, use search results
    if (state.currentResultsList.length > 0) {
      const currentIndex = state.currentResultsList.findIndex(
        (video) => video.id === state.currentVideoId
      );

      if (
        currentIndex !== -1 &&
        currentIndex < state.currentResultsList.length - 1
      ) {
        const nextVideo = state.currentResultsList[currentIndex + 1];
        playVideo(nextVideo.id, nextVideo.title, nextVideo.thumbnailUrl);

        const nextResultItem = document.querySelector(
          `.result-item[data-index="${currentIndex + 1}"]`
        );
        if (nextResultItem) {
          highlightResult(nextResultItem);
          nextResultItem.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }
      }
    }
  }

  /**
   * Plays previous track in queue or playlist
   */
  function playPreviousTrack() {
    // If we're in queue view, or queue has items, use that
    if (
      (state.activeTab === "queue" || state.queue.length > 0) &&
      state.currentVideoIndex !== -1
    ) {
      let prevIndex = state.currentVideoIndex - 1;
      if (prevIndex >= 0) {
        const prevVideo = state.queue[prevIndex];
        playVideo(
          prevVideo.id,
          prevVideo.title,
          prevVideo.thumbnail,
          prevIndex
        );

        if (state.activeTab === "queue") {
          const prevResultItem = dom["yt-queue-container"].querySelector(
            `.result-item[data-index="${prevIndex}"]`
          );
          if (prevResultItem) {
            highlightResult(prevResultItem);
            prevResultItem.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          }
        }
        return;
      }
    }

    // Otherwise, use search results if available
    if (state.currentResultsList.length === 0) {
      return;
    }

    const currentIndex = state.currentResultsList.findIndex(
      (video) => video.id === state.currentVideoId
    );

    if (currentIndex > 0) {
      const prevVideo = state.currentResultsList[currentIndex - 1];
      playVideo(prevVideo.id, prevVideo.title, prevVideo.thumbnailUrl);

      const prevResultItem = document.querySelector(
        `.result-item[data-index="${currentIndex - 1}"]`
      );
      if (prevResultItem) {
        highlightResult(prevResultItem);
        prevResultItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }

  /**
   * Highlights active result in the list
   * @param {HTMLElement} element - Result element to highlight
   */
  function highlightResult(element) {
    const activeResult = document.querySelector(".result-item.active");
    if (activeResult) {
      activeResult.classList.remove("active");
    }
    element.classList.add("active");
  }

  /**
   * Shows or hides the loading indicator
   * @param {boolean} show - Whether to show or hide the loading indicator
   */
  function showLoading(show) {
    if (dom["yt-loading"]) {
      dom["yt-loading"].style.display = show ? "block" : "none";
    }
  }

  /**
   * Shows search results section
   */
  function showResults() {
    if (dom["yt-results-heading"]) {
      dom["yt-results-heading"].style.display = "block";
    }
    if (dom["yt-no-results"]) {
      dom["yt-no-results"].style.display = "none";
    }
    if (dom["yt-results-container"]) {
      dom["yt-results-container"].style.display = "block";
    }
  }

  /**
   * Shows no results message
   */
  function showNoResults() {
    if (dom["yt-results-heading"]) {
      dom["yt-results-heading"].style.display = "none";
    }
    if (dom["yt-no-results"]) {
      dom["yt-no-results"].style.display = "block";
    }
    if (dom["yt-results-container"]) {
      dom["yt-results-container"].style.display = "none";
    }
  }

  /**
   * Hides results section
   */
  function hideResults() {
    if (dom["yt-results-heading"]) {
      dom["yt-results-heading"].style.display = "none";
    }
    if (dom["yt-no-results"]) {
      dom["yt-no-results"].style.display = "none";
    }
    if (dom["yt-results-container"]) {
      dom["yt-results-container"].style.display = "none";
    }
  }

  /**
   * Shows error message
   * @param {string} message - Error message to display
   */
  function showError(message) {
    if (dom["yt-error-message"]) {
      dom["yt-error-message"].textContent = message;
      dom["yt-error-message"].style.display = "block";
    }
  }

  /**
   * Hides error message
   */
  function hideError() {
    if (dom["yt-error-message"]) {
      dom["yt-error-message"].style.display = "none";
    }
  }

  /**
   * Cleans up resources when page unloads
   */
  function cleanup() {
    if (state.timeUpdateInterval) {
      clearInterval(state.timeUpdateInterval);
    }
    if (state.durationCheckInterval) {
      clearInterval(state.durationCheckInterval);
    }
  }

  /**
   * Handles tab visibility changes
   */
  function handleVisibilityChange() {
    state.tabVisible = document.visibilityState === "visible";

    // When tab becomes visible, sync player time
    if (state.tabVisible) {
      requestVideoData();
    } else {
      // Tab is hidden, record current timestamp for background tracking
      const videoData = state.videoData[state.currentVideoId];
      if (state.isPlaying && videoData) {
        state.videoStartTime = state.estimatedCurrentTime;
        state.expectedEndTime = videoData.duration;
      }
    }
  }

  /**
   * Starts tracking playback in background tabs
   */
  function startBackgroundPlaybackTracking() {
    // Clear any existing interval first
    stopBackgroundPlaybackTracking();
    if (!state.tabVisible) {
      const videoData = state.videoData[state.currentVideoId];
      if (videoData) {
        state.videoStartTime = state.estimatedCurrentTime;
        state.expectedEndTime = videoData.duration;

        state.backgroundTrackingInterval = setInterval(() => {
          if (!state.isPlaying) {
            stopBackgroundPlaybackTracking();
            return;
          }

          const currentTime = new Date().getTime() / 1000;
          const startTime = state.lastUpdateTime;
          const estimatedTimeElapsed = currentTime - startTime;
          const estimatedPosition =
            state.estimatedCurrentTime + estimatedTimeElapsed;

          // Check if the estimated position exceeds the expected end time
          if (estimatedPosition >= state.expectedEndTime - 1) {
            stopBackgroundPlaybackTracking();
            handlePlayerStateChange(0); // Trigger ended state
          }
        }, 1000); // Check every second
      }
    }
  }

  /**
   * Stops background playback tracking
   */
  function stopBackgroundPlaybackTracking() {
    if (state.backgroundTrackingInterval) {
      clearInterval(state.backgroundTrackingInterval);
      state.backgroundTrackingInterval = null;
    }
  }

  // Public API
  return {
    initialize,
  };
})();

document.addEventListener("DOMContentLoaded", () => {
  YouTubePlayer.initialize();
});
