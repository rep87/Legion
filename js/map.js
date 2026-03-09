const MAP_WIDTH = 800;
const MAP_HEIGHT = 600;
const TILE_SIZE = 40;
const HERO_REVEAL_RADIUS = 88;
const BASE_REVEAL_RADIUS = 150;
const VISION_TURRET_REVEAL_RADIUS = 110;
const MINIMAP_X = 588;
const MINIMAP_Y = 438;
const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 150;

const REGION_THEMES = {
  A: {
    skyTop: "#0d121b",
    skyBottom: "#171111",
    dust: "rgba(255, 107, 45, 0.1)",
    terrain: "#241c1d",
    terrainEdge: "#3b2820",
    accent: "#ff6b2d",
    accentSoft: "#ff9f6b",
  },
  B: {
    skyTop: "#090d15",
    skyBottom: "#130f1d",
    dust: "rgba(255, 146, 88, 0.12)",
    terrain: "#1c1f2b",
    terrainEdge: "#31374b",
    accent: "#ff9258",
    accentSoft: "#ffc39d",
  },
};

const PATHS = {
  A: [
    { x: 0, y: 510 },
    { x: 180, y: 510 },
    { x: 180, y: 360 },
    { x: 430, y: 360 },
    { x: 430, y: 470 },
    { x: 800, y: 470 },
  ],
  B: [
    { x: 0, y: 500 },
    { x: 145, y: 500 },
    { x: 145, y: 250 },
    { x: 335, y: 250 },
    { x: 335, y: 410 },
    { x: 560, y: 410 },
    { x: 560, y: 200 },
    { x: 800, y: 200 },
  ],
};

const SLOT_LAYOUTS = {
  A: [
    { id: "A-1", x: 110, y: 470, robotCap: 3, turretCap: 1 },
    { id: "A-2", x: 220, y: 400, robotCap: 3, turretCap: 1 },
    { id: "A-3", x: 335, y: 325, robotCap: 3, turretCap: 1 },
    { id: "A-4", x: 470, y: 428, robotCap: 3, turretCap: 1 },
    { id: "A-5", x: 645, y: 438, robotCap: 3, turretCap: 1 },
  ],
  B: [
    { id: "B-1", x: 88, y: 460, robotCap: 3, turretCap: 1 },
    { id: "B-2", x: 195, y: 288, robotCap: 3, turretCap: 1 },
    { id: "B-3", x: 380, y: 372, robotCap: 3, turretCap: 1 },
    { id: "B-4", x: 516, y: 240, robotCap: 3, turretCap: 1 },
    { id: "B-5", x: 680, y: 168, robotCap: 3, turretCap: 1 },
  ],
};

function getGameState() {
  return window.gameState || null;
}

function getTheme(region) {
  return REGION_THEMES[region] || REGION_THEMES.A;
}

function getRegionPath(region) {
  return PATHS[region] || PATHS.A;
}

function getRegionSlots(region) {
  return SLOT_LAYOUTS[region] || SLOT_LAYOUTS.A;
}

function createRevealZone(x, y, radius, source) {
  return { x, y, radius, source };
}

function ensureMapState() {
  const gameState = getGameState();
  if (!gameState) {
    return null;
  }

  if (!Array.isArray(gameState.fogOfWar)) {
    gameState.fogOfWar = [];
  }

  if (!gameState.mapData) {
    gameState.mapData = {
      baseCore: { x: 96, y: 478 },
      revealedZoneKeys: {},
      placedTurrets: [],
      slotsByRegion: {},
      hoveredSlotId: null,
      selectedSlotId: null,
      lastHeroRevealCell: null,
    };
  }

  for (const region of Object.keys(SLOT_LAYOUTS)) {
    if (!gameState.mapData.slotsByRegion[region]) {
      gameState.mapData.slotsByRegion[region] = getRegionSlots(region).map((slot) => ({
        ...slot,
        robots: [],
        turret: null,
      }));
    }
  }

  ensureBaseReveal(gameState);
  syncTurretsFromState(gameState);
  updateHeroVision(gameState);
  return gameState;
}

