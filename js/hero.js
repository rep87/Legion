const HERO_MOVE_SPEED = 220;
const HERO_ATTACK_RANGE = 68;
const HERO_ATTACK_DAMAGE = 48;
const HERO_ATTACK_COOLDOWN = 0.4;
const HERO_SIGHT_RADIUS = 96;
const HERO_LOOT_RANGE = 92;
const HERO_SLOT_COUNT = 2;
const INVENTORY_SLOT_COUNT = 9;
const LOOT_CLICK_RADIUS = 18;
const HERO_SPRITE_DRAW_SIZE = 32;
const HERO_SPRITE_PATH = new URL("../assets/hero/hero_32_base.png", import.meta.url).href;

const gameState = window.gameState;

if (!gameState) {
  throw new Error("hero.js requires window.gameState from game.js");
}

const hero = gameState.hero;
const heroState = {
  x: Number.isFinite(hero.x) ? hero.x : 400,
  y: Number.isFinite(hero.y) ? hero.y : 300,
  targetX: Number.isFinite(hero.x) ? hero.x : 400,
  targetY: Number.isFinite(hero.y) ? hero.y : 300,
  moveUp: false,
  moveDown: false,
  moveLeft: false,
  moveRight: false,
  attackCooldown: 0,
  lastFogSignalX: Number.isFinite(hero.x) ? hero.x : 400,
  lastFogSignalY: Number.isFinite(hero.y) ? hero.y : 300,
  initialized: false,
  lastTick: performance.now(),
  localItemId: 0,
};

hero.items = Array(HERO_SLOT_COUNT).fill(null);

function createSpriteAsset(src) {
  const image = new Image();
  const asset = { image, loaded: false, failed: false, src, renderSource: image };

  image.addEventListener(
    "load",
    () => {
      asset.renderSource = stripHeroBackdrop(image);
      asset.loaded = true;
    },
    { once: true }
  );

  image.addEventListener(
    "error",
    () => {
      asset.failed = true;
      console.warn(`Failed to load hero sprite: ${src}`);
    },
    { once: true }
  );

  image.src = src;
  return asset;
}

const heroSpriteAsset = createSpriteAsset(HERO_SPRITE_PATH);

