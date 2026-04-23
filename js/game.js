const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const hud = {
  gold: document.getElementById("gold-value"),
  power: document.getElementById("power-value"),
  wave: document.getElementById("wave-value"),
  baseHP: document.getElementById("base-hp-value"),
  status: document.getElementById("status-line"),
};

const REGION_THEMES = {
  A: {
    name: "Sector A",
    skyTop: "#0d121b",
    skyBottom: "#171111",
    dust: "rgba(255, 107, 45, 0.1)",
    terrain: "#241c1d",
    terrainEdge: "#3b2820",
    accent: "#ff6b2d",
  },
  B: {
    name: "Sector B",
    skyTop: "#090d15",
    skyBottom: "#130f1d",
    dust: "rgba(255, 146, 88, 0.12)",
    terrain: "#1c1f2b",
    terrainEdge: "#31374b",
    accent: "#ff9258",
  },
};

const gameState = {
  currentRegion: "A",
  paths: {
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
  },
  regions: {
    A: { cleared: false, bossDefeated: false },
    B: { cleared: false, bossDefeated: false },
  },
  stage: 1,
  wave: 1,
  maxWaves: 5,
  isBossWave: false,
  waveActive: false,
  stageComplete: false,
  baseHP: 100,
  maxBaseHP: 100,
  power: 10,
  maxPower: 10,
  usedPower: 0,
  gold: 120,
  hero: { x: 360, y: 310, hp: 100, maxHP: 100, items: [null, null] },
  droppedItems: [],
  placedRobots: [],
  enemies: [],
  fogOfWar: [
    { x: 96, y: 478, radius: 180, source: "base" },
    { x: 360, y: 310, radius: 120, source: "hero:start" },
  ],
  elapsedInWave: 0,
  message: "Stage 1: assemble robots from parts and hold Sector A through wave 5.",
};

window.gameState = gameState;

function syncBossWave() {
  gameState.isBossWave = gameState.wave === gameState.maxWaves;
}

function updateHUD() {
  hud.gold.textContent = String(gameState.gold);
  hud.power.textContent = `${gameState.power} / ${gameState.maxPower}`;
  hud.wave.textContent = `A-${String(gameState.wave).padStart(2, "0")}${gameState.isBossWave ? " BOSS" : ""}`;
  hud.baseHP.textContent = `${gameState.baseHP} / ${gameState.maxBaseHP}`;
  hud.status.textContent = gameState.message;
}

function clampState() {
  gameState.baseHP = Math.max(0, Math.min(gameState.baseHP, gameState.maxBaseHP));
  gameState.usedPower = Math.max(0, Math.min(gameState.usedPower, gameState.maxPower));
  gameState.power = Math.max(0, gameState.maxPower - gameState.usedPower);
}

function beginWave() {
  if (gameState.waveActive) {
    gameState.message = "A wave is already in progress.";
    return;
  }

  if (gameState.stageComplete) {
    gameState.message = "Stage 1 is clear. Restart to play again.";
    return;
  }

  syncBossWave();
  gameState.waveActive = true;
  gameState.elapsedInWave = 0;
  gameState.message = gameState.isBossWave
    ? "Final wave: a heavy boss is entering. Keep the robot line alive."
    : `Sector A wave ${gameState.wave} started. Use the hero to finish stragglers and recover drops.`;
}

function completeWave() {
  gameState.waveActive = false;
  gameState.gold += gameState.isBossWave ? 90 : 30;

  if (gameState.wave < gameState.maxWaves) {
    gameState.wave += 1;
    syncBossWave();
    gameState.message = `Wave cleared. Reward paid. Next: A-${String(gameState.wave).padStart(2, "0")}.`;
    return;
  }

  gameState.regions.A.cleared = true;
  gameState.regions.A.bossDefeated = true;
  gameState.stageComplete = true;
  gameState.message = "Stage 1 clear. Sector A base is stabilized.";
}

function resetBattle() {
  window.location.reload();
}

function damageBase(amount) {
  gameState.baseHP -= amount;
  gameState.message = `Base took ${amount} damage.`;
  if (gameState.baseHP <= 0) {
    gameState.waveActive = false;
    gameState.message = "Base destroyed. Restart and rebuild the defense line.";
  }
}

function usePower(amount) {
  const nextUsage = gameState.usedPower + amount;
  if (nextUsage > gameState.maxPower) {
    gameState.message = "Not enough power for another robot.";
    return;
  }

  gameState.usedPower = nextUsage;
  gameState.message = `Used ${amount} power. Current load ${gameState.usedPower}/${gameState.maxPower}.`;
}

