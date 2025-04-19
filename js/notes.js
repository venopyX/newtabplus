// Notes functionality
let notes = [];
let categories = ["personal", "work", "ideas"]; // Default categories
let currentCategory = "all";

function initializeNotes() {
  // Add event listeners
  document.getElementById("add-note").addEventListener("click", () => {
    openModal("note-modal");
  });

  // Category selector
  document
    .querySelectorAll("#notes-categories button[data-category]")
    .forEach((button) => {
      button.addEventListener("click", function () {
        const category = this.dataset.category;
        setActiveCategory(category);
      });
    });

  // Add new category
  document
    .getElementById("add-category")
    .addEventListener("click", addNewCategory);

  // Search functionality
  document
    .querySelector("#notes-search input")
    .addEventListener("input", function () {
      filterNotes(this.value);
    });

  // Form submission handling
  document.getElementById("note-form").addEventListener("submit", function (e) {
    e.preventDefault();
    saveNote();
  });

  // Load saved notes and categories
  loadNotes();
  loadCategories();
}

// Load notes from storage
function loadNotes() {
  chrome.storage.sync.get("notes", function (data) {
    if (data.notes) {
      notes = data.notes;
      renderNotes();
    }
  });
}

// Load categories from storage
function loadCategories() {
  chrome.storage.sync.get("noteCategories", function (data) {
    if (data.noteCategories) {
      categories = data.noteCategories;
      updateCategoryOptions();
    }
  });
}

// Save categories to storage
function saveCategories() {
  chrome.storage.sync.set({ noteCategories: categories });
}

// Update category dropdown and filter buttons
function updateCategoryOptions() {
  // Update dropdown in note modal
  const dropdown = document.getElementById("note-category");
  dropdown.innerHTML = ""; // Clear existing options

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category.charAt(0).toUpperCase() + category.slice(1); // Capitalize
    dropdown.appendChild(option);
  });

  // Update category filter buttons
  const categoriesContainer = document.getElementById("notes-categories");
  const existingButtons = categoriesContainer.querySelectorAll(
    'button[data-category]:not([data-category="all"])'
  );

  // Remove existing custom category buttons
  existingButtons.forEach((button) => {
    if (
      !["all", "personal", "work", "ideas"].includes(button.dataset.category)
    ) {
      button.remove();
    }
  });

  // Add buttons for custom categories
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

// Add a new category
function addNewCategory() {
  const newCategory = prompt("Enter the name of the new category:");

  if (newCategory && newCategory.trim()) {
    const category = newCategory.trim().toLowerCase();

    // Check if category already exists
    if (categories.includes(category)) {
      alert("This category already exists");
      return;
    }

    // Add to categories array
    categories.push(category);

    // Save to storage
    saveCategories();

    // Update UI
    updateCategoryOptions();
  }
}

// Set active category
function setActiveCategory(category) {
  // Update current category
  currentCategory = category;

  // Update active button
  const buttons = document.querySelectorAll("#notes-categories button");
  buttons.forEach((button) => {
    button.classList.toggle("active", button.dataset.category === category);
  });

  // Filter notes
  renderNotes();
}

// Filter notes by search term
function filterNotes(searchTerm) {
  const search = searchTerm.toLowerCase();

  // If no search term, just filter by category
  if (!search) {
    renderNotes();
    return;
  }

  // Get notes that match the category
  const categoryNotes =
    currentCategory === "all"
      ? notes
      : notes.filter((note) => note.category === currentCategory);

  // Filter by search term
  const filteredNotes = categoryNotes.filter(
    (note) =>
      note.title.toLowerCase().includes(search) ||
      note.content.toLowerCase().includes(search)
  );

  // Render filtered notes
  renderFilteredNotes(filteredNotes);
}

// Render notes with current filters
function renderNotes() {
  const container = document.getElementById("notes-list");
  container.innerHTML = "";

  // Filter by category
  const filteredNotes =
    currentCategory === "all"
      ? notes
      : notes.filter((note) => note.category === currentCategory);

  // Sort by most recent first
  filteredNotes.sort((a, b) => b.updated - a.updated);

  renderFilteredNotes(filteredNotes);
}