function stripHeroBackdrop(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return image;
  }

  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const width = canvas.width;
  const height = canvas.height;
  const visited = new Uint8Array(width * height);
  const queue = [];

  function getOffset(x, y) {
    return (y * width + x) * 4;
  }

  function sampleColor(x, y) {
    const offset = getOffset(x, y);
    return {
      r: data[offset],
      g: data[offset + 1],
      b: data[offset + 2],
      a: data[offset + 3],
    };
  }

  const backdropSamples = [
    sampleColor(0, 0),
    sampleColor(width - 1, 0),
    sampleColor(0, height - 1),
    sampleColor(width - 1, height - 1),
  ];

  function matchesBackdrop(x, y) {
    const offset = getOffset(x, y);
    const alpha = data[offset + 3];
    if (alpha === 0) {
      return true;
    }

    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const average = (red + green + blue) / 3;
    const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
    const tolerance = average >= 205 ? 38 : 28;

    return backdropSamples.some((sample) => {
      if (sample.a === 0) {
        return false;
      }

      const colorDistance = Math.abs(red - sample.r) + Math.abs(green - sample.g) + Math.abs(blue - sample.b);
      return colorDistance <= tolerance && spread <= 32;
    });
  }

  function enqueue(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }

    const index = y * width + x;
    if (visited[index]) {
      return;
    }

    visited[index] = 1;
    queue.push([x, y]);
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }

  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (queue.length > 0) {
    const [x, y] = queue.shift();
    if (!matchesBackdrop(x, y)) {
      continue;
    }

    const offset = getOffset(x, y);
    data[offset + 3] = 0;

    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ensureInventoryState() {
  if (Array.isArray(gameState.inventory)) {
    return gameState.inventory;
  }

  if (Array.isArray(gameState.inventory?.slots)) {
    return gameState.inventory.slots;
  }

  gameState.inventory = Array(INVENTORY_SLOT_COUNT).fill(null);
  return gameState.inventory;
}

function getInventorySlots() {
  return ensureInventoryState();
}

function nextLocalItemId() {
  heroState.localItemId += 1;
  return `hero-item-${heroState.localItemId}`;
}

function setHeroPosition(x, y) {
  heroState.x = clamp(x, 0, 800);
  heroState.y = clamp(y, 0, 600);
}

function clearHeroItems() {
  hero.items = Array(HERO_SLOT_COUNT).fill(null);
}

function patchHeroPosition() {
  const xDescriptor = Object.getOwnPropertyDescriptor(hero, "x");
  const yDescriptor = Object.getOwnPropertyDescriptor(hero, "y");
  if ((xDescriptor && xDescriptor.get) || (yDescriptor && yDescriptor.get)) {
    return;
  }

  Object.defineProperty(hero, "x", {
    configurable: true,
    enumerable: true,
    get() {
      return heroState.x;
    },
    set() {
      return heroState.x;
    },
  });

  Object.defineProperty(hero, "y", {
    configurable: true,
    enumerable: true,
    get() {
      return heroState.y;
    },
    set() {
      return heroState.y;
    },
  });

  setHeroPosition(heroState.x, heroState.y);
}

function ensureOverlay() {
  const existing = document.getElementById("hero-item-slots");
  if (existing) {
    return existing;
  }

  const canvasWrap = document.querySelector(".canvas-wrap");
  if (!canvasWrap) {
    return null;
  }

  if (!document.getElementById("hero-ui-style")) {
    const style = document.createElement("style");
    style.id = "hero-ui-style";
    style.textContent = [
      "#hero-item-slots {",
      "  position: absolute;",
      "  top: 12px;",
      "  right: 12px;",
      "  width: 126px;",
      "  padding: 10px;",
      "  border: 1px solid rgba(255, 107, 45, 0.65);",
      "  background: rgba(7, 10, 16, 0.84);",
      "  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);",
      "  font: 11px \"Courier New\", monospace;",
      "  color: #dfe7f4;",
      "  pointer-events: none;",
      "  z-index: 3;",
      "}",
      "#hero-item-slots .hero-slots-title {",
      "  margin-bottom: 8px;",
      "  color: #ffb38b;",
      "  text-transform: uppercase;",
      "  letter-spacing: 1px;",
      "}",
      "#hero-item-slots .hero-slots-grid {",
      "  display: grid;",
      "  grid-template-columns: repeat(2, 1fr);",
      "  gap: 8px;",
      "}",
      "#hero-item-slots .hero-slot {",
      "  min-height: 48px;",
      "  padding: 6px 4px;",
      "  border: 1px solid rgba(54, 70, 91, 0.95);",
      "  background: linear-gradient(180deg, rgba(24, 34, 47, 0.96), rgba(10, 15, 24, 0.96));",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  text-align: center;",
      "  color: #7f8da1;",
      "  line-height: 1.25;",
      "  white-space: pre-line;",
      "}",
      "#hero-item-slots .hero-slot.filled {",
      "  color: #f5f8fd;",
      "}",
    ].join("\n");
    document.head.appendChild(style);
  }

  const overlay = document.createElement("section");
  overlay.id = "hero-item-slots";
  overlay.innerHTML = [
    '<div class="hero-slots-title">Hero Gear</div>',
    '<div class="hero-slots-grid">',
    '  <div class="hero-slot" data-slot-index="0">EMPTY</div>',
    '  <div class="hero-slot" data-slot-index="1">EMPTY</div>',
    '</div>',
  ].join("");

  canvasWrap.appendChild(overlay);
  return overlay;
}

function formatItemLabel(item) {
  if (!item) {
    return "EMPTY";
  }

  if (typeof item === "string") {
    return item.toUpperCase();
  }

  const grade = item.grade || item.rank || "";
  const name = item.name || item.label || item.type || item.partType || "ITEM";
  return `${grade ? `${grade} ` : ""}${String(name).toUpperCase()}`;
}

function renderHeroSlots() {
  const overlay = ensureOverlay();
  if (!overlay) {
    return;
  }

  Array.from(overlay.querySelectorAll(".hero-slot")).forEach((slotNode, index) => {
    const item = hero.items[index];
    slotNode.textContent = formatItemLabel(item);
    slotNode.classList.toggle("filled", Boolean(item));
  });
}

function renderInventoryFallback() {
  const grid = document.getElementById("inventory-grid");
  if (!grid) {
    return;
  }

  const slots = getInventorySlots();
  const children = Array.from(grid.children);
  children.forEach((child, index) => {
    if (child.classList.contains("inventory-slot")) {
      return;
    }

    const item = slots[index] || null;
    child.textContent = item ? formatItemLabel(item) : String(index + 1);
    child.title = item ? formatItemLabel(item) : "EMPTY";
    child.style.color = item ? "#e7edf7" : "#8b98aa";
    child.style.padding = item ? "6px" : "0";
    child.style.textAlign = "center";
  });
}

function syncInventoryDisplay() {
  renderInventoryFallback();
}

function setStatus(message) {
  gameState.message = message;
}

function signalFogUpdate(force) {
  const shouldForce = Boolean(force);
  const dx = heroState.x - heroState.lastFogSignalX;
  const dy = heroState.y - heroState.lastFogSignalY;
  if (!shouldForce && Math.hypot(dx, dy) < 24) {
    return;
  }

  const reveal = {
    x: Math.round(heroState.x),
    y: Math.round(heroState.y),
    radius: HERO_SIGHT_RADIUS,
    source: "hero",
  };

  if (window.mapSystem?.revealArea) {
    window.mapSystem.revealArea(reveal.x, reveal.y, reveal.radius, `hero:manual:${reveal.x}:${reveal.y}`);
  } else {
    gameState.fogOfWar.push(reveal);
  }

  heroState.lastFogSignalX = heroState.x;
  heroState.lastFogSignalY = heroState.y;

  if (typeof window.updateFogOfWar === "function") {
    window.updateFogOfWar(reveal);
  }

  window.dispatchEvent(new CustomEvent("hero:fog-update", { detail: reveal }));
}

function inventoryHasSpace() {
  return getInventorySlots().some((slot) => slot === null);
}

function mapPartType(rawType) {
  return {
    arm: "arm",
    leg: "legs",
    legs: "legs",
    head: "head",
    body: "torso",
    torso: "torso",
    disassembler: "disassembler",
  }[rawType] || "arm";
}

function normalizeInventoryItem(item) {
  if (!item) {
    return null;
  }

  if (item.id && item.rank && item.type) {
    return item;
  }

  const type = mapPartType(item.partType || item.type || item.kind);
  const rank = item.rank || item.grade || "C";
  const saleValueTable = { C: 10, B: 25, A: 55, S: 125 };
  return {
    id: nextLocalItemId(),
    type,
    rank,
    label: type === "disassembler" ? "DISASSEMBLER" : `${type.toUpperCase()}-${rank}`,
    saleValue: saleValueTable[rank] || 10,
    isDisassemblyTool: type === "disassembler",
    sourceDropId: item.id || null,
  };
}

function addItemToInventory(item) {
  const normalizedItem = normalizeInventoryItem(item);
  if (!normalizedItem) {
    return false;
  }

  if (window.inventorySystem?.addItem) {
    const added = window.inventorySystem.addItem(normalizedItem);
    syncInventoryDisplay();
    return added;
  }

  const slots = getInventorySlots();
  const emptyIndex = slots.findIndex((slot) => slot === null);
  if (emptyIndex === -1) {
    return false;
  }

  slots[emptyIndex] = normalizedItem;
  syncInventoryDisplay();
  return true;
}

function resolveDroppedItemPosition(item) {
  return {
    x: Number.isFinite(item && item.x) ? item.x : Number.isFinite(item && item.position && item.position.x) ? item.position.x : 0,
    y: Number.isFinite(item && item.y) ? item.y : Number.isFinite(item && item.position && item.position.y) ? item.position.y : 0,
  };
}

function collectGold(item) {
  const goldAmount = Math.max(0, Number(item?.amount) || 0);
  gameState.gold = (gameState.gold || 0) + goldAmount;
  setStatus(`Collected ${goldAmount}G.`);
  syncInventoryDisplay();
  return true;
}

function lootItem(item, index) {
  const position = resolveDroppedItemPosition(item);
  const distance = Math.hypot(heroState.x - position.x, heroState.y - position.y);
  if (distance > HERO_LOOT_RANGE) {
    setStatus("Item is too far away.");
    return false;
  }

  if (item?.kind === "gold") {
    collectGold(item);
    gameState.droppedItems.splice(index, 1);
    return true;
  }

  if (!inventoryHasSpace()) {
    setStatus("Inventory is full.");
    return false;
  }

  const inventoryItem = normalizeInventoryItem(item && item.payload ? item.payload : item);
  const added = addItemToInventory(inventoryItem);
  if (!added) {
    setStatus("Inventory is full.");
    return false;
  }

  gameState.droppedItems.splice(index, 1);
  setStatus(`${formatItemLabel(inventoryItem)} recovered.`);
  renderHeroSlots();
  syncInventoryDisplay();
  return true;
}

function findClickedLoot(worldX, worldY) {
  for (let index = gameState.droppedItems.length - 1; index >= 0; index -= 1) {
    const item = gameState.droppedItems[index];
    const position = resolveDroppedItemPosition(item);
    if (Math.hypot(worldX - position.x, worldY - position.y) <= LOOT_CLICK_RADIUS) {
      return { item, index };
    }
  }

  return null;
}

function damageEnemy(enemy, amount) {
  if (!enemy) {
    return false;
  }

  if (enemy.id && typeof window.enemySystem?.damageEnemy === "function") {
    return Boolean(window.enemySystem.damageEnemy(enemy.id, amount));
  }

  if (typeof enemy.takeDamage === "function") {
    enemy.takeDamage(amount, { source: "hero" });
    return true;
  }

  if (typeof enemy.hp === "number") {
    enemy.hp -= amount;
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.isDead = true;
    }
    return true;
  }

  return false;
}