function update(deltaSeconds) {
  window.enemySystem?.syncWaveSpawns();
  window.enemySystem?.update(deltaSeconds);

  if (gameState.waveActive && gameState.baseHP > 0) {
    gameState.elapsedInWave += deltaSeconds;
    if (gameState.elapsedInWave > 0.7 && Array.isArray(gameState.enemies) && gameState.enemies.length === 0) {
      completeWave();
    }
  }

  clampState();
  updateHUD();
}

function drawFallbackBackground(theme) {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, theme.skyTop);
  sky.addColorStop(1, theme.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = theme.dust;
  for (let i = 0; i < 26; i += 1) {
    const x = (i * 73) % canvas.width;
    const y = 40 + ((i * 97) % 260);
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.fillStyle = theme.terrain;
  ctx.fillRect(0, 430, canvas.width, 170);
  ctx.fillStyle = theme.terrainEdge;
  ctx.fillRect(0, 422, canvas.width, 8);
}

function drawFallbackScene() {
  const theme = REGION_THEMES[gameState.currentRegion];
  drawFallbackBackground(theme);
  ctx.strokeStyle = "#6e727a";
  ctx.lineWidth = 20;
  ctx.beginPath();
  for (const [index, point] of gameState.paths.A.entries()) {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();

  ctx.fillStyle = "#111927";
  ctx.fillRect(42, 442, 110, 72);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(54, 454, 18, 46);
  ctx.fillStyle = "#e5edf8";
  ctx.font = '12px "Courier New", monospace';
  ctx.fillText("BASE", 78, 490);
}

function render() {
  if (window.mapSystem?.renderScene) {
    window.mapSystem.renderScene(ctx);
    return;
  }

  drawFallbackScene();
}

let lastTimestamp = performance.now();

function frame(timestamp) {
  const deltaSeconds = Math.min(0.05, (timestamp - lastTimestamp) / 1000);
  lastTimestamp = timestamp;
  update(deltaSeconds);
  render();
  window.requestAnimationFrame(frame);
}

function focusElement(selector) {
  const element = document.querySelector(selector);
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "nearest" });
  if (typeof element.focus === "function") {
    element.focus({ preventScroll: true });
  }
}

function bindUI() {
  document.getElementById("start-wave-button")?.addEventListener("click", beginWave);
  document.getElementById("focus-battlefield-button")?.addEventListener("click", () => focusElement("#game-canvas"));
  document.getElementById("focus-fabricator-button")?.addEventListener("click", () => focusElement("#robots-module-root"));
  document.getElementById("focus-inventory-button")?.addEventListener("click", () => focusElement("#inventory-panel"));
  document.getElementById("damage-base-button")?.addEventListener("click", () => damageBase(12));
  document.getElementById("use-power-button")?.addEventListener("click", () => usePower(2));
  document.getElementById("reset-battle-button")?.addEventListener("click", resetBattle);
}

function renderGameToText() {
  return JSON.stringify({
    coordinateSystem: "origin top-left, +x right, +y down",
    stage: gameState.stage,
    region: gameState.currentRegion,
    wave: gameState.wave,
    maxWaves: gameState.maxWaves,
    isBossWave: gameState.isBossWave,
    waveActive: gameState.waveActive,
    stageComplete: gameState.stageComplete,
    baseHP: gameState.baseHP,
    maxBaseHP: gameState.maxBaseHP,
    power: {
      available: gameState.power,
      used: gameState.usedPower,
      max: gameState.maxPower,
    },
    gold: gameState.gold,
    hero: {
      x: Math.round(gameState.hero.x),
      y: Math.round(gameState.hero.y),
      hp: gameState.hero.hp,
    },
    enemies: (gameState.enemies || []).map((enemy) => ({
      id: enemy.id,
      x: Math.round(enemy.x),
      y: Math.round(enemy.y),
      hp: Math.round(enemy.hp),
      boss: Boolean(enemy.isBoss),
    })),
    robots: (gameState.placedRobots || []).map((robot) => ({
      id: robot.id,
      x: Math.round(robot.x),
      y: Math.round(robot.y),
      hp: Math.round(robot.hp),
      slotId: robot.slotId,
    })),
    drops: (gameState.droppedItems || []).map((item) => ({
      kind: item.kind,
      x: Math.round(item.x),
      y: Math.round(item.y),
      grade: item.grade || null,
      partType: item.partType || null,
    })),
    status: gameState.message,
  });
}

window.render_game_to_text = renderGameToText;
window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) {
    update(1 / 60);
  }
  render();
};

syncBossWave();
updateHUD();
bindUI();
render();
window.requestAnimationFrame(frame);
