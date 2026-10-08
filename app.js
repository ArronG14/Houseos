const STORAGE_KEY = "houseos-furniture-layout-v1";

const templates = {
  sofa: { label: "Sofa", w: 18, h: 7, x: 49, y: 28, rotation: 0 },
  tv: { label: "TV", w: 12, h: 2.5, x: 25, y: 48, rotation: 90 },
  "tv-stand": { label: "TV stand", w: 14, h: 4, x: 27, y: 50, rotation: 90 },
  "dining-table": { label: "Dining table", w: 14, h: 9, x: 58, y: 31, rotation: 0 },
  chair: { label: "Chair", w: 5, h: 5, x: 61, y: 38, rotation: 0 },
  fridge: { label: "Fridge", w: 5, h: 8, x: 88, y: 69, rotation: 0 },
  "kitchen-run": { label: "Kitchen", w: 22, h: 5, x: 91, y: 61, rotation: 90 },
  "upper-cupboards": { label: "Cupboards", w: 22, h: 3.5, x: 95, y: 61, rotation: 90 },
};

const state = {
  pieces: [],
  selectedId: null,
  drag: null,
};

const stage = document.querySelector("#planStage");
const layer = document.querySelector("#furnitureLayer");
const saveStatus = document.querySelector("#saveStatus");
const selectedName = document.querySelector("#selectedName");
const sizeControl = document.querySelector("#sizeControl");

document.querySelectorAll("[data-add]").forEach((button) => {
  button.addEventListener("click", () => addPiece(button.dataset.add));
});

document.querySelector("#rotateLeft").addEventListener("click", () => rotateSelected(-90));
document.querySelector("#rotateRight").addEventListener("click", () => rotateSelected(90));
document.querySelector("#deleteItem").addEventListener("click", deleteSelected);
document.querySelector("#saveLayout").addEventListener("click", () => saveLayout("Saved"));
document.querySelector("#exportLayout").addEventListener("click", exportLayout);
document.querySelector("#exportImage").addEventListener("click", exportImage);
document.querySelector("#clearLayout").addEventListener("click", clearLayout);

sizeControl.addEventListener("input", () => {
  const piece = selectedPiece();
  if (!piece) return;
  piece.scale = Number(sizeControl.value) / 100;
  render();
  saveLayout("Saved");
});

stage.addEventListener("pointerdown", (event) => {
  if (event.target === stage || event.target.id === "floorplan" || event.target === layer) {
    selectPiece(null);
  }
});

function addPiece(type) {
  const template = templates[type];
  const offset = state.pieces.filter((piece) => piece.type === type).length * 2;
  const piece = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    type,
    label: template.label,
    x: clamp(template.x + offset, 5, 95),
    y: clamp(template.y + offset, 5, 95),
    w: template.w,
    h: template.h,
    rotation: template.rotation,
    scale: 1,
  };

  state.pieces.push(piece);
  state.selectedId = piece.id;
  render();
  saveLayout("Added");
}

function render() {
  layer.replaceChildren();

  state.pieces.forEach((piece) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `piece ${piece.type}${piece.id === state.selectedId ? " selected" : ""}`;
    el.dataset.id = piece.id;
    el.dataset.label = piece.label;
    el.style.setProperty("--x", piece.x);
    el.style.setProperty("--y", piece.y);
    el.style.setProperty("--w", piece.w * piece.scale);
    el.style.setProperty("--h", piece.h * piece.scale);
    el.style.setProperty("--r", `${piece.rotation}deg`);
    el.setAttribute("aria-label", `${piece.label}, drag to move`);

    el.addEventListener("pointerdown", startDrag);
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      selectPiece(piece.id);
    });

    layer.appendChild(el);
  });

  updateSelection();
}

function startDrag(event) {
  const id = event.currentTarget.dataset.id;
  const piece = state.pieces.find((item) => item.id === id);
  if (!piece) return;

  event.preventDefault();
  event.stopPropagation();
  selectPiece(id);

  const point = eventToPercent(event);
  state.drag = {
    id,
    pointerId: event.pointerId,
    startX: point.x,
    startY: point.y,
    pieceX: piece.x,
    pieceY: piece.y,
  };

  window.addEventListener("pointermove", dragMove);
  window.addEventListener("pointerup", endDrag, { once: true });
  window.addEventListener("pointercancel", endDrag, { once: true });
}