// Render a filtered list of notes
function renderFilteredNotes(filteredNotes) {
  const container = document.getElementById("notes-list");
  container.innerHTML = "";

  if (filteredNotes.length === 0) {
    container.innerHTML =
      '<p class="empty-list">No notes found. Click the + button to add one.</p>';
    return;
  }

  // Create note elements
  filteredNotes.forEach((note) => {
    const noteElement = document.createElement("div");
    noteElement.className = "note-item";
    noteElement.dataset.id = note.id;
    noteElement.innerHTML = `
      <div class="note-header">
        <div class="note-title">${note.title}</div>
        <span class="note-category">${note.category}</span>
      </div>
      <div class="note-preview">${note.content}</div>
      <div class="note-actions">
        <button class="edit-btn" title="Edit Note">
          <i class="fas fa-edit"></i>
        </button>
        <button class="delete-btn" title="Delete Note">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;

    // Make the entire note card clickable
    noteElement.addEventListener("click", () => viewNote(note.id));

    // Edit button handler
    noteElement.querySelector(".edit-btn").addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent triggering the note view
      openNote(note.id);
    });

    // Delete button handler
    noteElement.querySelector(".delete-btn").addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent triggering the note view
      deleteNote(note.id);
    });

    // Append to container
    container.appendChild(noteElement);
  });
}

// Save a new or edited note
function saveNote() {
  const form = document.getElementById("note-form");
  const title = document.getElementById("note-title").value;
  const category = document.getElementById("note-category").value;
  const content = document.getElementById("note-content").value;

  // Check if editing or creating new
  const editMode = form.dataset.mode === "edit";
  const editId = form.dataset.editId;

  if (editMode && editId) {
    // Update existing note
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
    // Create new note
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

  // Save to storage
  chrome.storage.sync.set({ notes: notes }, function () {
    // Reset form and handlers
    form.reset();
    form.dataset.mode = "add";
    delete form.dataset.editId;

    // Close modal
    closeAllModals();

    // Render updated list
    renderNotes();
  });
}

// Open a note for viewing/editing
function openNote(id) {
  const note = notes.find((note) => note.id === id);
  if (!note) return;

  // Populate form
  document.getElementById("note-title").value = note.title;
  document.getElementById("note-category").value = note.category;
  document.getElementById("note-content").value = note.content;

  // Set form to edit mode
  const form = document.getElementById("note-form");
  form.dataset.mode = "edit";
  form.dataset.editId = id;

  // Open modal
  openModal("note-modal");
}

// View a note in the note view modal
function viewNote(id) {
  const note = notes.find((note) => note.id === id);
  if (!note) return;

  // Populate the note view modal
  document.getElementById("note-view-title").textContent = note.title;
  document.getElementById("note-view-category").textContent = note.category;
  document.getElementById("note-view-date").textContent = formatDate(
    note.updated
  );

  // Process content using marked.js library for proper markdown parsing
  document.getElementById("note-view-content").innerHTML = marked.parse(
    note.content
  );

  // Reset the edit button event listeners
  const editBtn = document.getElementById("note-view-edit");
  const newEditBtn = editBtn.cloneNode(true);
  editBtn.parentNode.replaceChild(newEditBtn, editBtn);

  // Set up the edit button to open the edit form
  newEditBtn.addEventListener("click", function () {
    closeAllModals(); // Close the view modal
    setTimeout(() => openNote(id), 100); // Open the edit modal with a slight delay
  });

  // Open the view modal
  openModal("note-view-modal");
}

// Delete a note after confirmation
function deleteNote(id) {
  if (!confirm("Are you sure you want to delete this note?")) {
    return;
  }

  // Find note index
  const noteIndex = notes.findIndex((note) => note.id === id);
  if (noteIndex === -1) return;

  // Remove from array
  notes.splice(noteIndex, 1);

  // Save to storage
  chrome.storage.sync.set({ notes: notes }, function () {
    // Render updated list
    renderNotes();

    // Show feedback
    showNotification("Note Deleted", "The note was successfully deleted", {
      timeout: 3000,
    });
  });
}

// Helper function to escape HTML
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
