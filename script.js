const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const directionToggle = document.getElementById("directionToggle");

const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");
const clearSelectionsBtn = document.getElementById("clearSelections");

const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");

const WORKER_ENDPOINT = window.WORKER_ENDPOINT || "/api/chat";

const STORAGE_KEYS = {
  selected: "loreal-selected-products",
  history: "loreal-chat-history",
  direction: "loreal-direction",
  category: "loreal-category",
  search: "loreal-search",
};

const state = {
  products: [],
  selectedIds: new Set(readJSON(STORAGE_KEYS.selected, [])),
  conversation: readJSON(STORAGE_KEYS.history, [
    {
      role: "assistant",
      content:
        "Pick a category, select products, and I will build a personalized routine.",
    },
  ]),
  expandedIds: new Set(),
  hasGeneratedRoutine: false,
};

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCategory(category = "") {
  return category.replaceAll("_", " ");
}

function selectedProducts() {
  return state.products.filter((product) => state.selectedIds.has(product.id));
}

function setDirection(direction) {
  document.documentElement.dir = direction;
  document.body.dir = direction;
  directionToggle.value = direction;
  localStorage.setItem(STORAGE_KEYS.direction, direction);
}

function saveSelectionState() {
  saveJSON(STORAGE_KEYS.selected, [...state.selectedIds]);
}

function saveConversationState() {
  saveJSON(STORAGE_KEYS.history, state.conversation);
}

function syncUIState() {
  clearSelectionsBtn.disabled = state.selectedIds.size === 0;
  generateRoutineBtn.disabled = state.selectedIds.size === 0;
}

function appendMessage(role, content) {
  state.conversation.push({ role, content });
  saveConversationState();
  renderChat();
}

function renderChat() {
  chatWindow.innerHTML = state.conversation
    .map(
      (message) => `
        <div class="chat-message ${message.role}">
          ${escapeHtml(message.content).replace(/\n/g, "<br>")}
        </div>
      `
    )
    .join("");

  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function showTyping() {
  const el = document.createElement("div");
  el.id = "typing-indicator";
  el.className = "typing-indicator";
  el.innerHTML = "<span></span><span></span><span></span>";
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function hideTyping() {
  document.getElementById("typing-indicator")?.remove();
}

function renderSelectedProducts() {
  const list = selectedProducts();

  if (!list.length) {
    selectedProductsList.innerHTML = `
      <div class="placeholder-message">
        No products selected yet
      </div>
    `;
    syncUIState();
    return;
  }

  selectedProductsList.innerHTML = list
    .map(
      (product) => `
      <div class="selected-item" data-id="${product.id}">
        <div>
          <strong>${escapeHtml(product.name)}</strong>
          <span>${escapeHtml(product.brand)} · ${escapeHtml(
        formatCategory(product.category)
      )}</span>
        </div>
        <button
          type="button"
          class="remove-selected"
          data-action="remove"
          data-id="${product.id}"
          aria-label="Remove ${escapeHtml(product.name)}"
        >
          &times;
        </button>
      </div>
    `
    )
    .join("");

  syncUIState();
}

function renderProducts() {
  const category = categoryFilter.value.trim();
  const query = productSearch.value.trim().toLowerCase();

  let filtered = state.products.slice();

  if (category) {
    filtered = filtered.filter((product) => product.category === category);
  }

  if (query) {
    filtered = filtered.filter((product) => {
      const haystack = [
        product.name,
        product.brand,
        product.category,
        product.description,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }

  if (!category && !query) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Choose a category or type a search term to view products
      </div>
    `;
    return;
  }

  if (!filtered.length) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products match your filters
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = filtered
    .map((product) => {
      const selected = state.selectedIds.has(product.id);
      const expanded = state.expandedIds.has(product.id);

      return `
        <article
          class="product-card ${selected ? "selected" : ""} ${
        expanded ? "expanded" : ""
      }"
          data-id="${product.id}"
          tabindex="0"
          role="button"
          aria-pressed="${selected}"
        >
          <div class="card-top">
            <img src="${escapeHtml(product.image)}" alt="${escapeHtml(
        product.name
      )}">
            <button
              type="button"
              class="details-btn"
              data-action="details"
              data-id="${product.id}"
              aria-expanded="${expanded}"
            >
              ${expanded ? "Hide details" : "View details"}
            </button>
          </div>

          <div class="product-info">
            <p class="eyebrow">${escapeHtml(product.brand)}</p>
            <h3>${escapeHtml(product.name)}</h3>
            <p class="category">${escapeHtml(formatCategory(product.category))}</p>
            <p class="product-description">${escapeHtml(product.description)}</p>
            <p class="card-hint ${selected ? "selected" : ""}">
              ${selected ? "Selected" : "Click card to select"}
            </p>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  state.products = data.products || [];
}

function toggleProductSelection(productId) {
  if (state.selectedIds.has(productId)) {
    state.selectedIds.delete(productId);
  } else {
    state.selectedIds.add(productId);
  }

  saveSelectionState();
  renderProducts();
  renderSelectedProducts();
}

function toggleDescription(productId) {
  if (state.expandedIds.has(productId)) {
    state.expandedIds.delete(productId);
  } else {
    state.expandedIds.add(productId);
  }

  renderProducts();
}

async function generateRoutine() {
  const picks = selectedProducts();

  if (!picks.length) {
    appendMessage("assistant", "Select at least one product before generating a routine.");
    return;
  }

  const payloadProducts = picks.map((product) => ({
    id: product.id,
    brand: product.brand,
    name: product.name,
    category: product.category,
    description: product.description,
  }));

  appendMessage(
    "user",
    `Generate a personalized routine using only these selected products:\n${picks
      .map((p) => `- ${p.brand} ${p.name}`)
      .join("\n")}`
  );

  generateRoutineBtn.disabled = true;
  generateRoutineBtn.textContent = "Generating…";
  showTyping();

  try {
    const response = await fetch(WORKER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: state.conversation,
        selectedProducts: payloadProducts,
      }),
    });

    const text = await response.text();
    if (!text) throw new Error("Worker returned an empty response. Is it deployed?");
    const data = JSON.parse(text);

    if (!response.ok) {
      throw new Error(data.error || "Failed to generate routine.");
    }

    state.hasGeneratedRoutine = true;
    hideTyping();
    appendMessage("assistant", data.text || "I could not generate a response.");
  } catch (error) {
    hideTyping();
    appendMessage("assistant", `Error: ${error.message}`);
  } finally {
    generateRoutineBtn.disabled = state.selectedIds.size === 0;
    generateRoutineBtn.innerHTML =
      '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Routine';
    syncUIState();
  }
}

