const PART_TYPES = ["arm", "leg", "head", "body"];
const GRADE_TABLE = [
  { grade: "C", weight: 0.6 },
  { grade: "B", weight: 0.25 },
  { grade: "A", weight: 0.12 },
  { grade: "S", weight: 0.03 },
];
const DROP_LIFETIME_MS = 30000;
const DEBUG_PART_DROP_RATE = 1;
const DEBUG_DROP_LOG_DURATION_MS = 3000;
const BASE_REACH_RADIUS = 12;
const ROBOT_THREAT_RADIUS = 92;
const ENEMY_SPRITE_DRAW_SIZE = 32;
const BOSS_SPRITE_DRAW_SIZE = 42;
const DROP_ICON_DRAW_SIZE = 16;
const ENEMY_SPRITE_PATHS = {
  C: new URL("../assets/enemies/enemy_c_32.png", import.meta.url).href,
  B: new URL("../assets/enemies/enemy_b_32.png", import.meta.url).href,
  A: new URL("../assets/enemies/enemy_a_32.png", import.meta.url).href,
  S: new URL("../assets/enemies/enemy_s_32.png", import.meta.url).href,
};
const DROP_ICON_PATHS = {
  arm: new URL("../assets/parts/part_arm_16.png", import.meta.url).href,
  leg: new URL("../assets/parts/part_leg_16.png", import.meta.url).href,
  head: new URL("../assets/parts/part_head_16.png", import.meta.url).href,
  body: new URL("../assets/parts/part_torso_16.png", import.meta.url).href,
  gold: new URL("../assets/ui/gold_coin_16.png", import.meta.url).href,
};

const FALLBACK_PATHS = {
  A: [
    { x: 0, y: 510 },
    { x: 180, y: 510 },
    { x: 180, y: 360 },
    { x: 430, y: 360 },
    { x: 430, y: 470 },
    { x: 800, y: 470 },
  ],
  B: [
    { x: 0, y: 470 },
    { x: 180, y: 470 },
    { x: 180, y: 320 },
    { x: 500, y: 320 },
    { x: 500, y: 445 },
    { x: 800, y: 445 },
  ],
};

const REGION_TEMPLATES = {
  A: { hp: 40, speed: 46, attack: 8, gold: 8, color: "#e76845" },
  B: { hp: 62, speed: 54, attack: 12, gold: 12, color: "#ff9258" },
};

function createSpriteAsset(src, label) {
  const image = new Image();
  const asset = { image, loaded: false, failed: false, src };

  image.addEventListener("load", () => {
    asset.loaded = true;
  }, { once: true });

  image.addEventListener("error", () => {
    asset.failed = true;
    console.warn(`Failed to load ${label} sprite: ${src}`);
  }, { once: true });

  image.src = src;
  return asset;
}

const enemySpriteAssets = Object.fromEntries(
  Object.entries(ENEMY_SPRITE_PATHS).map(([grade, src]) => [grade, createSpriteAsset(src, `enemy-${grade}`)])
);
const dropSpriteAssets = Object.fromEntries(
  Object.entries(DROP_ICON_PATHS).map(([kind, src]) => [kind, createSpriteAsset(src, `drop-${kind}`)])
);

const enemyVisualState = {
  initialized: false,
};
const dropDebugState = {
  timeoutId: null,
};

function getGameState() {
  return window.gameState;
}

function randomId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function pickWeightedGrade() {
  let roll = Math.random();
  for (const entry of GRADE_TABLE) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.grade;
    }
  }
  return "C";
}

function clonePoint(point) {
  return { x: point.x, y: point.y };
}