function ensureBaseReveal(gameState) {
  const { x, y } = gameState.mapData.baseCore;
  revealArea(gameState, x, y, BASE_REVEAL_RADIUS, "base");
}

function syncTurretsFromState(gameState) {
  const currentRegion = gameState.currentRegion || "A";
  const slots = gameState.mapData.slotsByRegion[currentRegion];
  for (const slot of slots) {
    slot.robots = [];
  }

  if (Array.isArray(gameState.placedRobots)) {
    for (const robot of gameState.placedRobots) {
      const slotId = robot.slotId || robot.assignedSlotId;
      if (!slotId) {
        continue;
      }

      const slot = findSlotById(gameState, slotId);
      if (!slot) {
        continue;
      }

      if (slot.robots.length < slot.robotCap) {
        slot.robots.push(robot.id || `robot-${slot.robots.length + 1}`);
      }
    }
  }

  if (!Array.isArray(gameState.mapData.placedTurrets)) {
    gameState.mapData.placedTurrets = [];
  }

  for (const slot of getAllSlots(gameState)) {
    slot.turret = null;
  }

  for (const turret of gameState.mapData.placedTurrets) {
    const slot = findSlotById(gameState, turret.slotId);
    if (!slot) {
      continue;
    }

    slot.turret = turret;
    if (turret.kind === "vision") {
      revealArea(gameState, slot.x, slot.y, VISION_TURRET_REVEAL_RADIUS, `vision-turret:${slot.id}`);
    }
  }
}

function getAllSlots(gameState) {
  return Object.values(gameState.mapData.slotsByRegion).flat();
}

function findSlotById(gameState, slotId) {
  return getAllSlots(gameState).find((slot) => slot.id === slotId) || null;
}

function buildRevealKey(x, y, radius, source) {
  return `${source}:${Math.round(x)}:${Math.round(y)}:${Math.round(radius)}`;
}

function revealArea(gameState, x, y, radius, source = "dynamic") {
  const key = buildRevealKey(x, y, radius, source);
  if (gameState.mapData.revealedZoneKeys[key]) {
    return false;
  }

  gameState.mapData.revealedZoneKeys[key] = true;
  gameState.fogOfWar.push(createRevealZone(x, y, radius, source));
  return true;
}

function updateHeroVision(gameState) {
  const hero = gameState.hero;
  if (!hero) {
    return;
  }

  const cellX = Math.floor(hero.x / TILE_SIZE);
  const cellY = Math.floor(hero.y / TILE_SIZE);
  const cellKey = `${cellX},${cellY}`;
  if (gameState.mapData.lastHeroRevealCell === cellKey) {
    return;
  }

  gameState.mapData.lastHeroRevealCell = cellKey;
  revealArea(gameState, hero.x, hero.y, HERO_REVEAL_RADIUS, `hero:${cellKey}`);
}

function isPointVisible(gameState, x, y) {
  return gameState.fogOfWar.some((zone) => {
    const dx = x - zone.x;
    const dy = y - zone.y;
    return dx * dx + dy * dy <= zone.radius * zone.radius;
  });
}

