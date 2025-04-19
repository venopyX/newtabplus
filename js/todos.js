/**
 * Todos module for NewTab+
 */

let todos = [];
let todoFilter = "incomplete";

/**
 * Initialize todos functionality
 */
function initializeTodos() {
  document.getElementById("add-todo").addEventListener("click", () => {
    openModal("todo-modal");
  });

  document.getElementById("todo-form").addEventListener("submit", function (e) {
    e.preventDefault();
    saveTodo();
  });

  // Fix: Update filter selector to match component HTML structure
  document.querySelectorAll("#todo-filters button").forEach((button) => {
    button.addEventListener("click", function () {
      setTodoFilter(this.dataset.filter);
    });
  });

  loadTodos();
}

/**
 * Load todos from storage
 */
function loadTodos() {
  chrome.storage.sync.get("todos", function (data) {
    if (data.todos) {
      todos = data.todos;
      renderTodos();
    }
  });
}

/**
 * Save a new or edited todo
 */
function saveTodo() {
  const form = document.getElementById("todo-form");
  const text = document.getElementById("todo-text").value;
  const dueDateInput = document.getElementById("todo-duedate").value;
  const priority = document.getElementById("todo-priority").value;
  const recurring = document.getElementById("todo-recurring").value;

  const dueDate = dueDateInput ? new Date(dueDateInput).getTime() : null;
  const editMode = form.dataset.mode === "edit";
  const editId = form.dataset.editId;

  if (editMode && editId) {
    const index = todos.findIndex((todo) => todo.id === editId);
    if (index !== -1) {
      todos[index] = {
        ...todos[index],
        text: text,
        dueDate: dueDate,
        priority: priority,
        recurring: recurring,
        updated: Date.now(),
      };
    }
  } else {
    const newTodo = {
      id: generateId(),
      text: text,
      dueDate: dueDate,
      priority: priority,
      recurring: recurring !== "none" ? recurring : null,
      completed: false,
      created: Date.now(),
      updated: Date.now(),
    };

    todos.push(newTodo);
  }

  chrome.storage.sync.set({ todos: todos }, function () {
    form.reset();
    form.dataset.mode = "add";
    delete form.dataset.editId;

    closeAllModals();
    renderTodos();
    updateCalendarWithTodos();
  });
}

/**
 * Set the todo filter
 */
function setTodoFilter(filter) {
  todoFilter = filter;

  const filterButtons = document.querySelectorAll("#todo-filters button");
  filterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === filter);
  });

  renderTodos();
}

/**
 * Render filtered todos in the UI
 */
function renderTodos() {
  const container = document.getElementById("todo-list");
  if (!container) return;

  container.innerHTML = "";

  const filteredTodos = filterTodos(todos, todoFilter);
  sortTodos(filteredTodos);

  if (filteredTodos.length === 0) {
    const message = getEmptyMessage(todoFilter);
    container.innerHTML = `<p class="empty-list">${message}</p>`;
    return;
  }

  filteredTodos.forEach((todo) => {
    const todoElement = document.createElement("div");
    todoElement.className = "todo-item";
    todoElement.classList.add(`priority-${todo.priority}`);
    if (todo.completed) todoElement.classList.add("completed");

    todoElement.dataset.id = todo.id;

    const dueText = todo.dueDate
      ? `<span class="due-date">${formatDate(todo.dueDate)}</span>`
      : "";
    const recurringText = todo.recurring
      ? `<span class="todo-recurring">${getRecurringText(
          todo.recurring
        )}</span>`
      : "";

    const priorityText = `<span class="priority-tag priority-${
      todo.priority
    }">${
      todo.priority.charAt(0).toUpperCase() + todo.priority.slice(1)
    }</span>`;

    todoElement.innerHTML = `
      <label class="todo-checkbox">
        <input type="checkbox" ${todo.completed ? "checked" : ""}>
        <span class="checkmark"></span>
      </label>
      <div class="todo-content">
        <span class="todo-text">${todo.text}</span>
        <div class="todo-meta">
          ${priorityText}
          ${dueText}
          ${recurringText}
        </div>
      </div>
      <div class="todo-actions">
        <button class="edit-todo" title="Edit"><i class="fas fa-edit"></i></button>
        <button class="delete-todo" title="Delete"><i class="fas fa-trash"></i></button>
      </div>
    `;

    todoElement
      .querySelector("input[type=checkbox]")
      .addEventListener("change", function () {
        toggleTodoCompletion(todo.id);
      });

    todoElement.querySelector(".edit-todo").addEventListener("click", () => {
      editTodo(todo.id);
    });

    todoElement.querySelector(".delete-todo").addEventListener("click", () => {
      deleteTodo(todo.id);
    });

    container.appendChild(todoElement);
  });
}

/**
 * Get empty list message based on filter
 */
