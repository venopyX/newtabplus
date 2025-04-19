/**
 * Calendar module for NewTab+
 */

let calendarView = "month";
let calendarEvents = [];
let currentDate = new Date();
let currentViewDate = new Date();

/**
 * Initialize the calendar when components are loaded
 */
function initializeCalendar() {
  const viewSelector = document.getElementById("calendar-view-selector");
  const prevButton = document.getElementById("calendar-prev");
  const nextButton = document.getElementById("calendar-next");
  const todayButton = document.getElementById("calendar-today");

  if (viewSelector) {
    viewSelector.addEventListener("change", function () {
      calendarView = this.value;
      renderCalendar();
    });
  }

  if (prevButton) {
    prevButton.addEventListener("click", function () {
      navigateCalendar(-1);
    });
  }

  if (nextButton) {
    nextButton.addEventListener("click", function () {
      navigateCalendar(1);
    });
  }

  if (todayButton) {
    todayButton.addEventListener("click", function () {
      currentViewDate = new Date();
      renderCalendar();
    });
  }

  renderCalendar();
}

/**
 * Navigate the calendar forward or backward
 */
function navigateCalendar(direction) {
  switch (calendarView) {
    case "day":
      currentViewDate.setDate(currentViewDate.getDate() + direction);
      break;
    case "week":
      currentViewDate.setDate(currentViewDate.getDate() + direction * 7);
      break;
    case "month":
    default:
      currentViewDate.setMonth(currentViewDate.getMonth() + direction);
      break;
  }

  renderCalendar();
}

/**
 * Navigate to a specific date
 */
function navigateToDate(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }

  currentViewDate = new Date(date);
  renderCalendar();
}

/**
 * Render the calendar in the current view
 */
function renderCalendar() {
  updateDateDisplay();

  const calendarContent = document.getElementById("calendar-content");
  if (!calendarContent) return;

  calendarContent.innerHTML = "";

  switch (calendarView) {
    case "day":
      renderDayView(calendarContent);
      break;
    case "week":
      renderWeekView(calendarContent);
      break;
    case "month":
    default:
      renderMonthView(calendarContent);
      break;
  }
}

/**
 * Update the date display in the calendar header
 */
