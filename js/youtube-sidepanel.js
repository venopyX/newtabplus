/**
 * YouTube Player Sidepanel for NewTab+
 * Handles YouTube video searching and playback with CSP-compatible implementation
 */

// Global variables
let currentVideoId = "";
let isPlaying = false;
let currentResultsList = [];
let playerReady = false;
let timeUpdateInterval = null;
let videoData = {}; 
let estimatedCurrentTime = 0;
let lastUpdateTime = 0;

/**
 * Initializes the YouTube sidepanel and sets up event listeners
 */
function initializeYouTubeSidepanel() {
  const searchInput = document.getElementById("yt-search-input");
  const searchButton = document.getElementById("yt-search-button");
  const resultsContainer = document.getElementById("yt-results-container");
  const playerContainer = document.getElementById("yt-player-container");
  const playPauseButton = document.getElementById("yt-play-pause");
  const currentTimeDisplay = document.getElementById("yt-current-time");
  const durationDisplay = document.getElementById("yt-duration");
  const progressBar = document.getElementById("yt-progress");
  const nowPlayingThumbnail = document.getElementById(
    "yt-now-playing-thumbnail"
  );
  const nowPlayingTitle = document.getElementById("yt-now-playing-title");
  const loadingElement = document.getElementById("yt-loading");
  const resultsHeading = document.getElementById("yt-results-heading");
  const noResultsElement = document.getElementById("yt-no-results");
  const errorMessageElement = document.getElementById("yt-error-message");
  const volumeSlider = document.getElementById("yt-volume-slider");
  const volumeIcon = document.getElementById("yt-volume-icon");
  const sidepanelToggle = document.getElementById("youtube-sidepanel-toggle");

  if (sidepanelToggle) {
    sidepanelToggle.addEventListener("click", toggleYouTubeSidepanel);
  }

  if (searchButton) {
    searchButton.addEventListener("click", performYouTubeSearch);
  }

  if (searchInput) {
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") performYouTubeSearch();
    });
  }

  if (playPauseButton) {
    playPauseButton.addEventListener("click", toggleYouTubePlayPause);
  }

  if (progressBar) {
    progressBar.addEventListener("input", handleYouTubeProgressChange);
  }

  if (volumeSlider) {
    volumeSlider.addEventListener("input", handleYouTubeVolumeChange);
  }

  if (volumeIcon) {
    volumeIcon.addEventListener("click", toggleYouTubeMute);
  }

  setupYouTubePlayer();
}

/**
 * Sets up YouTube player with CSP-compatible approach
 */
function setupYouTubePlayer() {
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

  window.addEventListener("message", handleYouTubeMessages);

  playerReady = true;
}

/**
 * Handles messages from the YouTube iframe
 * @param {MessageEvent} event - Message event containing data from YouTube iframe
 */