function ensureDropDebugOverlay() {
  let overlay = document.getElementById("drop-debug-log");
  if (overlay) {
    return overlay;
  }

  if (!document.getElementById("drop-debug-style")) {
    const style = document.createElement("style");
    style.id = "drop-debug-style";
    style.textContent = `
      #drop-debug-log {
        position: fixed;
        top: 18px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 40;
        min-width: 280px;
        max-width: min(90vw, 680px);
        padding: 10px 14px;
        border: 1px solid rgba(255, 107, 45, 0.7);
        background: rgba(8, 12, 18, 0.92);
        color: #e7edf7;
        font: 13px "Courier New", monospace;
        text-align: center;
        box-shadow: 0 10px 26px rgba(0, 0, 0, 0.35);
        opacity: 0;
        pointer-events: none;
        transition: opacity 120ms ease;
      }
      #drop-debug-log[data-visible="true"] {
        opacity: 1;
      }
    `;
    document.head.appendChild(style);
  }

  overlay = document.createElement("div");
  overlay.id = "drop-debug-log";
  overlay.setAttribute("data-visible", "false");
  document.body.appendChild(overlay);
  return overlay;
}

function showDropDebugLog(message) {
  const overlay = ensureDropDebugOverlay();
  overlay.textContent = message;
  overlay.setAttribute("data-visible", "true");

  if (dropDebugState.timeoutId) {
    window.clearTimeout(dropDebugState.timeoutId);
  }

  dropDebugState.timeoutId = window.setTimeout(() => {
    overlay.setAttribute("data-visible", "false");
    dropDebugState.timeoutId = null;
  }, DEBUG_DROP_LOG_DURATION_MS);
}

function formatEnemyDebugLabel(enemy) {
  return `enemy_${String(enemy.grade || "c").toLowerCase()}`;
}

function formatPartTypeLabel(partType) {
  return {
    arm: "\uD314",
    leg: "\uB2E4\uB9AC",
    head: "\uBA38\uB9AC",
    body: "\uBAB8\uD1B5",
  }[partType] || partType;
}

function buildDropDebugMessage(enemy, droppedParts) {
  if (!droppedParts.length) {
    return `${formatEnemyDebugLabel(enemy)} \uCC98\uCE58 -> \uB4DC\uB86D \uC5C6\uC74C`;
  }

  const firstDrop = droppedParts[0];
  return `${formatEnemyDebugLabel(enemy)} \uCC98\uCE58 -> ${formatPartTypeLabel(firstDrop.partType)}(${firstDrop.grade}) \uB4DC\uB86D`;
}