function updateDateDisplay() {
  const dateDisplay = document.getElementById("calendar-date-display");
  if (!dateDisplay) return;

  const options = { year: "numeric" };

  switch (calendarView) {
    case "day":
      Object.assign(options, {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      break;
    case "week":
      const weekStart = getWeekStartDate(currentViewDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      if (weekStart.getMonth() === weekEnd.getMonth()) {
        dateDisplay.textContent = `${weekStart.toLocaleDateString("en-US", {
          month: "long",
        })} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
      } else if (weekStart.getFullYear() === weekEnd.getFullYear()) {
        dateDisplay.textContent = `${weekStart.toLocaleDateString("en-US", {
          month: "short",
        })} ${weekStart.getDate()} - ${weekEnd.toLocaleDateString("en-US", {
          month: "short",
        })} ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
      } else {
        dateDisplay.textContent = `${weekStart.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })} - ${weekEnd.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`;
      }
      return;
    case "month":
    default:
      Object.assign(options, { month: "long" });
      break;
  }

  dateDisplay.textContent = currentViewDate.toLocaleDateString(
    "en-US",
    options
  );
}

/**
 * Render month view calendar
 */
function renderMonthView(container) {
  const month = currentViewDate.getMonth();
  const year = currentViewDate.getFullYear();

  const monthStart = new Date(year, month, 1);
  const firstDay = monthStart.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarGrid = document.createElement("div");
  calendarGrid.className = "calendar-grid month-view";

  // Add day headers
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  dayNames.forEach((day) => {
    const dayHeader = document.createElement("div");
    dayHeader.className = "day-name";
    dayHeader.textContent = day;
    calendarGrid.appendChild(dayHeader);
  });

  // Add empty cells for days before the first of month
  for (let i = 0; i < firstDay; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "calendar-day empty";
    calendarGrid.appendChild(emptyCell);
  }

  // Add days of month
  const today = new Date();
  const isCurrentMonth =
    today.getMonth() === month && today.getFullYear() === year;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayCell = document.createElement("div");
    dayCell.className = "calendar-day";
    dayCell.dataset.date = formatDateString(date);

    if (isCurrentMonth && day === today.getDate()) {
      dayCell.classList.add("today");
    }

    dayCell.innerHTML = `
      <div class="day-number">${day}</div>
      <div class="day-events"></div>
    `;

    // Add events for this day
    const dayEvents = dayCell.querySelector(".day-events");
    const eventsForDay = getEventsForDay(date);

    if (eventsForDay.length > 0) {
      dayCell.classList.add("has-events");

      eventsForDay.slice(0, 3).forEach((event) => {
        const eventElement = document.createElement("div");
        eventElement.className = `event-dot ${event.type}`;

        if (event.type === "todo" && event.priority) {
          eventElement.classList.add(`priority-${event.priority}`);
        }

        eventElement.dataset.id = event.id;
        eventElement.dataset.type = event.type;
        eventElement.title = event.title;

        // Add event listener to individual event dots
        eventElement.addEventListener("click", (e) => {
          e.stopPropagation(); // Prevent triggering the day cell click
          navigateToEvent(event.id, event.type);
        });

        dayEvents.appendChild(eventElement);
      });

      if (eventsForDay.length > 3) {
        const moreElement = document.createElement("div");
        moreElement.className = "events-more";
        moreElement.textContent = `+${eventsForDay.length - 3}`;
        moreElement.addEventListener("click", (e) => {
          e.stopPropagation(); // Prevent triggering the day cell click
          showDayEventsModal(date, eventsForDay);
        });
        dayEvents.appendChild(moreElement);
      }
    }

    // Add click event to day cell for navigation to day view
    dayCell.addEventListener("click", () => {
      currentViewDate = new Date(date);
      calendarView = "day";
      document.getElementById("calendar-view-selector").value = "day";
      renderCalendar();
    });

    calendarGrid.appendChild(dayCell);
  }

  container.appendChild(calendarGrid);
}

/**
 * Render week view calendar
 */
function renderWeekView(container) {
  const weekStart = getWeekStartDate(currentViewDate);

  const weekGrid = document.createElement("div");
  weekGrid.className = "calendar-grid week-view";

  // Create time column
  const timeColumn = document.createElement("div");
  timeColumn.className = "time-column";

  for (let hour = 0; hour < 24; hour++) {
    const timeSlot = document.createElement("div");
    timeSlot.className = "time-slot";
    timeSlot.textContent = formatHour(hour);
    timeColumn.appendChild(timeSlot);
  }

  weekGrid.appendChild(timeColumn);

  // Create day columns
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);

    const dayColumn = document.createElement("div");
    dayColumn.className = "day-column";

    // Day header
    const dayHeader = document.createElement("div");
    dayHeader.className = "day-header";

    if (isSameDay(day, new Date())) {
      dayHeader.classList.add("today");
    }

    dayHeader.textContent = `${dayNames[day.getDay()].substring(
      0,
      3
    )} ${day.getDate()}`;
    dayColumn.appendChild(dayHeader);

    // Hours grid
    for (let hour = 0; hour < 24; hour++) {
      const hourCell = document.createElement("div");
      hourCell.className = "hour-cell";

      // Add events for this hour
      const hourStart = new Date(day);
      hourStart.setHours(hour, 0, 0, 0);

      const hourEnd = new Date(day);
      hourEnd.setHours(hour + 1, 0, 0, 0);

      const events = getEventsBetween(hourStart, hourEnd);

      if (events.length > 0) {
        events.forEach((event) => {
          const eventElement = document.createElement("div");
          eventElement.className = `event-item ${event.type}`;

          if (event.type === "todo" && event.priority) {
            eventElement.classList.add(`priority-${event.priority}`);
          }

          eventElement.textContent = event.title;
          eventElement.title = `${event.title} (${formatTime(event.date)})`;

          eventElement.addEventListener("click", () => {
            navigateToEvent(event.id, event.type);
          });

          hourCell.appendChild(eventElement);
        });
      }

      dayColumn.appendChild(hourCell);
    }

    weekGrid.appendChild(dayColumn);
  }

  container.appendChild(weekGrid);
}

/**
 * Render day view calendar
 */
function renderDayView(container) {
  const day = new Date(currentViewDate);

  const dayGrid = document.createElement("div");
  dayGrid.className = "calendar-grid day-view";

  // Create time column
  const timeColumn = document.createElement("div");
  timeColumn.className = "time-column";

  for (let hour = 0; hour < 24; hour++) {
    const timeSlot = document.createElement("div");
    timeSlot.className = "time-slot";
    timeSlot.textContent = formatHour(hour);
    timeColumn.appendChild(timeSlot);
  }

  dayGrid.appendChild(timeColumn);

  // Create events column
  const eventsColumn = document.createElement("div");
  eventsColumn.className = "events-column";

  // Hours grid
  for (let hour = 0; hour < 24; hour++) {
    const hourCell = document.createElement("div");
    hourCell.className = "hour-cell";

    // Add events for this hour
    const hourStart = new Date(day);
    hourStart.setHours(hour, 0, 0, 0);

    const hourEnd = new Date(day);
    hourEnd.setHours(hour + 1, 0, 0, 0);

    const events = getEventsBetween(hourStart, hourEnd);

    if (events.length > 0) {
      events.forEach((event) => {
        const eventElement = document.createElement("div");
        eventElement.className = `event-item ${event.type}`;

        if (event.type === "todo" && event.priority) {
          eventElement.classList.add(`priority-${event.priority}`);
        }

        eventElement.innerHTML = `
          <div class="event-title">${event.title}</div>
          <div class="event-time">${formatTime(event.date)}</div>
        `;

        eventElement.addEventListener("click", () => {
          navigateToEvent(event.id, event.type);
        });

        hourCell.appendChild(eventElement);
      });
    }

    eventsColumn.appendChild(hourCell);
  }

  dayGrid.appendChild(eventsColumn);
  container.appendChild(dayGrid);
}

