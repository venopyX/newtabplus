/**
 * Component Loader for NewTab+
 * Handles the dynamic loading of HTML components and modals
 */

const ComponentLoader = {
  components: [
    { id: "header-container", path: "../components/header.html" },
    { id: "calendar-container", path: "../components/calendar.html" },
    {
      id: "youtube-sidepanel-container",
      path: "../components/youtube-sidepanel.html",
    },
  ],

  dashboardCards: [
    { path: "../components/timed-tabs.html" },
    { path: "../components/notes.html" },
    { path: "../components/todos.html" },
    { path: "../components/reminders.html" },
  ],

  modals: [
    { path: "../components/modals/tab-timer-modal.html" },
    { path: "../components/modals/note-modal.html" },
    { path: "../components/modals/note-view-modal.html" },
    { path: "../components/modals/todo-modal.html" },
    { path: "../components/modals/reminder-modal.html" },
    { path: "../components/modals/search-engine-modal.html" }, // Added search engine modal
  ],

  /**
   * Initialize the component loader
   */
  init: function () {
    Promise.all(
      this.components.map((component) =>
        this.loadComponent(component.id, component.path)
      )
    )
      .then(() => {
        return this.loadDashboardCards();
      })
      .then(() => {
        return this.loadModals();
      })
      .then(() => {
        document.dispatchEvent(new Event("componentsLoaded"));
      })
      .catch((error) => {
        console.error("Error loading components:", error);
      });
  },

  /**
   * Load a component into a container
   * @param {string} containerId - Container element ID
   * @param {string} componentPath - Path to the component HTML file
   * @returns {Promise} Component loading promise
   */
  loadComponent: function (containerId, componentPath) {
    return fetch(componentPath)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to load ${componentPath}: ${response.status} ${response.statusText}`
          );
        }
        return response.text();
      })
      .then((html) => {
        const container = document.getElementById(containerId);
        if (container) {
          container.innerHTML = html;
        } else {
          console.error(
            `Container element with ID "${containerId}" not found.`
          );
        }
      });
  },

  /**
   * Load dashboard cards into dashboard container
   * @returns {Promise} Dashboard cards loading promise
   */
  loadDashboardCards: function () {
    const container = document.getElementById("dashboard-container");

    if (!container) {
      return Promise.reject(new Error("Dashboard container not found"));
    }

    const promises = this.dashboardCards.map((card) => {
      return fetch(card.path)
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              `Failed to load ${card.path}: ${response.status} ${response.statusText}`
            );
          }
          return response.text();
        })
        .then((html) => {
          container.innerHTML += html;
        });
    });

    return Promise.all(promises);
  },

  /**
   * Load modal components into modal container
   * @returns {Promise} Modals loading promise
   */
  loadModals: function () {
    const container = document.getElementById("modal-container");

    if (!container) {
      return Promise.reject(new Error("Modal container not found"));
    }

    const promises = this.modals.map((modal) => {
      return fetch(modal.path)
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              `Failed to load ${modal.path}: ${response.status} ${response.statusText}`
            );
          }
          return response.text();
        })
        .then((html) => {
          // Extract the modal ID from the HTML content
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = html;
          const modalElement = tempDiv.querySelector(".modal");
          const modalId = modalElement
            ? modalElement.id
            : `modal-${Math.random().toString(36).substring(2, 9)}`;

          // Create modal overlay wrapper with the appropriate structure
          const modalOverlay = document.createElement("div");
          modalOverlay.id = `${modalId}-overlay`;
          modalOverlay.className = "modal-overlay";
          modalOverlay.innerHTML = html;

          container.appendChild(modalOverlay);
        });
    });

    return Promise.all(promises);
  },
};

document.addEventListener("DOMContentLoaded", () => {
  ComponentLoader.init();
});