function getPathForRegion(region) {
  const gameState = getGameState();
  if (gameState && gameState.paths && Array.isArray(gameState.paths[region])) {
    return gameState.paths[region].map(clonePoint);
  }

  return (FALLBACK_PATHS[region] || FALLBACK_PATHS.A).map(clonePoint);
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function moveAlongPath(enemy, deltaSeconds) {
  const path = enemy.path;
  let remaining = enemy.speed * deltaSeconds;

  while (remaining > 0 && enemy.pathIndex < path.length - 1) {
    const nextPoint = path[enemy.pathIndex + 1];
    const dx = nextPoint.x - enemy.x;
    const dy = nextPoint.y - enemy.y;
    const segmentDistance = Math.hypot(dx, dy);

    if (segmentDistance <= remaining) {
      enemy.x = nextPoint.x;
      enemy.y = nextPoint.y;
      enemy.pathIndex += 1;
      remaining -= segmentDistance;
      continue;
    }

    const ratio = remaining / segmentDistance;
    enemy.x += dx * ratio;
    enemy.y += dy * ratio;
    remaining = 0;
  }
}

function createEnemy(options = {}) {
  const gameState = getGameState();
  const region = options.region || gameState.currentRegion || "A";
  const wave = options.wave || gameState.wave || 1;
  const template = REGION_TEMPLATES[region] || REGION_TEMPLATES.A;
  const path = getPathForRegion(region);
  const start = path[0];

  const bossMultiplier = options.boss === "wave" ? 10 : options.boss === "region" ? 18 : 1;
  const waveScale = 1 + Math.max(0, wave - 1) * 0.12;

  return {
    id: randomId("enemy"),
    grade: options.grade || (options.boss === "region" ? "S" : options.boss === "wave" ? "A" : pickWeightedGrade()),
    type: options.type || "scout",
    region,
    wave,
    isBoss: bossMultiplier > 1,
    bossType: options.boss || null,
    x: start.x,
    y: start.y,
    path,
    pathIndex: 0,
    radius: options.boss ? 14 : 9,
    maxHP: Math.round(template.hp * waveScale * bossMultiplier),
    hp: Math.round(template.hp * waveScale * bossMultiplier),
    speed: Math.max(18, template.speed - (options.boss ? 10 : 0) + Math.min(wave * 1.5, 14)),
    attack: Math.round(template.attack * waveScale * bossMultiplier),
    goldReward: Math.round(template.gold * waveScale * (options.boss === "region" ? 5 : options.boss === "wave" ? 3 : 1)),
    color: options.boss === "region" ? "#ffd166" : options.boss === "wave" ? "#ff6b2d" : template.color,
    spawnedAt: performance.now(),
    lastRobotHitAt: 0,
    robotHitCooldownMs: options.boss ? 1000 : 1800,
    reachedBase: false,
  };
}

function createItemDrop(x, y, kind, amount = 1, extra = {}) {
  return {
    id: randomId("drop"),
    kind,
    amount,
    x,
    y,
    icon: extra.icon || (kind === "gold" ? "G" : "P"),
    grade: extra.grade || null,
    partType: extra.partType || null,
    expiresAt: performance.now() + DROP_LIFETIME_MS,
    createdAt: performance.now(),
  };
}

function ensureDroppedItems(gameState) {
  if (!Array.isArray(gameState.droppedItems)) {
    gameState.droppedItems = [];
  }

  return gameState.droppedItems;
}

function dropLoot(enemy) {
  const gameState = getGameState();
  const droppedItems = ensureDroppedItems(gameState);
  const droppedParts = [];
  const shouldDropPart = Math.random() < DEBUG_PART_DROP_RATE;
  const partDropCount = shouldDropPart ? 1 + Math.floor(Math.random() * 2) : 0;

  for (let index = 0; index < partDropCount; index += 1) {
    const partType = PART_TYPES[Math.floor(Math.random() * PART_TYPES.length)];
    const grade = pickWeightedGrade();
    const drop = createItemDrop(enemy.x + index * 10, enemy.y - index * 4, "part", 1, {
      icon: grade,
      grade,
      partType,
    });
    droppedParts.push(drop);
    droppedItems.push(drop);
  }

  droppedItems.push(
    createItemDrop(enemy.x + 12, enemy.y + 8, "gold", enemy.goldReward, {
      icon: "G",
    })
  );

  showDropDebugLog(buildDropDebugMessage(enemy, droppedParts));
}

function damageBaseFromEnemy(enemy) {
  const gameState = getGameState();
  if (enemy.reachedBase) {
    return;
  }

  enemy.reachedBase = true;
  gameState.baseHP = Math.max(0, gameState.baseHP - enemy.attack);
  gameState.message = `${enemy.bossType === "region" ? "\uC9C0\uC5ED \uBCF4\uC2A4" : "\uC6E8\uC774\uBE0C \uBCF4\uC2A4"}\uAC00 \uC544\uAD70 \uB85C\uBD07\uC5D0 ${enemy.attack} \uD53C\uD574\uB97C \uC785\uD614\uC2B5\uB2C8\uB2E4.`;
}

function maybeDamageRobot(enemy, now) {
  const gameState = getGameState();
  if (!enemy.isBoss || !Array.isArray(gameState.placedRobots) || gameState.placedRobots.length === 0) {
    return;
  }

  if (now - enemy.lastRobotHitAt < enemy.robotHitCooldownMs) {
    return;
  }

  let target = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const robot of gameState.placedRobots) {
    if (!robot || typeof robot.x !== "number" || typeof robot.y !== "number") {
      continue;
    }
    const robotHP = typeof robot.hp === "number" ? robot.hp : typeof robot.currentHP === "number" ? robot.currentHP : null;
    if (robotHP !== null && robotHP <= 0) {
      continue;
    }
    const enemyDistance = distance(enemy, robot);
    if (enemyDistance < ROBOT_THREAT_RADIUS && enemyDistance < bestDistance) {
      target = robot;
      bestDistance = enemyDistance;
    }
  }

  if (!target) {
    return;
  }

  if (typeof target.hp === "number") {
    target.hp = Math.max(0, target.hp - enemy.attack);
  } else if (typeof target.currentHP === "number") {
    target.currentHP = Math.max(0, target.currentHP - enemy.attack);
  } else {
    target.pendingDamage = (target.pendingDamage || 0) + enemy.attack;
  }

  enemy.lastRobotHitAt = now;
  gameState.message = `${enemy.bossType === "region" ? "지역 보스" : "웨이브 보스"}가 아군 로봇에 ${enemy.attack} 피해를 입혔습니다.`;
}