function handleYouTubeMessages(event) {
  if (!event.data || typeof event.data !== "string") return;

  try {
    const data = JSON.parse(event.data);

    if (data.event === "onStateChange") {
      handleYouTubePlayerStateChange(data.info);
    } else if (data.event === "infoDelivery") {
      if (data.info && data.info.currentTime !== undefined) {
        estimatedCurrentTime = data.info.currentTime;
        lastUpdateTime = Date.now() / 1000;
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
function toggleYouTubeSidepanel() {
  const sidepanel = document.getElementById("youtube-sidepanel");
  if (sidepanel) {
    sidepanel.classList.toggle("open");
  }
}

/**
 * Shows YouTube sidepanel
 */
function showYouTubeSidepanel() {
  const sidepanel = document.getElementById("youtube-sidepanel");
  if (sidepanel && !sidepanel.classList.contains("open")) {
    sidepanel.classList.add("open");
  }
}

/**
 * Performs YouTube search with the current search input value
 */
async function performYouTubeSearch() {
  const searchInput = document.getElementById("yt-search-input");
  if (!searchInput) return;

  const query = searchInput.value.trim();
  if (query === "") return;

  showYouTubeLoading(true);
  hideYouTubeError();

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

    displayYouTubeResults(data.results);
  } catch (error) {
    console.error("Search error:", error);
    showYouTubeError(`Error searching for "${query}": ${error.message}`);
    hideYouTubeResults();
  } finally {
    showYouTubeLoading(false);
  }
}

/**
 * Displays YouTube search results
 * @param {Array} results - Array of video results
 */
function displayYouTubeResults(results) {
  const resultsContainer = document.getElementById("yt-results-container");
  const resultsHeading = document.getElementById("yt-results-heading");
  const noResultsElement = document.getElementById("yt-no-results");

  if (!resultsContainer || !resultsHeading || !noResultsElement) return;

  currentResultsList = results;

  if (!results || results.length === 0) {
    showYouTubeNoResults();
    return;
  }

  resultsContainer.innerHTML = "";
  results.forEach((video, index) => {
    videoData[video.id] = {
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
        <div class="views">${formatYouTubeViews(video.views)} views</div>
      </div>
    `;

    resultItem.addEventListener("click", () => {
      playYouTubeVideo(video.id, video.title, video.thumbnailUrl);
      highlightYouTubeResult(resultItem);
    });

    resultsContainer.appendChild(resultItem);
  });

  showYouTubeResults();
}

/**
 * Converts duration string to seconds
 * @param {string} durationStr - Duration in format "MM:SS" or "HH:MM:SS"
 * @returns {number} - Duration in seconds
 */
function convertDurationToSeconds(durationStr) {
  if (!durationStr) return 0;

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
function formatYouTubeViews(views) {
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
function playYouTubeVideo(videoId, title, thumbnail) {
  if (currentVideoId === videoId && isPlaying) {
    pauseYouTubeAudio();
    return;
  } else if (currentVideoId === videoId && !isPlaying) {
    playYouTubeAudio();
    return;
  }

  estimatedCurrentTime = 0;
  lastUpdateTime = Date.now() / 1000;

  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
  }

  currentVideoId = videoId;

  const nowPlayingTitle = document.getElementById("yt-now-playing-title");
  const nowPlayingThumbnail = document.getElementById(
    "yt-now-playing-thumbnail"
  );

  if (nowPlayingTitle) nowPlayingTitle.textContent = title;
  if (nowPlayingThumbnail) nowPlayingThumbnail.src = thumbnail;

  updateTimeDisplay(0, videoData[videoId]?.duration || 0);

  const iframe = document.getElementById("youtube-player-iframe");
  if (iframe) {
    iframe.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&controls=0&disablekb=1&modestbranding=1&fs=0&rel=0&origin=${encodeURIComponent(
      window.location.origin
    )}`;

    setTimeout(() => {
      timeUpdateInterval = setInterval(updateProgressWithEstimate, 250);
    }, 1000);
  }

  isPlaying = true;
  updateYouTubePlayPauseButton();

  const playerContainer = document.getElementById("yt-player-container");
  if (playerContainer) {
    playerContainer.style.display = "block";
  }
}

/**
 * Updates progress using time estimation between YouTube API updates
 */
function updateProgressWithEstimate() {
  if (!isPlaying) return;

  const currentRealTime = Date.now() / 1000;
  const elapsedSinceUpdate = currentRealTime - lastUpdateTime;
  const currentEstimatedTime = estimatedCurrentTime + elapsedSinceUpdate;
  const duration = videoData[currentVideoId]?.duration || 100;

  updateTimeDisplay(currentEstimatedTime, duration);
  requestCurrentTime();
}

/**
 * Requests current time from the YouTube iframe
 */
function requestCurrentTime() {
  const iframe = document.getElementById("youtube-player-iframe");
  if (!iframe || !iframe.contentWindow) return;

  try {
    iframe.contentWindow.postMessage(
      JSON.stringify({
        event: "listening",
        id: iframe.id,
      }),
      "*"
    );

    iframe.contentWindow.postMessage(
      JSON.stringify({
        event: "command",
        func: "getCurrentTime",
        args: [],
      }),
      "*"
    );

    iframe.contentWindow.postMessage(
      JSON.stringify({
        event: "command",
        func: "getDuration",
        args: [],
      }),
      "*"
    );

    iframe.contentWindow.postMessage(
      JSON.stringify({
        event: "command",
        func: "getPlayerState",
        args: [],
      }),
      "*"
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
  const currentTimeDisplay = document.getElementById("yt-current-time");
  const durationDisplay = document.getElementById("yt-duration");
  const progressBar = document.getElementById("yt-progress");

  if (!currentTimeDisplay || !durationDisplay || !progressBar) return;

  if (!duration && videoData[currentVideoId]) {
    duration = videoData[currentVideoId].duration;
  }

  if (currentTimeDisplay) {
    currentTimeDisplay.textContent = formatYouTubeTime(currentTime);
  }

  if (durationDisplay && duration) {
    durationDisplay.textContent = formatYouTubeTime(duration);
  }

  if (
    progressBar &&
    duration &&
    !progressBar.getAttribute("dragging") &&
    duration > 0
  ) {
    progressBar.value = Math.min((currentTime / duration) * 100, 100);
  }
}

/**
 * Handles YouTube player state changes
 * @param {number} state - Player state code
 */
function handleYouTubePlayerStateChange(state) {
  switch (state) {
    case 1:
      isPlaying = true;
      updateYouTubePlayPauseButton();
      break;
    case 2:
      isPlaying = false;
      updateYouTubePlayPauseButton();
      break;
    case 0:
      isPlaying = false;
      updateYouTubePlayPauseButton();

      if (timeUpdateInterval) {
        clearInterval(timeUpdateInterval);
        timeUpdateInterval = null;
      }

      const duration = videoData[currentVideoId]?.duration || 0;
      updateTimeDisplay(duration, duration);
      playNextYouTubeVideo();
      break;
  }
}

/**
 * Updates play/pause button display based on playback state
 */
function updateYouTubePlayPauseButton() {
  const playPauseButton = document.getElementById("yt-play-pause");
  if (playPauseButton) {
    playPauseButton.textContent = isPlaying ? "⏸️" : "▶️";
  }
}

/**
 * Toggles play/pause state
 */
function toggleYouTubePlayPause() {
  if (isPlaying) {
    pauseYouTubeAudio();
  } else {
    playYouTubeAudio();
  }
}

/**
 * Plays audio for current video
 */
function playYouTubeAudio() {
  if (!currentVideoId) return;

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

      lastUpdateTime = Date.now() / 1000;

      if (!timeUpdateInterval) {
        timeUpdateInterval = setInterval(updateProgressWithEstimate, 250);
      }
    } catch (e) {
      console.error("Error playing video:", e);
    }
  }

  isPlaying = true;
  updateYouTubePlayPauseButton();
}

/**
 * Pauses audio for current video
 */
function pauseYouTubeAudio() {
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

      if (timeUpdateInterval) {
        clearInterval(timeUpdateInterval);
        timeUpdateInterval = null;
      }
    } catch (e) {
      console.error("Error pausing video:", e);
    }
  }

  isPlaying = false;
  updateYouTubePlayPauseButton();
}

/**
 * Formats time in MM:SS format
 * @param {number} seconds - Time in seconds
 * @returns {string} - Formatted time string
 */
function formatYouTubeTime(seconds) {
  seconds = Math.floor(seconds);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
}

/**
 * Handles progress bar change events
 */
function handleYouTubeProgressChange() {
  const progressBar = document.getElementById("yt-progress");
  if (!progressBar) return;

  const iframe = document.getElementById("youtube-player-iframe");
  if (!iframe || !iframe.contentWindow) return;

  const percent = parseInt(progressBar.value);
  let duration = 0;

  if (videoData[currentVideoId]) {
    duration = videoData[currentVideoId].duration;
  }

  if (!duration) {
    const durationDisplay = document.getElementById("yt-duration");
    if (durationDisplay) {
      const parts = durationDisplay.textContent.split(":");
      if (parts.length === 2) {
        duration = parseInt(parts[0]) * 60 + parseInt(parts[1]);
      }
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

    estimatedCurrentTime = seekToTime;
    lastUpdateTime = Date.now() / 1000;
    updateTimeDisplay(seekToTime, duration);
  } catch (e) {
    console.error("Error seeking:", e);
  }
}

/**
 * Handles volume slider changes
 */
function handleYouTubeVolumeChange() {
  const volumeSlider = document.getElementById("yt-volume-slider");
  const volumeIcon = document.getElementById("yt-volume-icon");

  if (!volumeSlider || !volumeIcon) return;

  const volume = volumeSlider.value;

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

  if (volume == 0) {
    volumeIcon.textContent = "🔇";
  } else if (volume < 50) {
    volumeIcon.textContent = "🔈";
  } else {
    volumeIcon.textContent = "🔊";
  }
}

/**
 * Toggles mute state
 */
function toggleYouTubeMute() {
  const volumeIcon = document.getElementById("yt-volume-icon");
  if (!volumeIcon) return;

  const iframe = document.getElementById("youtube-player-iframe");
  if (!iframe || !iframe.contentWindow) return;

  const isMuted = volumeIcon.textContent === "🔇";

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
      volumeIcon.textContent = "🔊";
    } else {
      iframe.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func: "mute",
          args: [],
        }),
        "*"
      );
      volumeIcon.textContent = "🔇";
    }
  } catch (e) {
    console.error("Error toggling mute:", e);
  }
}

