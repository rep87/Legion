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
  wave: 1,
  maxWaves: 10,
  isBossWave: false,
  waveActive: false,
  baseHP: 100,
  maxBaseHP: 100,
  power: 10,
  maxPower: 10,
  usedPower: 0,
  gold: 100,
  hero: { x: 400, y: 300, hp: 100, maxHP: 100, items: [null, null] },
  droppedItems: [],
  placedRobots: [],
  enemies: [],
  fogOfWar: [{ x: 320, y: 220, radius: 140 }],
  elapsedInWave: 0,
  waveDuration: 12,
  message: "대기 중. 다음 웨이브 가동 버튼으로 전투를 시작합니다.",
};

window.gameState = gameState;

function syncBossWave() {
  gameState.isBossWave = gameState.wave === 5 || gameState.wave === 10;
}

function updateHUD() {
  hud.gold.textContent = String(gameState.gold);
  hud.power.textContent = `${gameState.power} / ${gameState.maxPower}`;
  hud.wave.textContent = `${gameState.currentRegion}-${String(gameState.wave).padStart(2, "0")}${gameState.isBossWave ? " BOSS" : ""}`;
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
    gameState.message = "이미 전투가 진행 중입니다.";
    return;
  }

  syncBossWave();
  gameState.waveActive = true;
  gameState.elapsedInWave = 0;
  gameState.message = gameState.isBossWave
    ? `${gameState.currentRegion}지역 보스 웨이브 개시. 방어선을 유지하세요.`
    : `${gameState.currentRegion}지역 ${gameState.wave}웨이브 개시. 적 신호 감지.`;
}

function completeWave() {
  gameState.waveActive = false;
  gameState.gold += gameState.isBossWave ? 60 : 25;

  if (gameState.wave < gameState.maxWaves) {
    gameState.wave += 1;
    syncBossWave();
    gameState.message = `${gameState.currentRegion}지역 웨이브 정리 완료. 다음 웨이브를 준비하세요.`;
    return;
  }

  if (gameState.currentRegion === "A" && !gameState.regions.A.bossDefeated) {
    gameState.regions.A.cleared = true;
    gameState.regions.A.bossDefeated = true;
    gameState.currentRegion = "B";
    gameState.wave = 1;
    gameState.isBossWave = false;
    gameState.message = "A지역 보스 격파. B지역 교두보가 개방되었습니다.";
    gameState.fogOfWar.push({ x: 560, y: 280, radius: 110 });
    return;
  }

  gameState.regions.B.cleared = true;
  gameState.regions.B.bossDefeated = true;
  gameState.wave = gameState.maxWaves;
  gameState.isBossWave = true;
  gameState.message = "B지역까지 제압 완료. 후속 콘텐츠용 스테이징 상태입니다.";
}

function resetBattle() {
  gameState.currentRegion = "A";
  gameState.regions.A.cleared = false;
  gameState.regions.A.bossDefeated = false;
  gameState.regions.B.cleared = false;
  gameState.regions.B.bossDefeated = false;
  gameState.wave = 1;
  gameState.isBossWave = false;
  gameState.waveActive = false;
  gameState.baseHP = 100;
  gameState.maxBaseHP = 100;
  gameState.usedPower = 0;
  gameState.maxPower = 10;
  gameState.power = 10;
  gameState.gold = 100;
  gameState.elapsedInWave = 0;
  gameState.message = "전장을 초기화했습니다. A지역 1웨이브부터 다시 시작합니다.";
  gameState.fogOfWar = [{ x: 320, y: 220, radius: 140 }];
}

function damageBase(amount) {
  gameState.baseHP -= amount;
  gameState.message = `기지가 ${amount}의 피해를 받았습니다.`;
  if (gameState.baseHP <= 0) {
    gameState.waveActive = false;
    gameState.message = "기지가 붕괴했습니다. 전장 초기화가 필요합니다.";
  }
}

function usePower(amount) {
  const nextUsage = gameState.usedPower + amount;
  if (nextUsage > gameState.maxPower) {
    gameState.message = "?꾨젰??遺議깊빀?덈떎. 異붽? 濡쒕큸 諛곗튂??遺덇??⑸땲??";
    return;
  }

  gameState.usedPower = nextUsage;
  gameState.message = `${amount} ?꾨젰???뚮え?덉뒿?덈떎. ?꾩옱 諛곗튂 ?꾨젰 ${gameState.usedPower}/${gameState.maxPower}.`;
}