function removeExpiredDrops(now = performance.now()) {
  const gameState = getGameState();
  gameState.droppedItems = ensureDroppedItems(gameState).filter((item) => item.expiresAt > now);
}

function spawnWave() {
  const gameState = getGameState();
  const wave = gameState.wave || 1;
  const region = gameState.currentRegion || "A";

  if (!Array.isArray(gameState.enemies)) {
    gameState.enemies = [];
  }

  if (gameState.isBossWave) {
    gameState.enemies.push(createEnemy({ region, wave, boss: "wave", type: "crusher" }));
    gameState.message = `${region}\uC9C0\uC5ED ${wave}\uC6E8\uC774\uBE0C \uBCF4\uC2A4 \uCD9C\uD604. \uBC29\uC5B4\uC120\uC744 \uC720\uC9C0\uD558\uC138\uC694.`;
    return gameState.enemies;
  }

  const count = Math.min(12, 4 + wave);
  for (let index = 0; index < count; index += 1) {
    const enemy = createEnemy({ region, wave, type: index % 3 === 0 ? "raider" : "scout" });
    enemy.x -= index * 28;
    gameState.enemies.push(enemy);
  }

  gameState.message = `${region}\uC9C0\uC5ED ${wave}\uC6E8\uC774\uBE0C \uC801 \uB85C\uBD07 ${count}\uAE30\uAC00 \uACBD\uB85C\uC5D0 \uD22C\uC785\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`;
  return gameState.enemies;
}

function spawnRegionBoss(region = getGameState().currentRegion) {
  const gameState = getGameState();
  const boss = createEnemy({
    region,
    wave: gameState.maxWaves || 10,
    boss: "region",
    type: `${region}-overlord`,
  });
  boss.radius = 18;
  boss.speed = Math.max(22, boss.speed - 8);
  gameState.enemies.push(boss);
  gameState.message = `${region}\uC9C0\uC5ED \uC9C0\uC5ED \uBCF4\uC2A4\uAC00 \uCD9C\uD604\uD588\uC2B5\uB2C8\uB2E4. \uCC98\uCE58 \uC2DC \uB2E4\uC74C \uC9C0\uC5ED\uC774 \uAC1C\uBC29\uB429\uB2C8\uB2E4.`;
  return boss;
}

function triggerRegionTransition(region) {
  const gameState = getGameState();
  if (region === "A") {
    gameState.regions.A.cleared = true;
    gameState.regions.A.bossDefeated = true;
    gameState.currentRegion = "B";
    gameState.wave = 1;
    gameState.isBossWave = false;
    gameState.waveActive = false;
    gameState.message = "B\uC9C0\uC5ED \uC9C0\uC5ED \uBCF4\uC2A4\uB97C \uACA9\uD30C\uD588\uC2B5\uB2C8\uB2E4. \uD604\uC7AC \uAD6C\uD604 \uBC94\uC704\uC5D0\uC11C \uBAA8\uB4E0 \uC9C0\uC5ED\uC774 \uC815\uB9AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.";
    return;
  }

  gameState.regions.B.cleared = true;
  gameState.regions.B.bossDefeated = true;
  gameState.waveActive = false;
  gameState.message = "B지역 지역 보스를 격파했습니다. 현재 구현 범위에서 모든 지역이 정리되었습니다.";
}

