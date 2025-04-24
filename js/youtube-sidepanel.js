/**
 * YouTube Player Sidepanel for NewTab+
 * Handles YouTube video searching and playback with CSP-compatible implementation
 */

const YouTubeSidepanel = (() => {
  /**
   * Private state for the YouTube sidepanel module
   */
  const state = {
    currentVideoId: "",
    isPlaying: false,
    currentResultsList: [],
    playerReady: false,
    timeUpdateInterval: null,
    videoData: {},
    estimatedCurrentTime: 0,
    lastUpdateTime: 0,
  };

  /**
   * Cached DOM elements to avoid repeated queries
   */
  const dom = {};

  /**
   * Initializes the YouTube sidepanel and sets up event listeners
   */
  function initialize() {
    cacheDOMElements();
    setupEventListeners();
    setupPlayer();
  }

  /**
   * Cache all required DOM elements
   */
  function cacheDOMElements() {
    const elements = [
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
      "youtube-sidepanel-toggle",
      "youtube-sidepanel",
    ];

    elements.forEach((id) => {
      dom[id] = document.getElementById(id);
    });
  }

  /**
   * Setup event listeners for user interaction
   */
  function setupEventListeners() {
    if (dom["youtube-sidepanel-toggle"]) {
      dom["youtube-sidepanel-toggle"].addEventListener(
        "click",
        toggleSidepanel
      );
    }

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

    window.addEventListener("message", handleMessages);
    window.addEventListener("beforeunload", cleanup);
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

    playerContainer.appendChild(iframe);
    state.playerReady = true;
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
   * Toggles YouTube sidepanel visibility
   */
  function toggleSidepanel() {
    if (dom["youtube-sidepanel"]) {
      dom["youtube-sidepanel"].classList.toggle("open");
    }
  }

  /**
   * Shows YouTube sidepanel
   */
  function showSidepanel() {
    if (
      dom["youtube-sidepanel"] &&
      !dom["youtube-sidepanel"].classList.contains("open")
    ) {
      dom["youtube-sidepanel"].classList.add("open");
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
          <div class="duration">${video.duration}</div>
          <div class="views">${formatViews(video.views)} views</div>
        </div>
      `;

      resultItem.addEventListener("click", () => {
        playVideo(video.id, video.title, video.thumbnailUrl);
        highlightResult(resultItem);
      });

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
   */
  function playVideo(videoId, title, thumbnail) {
    if (state.currentVideoId === videoId && state.isPlaying) {
      pauseAudio();
      return;
    } else if (state.currentVideoId === videoId && !state.isPlaying) {
      playAudio();
      return;
    }

    state.estimatedCurrentTime = 0;
    state.lastUpdateTime = Date.now() / 1000;

    if (state.timeUpdateInterval) {
      clearInterval(state.timeUpdateInterval);
    }

    state.currentVideoId = videoId;

    if (dom["yt-now-playing-title"]) {
      dom["yt-now-playing-title"].textContent = title;
    }

    if (dom["yt-now-playing-thumbnail"]) {
      dom["yt-now-playing-thumbnail"].src = thumbnail;
    }

    updateTimeDisplay(0, state.videoData[videoId]?.duration || 0);

    const iframe = document.getElementById("youtube-player-iframe");
    if (iframe) {
      iframe.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&controls=0&disablekb=1&modestbranding=1&fs=0&rel=0&origin=${encodeURIComponent(
        window.location.origin
      )}`;

      setTimeout(() => {
        state.timeUpdateInterval = setInterval(updateProgressWithEstimate, 250);
      }, 1000);
    }

    state.isPlaying = true;
    updatePlayPauseButton();

    if (dom["yt-player-container"]) {
      dom["yt-player-container"].style.display = "block";
    }
  }

  /**
   * Updates progress using time estimation between YouTube API updates
   */
  function updateProgressWithEstimate() {
    if (!state.isPlaying) {
      return;
    }

    const currentRealTime = Date.now() / 1000;
    const elapsedSinceUpdate = currentRealTime - state.lastUpdateTime;
    const currentEstimatedTime =
      state.estimatedCurrentTime + elapsedSinceUpdate;
    const duration = state.videoData[state.currentVideoId]?.duration || 100;

    updateTimeDisplay(currentEstimatedTime, duration);
    requestCurrentTime();
  }

  /**
   * Requests current time from the YouTube iframe
   */
  function requestCurrentTime() {
    const iframe = document.getElementById("youtube-player-iframe");
    if (!iframe || !iframe.contentWindow) {
      return;
    }

    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({
          event: "listening",
          id: iframe.id,
        }),
        "https://www.youtube.com"
      );

      iframe.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func: "getCurrentTime",
          args: [],
        }),
        "https://www.youtube.com"
      );

      iframe.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func: "getDuration",
          args: [],
        }),
        "https://www.youtube.com"
      );

      iframe.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func: "getPlayerState",
          args: [],
        }),
        "https://www.youtube.com"
      );
    } catch (e) {
      console.error("Error requesting data from YouTube iframe:", e);
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
   * Handles YouTube player state changes
   * @param {number} state - Player state code
   */
  function handlePlayerStateChange(state) {
    switch (state) {
      case 1:
        state.isPlaying = true;
        updatePlayPauseButton();
        break;
      case 2:
        state.isPlaying = false;
        updatePlayPauseButton();
        break;
      case 0:
        state.isPlaying = false;
        updatePlayPauseButton();

        if (state.timeUpdateInterval) {
          clearInterval(state.timeUpdateInterval);
          state.timeUpdateInterval = null;
        }

        const duration = state.videoData[state.currentVideoId]?.duration || 0;
        updateTimeDisplay(duration, duration);
        playNextVideo();
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
   * Plays next video in playlist
   */
  function playNextVideo() {
    if (!state.currentVideoId || state.currentResultsList.length === 0) {
      return;
    }

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
        nextResultItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
  }

  return {
    initialize,
    toggleSidepanel,
    showSidepanel,
  };
})();

/**
 * Initializes YouTube sidepanel when components are loaded
 */
document.addEventListener("componentsLoaded", () => {
  YouTubeSidepanel.initialize();
});

/**
 * Global function to toggle the YouTube sidepanel
 */
function toggleYouTubeSidepanel() {
  YouTubeSidepanel.toggleSidepanel();
}

/**
 * Global function to show the YouTube sidepanel
 */
function showYouTubeSidepanel() {
  YouTubeSidepanel.showSidepanel();
}
