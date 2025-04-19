// Calendar functionality for NewTab+
let calendar = {
  currentDate: new Date(),
  currentView: "month", // 'day', 'week', 'month'
  events: [], // Combined array of reminders, todos with due dates, and scheduled tabs

  // Initialize calendar
  init: function () {
    this.loadEvents();
    this.renderCalendar();
    this.setupEventListeners();
  },

  // Load events from all sources
  loadEvents: function () {
    this.events = [];

    // Load scheduled tabs
    chrome.storage.sync.get("timedTabs", (data) => {
      if (data.timedTabs && Array.isArray(data.timedTabs)) {
        data.timedTabs.forEach((tab) => {
          if (!tab.processed) {
            this.events.push({
              id: tab.id,
              title: tab.title,
              start: new Date(tab.scheduledTime),
              end: new Date(tab.scheduledTime + 3600000), // Add 1 hour for visual display
              type: "tab",
              url: tab.url,
              color: "#4fc3f7", // Use accent color for tabs
            });
          }
        });
      }

      // Load todos with due dates
      chrome.storage.sync.get("todos", (data) => {
        if (data.todos && Array.isArray(data.todos)) {
          data.todos.forEach((todo) => {
            // Check if dueDate exists and convert it to Date object
            if (todo.dueDate && !todo.completed) {
              // Determine color based on priority
              let color;
              switch (todo.priority) {
                case "high":
                  color = "#f44336";
                  break;
                case "medium":
                  color = "#ffc107";
                  break;
                case "low":
                  color = "#8bc34a";
                  break;
                default:
                  color = "#ffc107";
              }

              // Parse dueDate correctly - it might be a string or a number
              const dueDate =
                typeof todo.dueDate === "string"
                  ? new Date(todo.dueDate)
                  : new Date(parseInt(todo.dueDate));

              // Add the actual todo to calendar events
              this.events.push({
                id: todo.id,
                title: todo.text,
                start: dueDate,
                end: new Date(dueDate.getTime() + 1800000), // Add 30 minutes for display
                type: "todo",
                priority: todo.priority,
                recurring: todo.recurring || "none",
                color: color,
              });

              // If task is recurring, generate additional instances for the calendar view
              if (todo.recurring && todo.recurring !== "none") {
                this.generateRecurringEvents(todo, dueDate, color, 12); // Generate next 12 occurrences
              }
            }
          });
        }

        // Load reminders
        chrome.storage.sync.get("reminders", (data) => {
          if (data.reminders && Array.isArray(data.reminders)) {
            data.reminders.forEach((reminder) => {
              if (!reminder.triggered) {
                // Parse scheduledTime correctly
                const scheduledTime =
                  typeof reminder.scheduledTime === "string"
                    ? new Date(reminder.scheduledTime)
                    : new Date(parseInt(reminder.scheduledTime));

                // Add the base reminder
                this.events.push({
                  id: reminder.id,
                  title: reminder.title,
                  description: reminder.message,
                  start: scheduledTime,
                  end: new Date(scheduledTime.getTime() + 1800000), // Add 30 minutes
                  type: "reminder",
                  recurring: reminder.recurring || "none",
                  color: "#5b83c0", // Use primary color for reminders
                });

                // If reminder is recurring, generate additional instances for the calendar
                if (reminder.recurring && reminder.recurring !== "none") {
                  this.generateRecurringEvents(
                    reminder,
                    scheduledTime,
                    "#5b83c0",
                    12
                  );
                }
              }
            });
          }

          // Sort events by date
          this.events.sort((a, b) => a.start - b.start);

          // Log events for debugging
          console.log("Calendar events loaded:", this.events);

          // Re-render calendar with all events
          this.renderCalendar();
        });
      });
    });
  },

  // Generate recurring instances of events for the calendar view
  generateRecurringEvents: function (item, startDate, color, count) {
    if (!startDate || !item.recurring || item.recurring === "none") return;

    // Clone the start date to avoid modifying the original
    let currentDate = new Date(startDate.getTime());
    let nextDate;

    // Generate future occurrences
    for (let i = 0; i < count; i++) {
      // Calculate next occurrence based on recurrence pattern
      switch (item.recurring) {
        case "daily":
          nextDate = new Date(currentDate.getTime());
          nextDate.setDate(nextDate.getDate() + 1);
          break;
        case "weekly":
          nextDate = new Date(currentDate.getTime());
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case "monthly":
          nextDate = new Date(currentDate.getTime());
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        default:
          continue; // Skip if not a valid recurring pattern
      }

      // Create a virtual recurring event instance for the calendar
      this.events.push({
        id: `${item.id}-recurring-${i}`, // Create unique ID for each instance
        title: item.text || item.title,
        start: nextDate,
        end: new Date(nextDate.getTime() + 1800000), // Add 30 minutes
        type: item.dueDate ? "todo" : "reminder", // Determine type
        priority: item.priority,
        recurring: item.recurring,
        description: item.message,
        isRecurring: true, // Mark as recurring instance
        parentId: item.id, // Reference to original
        color: color,
        virtualEvent: true, // Mark as virtual for special handling
      });

      // Update current date for next iteration
      currentDate = nextDate;
    }
  },

  // Setup event listeners for calendar navigation and view switching
  setupEventListeners: function () {
    // Previous button
    document.getElementById("calendar-prev")?.addEventListener("click", () => {
      this.navigate(-1);
    });

    // Next button
    document.getElementById("calendar-next")?.addEventListener("click", () => {
      this.navigate(1);
    });

    // Today button
    document.getElementById("calendar-today")?.addEventListener("click", () => {
      this.currentDate = new Date();
      this.renderCalendar();
    });

    // View selector
    document
      .getElementById("calendar-view-selector")
      ?.addEventListener("change", (e) => {
        this.currentView = e.target.value;
        this.renderCalendar();
      });
  },

  // Navigate forward or backward in the calendar
  navigate: function (direction) {
    switch (this.currentView) {
      case "day":
        this.currentDate.setDate(this.currentDate.getDate() + direction);
        break;
      case "week":
        this.currentDate.setDate(this.currentDate.getDate() + direction * 7);
        break;
      case "month":
        this.currentDate.setMonth(this.currentDate.getMonth() + direction);
        break;
    }
    this.renderCalendar();
  },

  // Render the appropriate calendar view
  renderCalendar: function () {
    const calendarContainer = document.getElementById("calendar-container");
    if (!calendarContainer) return;

    // Update header date display
    this.updateHeaderDate();

    // Clear existing calendar content
    const calendarContent = document.getElementById("calendar-content");
    calendarContent.innerHTML = "";

    // Render the appropriate view
    switch (this.currentView) {
      case "day":
        this.renderDayView(calendarContent);
        break;
      case "week":
        this.renderWeekView(calendarContent);
        break;
      case "month":
        this.renderMonthView(calendarContent);
        break;
    }
  },

  // Update the header date display based on current view
  updateHeaderDate: function () {
    const dateDisplay = document.getElementById("calendar-date-display");
    if (!dateDisplay) return;

    const options = { year: "numeric", month: "long" };

    switch (this.currentView) {
      case "day":
        options.day = "numeric";
        dateDisplay.textContent = this.currentDate.toLocaleDateString(
          undefined,
          options
        );
        break;
      case "week":
        // Get first and last day of week
        const weekStart = new Date(this.currentDate);
        weekStart.setDate(
          this.currentDate.getDate() - this.currentDate.getDay()
        );
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        // Format date range
        if (weekStart.getMonth() === weekEnd.getMonth()) {
          dateDisplay.textContent = `${weekStart.toLocaleDateString(undefined, {
            month: "long",
          })} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
        } else {
          dateDisplay.textContent = `${weekStart.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })} - ${weekEnd.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}`;
        }
        break;
      case "month":
        dateDisplay.textContent = this.currentDate.toLocaleDateString(
          undefined,
          { month: "long", year: "numeric" }
        );
        break;
    }
  },

  // Render day view
  renderDayView: function (container) {
    const dayContainer = document.createElement("div");
    dayContainer.className = "calendar-day-view";

    // Create time slots (24 hours)
    for (let hour = 0; hour < 24; hour++) {
      const timeSlot = document.createElement("div");
      timeSlot.className = "calendar-time-slot";

      // Add time label
      const timeLabel = document.createElement("div");
      timeLabel.className = "calendar-time-label";
      const hourDisplay = hour % 12 === 0 ? 12 : hour % 12;
      timeLabel.textContent = `${hourDisplay}:00 ${hour < 12 ? "AM" : "PM"}`;
      timeSlot.appendChild(timeLabel);

      // Add events container for this hour
      const eventsContainer = document.createElement("div");
      eventsContainer.className = "calendar-events-container";

      // Filter events for this day and hour
      const startOfHour = new Date(this.currentDate);
      startOfHour.setHours(hour, 0, 0, 0);

      const endOfHour = new Date(startOfHour);
      endOfHour.setHours(hour + 1, 0, 0, 0);

      // Find events for this time slot
      const hourEvents = this.events.filter((event) => {
        return event.start >= startOfHour && event.start < endOfHour;
      });

      // Add events to the container
      hourEvents.forEach((event) => {
        const eventEl = this.createEventElement(event);
        eventsContainer.appendChild(eventEl);
      });

      timeSlot.appendChild(eventsContainer);
      dayContainer.appendChild(timeSlot);
    }

    container.appendChild(dayContainer);
  },

  // Render week view
  renderWeekView: function (container) {
    const weekContainer = document.createElement("div");
    weekContainer.className = "calendar-week-view";

    // Create header with day names
    const header = document.createElement("div");
    header.className = "calendar-week-header";

    // Find the first day of the week (Sunday)
    const firstDayOfWeek = new Date(this.currentDate);
    firstDayOfWeek.setDate(
      this.currentDate.getDate() - this.currentDate.getDay()
    );

    // Create columns for each day
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(firstDayOfWeek);
      dayDate.setDate(firstDayOfWeek.getDate() + i);

      const dayCol = document.createElement("div");
      dayCol.className = "calendar-day-column";

      // Add day header
      const dayHeader = document.createElement("div");
      dayHeader.className = "calendar-day-header";
      dayHeader.innerHTML = `
        <div class="day-name">${dayDate.toLocaleDateString(undefined, {
          weekday: "short",
        })}</div>
        <div class="day-number">${dayDate.getDate()}</div>
      `;

      // Highlight current day
      if (dayDate.toDateString() === new Date().toDateString()) {
        dayHeader.classList.add("current-day");
      }

      dayCol.appendChild(dayHeader);

      // Create time slots container
      const timeSlotsContainer = document.createElement("div");
      timeSlotsContainer.className = "calendar-day-slots";

      // Create 24 hour slots
      for (let hour = 0; hour < 24; hour++) {
        const timeSlot = document.createElement("div");
        timeSlot.className = "calendar-time-slot";

        // Only add time label to first column
        if (i === 0) {
          const timeLabel = document.createElement("div");
          timeLabel.className = "calendar-time-label";
          const hourDisplay = hour % 12 === 0 ? 12 : hour % 12;
          timeLabel.textContent = `${hourDisplay} ${hour < 12 ? "AM" : "PM"}`;
          timeSlot.appendChild(timeLabel);
        }

        // Add events for this hour
        const startOfHour = new Date(dayDate);
        startOfHour.setHours(hour, 0, 0, 0);

        const endOfHour = new Date(startOfHour);
        endOfHour.setHours(hour + 1, 0, 0, 0);

        // Find events for this time slot
        const hourEvents = this.events.filter((event) => {
          const eventStart = new Date(event.start);
          return eventStart >= startOfHour && eventStart < endOfHour;
        });

        // Add events to the slot
        hourEvents.forEach((event) => {
          const eventEl = this.createEventElement(event);
          timeSlot.appendChild(eventEl);
        });

        timeSlotsContainer.appendChild(timeSlot);
      }

      dayCol.appendChild(timeSlotsContainer);
      weekContainer.appendChild(dayCol);
    }

    container.appendChild(weekContainer);
  },

  // Render month view
  renderMonthView: function (container) {
    const monthContainer = document.createElement("div");
    monthContainer.className = "calendar-month-view";

    // Create header with day names
    const header = document.createElement("div");
    header.className = "calendar-month-header";

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    dayNames.forEach((day) => {
      const dayHeader = document.createElement("div");
      dayHeader.className = "calendar-day-header";
      dayHeader.textContent = day;
      header.appendChild(dayHeader);
    });

    monthContainer.appendChild(header);

    // Create calendar grid
    const calendarGrid = document.createElement("div");
    calendarGrid.className = "calendar-grid";

    // Get first day of the month
    const firstDayOfMonth = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth(),
      1
    );
    const lastDayOfMonth = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() + 1,
      0
    );

    // Get the day of the week the first day falls on (0 = Sunday, 6 = Saturday)
    const firstDayOfWeek = firstDayOfMonth.getDay();

    // Calculate total days to display (including padding days)
    const totalDays = firstDayOfWeek + lastDayOfMonth.getDate();
    const totalWeeks = Math.ceil(totalDays / 7);

    // Get previous month's last days for padding
    const prevMonth = new Date(firstDayOfMonth);
    prevMonth.setDate(0);
    const prevMonthLastDay = prevMonth.getDate();

    let dayCounter = 1;
    let nextMonthCounter = 1;

    // Create week rows
    for (let week = 0; week < totalWeeks; week++) {
      const weekRow = document.createElement("div");
      weekRow.className = "calendar-week";

      // Create day cells
      for (let day = 0; day < 7; day++) {
        const dayCell = document.createElement("div");
        dayCell.className = "calendar-day";

        // Previous month padding
        if (week === 0 && day < firstDayOfWeek) {
          const prevDate = prevMonthLastDay - (firstDayOfWeek - day - 1);
          dayCell.innerHTML = `<div class="day-number faded">${prevDate}</div>`;
          dayCell.classList.add("other-month");
        }
        // Next month padding
        else if (dayCounter > lastDayOfMonth.getDate()) {
          dayCell.innerHTML = `<div class="day-number faded">${nextMonthCounter}</div>`;
          dayCell.classList.add("other-month");
          nextMonthCounter++;
        }
        // Current month
        else {
          dayCell.innerHTML = `<div class="day-number">${dayCounter}</div>`;

          // Highlight current day
          const currentDate = new Date(
            this.currentDate.getFullYear(),
            this.currentDate.getMonth(),
            dayCounter
          );
          if (currentDate.toDateString() === new Date().toDateString()) {
            dayCell.classList.add("current-day");
          }

          // Get events for this day
          const dayStart = new Date(
            this.currentDate.getFullYear(),
            this.currentDate.getMonth(),
            dayCounter
          );
          const dayEnd = new Date(
            this.currentDate.getFullYear(),
            this.currentDate.getMonth(),
            dayCounter + 1
          );

          const dayEvents = this.events.filter((event) => {
            return event.start >= dayStart && event.start < dayEnd;
          });

          // Add event indicators
          if (dayEvents.length > 0) {
            const eventsContainer = document.createElement("div");
            eventsContainer.className = "day-events-container";

            // Limit to showing max 3 events with a "+X more" indicator
            const visibleEvents = dayEvents.slice(0, 3);
            visibleEvents.forEach((event) => {
              const eventEl = this.createEventElement(event, true); // compact = true
              eventsContainer.appendChild(eventEl);
            });

            // Add "more" indicator if needed
            if (dayEvents.length > 3) {
              const moreIndicator = document.createElement("div");
              moreIndicator.className = "more-events";
              moreIndicator.textContent = `+${dayEvents.length - 3} more`;
              eventsContainer.appendChild(moreIndicator);
            }

            dayCell.appendChild(eventsContainer);
          }

          dayCounter++;
        }

        weekRow.appendChild(dayCell);
      }

      calendarGrid.appendChild(weekRow);
    }

    monthContainer.appendChild(calendarGrid);
    container.appendChild(monthContainer);
  },

  // Create an event element
  createEventElement: function (event, compact = false) {
    const eventEl = document.createElement("div");
    eventEl.className = `calendar-event event-${event.type}`;
    eventEl.style.backgroundColor = event.color;

    if (compact) {
      // Compact view for month calendar
      eventEl.innerHTML = `
        <div class="event-title">${event.title}</div>
      `;
    } else {
      // Full view for day/week calendar
      const timeStr = event.start.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      eventEl.innerHTML = `
        <div class="event-time">${timeStr}</div>
        <div class="event-title">${event.title}</div>
      `;

      if (event.type === "todo") {
        eventEl.innerHTML += `<div class="event-priority ${event.priority}-priority"></div>`;
      }

      if (event.type === "reminder" && event.recurring !== "none") {
        eventEl.innerHTML += `<div class="event-recurring"><i class="fas fa-sync-alt"></i></div>`;
      }
    }

    // Add click handler
    eventEl.addEventListener("click", () => this.handleEventClick(event));

    return eventEl;
  },

  // Handle event click
  handleEventClick: function (event) {
    // Different behavior based on event type
    switch (event.type) {
      case "tab":
        // Open the tab
        if (confirm(`Open "${event.title}" now?`)) {
          chrome.tabs.create({ url: event.url });
        }
        break;

      case "todo":
        // Edit the todo directly on the current page
        editTodo(event.id);
        break;

      case "reminder":
        // Edit the reminder directly on the current page
        editReminder(event.id);
        break;
    }
  },

  // Create popup calendar
  createPopupCalendar: function (container) {
    // Store original view and date
    const originalView = this.currentView;
    const originalDate = new Date(this.currentDate);

    // Set to month view for popup
    this.currentView = "month";

    // Create calendar UI elements
    container.innerHTML = `
      <div class="calendar-header">
        <div class="calendar-nav">
          <button id="calendar-prev" class="calendar-nav-btn"><i class="fas fa-chevron-left"></i></button>
          <div id="calendar-date-display" class="calendar-date"></div>
          <button id="calendar-next" class="calendar-nav-btn"><i class="fas fa-chevron-right"></i></button>
        </div>
        <button id="calendar-today" class="calendar-today-btn">Today</button>
      </div>
      <div id="calendar-content" class="calendar-content"></div>
      <div class="calendar-footer">
        <button id="calendar-open-full" class="calendar-open-btn">Open Full Calendar</button>
      </div>
    `;

    // Render calendar content
    this.renderCalendar();

    // Add event listeners for popup
    this.setupEventListeners();

    // Add specific listener for "Open Full Calendar" button
    document
      .getElementById("calendar-open-full")
      .addEventListener("click", () => {
        chrome.tabs.create({ url: "chrome://newtab/" }, function (tab) {
          chrome.tabs.onUpdated.addListener(function listener(
            tabId,
            changeInfo
          ) {
            if (tabId === tab.id && changeInfo.status === "complete") {
              chrome.tabs.sendMessage(tabId, { action: "openCalendarTab" });
              chrome.tabs.onUpdated.removeListener(listener);
            }
          });
        });
        window.close(); // Close popup
      });

    // Restore original view and date when popup is closed
    window.addEventListener("unload", () => {
      this.currentView = originalView;
      this.currentDate = originalDate;
    });
  },
};

// Initialize calendar when DOM is loaded (if on newtab page)
document.addEventListener("DOMContentLoaded", function () {
  const calendarToggleBtn = document.getElementById("calendar-toggle-btn");
  const calendarCard = document.getElementById("calendar-card");

  if (calendarToggleBtn && calendarCard) {
    // Add click event to toggle calendar visibility
    calendarToggleBtn.addEventListener("click", function () {
      if (calendarCard.style.display === "none") {
        calendarCard.style.display = "block";

        // Initialize calendar if it's the first time showing it
        if (!calendar.initialized) {
          calendar.init();
          calendar.initialized = true;
        } else {
          // Refresh events if calendar was already initialized
          calendar.loadEvents();
        }

        // Animate appearance and scroll to it
        setTimeout(() => {
          calendarCard.scrollIntoView({ behavior: "smooth" });
        }, 100);
      } else {
        calendarCard.style.display = "none";
      }
    });
  }

  // Check if we should show the calendar based on URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  if (
    urlParams.get("showCalendar") === "true" &&
    calendarCard &&
    calendarToggleBtn
  ) {
    calendarCard.style.display = "block";
    calendar.init();
    calendar.initialized = true;

    setTimeout(() => {
      calendarCard.scrollIntoView({ behavior: "smooth" });
    }, 300);
  }
});