function pruneDeadEnemies() {
  gameState.enemies = gameState.enemies.filter((enemy) => !enemy.isDead && !enemy.dead && enemy.hp !== 0);
}

function findAttackTarget() {
  let nearest = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const enemy of gameState.enemies) {
    const enemyX = Number.isFinite(enemy && enemy.x) ? enemy.x : 0;
    const enemyY = Number.isFinite(enemy && enemy.y) ? enemy.y : 0;
    const distance = Math.hypot(heroState.x - enemyX, heroState.y - enemyY);
    if (distance <= HERO_ATTACK_RANGE && distance < bestDistance) {
      nearest = enemy;
      bestDistance = distance;
    }
  }

  return nearest;
}

function performAttack(options = {}) {
  const silent = Boolean(options.silent);
  const automatic = Boolean(options.automatic);

  if (heroState.attackCooldown > 0) {
    return false;
  }

  const target = findAttackTarget();
  if (!target) {
    if (!silent) {
      setStatus("No enemy in melee range.");
    }
    return false;
  }

  heroState.attackCooldown = HERO_ATTACK_COOLDOWN;
  damageEnemy(target, HERO_ATTACK_DAMAGE);
  pruneDeadEnemies();
  setStatus(automatic ? `Auto attack hit for ${HERO_ATTACK_DAMAGE}.` : `Melee attack hit for ${HERO_ATTACK_DAMAGE}.`);
  return true;
}

