/**
 * Notes module for NewTab+
 * Handles note management with markdown support
 */

let notes = [];
let categories = ["personal", "work", "ideas"];
let currentCategory = "all";

/**
 * Initialize notes functionality
 */
function initializeNotes() {
  document.getElementById("add-note").addEventListener("click", () => {
    openModal("note-modal");
  });

  document
    .querySelectorAll("#notes-categories button[data-category]")
    .forEach((button) => {
      button.addEventListener("click", function () {
        const category = this.dataset.category;
        setActiveCategory(category);
      });
    });

  document
    .getElementById("add-category")
    .addEventListener("click", addNewCategory);

  document
    .querySelector("#notes-search input")
    .addEventListener("input", function () {
      filterNotes(this.value);
    });

  document.getElementById("note-form").addEventListener("submit", function (e) {
    e.preventDefault();
    saveNote();
  });

  loadNotes();
  loadCategories();
}

/**
 * Load notes from storage
 */
function loadNotes() {
  chrome.storage.sync.get("notes", function (data) {
    if (data.notes) {
      notes = data.notes;
      renderNotes();
    }
  });
}

/**
 * Load categories from storage
 */
function loadCategories() {
  chrome.storage.sync.get("noteCategories", function (data) {
    if (data.noteCategories) {
      categories = data.noteCategories;
      updateCategoryOptions();
    }
  });
}

/**
 * Save categories to storage
 */
function saveCategories() {
  chrome.storage.sync.set({ noteCategories: categories });
}

/**
 * Update category options in UI
 */
function updateCategoryOptions() {
  const dropdown = document.getElementById("note-category");
  dropdown.innerHTML = "";

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    dropdown.appendChild(option);
  });

  const categoriesContainer = document.getElementById("notes-categories");
  const existingButtons = categoriesContainer.querySelectorAll(
    'button[data-category]:not([data-category="all"])'
  );

  existingButtons.forEach((button) => {
    if (
      !["all", "personal", "work", "ideas"].includes(button.dataset.category)
    ) {
      button.remove();
    }
  });

  categories.forEach((category) => {
    if (!["personal", "work", "ideas"].includes(category)) {
      const addCategoryButton = document.getElementById("add-category");

      const button = document.createElement("button");
      button.dataset.category = category;
      button.textContent = category.charAt(0).toUpperCase() + category.slice(1);

      button.addEventListener("click", function () {
        setActiveCategory(category);
      });

      categoriesContainer.insertBefore(button, addCategoryButton);
    }
  });
}

/**
 * Add a new category
 */
function addNewCategory() {
  const newCategory = prompt("Enter the name of the new category:");

  if (newCategory && newCategory.trim()) {
    const category = newCategory.trim().toLowerCase();

    if (categories.includes(category)) {
      alert("This category already exists");
      return;
    }

    categories.push(category);
    saveCategories();
    updateCategoryOptions();
  }
}

/**
 * Set active category for filtering
 * @param {string} category - Category to set as active
 */
function setActiveCategory(category) {
  currentCategory = category;

  const buttons = document.querySelectorAll("#notes-categories button");
  buttons.forEach((button) => {
    button.classList.toggle("active", button.dataset.category === category);
  });

  renderNotes();
}

/**
 * Filter notes by search term
 * @param {string} searchTerm - Term to search for
 */
function filterNotes(searchTerm) {
  const search = searchTerm.toLowerCase();

  if (!search) {
    renderNotes();
    return;
  }

  const categoryNotes =
    currentCategory === "all"
      ? notes
      : notes.filter((note) => note.category === currentCategory);

  const filteredNotes = categoryNotes.filter(
    (note) =>
      note.title.toLowerCase().includes(search) ||
      note.content.toLowerCase().includes(search)
  );

  renderFilteredNotes(filteredNotes);
}

/**
 * Render notes with current filters
 */
function renderNotes() {
  const filteredNotes =
    currentCategory === "all"
      ? notes
      : notes.filter((note) => note.category === currentCategory);

  filteredNotes.sort((a, b) => b.updated - a.updated);

  renderFilteredNotes(filteredNotes);
}