/**
 * Plays next video in playlist
 */
function playNextYouTubeVideo() {
  if (!currentVideoId || currentResultsList.length === 0) return;

  const currentIndex = currentResultsList.findIndex(
    (video) => video.id === currentVideoId
  );

  if (currentIndex !== -1 && currentIndex < currentResultsList.length - 1) {
    const nextVideo = currentResultsList[currentIndex + 1];
    playYouTubeVideo(nextVideo.id, nextVideo.title, nextVideo.thumbnailUrl);

    const nextResultItem = document.querySelector(
      `.result-item[data-index="${currentIndex + 1}"]`
    );
    if (nextResultItem) {
      highlightYouTubeResult(nextResultItem);
      nextResultItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }
}

/**
 * Highlights active result in the list
 * @param {HTMLElement} element - Result element to highlight
 */
function highlightYouTubeResult(element) {
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
function showYouTubeLoading(show) {
  const loadingElement = document.getElementById("yt-loading");
  if (loadingElement) {
    loadingElement.style.display = show ? "block" : "none";
  }
}

/**
 * Shows search results section
 */
function showYouTubeResults() {
  const resultsHeading = document.getElementById("yt-results-heading");
  const noResultsElement = document.getElementById("yt-no-results");
  const resultsContainer = document.getElementById("yt-results-container");

  if (resultsHeading) resultsHeading.style.display = "block";
  if (noResultsElement) noResultsElement.style.display = "none";
  if (resultsContainer) resultsContainer.style.display = "block";
}

/**
 * Shows no results message
 */
function showYouTubeNoResults() {
  const resultsHeading = document.getElementById("yt-results-heading");
  const noResultsElement = document.getElementById("yt-no-results");
  const resultsContainer = document.getElementById("yt-results-container");

  if (resultsHeading) resultsHeading.style.display = "none";
  if (noResultsElement) noResultsElement.style.display = "block";
  if (resultsContainer) resultsContainer.style.display = "none";
}

/**
 * Hides results section
 */
function hideYouTubeResults() {
  const resultsHeading = document.getElementById("yt-results-heading");
  const noResultsElement = document.getElementById("yt-no-results");
  const resultsContainer = document.getElementById("yt-results-container");

  if (resultsHeading) resultsHeading.style.display = "none";
  if (noResultsElement) noResultsElement.style.display = "none";
  if (resultsContainer) resultsContainer.style.display = "none";
}

/**
 * Shows error message
 * @param {string} message - Error message to display
 */
function showYouTubeError(message) {
  const errorMessageElement = document.getElementById("yt-error-message");
  if (errorMessageElement) {
    errorMessageElement.textContent = message;
    errorMessageElement.style.display = "block";
  }
}

/**
 * Hides error message
 */
function hideYouTubeError() {
  const errorMessageElement = document.getElementById("yt-error-message");
  if (errorMessageElement) {
    errorMessageElement.style.display = "none";
  }
}

/**
 * Cleans up resources when page unloads
 */
window.addEventListener("beforeunload", function () {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
  }
});

/**
 * Initializes YouTube sidepanel when components are loaded
 */
document.addEventListener("componentsLoaded", () => {
  initializeYouTubeSidepanel();
});