async function sendFollowUp(messageText) {
  appendMessage("user", messageText);
  showTyping();

  try {
    const response = await fetch(WORKER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: state.conversation,
        selectedProducts: selectedProducts().map((product) => ({
          id: product.id,
          brand: product.brand,
          name: product.name,
          category: product.category,
          description: product.description,
        })),
      }),
    });

    const text = await response.text();
    if (!text) throw new Error("Worker returned an empty response. Is it deployed?");
    const data = JSON.parse(text);

    if (!response.ok) {
      throw new Error(data.error || "Chat request failed.");
    }

    hideTyping();
    appendMessage("assistant", data.text || "I could not generate a response.");
  } catch (error) {
    hideTyping();
    appendMessage("assistant", `Error: ${error.message}`);
  }
}

productsContainer.addEventListener("click", (event) => {
  const detailsButton = event.target.closest("[data-action='details']");
  if (detailsButton) {
    event.stopPropagation();
    toggleDescription(Number(detailsButton.dataset.id));
    return;
  }

  const removeButton = event.target.closest("[data-action='remove']");
  if (removeButton) {
    event.stopPropagation();
    toggleProductSelection(Number(removeButton.dataset.id));
    return;
  }

  const card = event.target.closest(".product-card");
  if (card) {
    toggleProductSelection(Number(card.dataset.id));
  }
});

productsContainer.addEventListener("keydown", (event) => {
  const card = event.target.closest(".product-card");
  if (!card) return;

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    toggleProductSelection(Number(card.dataset.id));
  }
});

selectedProductsList.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-action='remove']");
  if (!removeButton) return;
  toggleProductSelection(Number(removeButton.dataset.id));
});

categoryFilter.addEventListener("change", () => {
  localStorage.setItem(STORAGE_KEYS.category, categoryFilter.value);
  renderProducts();
});

productSearch.addEventListener("input", () => {
  localStorage.setItem(STORAGE_KEYS.search, productSearch.value);
  renderProducts();
});

directionToggle.addEventListener("change", () => {
  setDirection(directionToggle.value);
  renderProducts();
  renderSelectedProducts();
  renderChat();
});

clearSelectionsBtn.addEventListener("click", () => {
  state.selectedIds.clear();
  saveSelectionState();
  renderProducts();
  renderSelectedProducts();
});

generateRoutineBtn.addEventListener("click", generateRoutine);

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = userInput.value.trim();
  if (!text) return;

  if (!state.hasGeneratedRoutine) {
    appendMessage(
      "assistant",
      "Generate a routine first, then I can answer follow-up questions about it."
    );
    userInput.value = "";
    return;
  }

  userInput.value = "";
  await sendFollowUp(text);
});

async function init() {
  setDirection(localStorage.getItem(STORAGE_KEYS.direction) || "ltr");
  categoryFilter.value = localStorage.getItem(STORAGE_KEYS.category) || "";
  productSearch.value = localStorage.getItem(STORAGE_KEYS.search) || "";

  await loadProducts();

  if (!state.conversation.length) {
    state.conversation = [
      {
        role: "assistant",
        content:
          "Pick a category, select products, and I will build a personalized routine.",
      },
    ];
    saveConversationState();
  }

  renderProducts();
  renderSelectedProducts();
  renderChat();
  syncUIState();
}

init();