function handleEnemyDeath(enemy) {
  const gameState = getGameState();
  if (!enemy || enemy.lootHandled) {
    return;
  }

  enemy.lootHandled = true;
  enemy.isDead = true;
  enemy.dead = true;
  dropLoot(enemy);

  if (enemy.bossType === "region") {
    triggerRegionTransition(enemy.region);
  } else {
    gameState.message = enemy.isBoss
      ? `${enemy.region}\uC9C0\uC5ED \uC6E8\uC774\uBE0C \uBCF4\uC2A4\uB97C \uACA9\uD30C\uD588\uC2B5\uB2C8\uB2E4.`
      : "\uC801 \uB85C\uBD07\uC744 \uD30C\uAD34\uD558\uACE0 \uC804\uB9AC\uD488\uC744 \uD68C\uC218\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
  }
}

function damageEnemy(enemyId, amount) {
  const gameState = getGameState();
  const enemy = gameState.enemies.find((candidate) => candidate.id === enemyId);
  if (!enemy) {
    return null;
  }

  enemy.hp = Math.max(0, enemy.hp - amount);
  if (enemy.hp === 0) {
    handleEnemyDeath(enemy);
    gameState.enemies = gameState.enemies.filter((candidate) => candidate.id !== enemyId);
  }
  return enemy;
}

function updateEnemies(deltaSeconds) {
  const gameState = getGameState();
  if (!gameState || !Array.isArray(gameState.enemies)) {
    return;
  }

  const now = performance.now();
  const survivors = [];

  for (const enemy of gameState.enemies) {
    if (!enemy) {
      continue;
    }

    if (enemy.hp <= 0 || enemy.isDead || enemy.dead) {
      handleEnemyDeath(enemy);
      continue;
    }

    maybeDamageRobot(enemy, now);
    moveAlongPath(enemy, deltaSeconds);

    const pathEnd = enemy.path[enemy.path.length - 1];
    if (enemy.pathIndex >= enemy.path.length - 1 && distance(enemy, pathEnd) <= BASE_REACH_RADIUS) {
      damageBaseFromEnemy(enemy);
      continue;
    }

    survivors.push(enemy);
  }

  gameState.enemies = survivors;
  removeExpiredDrops(now);
}

function isPointVisible(x, y) {
  const gameState = getGameState();
  if (!gameState || !Array.isArray(gameState.fogOfWar) || gameState.fogOfWar.length === 0) {
    return true;
  }

  return gameState.fogOfWar.some((zone) => {
    const dx = x - zone.x;
    const dy = y - zone.y;
    return dx * dx + dy * dy <= zone.radius * zone.radius;
  });
}

function getEnemySpriteAsset(enemy) {
  if (!enemy || !enemy.grade) {
    return enemySpriteAssets.C;
  }

  return enemySpriteAssets[enemy.grade] || enemySpriteAssets.C;
}

function getDropSpriteAsset(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  if (item.kind === "gold") {
    return dropSpriteAssets.gold || null;
  }

  if (item.kind === "part") {
    return dropSpriteAssets[item.partType] || null;
  }

  return null;
}