function updateAutoAttack() {
  performAttack({ automatic: true, silent: true });
}

function normalizeVector(x, y) {
  const length = Math.hypot(x, y);
  if (!length) {
    return { x: 0, y: 0 };
  }

  return { x: x / length, y: y / length };
}

function updateMovement(deltaSeconds) {
  const keyboardX = Number(heroState.moveRight) - Number(heroState.moveLeft);
  const keyboardY = Number(heroState.moveDown) - Number(heroState.moveUp);

  let directionX = keyboardX;
  let directionY = keyboardY;

  if (directionX === 0 && directionY === 0) {
    directionX = heroState.targetX - heroState.x;
    directionY = heroState.targetY - heroState.y;
    if (Math.hypot(directionX, directionY) <= 4) {
      directionX = 0;
      directionY = 0;
    }
  }

  const direction = normalizeVector(directionX, directionY);

  setHeroPosition(
    heroState.x + direction.x * HERO_MOVE_SPEED * deltaSeconds,
    heroState.y + direction.y * HERO_MOVE_SPEED * deltaSeconds
  );

  signalFogUpdate(false);
}

function toCanvasCoordinates(event) {
  const canvas = document.getElementById("game-canvas");
  if (!canvas) {
    return { x: 0, y: 0 };
  }

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function onCanvasPointerDown(event) {
  const coordinates = toCanvasCoordinates(event);
  const clickedLoot = findClickedLoot(coordinates.x, coordinates.y);

  if (clickedLoot) {
    lootItem(clickedLoot.item, clickedLoot.index);
    return;
  }

  const enemyNearby = gameState.enemies.some((enemy) => {
    const enemyX = Number.isFinite(enemy && enemy.x) ? enemy.x : 0;
    const enemyY = Number.isFinite(enemy && enemy.y) ? enemy.y : 0;
    return Math.hypot(coordinates.x - enemyX, coordinates.y - enemyY) <= 24 && Math.hypot(heroState.x - enemyX, heroState.y - enemyY) <= HERO_ATTACK_RANGE;
  });

  if (event.button === 0 && enemyNearby) {
    performAttack();
    return;
  }

  heroState.targetX = coordinates.x;
  heroState.targetY = coordinates.y;
}

function isHeroVisible() {
  if (!Array.isArray(gameState.fogOfWar) || gameState.fogOfWar.length === 0) {
    return true;
  }

  return gameState.fogOfWar.some((zone) => {
    const dx = heroState.x - zone.x;
    const dy = heroState.y - zone.y;
    return dx * dx + dy * dy <= zone.radius * zone.radius;
  });
}

function drawHeroSprite() {
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas?.getContext("2d");
  if (!ctx || !heroSpriteAsset.loaded || !isHeroVisible()) {
    return;
  }

  const drawX = Math.round(heroState.x - HERO_SPRITE_DRAW_SIZE / 2);
  const drawY = Math.round(heroState.y - HERO_SPRITE_DRAW_SIZE / 2);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(heroSpriteAsset.renderSource || heroSpriteAsset.image, drawX, drawY, HERO_SPRITE_DRAW_SIZE, HERO_SPRITE_DRAW_SIZE);
  ctx.restore();
}

function onKeyChange(event, pressed) {
  if (event.repeat && pressed) {
    return;
  }

  switch (event.code) {
    case "KeyW":
      heroState.moveUp = pressed;
      break;
    case "KeyS":
      heroState.moveDown = pressed;
      break;
    case "KeyA":
      heroState.moveLeft = pressed;
      break;
    case "KeyD":
      heroState.moveRight = pressed;
      break;
    case "Space":
      if (pressed) {
        event.preventDefault();
        performAttack();
      }
      break;
    default:
      break;
  }
}

function tick() {
  const now = performance.now();
  const deltaSeconds = Math.min(0.05, (now - heroState.lastTick) / 1000);
  heroState.lastTick = now;
  heroState.attackCooldown = Math.max(0, heroState.attackCooldown - deltaSeconds);
  updateMovement(deltaSeconds);
  updateAutoAttack();
  renderHeroSlots();
  syncInventoryDisplay();
  drawHeroSprite();
  window.enemySystem?.drawSprites?.();
  window.requestAnimationFrame(tick);
}

function wrapAdvanceTime() {
  const previousAdvanceTime = window.advanceTime;
  if (typeof previousAdvanceTime !== "function") {
    return;
  }

  window.advanceTime = (ms) => {
    previousAdvanceTime(ms);
    const deltaSeconds = Math.max(0, ms / 1000);
    heroState.attackCooldown = Math.max(0, heroState.attackCooldown - deltaSeconds);
    updateMovement(deltaSeconds);
    updateAutoAttack();
    renderHeroSlots();
    syncInventoryDisplay();
    drawHeroSprite();
    window.enemySystem?.drawSprites?.();
  };
}

function bindHeroControls() {
  const canvas = document.getElementById("game-canvas");
  if (!canvas) {
    return;
  }

  document.addEventListener("keydown", (event) => onKeyChange(event, true));
  document.addEventListener("keyup", (event) => onKeyChange(event, false));
  canvas.addEventListener("pointerdown", onCanvasPointerDown);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
}

function initHeroSystem() {
  if (heroState.initialized) {
    return;
  }

  heroState.initialized = true;
  clearHeroItems();
  patchHeroPosition();
  bindHeroControls();
  renderHeroSlots();
  syncInventoryDisplay();
  signalFogUpdate(true);
  wrapAdvanceTime();
  window.requestAnimationFrame(tick);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHeroSystem, { once: true });
} else {
  initHeroSystem();
}

window.heroSystem = {
  init: initHeroSystem,
  attack: performAttack,
  lootItem,
};

