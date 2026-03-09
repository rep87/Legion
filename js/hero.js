const HERO_MOVE_SPEED = 220;
const HERO_ATTACK_RANGE = 68;
const HERO_ATTACK_DAMAGE = 34;
const HERO_ATTACK_COOLDOWN = 0.4;
const HERO_SIGHT_RADIUS = 96;
const HERO_LOOT_RANGE = 92;
const HERO_SLOT_COUNT = 2;
const INVENTORY_SLOT_COUNT = 9;
const LOOT_CLICK_RADIUS = 18;

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
};

if (!Array.isArray(gameState.inventory)) {
  gameState.inventory = Array(INVENTORY_SLOT_COUNT).fill(null);
}

if (!Array.isArray(hero.items)) {
  hero.items = Array(HERO_SLOT_COUNT).fill(null);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setHeroPosition(x, y) {
  heroState.x = clamp(x, 0, 800);
  heroState.y = clamp(y, 0, 600);
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

  const grade = item.grade ? `${item.grade} ` : "";
  const name = item.name || item.type || "ITEM";
  return `${grade}${String(name).toUpperCase()}`;
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

  gameState.fogOfWar.push(reveal);
  heroState.lastFogSignalX = heroState.x;
  heroState.lastFogSignalY = heroState.y;

  if (typeof window.updateFogOfWar === "function") {
    window.updateFogOfWar(reveal);
  }

  window.dispatchEvent(new CustomEvent("hero:fog-update", { detail: reveal }));
}

function inventoryHasSpace() {
  return gameState.inventory.some((slot) => slot === null);
}

function addItemToInventory(item) {
  const emptyIndex = gameState.inventory.findIndex((slot) => slot === null);
  if (emptyIndex === -1) {
    return false;
  }

  gameState.inventory[emptyIndex] = item;
  return true;
}

function equipHeroItem(item) {
  const emptyHeroSlot = hero.items.findIndex((slot) => slot === null);
  if (emptyHeroSlot === -1) {
    return false;
  }

  hero.items[emptyHeroSlot] = item;
  renderHeroSlots();
  return true;
}

function resolveDroppedItemPosition(item) {
  return {
    x: Number.isFinite(item && item.x) ? item.x : Number.isFinite(item && item.position && item.position.x) ? item.position.x : 0,
    y: Number.isFinite(item && item.y) ? item.y : Number.isFinite(item && item.position && item.position.y) ? item.position.y : 0,
  };
}

function lootItem(item, index) {
  const position = resolveDroppedItemPosition(item);
  const distance = Math.hypot(heroState.x - position.x, heroState.y - position.y);
  if (distance > HERO_LOOT_RANGE) {
    setStatus("아이템이 너무 멉니다.");
    return false;
  }

  if (!inventoryHasSpace()) {
    setStatus("인벤토리가 꽉 찼습니다");
    return false;
  }

  const payload = item && item.payload ? item.payload : item;
  const equipped = equipHeroItem(payload);
  addItemToInventory(payload);

  gameState.droppedItems.splice(index, 1);
  setStatus(equipped ? `${formatItemLabel(payload)} 장착 및 회수 완료.` : `${formatItemLabel(payload)} 회수 완료.`);
  renderHeroSlots();
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

function performAttack() {
  if (heroState.attackCooldown > 0) {
    return false;
  }

  const target = findAttackTarget();
  heroState.attackCooldown = HERO_ATTACK_COOLDOWN;

  if (!target) {
    setStatus("근접 공격 범위에 적이 없습니다.");
    return false;
  }

  damageEnemy(target, HERO_ATTACK_DAMAGE);
  pruneDeadEnemies();
  setStatus(`근접 공격 적중: ${HERO_ATTACK_DAMAGE} 피해.`);
  return true;
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
  renderHeroSlots();
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
    renderHeroSlots();
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
  patchHeroPosition();
  bindHeroControls();
  renderHeroSlots();
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

// TODO(agent1): Load js/hero.js from game.js or index.html so the hero system initializes in the app.