function getEmptyMessage(filter) {
  switch (filter) {
    case "incomplete":
      return "No incomplete todos.";
    case "completed":
      return "No completed todos.";
    case "today":
      return "No todos due today.";
    case "upcoming":
      return "No upcoming todos.";
    default:
      return "No todos. Click the + button to add one.";
  }
}

/**
 * Filter todos based on the current filter
 */
function filterTodos(todoList, filter) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  switch (filter) {
    case "incomplete":
      return todoList.filter((todo) => !todo.completed);
    case "completed":
      return todoList.filter((todo) => todo.completed);
    case "today":
      return todoList.filter((todo) => {
        if (!todo.dueDate) return false;
        const dueDate = new Date(todo.dueDate);
        return dueDate >= today && dueDate < tomorrow && !todo.completed;
      });
    case "upcoming":
      return todoList.filter((todo) => {
        if (!todo.dueDate) return false;
        const dueDate = new Date(todo.dueDate);
        return dueDate >= tomorrow && !todo.completed;
      });
    default:
      return todoList;
  }
}

/**
 * Sort todos by priority and due date
 */
function sortTodos(todoList) {
  const priorityValues = { high: 1, medium: 2, low: 3 };

  todoList.sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }

    if (a.priority !== b.priority) {
      return priorityValues[a.priority] - priorityValues[b.priority];
    }

    if (a.dueDate && b.dueDate) {
      return a.dueDate - b.dueDate;
    }

    if (a.dueDate) return -1;
    if (b.dueDate) return 1;

    return b.created - a.created;
  });
}

/**
 * Toggle the completion state of a todo
 */
function toggleTodoCompletion(id) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;

  todo.completed = !todo.completed;
  todo.updated = Date.now();

  if (todo.completed && todo.recurring) {
    createNextRecurringTodo(todo);
  }

  chrome.storage.sync.set({ todos: todos }, function () {
    renderTodos();
    updateCalendarWithTodos();
  });
}

/**
 * Create a new recurring todo after completion
 */
function createNextRecurringTodo(completedTodo) {
  if (!completedTodo.dueDate) return;

  const nextDueDate = calculateNextDueDate(
    new Date(completedTodo.dueDate),
    completedTodo.recurring
  );

  if (!nextDueDate) return;

  const newTodo = {
    id: generateId(),
    text: completedTodo.text,
    dueDate: nextDueDate.getTime(),
    priority: completedTodo.priority,
    recurring: completedTodo.recurring,
    completed: false,
    created: Date.now(),
    updated: Date.now(),
  };

  todos.push(newTodo);
}

/**
 * Calculate the next due date based on recurrence pattern
 */
function calculateNextDueDate(currentDate, recurrence) {
  const nextDate = new Date(currentDate);

  switch (recurrence) {
    case "daily":
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case "weekdays":
      let addDays = 1;
      if (nextDate.getDay() === 5) addDays = 3;
      if (nextDate.getDay() === 6) addDays = 2;
      nextDate.setDate(nextDate.getDate() + addDays);
      break;
    case "weekly":
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case "biweekly":
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case "monthly":
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case "quarterly":
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case "yearly":
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    default:
      return null;
  }

  return nextDate;
}

/**
 * Convert recurring pattern to human readable text
 */
function getRecurringText(recurring) {
  switch (recurring) {
    case "daily":
      return "Repeats daily";
    case "weekdays":
      return "Repeats on weekdays";
    case "weekly":
      return "Repeats weekly";
    case "biweekly":
      return "Repeats every 2 weeks";
    case "monthly":
      return "Repeats monthly";
    case "quarterly":
      return "Repeats quarterly";
    case "yearly":
      return "Repeats yearly";
    default:
      return "";
  }
}

/**
 * Edit a todo
 */
function editTodo(id) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;

  document.getElementById("todo-text").value = todo.text;

  if (todo.dueDate) {
    document.getElementById("todo-duedate").value = formatDateForInput(
      todo.dueDate
    );
  } else {
    document.getElementById("todo-duedate").value = "";
  }

  document.getElementById("todo-priority").value = todo.priority || "medium";
  document.getElementById("todo-recurring").value = todo.recurring || "none";

  const form = document.getElementById("todo-form");
  form.dataset.mode = "edit";
  form.dataset.editId = id;

  openModal("todo-modal");
}

/**
 * Delete a todo
 */
function deleteTodo(id) {
  if (!confirm("Are you sure you want to delete this todo?")) {
    return;
  }

  todos = todos.filter((todo) => todo.id !== id);

  chrome.storage.sync.set({ todos: todos }, function () {
    renderTodos();
    updateCalendarWithTodos();
  });
}

/**
 * Update calendar with todo due dates
 */
function updateCalendarWithTodos() {
  const dueDates = todos
    .filter((todo) => todo.dueDate && !todo.completed)
    .map((todo) => ({
      id: todo.id,
      date: new Date(todo.dueDate),
      title: todo.text,
      type: "todo",
      priority: todo.priority || "medium",
    }));

  if (typeof updateCalendarEvents === "function") {
    updateCalendarEvents(dueDates);
  }
}