/**
 * Render a filtered list of notes
 * @param {Array} filteredNotes - Notes to render
 */
function renderFilteredNotes(filteredNotes) {
  const container = document.getElementById("notes-list");
  container.innerHTML = "";

  if (filteredNotes.length === 0) {
    container.innerHTML =
      '<p class="empty-list">No notes found. Click the + button to add one.</p>';
    return;
  }

  filteredNotes.forEach((note) => {
    const noteElement = document.createElement("div");
    noteElement.className = "note-item";
    noteElement.dataset.id = note.id;

    let contentPreview = note.content.substring(0, 100);
    if (note.content.length > 100) contentPreview += "...";

    noteElement.innerHTML = `
      <div class="note-header">
        <div class="note-title">${note.title}</div>
        <span class="note-category">${note.category}</span>
      </div>
      <div class="note-preview">${contentPreview}</div>
      <div class="note-actions">
        <button class="edit-btn" title="Edit Note">
          <i class="fas fa-edit"></i>
        </button>
        <button class="delete-btn" title="Delete Note">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;

    noteElement.addEventListener("click", () => viewNote(note.id));

    noteElement.querySelector(".edit-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      openNote(note.id);
    });

    noteElement.querySelector(".delete-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteNote(note.id);
    });

    container.appendChild(noteElement);
  });
}

/**
 * Save a new or edited note
 */
function saveNote() {
  const form = document.getElementById("note-form");
  const title = document.getElementById("note-title").value;
  const category = document.getElementById("note-category").value;
  const content = document.getElementById("note-content").value;

  const editMode = form.dataset.mode === "edit";
  const editId = form.dataset.editId;

  if (editMode && editId) {
    const index = notes.findIndex((note) => note.id === editId);
    if (index !== -1) {
      notes[index] = {
        ...notes[index],
        title,
        category,
        content,
        updated: Date.now(),
      };
    }
  } else {
    const newNote = {
      id: generateId(),
      title,
      category,
      content,
      created: Date.now(),
      updated: Date.now(),
    };

    notes.push(newNote);
  }

  chrome.storage.sync.set({ notes: notes }, function () {
    form.reset();
    form.dataset.mode = "add";
    delete form.dataset.editId;

    closeAllModals();
    renderNotes();
  });
}

/**
 * Open a note for editing
 * @param {string} id - Note ID to edit
 */
function openNote(id) {
  const note = notes.find((note) => note.id === id);
  if (!note) return;

  document.getElementById("note-title").value = note.title;
  document.getElementById("note-category").value = note.category;
  document.getElementById("note-content").value = note.content;

  const form = document.getElementById("note-form");
  form.dataset.mode = "edit";
  form.dataset.editId = id;

  openModal("note-modal");
}

/**
 * View a note in detail
 * @param {string} id - Note ID to view
 */
function viewNote(id) {
  const note = notes.find((note) => note.id === id);
  if (!note) return;

  document.getElementById("note-view-title").textContent = note.title;
  document.getElementById("note-view-category").textContent = note.category;
  document.getElementById("note-view-date").textContent = formatDate(
    note.updated
  );

  document.getElementById("note-view-content").innerHTML = marked.parse(
    note.content
  );

  const editBtn = document.getElementById("note-view-edit");
  const newEditBtn = editBtn.cloneNode(true);
  editBtn.parentNode.replaceChild(newEditBtn, editBtn);

  newEditBtn.addEventListener("click", function () {
    closeAllModals();
    setTimeout(() => openNote(id), 100);
  });

  openModal("note-view-modal");
}

/**
 * Delete a note
 * @param {string} id - Note ID to delete
 */
function deleteNote(id) {
  if (!confirm("Are you sure you want to delete this note?")) {
    return;
  }

  const noteIndex = notes.findIndex((note) => note.id === id);
  if (noteIndex === -1) return;

  notes.splice(noteIndex, 1);

  chrome.storage.sync.set({ notes: notes }, function () {
    renderNotes();

    showNotification("Note Deleted", "The note was successfully deleted", {
      timeout: 3000,
    });
  });
}