function drawDroppedItemSprites(ctx, gameState) {
  if (!Array.isArray(gameState.droppedItems)) {
    return;
  }

  for (const item of gameState.droppedItems) {
    if (!item || typeof item.x !== "number" || typeof item.y !== "number") {
      continue;
    }

    const asset = getDropSpriteAsset(item);
    const drawX = Math.round(item.x - DROP_ICON_DRAW_SIZE / 2);
    const drawY = Math.round(item.y - DROP_ICON_DRAW_SIZE / 2);

    if (asset?.loaded) {
      ctx.drawImage(asset.renderSource, drawX, drawY, DROP_ICON_DRAW_SIZE, DROP_ICON_DRAW_SIZE);
      continue;
    }

    ctx.fillStyle = item.kind === "gold" ? "#ffcf70" : "#d7dde8";
    ctx.fillRect(drawX, drawY, DROP_ICON_DRAW_SIZE, DROP_ICON_DRAW_SIZE);
    ctx.fillStyle = "#11151d";
    ctx.fillText(item.icon || "?", item.x, item.y + 1);
  }
}

function drawEnemySprites() {
  const gameState = getGameState();
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas?.getContext("2d");
  if (!gameState || !ctx || !Array.isArray(gameState.enemies)) {
    return;
  }

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  for (const enemy of gameState.enemies) {
    if (!enemy || typeof enemy.x !== "number" || typeof enemy.y !== "number") {
      continue;
    }

    const asset = getEnemySpriteAsset(enemy);
    if (!asset.loaded) {
      continue;
    }

    const size = enemy.isBoss ? BOSS_SPRITE_DRAW_SIZE : ENEMY_SPRITE_DRAW_SIZE;
    const drawX = Math.round(enemy.x - size / 2);
    const drawY = Math.round(enemy.y - size / 2);
    ctx.drawImage(asset.renderSource, drawX, drawY, size, size);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '11px "Courier New", monospace';
  drawDroppedItemSprites(ctx, gameState);

  ctx.restore();
}

function enemyVisualFrame() {
  drawEnemySprites();
  window.requestAnimationFrame(enemyVisualFrame);
}

function initEnemyVisuals() {
  if (enemyVisualState.initialized) {
    return;
  }

  enemyVisualState.initialized = true;
  window.requestAnimationFrame(enemyVisualFrame);
}

function drawEnemy(ctx, enemy) {
  ctx.fillStyle = enemy.color;
  ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius, enemy.radius * 2, enemy.radius * 2);

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 8, enemy.radius * 2, 4);
  ctx.fillStyle = enemy.bossType === "region" ? "#ffd166" : "#7cff8f";
  ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 8, (enemy.hp / enemy.maxHP) * enemy.radius * 2, 4);
}

function drawDrops(ctx) {
  const gameState = getGameState();
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '11px "Courier New", monospace';

  for (const item of gameState.droppedItems) {
    ctx.fillStyle = item.kind === "gold" ? "#ffcf70" : "#d7dde8";
    ctx.fillRect(item.x - 9, item.y - 9, 18, 18);
    ctx.fillStyle = "#11151d";
    ctx.fillText(item.icon, item.x, item.y + 1);
  }

  ctx.restore();
}

function drawEnemies(ctx) {
  const gameState = getGameState();
  if (!gameState || !Array.isArray(gameState.enemies)) {
    return;
  }

  for (const enemy of gameState.enemies) {
    drawEnemy(ctx, enemy);
  }
  drawDrops(ctx);
}

function syncWaveSpawns() {
  const gameState = getGameState();
  if (!gameState) {
    return;
  }

  const nextWaveKey = `${gameState.currentRegion}-${gameState.wave}-${gameState.isBossWave ? "boss" : "normal"}`;
  if (!gameState.waveActive) {
    enemySystem.activeWaveKey = null;
    return;
  }

  if (enemySystem.activeWaveKey === nextWaveKey) {
    return;
  }

  enemySystem.activeWaveKey = nextWaveKey;
  spawnWave();
}

const enemySystem = {
  activeWaveKey: null,
  createEnemy,
  spawnWave,
  spawnRegionBoss,
  update: updateEnemies,
  draw: drawEnemies,
  drawSprites: drawEnemySprites,
  damageEnemy,
  syncWaveSpawns,
  removeExpiredDrops,
};

window.enemySystem = enemySystem;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initEnemyVisuals, { once: true });
} else {
  initEnemyVisuals();
}