function drawBackground(ctx, theme) {
  const sky = ctx.createLinearGradient(0, 0, 0, MAP_HEIGHT);
  sky.addColorStop(0, theme.skyTop);
  sky.addColorStop(1, theme.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

  ctx.fillStyle = theme.dust;
  for (let i = 0; i < 26; i += 1) {
    const x = (i * 73) % MAP_WIDTH;
    const y = 40 + ((i * 97) % 260);
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.fillStyle = theme.terrain;
  ctx.fillRect(0, 430, MAP_WIDTH, 170);
  ctx.fillStyle = theme.terrainEdge;
  ctx.fillRect(0, 422, MAP_WIDTH, 8);
}

function strokePolyline(ctx, points, width, color, dashed = false) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "square";
  if (dashed) {
    ctx.setLineDash([8, 8]);
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  if (dashed) {
    ctx.setLineDash([]);
  }
}

function drawPath(ctx, gameState, theme) {
  const path = getRegionPath(gameState.currentRegion);
  strokePolyline(ctx, path, 20, "#6e727a");
  strokePolyline(ctx, path, 2, theme.accent, true);
}

function drawBase(ctx, gameState, theme) {
  const { x, y } = gameState.mapData.baseCore;
  ctx.fillStyle = "#111927";
  ctx.fillRect(x - 54, y - 36, 110, 72);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(x - 42, y - 24, 18, 46);
  ctx.fillStyle = "#ffcf70";
  ctx.fillRect(x - 14, y - 24, 24, 18);
  ctx.fillStyle = "#e5edf8";
  ctx.font = '12px "Courier New", monospace';
  ctx.fillText("BASE", x - 18, y + 12);
}

function drawHero(ctx, gameState) {
  if (!gameState.hero) {
    return;
  }

  ctx.fillStyle = "#d2dae6";
  ctx.fillRect(gameState.hero.x - 6, gameState.hero.y - 10, 12, 20);
  ctx.fillStyle = "#ff6b2d";
  ctx.fillRect(gameState.hero.x - 3, gameState.hero.y - 15, 6, 6);
}

function drawEnemies(ctx, gameState) {
  if (!Array.isArray(gameState.enemies)) {
    return;
  }

  for (const enemy of gameState.enemies) {
    if (typeof enemy.x !== "number" || typeof enemy.y !== "number") {
      continue;
    }

    ctx.fillStyle = "#d94c41";
    ctx.fillRect(enemy.x - 6, enemy.y - 6, 12, 12);
  }
}

function drawDroppedTurretHints(ctx, gameState) {
  if (!Array.isArray(gameState.droppedItems)) {
    return;
  }

  for (const item of gameState.droppedItems) {
    if (!isTurretItem(item) || typeof item.x !== "number" || typeof item.y !== "number") {
      continue;
    }

    ctx.strokeStyle = "rgba(255, 200, 112, 0.8)";
    ctx.strokeRect(item.x - 8, item.y - 8, 16, 16);
    ctx.fillStyle = "#ffcf70";
    ctx.fillRect(item.x - 2, item.y - 2, 4, 4);
  }
}

function getSlotOccupancyText(slot) {
  const robotCount = slot.robots.length;
  const turretCount = slot.turret ? 1 : 0;
  return `${robotCount}/${slot.robotCap} R  ${turretCount}/${slot.turretCap} T`;
}

function drawSlots(ctx, gameState, theme) {
  const slots = gameState.mapData.slotsByRegion[gameState.currentRegion];

  for (const slot of slots) {
    const highlight = slot.id === gameState.mapData.selectedSlotId || slot.id === gameState.mapData.hoveredSlotId;
    const robotFull = slot.robots.length >= slot.robotCap;
    const turretFull = Boolean(slot.turret);
    ctx.fillStyle = highlight ? "rgba(255, 159, 107, 0.18)" : "rgba(9, 12, 18, 0.72)";
    ctx.strokeStyle = robotFull && turretFull ? "#7b8799" : theme.accentSoft;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(slot.x - 26, slot.y - 20, 52, 40);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#e7edf7";
    ctx.font = '10px "Courier New", monospace';
    ctx.fillText(slot.id, slot.x - 19, slot.y - 5);
    ctx.fillText(getSlotOccupancyText(slot), slot.x - 24, slot.y + 10);

    if (slot.turret) {
      ctx.fillStyle = slot.turret.kind === "vision" ? "#8cf0ff" : "#ffcf70";
      ctx.fillRect(slot.x - 5, slot.y - 32, 10, 10);
    }
  }
}

function drawFog(ctx, gameState) {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
  ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
  ctx.globalCompositeOperation = "destination-out";
  for (const zone of gameState.fogOfWar) {
    const gradient = ctx.createRadialGradient(zone.x, zone.y, zone.radius * 0.2, zone.x, zone.y, zone.radius);
    gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMinimapFrame(ctx) {
  ctx.fillStyle = "rgba(4, 6, 10, 0.78)";
  ctx.fillRect(MINIMAP_X, MINIMAP_Y, MINIMAP_WIDTH, MINIMAP_HEIGHT);
  ctx.strokeStyle = "rgba(255, 107, 45, 0.72)";
  ctx.strokeRect(MINIMAP_X, MINIMAP_Y, MINIMAP_WIDTH, MINIMAP_HEIGHT);
}

function toMinimapPoint(x, y) {
  return {
    x: MINIMAP_X + (x / MAP_WIDTH) * MINIMAP_WIDTH,
    y: MINIMAP_Y + (y / MAP_HEIGHT) * MINIMAP_HEIGHT,
  };
}

function drawMinimap(ctx, gameState) {
  drawMinimapFrame(ctx);

  const path = getRegionPath(gameState.currentRegion);
  ctx.save();
  ctx.beginPath();
  ctx.rect(MINIMAP_X, MINIMAP_Y, MINIMAP_WIDTH, MINIMAP_HEIGHT);
  ctx.clip();

  ctx.fillStyle = "rgba(36, 42, 54, 0.86)";
  ctx.fillRect(MINIMAP_X, MINIMAP_Y, MINIMAP_WIDTH, MINIMAP_HEIGHT);

  ctx.strokeStyle = "#777d88";
  ctx.lineWidth = 4;
  ctx.beginPath();
  const first = toMinimapPoint(path[0].x, path[0].y);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < path.length; i += 1) {
    const point = toMinimapPoint(path[i].x, path[i].y);
    ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();

  const heroPoint = toMinimapPoint(gameState.hero.x, gameState.hero.y);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(heroPoint.x, heroPoint.y, 3, 0, Math.PI * 2);
  ctx.fill();

  for (const enemy of gameState.enemies) {
    if (typeof enemy.x !== "number" || typeof enemy.y !== "number") {
      continue;
    }

    const enemyPoint = toMinimapPoint(enemy.x, enemy.y);
    ctx.fillStyle = "#ff4e45";
    ctx.beginPath();
    ctx.arc(enemyPoint.x, enemyPoint.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const slot of gameState.mapData.slotsByRegion[gameState.currentRegion]) {
    const point = toMinimapPoint(slot.x, slot.y);
    ctx.fillStyle = slot.turret ? "#ffcf70" : "rgba(255, 159, 107, 0.72)";
    ctx.fillRect(point.x - 2, point.y - 2, 4, 4);
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.86)";
  for (let y = 0; y < MAP_HEIGHT; y += 12) {
    for (let x = 0; x < MAP_WIDTH; x += 12) {
      if (isPointVisible(gameState, x + 6, y + 6)) {
        continue;
      }
      const point = toMinimapPoint(x, y);
      ctx.fillRect(point.x, point.y, (12 / MAP_WIDTH) * MINIMAP_WIDTH + 1, (12 / MAP_HEIGHT) * MINIMAP_HEIGHT + 1);
    }
  }

  ctx.restore();
  ctx.fillStyle = "#9aa7b9";
  ctx.font = '10px "Courier New", monospace';
  ctx.fillText("MINIMAP", MINIMAP_X + 8, MINIMAP_Y + 12);
}

function isTurretItem(item) {
  if (!item || typeof item !== "object") {
    return false;
  }

  return item.kind === "turret"
    || item.type === "turret"
    || item.itemType === "turret"
    || item.category === "turret"
    || item.name === "turret";
}

function getTurretKind(item) {
  const rawKind = item.turretKind || item.subtype || item.variant || item.mode;
  return rawKind === "vision" ? "vision" : "attack";
}

function installTurretFromDrop(slotId, dropItemId) {
  const gameState = ensureMapState();
  if (!gameState) {
    return { ok: false, reason: "missing-game-state" };
  }

  const slot = findSlotById(gameState, slotId);
  if (!slot) {
    return { ok: false, reason: "missing-slot" };
  }

  if (slot.turret) {
    return { ok: false, reason: "slot-occupied" };
  }

  const itemIndex = gameState.droppedItems.findIndex((item) => item.id === dropItemId && isTurretItem(item));
  if (itemIndex === -1) {
    return { ok: false, reason: "missing-turret-drop" };
  }

  const item = gameState.droppedItems[itemIndex];
  const turret = {
    id: item.id,
    kind: getTurretKind(item),
    slotId,
    x: slot.x,
    y: slot.y,
    installedAt: Date.now(),
  };

  gameState.droppedItems.splice(itemIndex, 1);
  gameState.mapData.placedTurrets.push(turret);
  slot.turret = turret;

  if (turret.kind === "vision") {
    revealArea(gameState, slot.x, slot.y, VISION_TURRET_REVEAL_RADIUS, `vision-turret:${slot.id}`);
  }

  return { ok: true, turret };
}

function findSlotAtPoint(x, y) {
  const gameState = ensureMapState();
  if (!gameState) {
    return null;
  }

  const slots = gameState.mapData.slotsByRegion[gameState.currentRegion];
  return slots.find((slot) => Math.abs(x - slot.x) <= 26 && Math.abs(y - slot.y) <= 20) || null;
}

function updatePointerState(x, y) {
  const gameState = ensureMapState();
  if (!gameState) {
    return null;
  }

  const slot = findSlotAtPoint(x, y);
  gameState.mapData.hoveredSlotId = slot ? slot.id : null;
  return slot;
}

function selectSlot(slotId) {
  const gameState = ensureMapState();
  if (!gameState) {
    return null;
  }

  const slot = findSlotById(gameState, slotId);
  gameState.mapData.selectedSlotId = slot ? slot.id : null;
  return slot;
}

function renderScene(ctx) {
  const gameState = ensureMapState();
  if (!gameState) {
    return;
  }

  const theme = getTheme(gameState.currentRegion);
  drawBackground(ctx, theme);
  drawPath(ctx, gameState, theme);
  drawBase(ctx, gameState, theme);
  drawSlots(ctx, gameState, theme);
  drawDroppedTurretHints(ctx, gameState);
  drawEnemies(ctx, gameState);
  drawHero(ctx, gameState);
  drawFog(ctx, gameState);
  drawMinimap(ctx, gameState);
}

function describeState() {
  const gameState = ensureMapState();
  if (!gameState) {
    return null;
  }

  const slots = gameState.mapData.slotsByRegion[gameState.currentRegion].map((slot) => ({
    id: slot.id,
    robotCount: slot.robots.length,
    robotCap: slot.robotCap,
    turretInstalled: Boolean(slot.turret),
    turretKind: slot.turret ? slot.turret.kind : null,
  }));

  return {
    region: gameState.currentRegion,
    path: getRegionPath(gameState.currentRegion),
    visibleZones: gameState.fogOfWar.length,
    hoveredSlotId: gameState.mapData.hoveredSlotId,
    selectedSlotId: gameState.mapData.selectedSlotId,
    slots,
  };
}

const mapSystem = {
  ensureMapState,
  revealArea: (x, y, radius, source) => {
    const gameState = ensureMapState();
    if (!gameState) {
      return false;
    }
    return revealArea(gameState, x, y, radius, source);
  },
  updateHeroVision: () => {
    const gameState = ensureMapState();
    if (!gameState) {
      return;
    }
    updateHeroVision(gameState);
  },
  installTurretFromDrop,
  findSlotAtPoint,
  updatePointerState,
  selectSlot,
  renderScene,
  describeState,
};

window.mapSystem = mapSystem;

// TODO(agent-1/game.js): import `./map.js` and delegate canvas rendering to `window.mapSystem.renderScene(ctx)`.
ensureMapState();

export { mapSystem };
