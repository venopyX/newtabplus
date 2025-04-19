// To-Do List functionality
let todos = [];
let todoFilter = "incomplete"; // Changed default from "all" to "incomplete"

function initializeTodos() {
  // Add event listeners
  document.getElementById("add-todo").addEventListener("click", () => {
    openModal("todo-modal");
  });

  // Filter selector
  document
    .querySelectorAll("#todo-filters button[data-filter]")
    .forEach((button) => {
      button.addEventListener("click", function () {
        const filter = this.dataset.filter;
        setActiveTodoFilter(filter);
      });
    });

  // Form submission handling
  document.getElementById("todo-form").addEventListener("submit", function (e) {
    e.preventDefault();
    saveTodo();
  });

  // Load saved todos
  loadTodos();

  // Set up timer to check overdue todos every minute
  setInterval(checkOverdueTodos, 60000);
}

// Load todos from storage
function loadTodos() {
  chrome.storage.sync.get("todos", function (data) {
    if (data.todos) {
      todos = data.todos;
      renderTodos();
    }
  });
}

// Save a new or edited todo
function saveTodo() {
  const form = document.getElementById("todo-form");
  const text = document.getElementById("todo-text").value;
  const dueDateInput = document.getElementById("todo-duedate").value;
  const priority = document.getElementById("todo-priority").value;
  const recurring = document.getElementById("todo-recurring").value;

  // Parse due date if provided
  let dueDate = null;
  if (dueDateInput) {
    dueDate = new Date(dueDateInput).getTime();
  }

  // Check if editing or creating new
  const editMode = form.dataset.mode === "edit";
  const editId = form.dataset.editId;

  if (editMode && editId) {
    // Update existing todo
    const index = todos.findIndex((todo) => todo.id === editId);
    if (index !== -1) {
      todos[index] = {
        ...todos[index],
        text,
        dueDate,
        priority,
        recurring,
        updated: Date.now(),
      };
    }
  } else {
    // Create new todo
    const newTodo = {
      id: generateId(),
      text,
      dueDate,
      priority,
      recurring,
      completed: false,
      created: Date.now(),
      updated: Date.now(),
    };

    todos.push(newTodo);
  }

  // Save to storage
  chrome.storage.sync.set({ todos: todos }, function () {
    // Reset form and handlers
    form.reset();
    form.dataset.mode = "add";
    delete form.dataset.editId;

    // Close modal
    closeAllModals();

    // Render updated list
    renderTodos();
  });
}

// Set active filter
function setActiveTodoFilter(filter) {
  // Update current filter
  todoFilter = filter;

  // Update active button
  const buttons = document.querySelectorAll("#todo-filters button");
  buttons.forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === filter);
  });

  // Render filtered todos
  renderTodos();
}

// Render todos with current filter
function renderTodos() {
  const container = document.getElementById("todo-list");
  container.innerHTML = "";

  // Apply filters
  let filteredTodos = todos;
  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const endOfDay = startOfDay + 86400000; // 24 hours in milliseconds

  switch (todoFilter) {
    case "today":
      filteredTodos = todos.filter(
        (todo) =>
          todo.dueDate && todo.dueDate >= startOfDay && todo.dueDate < endOfDay
      );
      break;
    case "upcoming":
      filteredTodos = todos.filter(
        (todo) => todo.dueDate && todo.dueDate >= endOfDay
      );
      break;
    case "completed":
      filteredTodos = todos.filter((todo) => todo.completed);
      break;
    case "incomplete":
      // New filter to show only incomplete tasks
      filteredTodos = todos.filter((todo) => !todo.completed);
      break;
    case "all":
    default:
      // All shows all tasks, both completed and incomplete
      filteredTodos = todos;
      break;
  }

  // Sort: first by completion, then by due date (if present), then by priority
  filteredTodos.sort((a, b) => {
    // First sort by completion status
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }

    // Then sort by due date (if both have it)
    if (a.dueDate && b.dueDate) {
      return a.dueDate - b.dueDate;
    } else if (a.dueDate) {
      return -1; // a has due date, b doesn't
    } else if (b.dueDate) {
      return 1; // b has due date, a doesn't
    }

    // Then sort by priority
    const priorityValues = { high: 0, medium: 1, low: 2 };
    return priorityValues[a.priority] - priorityValues[b.priority];
  });

  if (filteredTodos.length === 0) {
    container.innerHTML =
      '<p class="empty-list">No tasks found. Click the + button to add one.</p>';
    return;
  }

  // Create todo elements
  filteredTodos.forEach((todo) => {
    const todoElement = document.createElement("div");
    todoElement.className = `todo-item${todo.completed ? " completed" : ""}`;
    todoElement.dataset.id = todo.id;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "todo-checkbox";
    checkbox.checked = todo.completed;

    // Toggle completion status when checkbox is clicked
    checkbox.addEventListener("change", () => toggleTodoCompletion(todo.id));

    const todoHTML = `
      <div class="todo-content">
        <div class="todo-text">${todo.text}</div>
        <div class="todo-meta">
          ${
            todo.dueDate
              ? `<span class="todo-due-date">${formatDate(todo.dueDate)}</span>`
              : ""
          }
          ${
            todo.recurring !== "none"
              ? `<span class="todo-recurring">${todo.recurring}</span>`
              : ""
          }
          <span class="todo-priority priority-${todo.priority}">${
      todo.priority
    }</span>
        </div>
      </div>
      <div class="todo-actions">
        <button class="edit-todo" data-id="${
          todo.id
        }" title="Edit"><i class="fas fa-edit"></i></button>
        <button class="delete-todo" data-id="${
          todo.id
        }" title="Delete"><i class="fas fa-trash"></i></button>
      </div>
    `;

    todoElement.appendChild(checkbox);
    todoElement.insertAdjacentHTML("beforeend", todoHTML);

    // Add event listeners
    todoElement
      .querySelector(".edit-todo")
      .addEventListener("click", () => editTodo(todo.id));
    todoElement
      .querySelector(".delete-todo")
      .addEventListener("click", () => deleteTodo(todo.id));

    // Append to container
    container.appendChild(todoElement);
  });
}