function update(deltaSeconds) {
  window.enemySystem?.syncWaveSpawns();
  window.enemySystem?.update(deltaSeconds);

  if (gameState.waveActive) {
    gameState.elapsedInWave += deltaSeconds;
    if (gameState.elapsedInWave >= gameState.waveDuration) {
      completeWave();
    }
  }

  const moveRadius = 120;
  const orbit = performance.now() * 0.00025;
  gameState.hero.x = 400 + Math.cos(orbit) * moveRadius;
  gameState.hero.y = 300 + Math.sin(orbit * 1.3) * 70;

  clampState();
  updateHUD();
}

function drawBackground(theme) {
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

function drawPath(theme) {
  ctx.strokeStyle = "#6e727a";
  ctx.lineWidth = 20;
  ctx.lineCap = "square";
  ctx.beginPath();
  ctx.moveTo(0, 510);
  ctx.lineTo(180, 510);
  ctx.lineTo(180, 360);
  ctx.lineTo(430, 360);
  ctx.lineTo(430, 470);
  ctx.lineTo(800, 470);
  ctx.stroke();

  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(0, 510);
  ctx.lineTo(180, 510);
  ctx.lineTo(180, 360);
  ctx.lineTo(430, 360);
  ctx.lineTo(430, 470);
  ctx.lineTo(800, 470);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawBase(theme) {
  ctx.fillStyle = "#111927";
  ctx.fillRect(42, 442, 110, 72);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(54, 454, 18, 46);
  ctx.fillStyle = "#ffcf70";
  ctx.fillRect(82, 454, 24, 18);
  ctx.fillStyle = "#e5edf8";
  ctx.font = '12px "Courier New", monospace';
  ctx.fillText("BASE", 78, 490);
}

function drawHero() {
  ctx.fillStyle = "#d2dae6";
  ctx.fillRect(gameState.hero.x - 6, gameState.hero.y - 10, 12, 20);
  ctx.fillStyle = "#ff6b2d";
  ctx.fillRect(gameState.hero.x - 3, gameState.hero.y - 15, 6, 6);
}

function drawWaveBanner(theme) {
  ctx.fillStyle = "rgba(5, 7, 12, 0.72)";
  ctx.fillRect(250, 24, 300, 46);
  ctx.strokeStyle = theme.accent;
  ctx.strokeRect(250, 24, 300, 46);
  ctx.fillStyle = "#e7edf7";
  ctx.font = '16px "Courier New", monospace';
  ctx.fillText(
    `${REGION_THEMES[gameState.currentRegion].name}  WAVE ${String(gameState.wave).padStart(2, "0")}${gameState.isBossWave ? "  BOSS" : ""}`,
    268,
    52
  );
}

function drawRegionMarkers(theme) {
  ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
  for (let i = 0; i < 4; i += 1) {
    ctx.fillRect(220 + i * 120, 180 + (i % 2) * 36, 60, 2);
  }

  ctx.strokeStyle = theme.accent;
  ctx.strokeRect(610, 126, 118, 68);
  ctx.fillStyle = "#dfe7f4";
  ctx.font = '12px "Courier New", monospace';
  ctx.fillText(`REGION ${gameState.currentRegion}`, 630, 165);
}

function render() {
  if (window.mapSystem?.renderScene) {
    window.mapSystem.renderScene(ctx);
    return;
  }

  const theme = REGION_THEMES[gameState.currentRegion];
  drawBackground(theme);
  drawPath(theme);
  drawBase(theme);
  drawHero();
  drawWaveBanner(theme);
  drawRegionMarkers(theme);
}

let lastTimestamp = performance.now();

function frame(timestamp) {
  const deltaSeconds = Math.min(0.05, (timestamp - lastTimestamp) / 1000);
  lastTimestamp = timestamp;
  update(deltaSeconds);
  render();
  window.requestAnimationFrame(frame);
}

function bindUI() {
  document.getElementById("start-wave-button").addEventListener("click", () => {
    beginWave();
  });

  document.getElementById("damage-base-button").addEventListener("click", () => {
    damageBase(12);
  });

  document.getElementById("use-power-button").addEventListener("click", () => {
    usePower(2);
  });

  document.getElementById("reset-battle-button").addEventListener("click", () => {
    resetBattle();
  });
}

function renderGameToText() {
  return JSON.stringify({
    coordinateSystem: "origin top-left, +x right, +y down",
    region: gameState.currentRegion,
    wave: gameState.wave,
    maxWaves: gameState.maxWaves,
    isBossWave: gameState.isBossWave,
    waveActive: gameState.waveActive,
    baseHP: gameState.baseHP,
    maxBaseHP: gameState.maxBaseHP,
    power: {
      available: gameState.power,
      used: gameState.usedPower,
      max: gameState.maxPower,
    },
    hero: {
      x: Math.round(gameState.hero.x),
      y: Math.round(gameState.hero.y),
      hp: gameState.hero.hp,
    },
    regions: gameState.regions,
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