function dragMove(event) {
  if (!state.drag || event.pointerId !== state.drag.pointerId) return;
  const piece = state.pieces.find((item) => item.id === state.drag.id);
  if (!piece) return;

  const point = eventToPercent(event);
  piece.x = clamp(state.drag.pieceX + point.x - state.drag.startX, 2, 98);
  piece.y = clamp(state.drag.pieceY + point.y - state.drag.startY, 2, 98);
  render();
}

function endDrag() {
  window.removeEventListener("pointermove", dragMove);
  state.drag = null;
  saveLayout("Saved");
}

function eventToPercent(event) {
  const rect = stage.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 100,
    y: ((event.clientY - rect.top) / rect.height) * 100,
  };
}

function selectPiece(id) {
  state.selectedId = id;
  render();
}

function selectedPiece() {
  return state.pieces.find((piece) => piece.id === state.selectedId);
}

function updateSelection() {
  const piece = selectedPiece();
  selectedName.textContent = piece ? piece.label : "Nothing selected";
  sizeControl.disabled = !piece;
  sizeControl.value = piece ? Math.round(piece.scale * 100) : 100;

  document.querySelector("#rotateLeft").disabled = !piece;
  document.querySelector("#rotateRight").disabled = !piece;
  document.querySelector("#deleteItem").disabled = !piece;
}

function rotateSelected(amount) {
  const piece = selectedPiece();
  if (!piece) return;
  piece.rotation = (piece.rotation + amount + 360) % 360;
  render();
  saveLayout("Saved");
}

function deleteSelected() {
  if (!state.selectedId) return;
  state.pieces = state.pieces.filter((piece) => piece.id !== state.selectedId);
  state.selectedId = null;
  render();
  saveLayout("Deleted");
}

function clearLayout() {
  state.pieces = [];
  state.selectedId = null;
  render();
  saveLayout("Cleared");
}

function saveLayout(message = "Saved") {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.pieces));
  setStatus(message);
}

function loadLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(saved)) {
      state.pieces = saved;
    }
  } catch {
    state.pieces = [];
  }
  render();
}

function exportLayout() {
  const payload = {
    app: "HouseOS Furniture Editor",
    savedAt: new Date().toISOString(),
    floorplan: "approved-floorplan.jpg",
    pieces: state.pieces,
  };
  downloadFile("houseos-layout.json", JSON.stringify(payload, null, 2), "application/json");
  setStatus("JSON exported");
}

async function exportImage() {
  const image = document.querySelector("#floorplan");
  await image.decode().catch(() => {});

  const canvas = document.createElement("canvas");
  const rect = stage.getBoundingClientRect();
  canvas.width = 1196;
  canvas.height = 1202;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  state.pieces.forEach((piece) => drawPiece(ctx, piece, canvas.width, canvas.height));

  canvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "houseos-layout.png";
    link.click();
    URL.revokeObjectURL(link.href);
  }, "image/png");

  setStatus(rect.width < 500 ? "Image exported" : "Image exported");
}

function drawPiece(ctx, piece, width, height) {
  const pieceWidth = (piece.w * piece.scale * width) / 100;
  const pieceHeight = (piece.h * piece.scale * height) / 100;
  const x = (piece.x * width) / 100;
  const y = (piece.y * height) / 100;

  const colors = {
    sofa: "#aeb7b4",
    tv: "#101010",
    "tv-stand": "#e8dfd1",
    "dining-table": "#a87345",
    chair: "#80928c",
    fridge: "#f4f8fb",
    "kitchen-run": "#e8e0d3",
    "upper-cupboards": "#d8d0c5",
  };

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((piece.rotation * Math.PI) / 180);
  ctx.fillStyle = colors[piece.type] || "#d9d2c7";
  ctx.strokeStyle = "#071016";
  ctx.lineWidth = 3;
  roundRect(ctx, -pieceWidth / 2, -pieceHeight / 2, pieceWidth, pieceHeight, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = piece.type === "tv" ? "#f5f8fb" : "#071016";
  ctx.font = "bold 22px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(piece.label, 0, 0, pieceWidth * 0.84);
  ctx.restore();
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function setStatus(message) {
  saveStatus.textContent = message;
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(() => {
    saveStatus.textContent = "Ready";
  }, 1800);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

loadLayout();