// Toggle todo completion status
function toggleTodoCompletion(id) {
  const index = todos.findIndex((todo) => todo.id === id);
  if (index === -1) return;

  // Store previous completion state to check if we're completing (not uncompleting)
  const wasCompletedBefore = todos[index].completed;
  
  // Toggle completed status
  todos[index].completed = !todos[index].completed;
  todos[index].updated = Date.now();

  // Only create a new instance if:
  // 1. Task was NOT completed before (we're marking it complete now)
  // 2. Task is now marked as completed
  // 3. Task is recurring
  if (!wasCompletedBefore && todos[index].completed && todos[index].recurring !== "none") {
    const original = todos[index];

    // Calculate next occurrence based on recurrence pattern
    const nextDueDate = calculateNextDueDate(
      original.dueDate,
      original.recurring
    );

    if (nextDueDate) {
      // Create new recurring instance
      const newTodo = {
        id: generateId(),
        text: original.text,
        dueDate: nextDueDate,
        priority: original.priority,
        recurring: original.recurring,
        completed: false,
        created: Date.now(),
        updated: Date.now(),
      };

      todos.push(newTodo);
    }
  }

  // Save to storage
  chrome.storage.sync.set({ todos: todos }, function () {
    renderTodos();
  });
}

// Calculate next occurrence date based on recurrence pattern
function calculateNextDueDate(currentDueDate, recurring) {
  if (!currentDueDate) return null;

  const date = new Date(currentDueDate);

  switch (recurring) {
    case "daily":
      date.setDate(date.getDate() + 1);
      break;
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    default:
      return null;
  }

  return date.getTime();
}

// Edit a todo
function editTodo(id) {
  const todo = todos.find((todo) => todo.id === id);
  if (!todo) return;

  // Populate form
  document.getElementById("todo-text").value = todo.text;

  // Format date for datetime-local input
  if (todo.dueDate) {
    const date = new Date(todo.dueDate);
    const formattedDate = date.toISOString().slice(0, 16); // Format: YYYY-MM-DDThh:mm
    document.getElementById("todo-duedate").value = formattedDate;
  } else {
    document.getElementById("todo-duedate").value = "";
  }

  // Set other fields
  document.getElementById("todo-priority").value = todo.priority;
  document.getElementById("todo-recurring").value = todo.recurring || "none";

  // Set form to edit mode
  const form = document.getElementById("todo-form");
  form.dataset.mode = "edit";
  form.dataset.editId = id;

  // Open modal
  openModal("todo-modal");
}

// Delete a todo
function deleteTodo(id) {
  if (confirm("Are you sure you want to delete this task?")) {
    todos = todos.filter((todo) => todo.id !== id);

    // Save to storage
    chrome.storage.sync.set({ todos: todos }, function () {
      renderTodos();
    });
  }
}

// Check for overdue todos and send notifications if needed
function checkOverdueTodos() {
  const now = Date.now();

  // Get todos that are due in the past 5 minutes and not completed
  const overdueTodos = todos.filter(
    (todo) =>
      !todo.completed &&
      todo.dueDate &&
      todo.dueDate <= now &&
      todo.dueDate > now - 300000 && // 5 minutes in milliseconds
      !todo.notified // Check if notification has been sent
  );

  if (overdueTodos.length > 0) {
    // Mark as notified
    overdueTodos.forEach((todo) => {
      const index = todos.findIndex((t) => t.id === todo.id);
      if (index !== -1) {
        todos[index].notified = true;
      }

      // Show notification
      showNotification("Task Due", todo.text, {
        onClick: function () {
          window.focus();
          setActiveTodoFilter("today");
          this.close();
        },
      });
    });

    // Save updated todos
    chrome.storage.sync.set({ todos: todos });
  }
}