/**
 * Show modal with events for a specific day
 */
function showDayEventsModal(date, events) {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.id = "day-events-modal";

  const dateStr = date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const modalContent = document.createElement("div");
  modalContent.className = "modal-content";

  modalContent.innerHTML = `
    <span class="close-modal">&times;</span>
    <h2>Events for ${dateStr}</h2>
    <div class="modal-body">
      <div class="events-list"></div>
    </div>
    <div class="modal-actions">
      <button id="view-day-btn" class="btn-secondary">View Day</button>
    </div>
  `;

  const eventsList = modalContent.querySelector(".events-list");

  if (events.length === 0) {
    eventsList.innerHTML = "<p>No events for this day.</p>";
  } else {
    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    events.forEach((event) => {
      const eventItem = document.createElement("div");
      eventItem.className = `event-item ${event.type}`;

      if (event.type === "todo" && event.priority) {
        eventItem.classList.add(`priority-${event.priority}`);
      }

      let timeStr = "";
      if (event.date.getHours() !== 0 || event.date.getMinutes() !== 0) {
        timeStr = event.date.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        });
      }

      eventItem.innerHTML = `
        <div class="event-details">
          <div class="event-title">${event.title}</div>
          ${timeStr ? `<div class="event-time">${timeStr}</div>` : ""}
          <div class="event-type">${getEventTypeName(event.type)}</div>
        </div>
        <div class="event-actions">
          <button class="edit-event" data-id="${event.id}" data-type="${
        event.type
      }">
            <i class="fas fa-edit"></i>
          </button>
        </div>
      `;

      eventItem
        .querySelector(".edit-event")
        .addEventListener("click", function () {
          navigateToEvent(event.id, event.type);
          closeAllModals();
        });

      eventsList.appendChild(eventItem);
    });
  }

  modalContent
    .querySelector(".close-modal")
    .addEventListener("click", closeAllModals);

  modalContent
    .querySelector("#view-day-btn")
    .addEventListener("click", function () {
      currentViewDate = new Date(date);
      calendarView = "day";
      document.getElementById("calendar-view-selector").value = "day";
      renderCalendar();
      closeAllModals();
    });

  modal.appendChild(modalContent);
  document.getElementById("modal-container").appendChild(modal);
  document.getElementById("modal-container").classList.remove("hidden");
  modal.classList.add("active");
}

/**
 * Navigate to a specific event in its module
 */
function navigateToEvent(id, type) {
  switch (type) {
    case "todo":
      editTodoFromCalendar(id);
      break;

    case "reminder":
      editReminderFromCalendar(id);
      break;

    case "timedTab":
      const tab = timedTabs.find((t) => t.id === id);
      if (tab) {
        editTimedTab(id);
      }
      break;
  }
}

/**
 * Get events for a specific day
 */
function getEventsForDay(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  return calendarEvents.filter((event) => {
    const eventDate = new Date(event.date);
    return (
      eventDate.getFullYear() === year &&
      eventDate.getMonth() === month &&
      eventDate.getDate() === day
    );
  });
}

/**
 * Get events between two times
 */
function getEventsBetween(startTime, endTime) {
  return calendarEvents.filter((event) => {
    const eventTime = new Date(event.date);
    return eventTime >= startTime && eventTime < endTime;
  });
}

/**
 * Update calendar events from different modules
 */
function updateCalendarEvents(events) {
  if (!Array.isArray(events)) return;

  events.forEach((event) => {
    if (!event.id || !event.date || !event.title || !event.type) {
      return;
    }

    const existingIndex = calendarEvents.findIndex(
      (e) => e.id === event.id && e.type === event.type
    );

    if (existingIndex !== -1) {
      calendarEvents[existingIndex] = event;
    } else {
      calendarEvents.push(event);
    }
  });

  renderCalendar();
}

/**
 * Get the start date of the week containing the given date
 */
function getWeekStartDate(date) {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() - day);
  return result;
}

/**
 * Format a date as YYYY-MM-DD
 */
function formatDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Format an hour for display (12-hour format)
 */
function formatHour(hour) {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

/**
 * Format a time for display
 */
function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Check if two dates are the same day
 */
function isSameDay(date1, date2) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Get event type display name
 */
function getEventTypeName(type) {
  switch (type) {
    case "todo":
      return "Todo";
    case "reminder":
      return "Reminder";
    case "timedTab":
      return "Scheduled Tab";
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

// Day name constants for calendar
const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
